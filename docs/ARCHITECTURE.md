# 아키텍처

> MVP 원칙: 페이지 1개, API 라우트 2개, 서비스 파일 2개, 순수 함수 파일 1개. 이 이상 늘리지 않는다.

## 디렉토리 구조
```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                # 유일한 페이지 ('use client': 입력 폼 + 결과 표시)
│   └── api/
│       ├── channel/route.ts    # POST: 채널 + 최근 영상 + 인기 급상승 → 요약 반환 (빠름, 1~2초)
│       └── recommend/route.ts  # POST: 요약 + 인기 급상승 → Claude 추천 반환 (느림, 10~40초)
├── components/                 # page.tsx가 길어질 때만 분리 (ChannelSummary, RecommendationList, TrendingList)
├── types/
│   └── index.ts                # 도메인 타입 + Zod 스키마
├── lib/
│   └── analyze.ts              # 순수 함수: 영상 목록 → 채널 요약 (외부 호출 없음)
└── services/
    ├── youtube.ts              # YouTube Data API v3 (fetch)
    └── claude.ts               # Claude API (@anthropic-ai/sdk)
tests/                          # Vitest 테스트 (lib, services, api 라우트)
```

## 레이어 규칙
```
page.tsx (Client) ──fetch──▶ app/api/*/route.ts ──▶ services/*  ──▶ 외부 API
                                     │
                                     └──────────▶ lib/analyze.ts (순수 함수)
```
- `services/`: 외부 API 호출 + 응답을 `types/`의 도메인 타입으로 변환만 한다. 집계·계산 로직을 넣지 않는다.
- `lib/`: 계산만 한다 (키워드 집계, 주력 카테고리, 평균 조회수, TOP3). `fetch` 금지.
- `app/api/`: 입력 검증 → services/lib 호출 → JSON 응답. 에러를 HTTP 상태 코드로 바꾼다.
- `page.tsx`: 화면 상태와 렌더링만 한다. services를 import하지 않는다.

## 데이터 흐름 (2단계 로딩)
```
[1단계] page.tsx ── POST /api/channel { channel } ──▶
          youtube.getChannel(channel)                 # channels.list (id= 또는 forHandle=)
          youtube.getRecentVideos(uploadsPlaylistId)  # playlistItems.list → videos.list (최대 20개)
          analyze.summarizeChannel(channel, videos)   # → ChannelSummary (topCategoryId 포함)
          youtube.getTrendingVideos(topCategoryId)    # videos.list chart=mostPopular regionCode=KR
                                                      #  └ 에러/빈 결과 → 카테고리 없이 재조회, fallback=true
        ◀── { summary, trending, trendingFallback }
        → 채널 요약과 인기 급상승 목록을 먼저 렌더링

[2단계] page.tsx ── POST /api/recommend { summary, trending } ──▶
          claude.recommendNext(summary, trending)     # messages.parse + Zod 스키마
        ◀── { analysis, recommendations[3~5] }
        → 추천 렌더링. "다른 추천 받기"는 2단계만 다시 호출한다.
```
- 1단계 결과는 클라이언트 `useState`에 보관했다가 2단계 요청 본문으로 그대로 보낸다 (서버 저장 없음).
- YouTube 쿼터: 분석 1회 ≈ 4 units. `search.list`(100 units)는 사용하지 않는다.

## 에러 처리
| 상황 | 라우트 응답 | 화면 |
|------|------------|------|
| 입력 형식 오류 (`UC`로 시작하는 ID도, `@핸들`도 아님) | 400 | 입력창 아래 안내 |
| 채널 없음 | 404 | "채널을 찾을 수 없어요" |
| 최근 영상 0개 | 422 | "분석할 영상이 없어요" |
| YouTube/Claude 호출 실패, Claude 거절(`stop_reason: "refusal"`) | 502 | 채널 요약은 유지하고 "추천 다시 시도" 버튼 표시 |
| API 키 미설정 | 500 | "서버 설정(.env)을 확인하세요" |

에러 응답 형식: `{ error: string }` (사용자에게 보여줄 한국어 메시지)

## 상태 관리
- 서버: 상태 없음 (캐시·DB 없음)
- 클라이언트: `page.tsx`의 `useState`만 사용한다. 상태 관리 라이브러리를 쓰지 않는다.
  - `channelState`: `idle | loading | success | error` + 데이터
  - `recommendState`: `idle | loading | success | error` + 데이터

## 환경 변수 (`.env`는 Git 제외, 형식은 `.env.example` 참고)
| 이름 | 용도 |
|------|------|
| `YOUTUBE_API_KEY` | YouTube Data API v3 키 |
| `NEXT_PUBLIC_DEFAULT_CHANNEL` | 입력창 기본값 (선택, 내 채널 ID 또는 @핸들). 브라우저에 노출되는 값이므로 비밀 값을 넣지 말 것 |
| `ANTHROPIC_API_KEY` | Claude API 키 |
