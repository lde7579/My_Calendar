# Step 5: dashboard-ui

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/PRD.md` (핵심 기능 4~6, **유저 플로우**)
- `/docs/UI_GUIDE.md` (색상, 컴포넌트 클래스, 금지 패턴 — 반드시 지킬 것)
- `/docs/ARCHITECTURE.md` (상태 관리: `channelState`, `recommendState`)
- `/src/types/index.ts` (step 1: `ChannelResponse`, `RecommendResponse`, `ErrorResponse`)
- `/src/app/api/channel/route.ts`, `/src/app/api/recommend/route.ts` (step 4: 요청/응답 형식, 에러 코드)
- `/src/app/layout.tsx`, `/src/app/page.tsx`, `/src/app/globals.css` (step 0)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

`src/app/page.tsx`를 실제 대시보드로 교체한다. `'use client'` 컴포넌트 1개 + 필요하면 `src/components/`에 표시 전용 컴포넌트 최대 3개(`ChannelSummary.tsx`, `RecommendationList.tsx`, `TrendingList.tsx`).

### 화면 구성 (위에서 아래로, 좌측 정렬, `max-w-5xl mx-auto px-6 py-10 space-y-8`)

```
YouTube Next Content
채널 ID 또는 @핸들
[ 입력창 (기본값: process.env.NEXT_PUBLIC_DEFAULT_CHANNEL ?? "") ] [분석하기]
(입력/채널 에러 문구)

── 내 채널 ──          채널명 · 카테고리 이름(categoryName), 구독자 / 평균 조회수 / 분석 영상 수(큰 숫자),
                      키워드 칩, 조회수 TOP 3 (제목 + 조회수)
── 분석 코멘트 ──       analysis 문단
── 다음 콘텐츠 추천 ──   [다른 추천 받기]  카드 3~5개: 번호. 제목 [복사] / 컨셉 / 이유 / 참고 영상 링크
── 참고한 인기 급상승 ── (fallback이면 "카테고리 차트가 없어 전체 인기 급상승 기준" 표시)
                      표: 썸네일(w-24) / 제목 / 채널명 / 조회수
```

### 동작 (PRD 유저 플로우 그대로)

1. [분석하기] (폼 submit, Enter 지원) → `channelState = loading`, 추천 상태 초기화 → `POST /api/channel`
   - 실패 → 응답의 `error` 문구를 입력창 아래에 표시
   - 성공 → 내 채널 요약 + 인기 급상승 목록을 **즉시** 렌더링하고, 이어서 자동으로 2번 실행
2. 추천 요청 → `recommendState = loading` → `POST /api/recommend` (본문: `{ summary, trending }` — 1단계 결과 그대로)
   - 로딩 중: 추천 섹션에 "추천 생성 중… 보통 20~30초" 문구
   - 실패: 에러 문구 + [추천 다시 시도] 버튼 (채널 요약은 유지)
   - 성공: 분석 코멘트 + 추천 카드
3. [다른 추천 받기] → 2번만 다시 실행 (YouTube 재조회 없음). 로딩 중에는 비활성화.
4. [복사] → `navigator.clipboard.writeText(title)`, 버튼 텍스트를 1.5초간 "복사됨"으로 바꾼다.
5. 참고 영상 링크: `referenceVideoIds`를 trending에서 찾아 제목을 보여주고 `https://www.youtube.com/watch?v={id}` 새 탭(`target="_blank" rel="noreferrer"`).
6. 로딩 중 [분석하기] 버튼은 비활성화하고 텍스트를 "분석 중…"으로 바꾼다.
7. 숫자 표시: 1만 이상은 "12.3만" 형식, 그 미만은 `toLocaleString("ko-KR")`. 이 포맷 함수는 `src/lib/format.ts`의 `formatCount(n: number): string`로 만들고 `tests/lib/format.test.ts`를 **먼저** 작성한다 (예: 950 → "950", 12345 → "1.2만", 123456 → "12.3만", 100000000 → "1억").
8. 카테고리 표시: 같은 파일에 `categoryName(id: string): string`을 만든다. YouTube 기본 카테고리 ID를 한국어 이름으로 바꾸는 상수 객체(1 영화/애니메이션, 2 자동차, 10 음악, 15 동물, 17 스포츠, 19 여행/이벤트, 20 게임, 22 인물/블로그, 23 코미디, 24 엔터테인먼트, 25 뉴스/정치, 26 노하우/스타일, 27 교육, 28 과학기술)로 처리하고, 없는 ID는 `카테고리 {id}`를 반환한다. API 호출로 카테고리 이름을 가져오지 마라.

### 스타일

- `docs/UI_GUIDE.md`의 카드/버튼/입력/칩/타이포 클래스를 그대로 쓴다.
- 결과 영역만 `fade-in 0.3s` (globals.css에 keyframes 1개) 허용.

## Acceptance Criteria

```bash
npm run test    # format + 기존 테스트 통과
npm run build   # 컴파일 에러 없음
npm run lint    # 에러 없음
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `page.tsx`와 `components/`가 `@/services/*`를 import하지 않는가? (`grep -r "services" src/app/page.tsx src/components` 결과 없음)
   - UI_GUIDE의 금지 패턴(blur, gradient-text, 글로우, 보라/인디고, rounded-2xl, gradient orb, 스피너)이 없는가?
   - 상태 관리 라이브러리 없이 `useState`만 썼는가?
3. 결과에 따라 `phases/0-mvp/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단
   - 실제 API 키로 화면을 확인하는 것은 사용자가 `npm run dev`로 직접 한다. 키가 없다는 이유로 blocked 처리하지 마라.

## 금지사항

- 상태 관리 라이브러리(zustand, redux, react-query, swr 등)나 UI 라이브러리(shadcn, MUI 등), 아이콘 패키지를 설치하지 마라. 이유: ADR 허용 패키지 외 금지, MVP.
- 라우팅·페이지를 추가하지 마라 (결과 상세 페이지, 히스토리 등). 이유: PRD상 페이지는 1개.
- `localStorage` 저장, 결과 히스토리 기능을 넣지 마라. 이유: PRD MVP 제외 사항.
- 스피너·스켈레톤·진행률 바 애니메이션을 넣지 마라. 이유: UI_GUIDE 애니메이션 규칙.
- 기존 테스트를 깨뜨리지 마라
