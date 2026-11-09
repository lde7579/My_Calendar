# Step 4: api-routes

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md` (데이터 흐름 1·2단계, **에러 처리 표**, 환경 변수)
- `/docs/ADR.md` (ADR-005 라우트 2개 분리)
- `/src/types/index.ts` (step 1: `ChannelResponse`, `RecommendResponse`, `ErrorResponse`, `RecommendRequestSchema`)
- `/src/lib/analyze.ts` (step 1: `parseChannelInput`, `summarizeChannel`)
- `/src/services/youtube.ts` (step 2: `getChannel`, `getRecentVideos`, `getTrendingVideos`, `YouTubeError`)
- `/src/services/claude.ts` (step 3: `recommendNext`, `RecommendError`)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

API 라우트 2개를 **테스트 먼저(TDD)** 작성한다. 라우트는 입력 검증 → services/lib 호출 → JSON 응답만 한다.

### 1. `src/app/api/channel/route.ts`

```ts
export async function POST(request: Request): Promise<Response>;
// 요청 본문: { channel: string }
// 성공 200: ChannelResponse
// 실패: ErrorResponse + 상태 코드
```

순서:
1. `process.env.YOUTUBE_API_KEY`가 없으면 → 500 `"서버 설정(.env)의 YOUTUBE_API_KEY를 확인하세요"`
2. 본문 JSON 파싱 실패 또는 `channel`이 문자열이 아님, 또는 `parseChannelInput`이 `null` → 400 `"채널 ID(UC...) 또는 @핸들로 입력해 주세요"`
3. `getChannel` → `null`이면 404 `"채널을 찾을 수 없어요"`
4. `getRecentVideos(channel.uploadsPlaylistId)` → 0개면 422 `"분석할 영상이 없어요"`
5. `summarizeChannel` → `getTrendingVideos(summary.topCategoryId)`
6. 200 `{ summary, trending: videos, trendingFallback: fallback }`
- `YouTubeError`가 나면 → 502 `"YouTube 데이터를 가져오지 못했어요"`. 그 외 예상 못 한 에러도 502로 응답하고 `console.error`로 남긴다.

### 2. `src/app/api/recommend/route.ts`

```ts
export async function POST(request: Request): Promise<Response>;
// 요청 본문: { summary: ChannelSummary, trending: Video[] }
// 성공 200: RecommendResponse
```

순서:
1. `process.env.ANTHROPIC_API_KEY`가 없으면 → 500 `"서버 설정(.env)의 ANTHROPIC_API_KEY를 확인하세요"`
2. 본문을 `RecommendRequestSchema.safeParse`로 검증, 실패 → 400 `"요청 형식이 올바르지 않아요"`
3. `recommendNext(summary, trending)` → 200 결과
- `RecommendError` → 502, 메시지는 `RecommendError.message` 그대로. 그 외 에러 → 502 `"추천을 생성하지 못했어요"` + `console.error`.

두 라우트 모두 `export const maxDuration`이나 runtime 설정은 넣지 않는다 (기본 Node.js 런타임).

### 3. 테스트

- `tests/api/channel.test.ts`, `tests/api/recommend.test.ts`
- `vi.mock("@/services/youtube")`, `vi.mock("@/services/claude")`로 서비스를 mock하고 (에러 클래스는 실제 것을 쓰도록 `importOriginal` 활용), `vi.stubEnv`로 API 키를 설정한다.
- `POST(new Request("http://localhost/api/channel", { method: "POST", body: JSON.stringify({...}) }))`를 직접 호출해 상태 코드와 본문을 확인한다.
- ARCHITECTURE.md 에러 처리 표의 모든 행(400/404/422/500/502)과 200 성공 케이스, `trendingFallback` 전달을 검증한다.

## Acceptance Criteria

```bash
npm run test    # api + 기존 테스트 통과
npm run build   # 컴파일 에러 없음 (.env 값이 비어 있어도 성공)
npm run lint    # 에러 없음
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 라우트에 집계·프롬프트 로직이 섞이지 않았는가? (lib/services 호출만)
   - 에러 응답이 모두 `{ error: string }` 형식이고 API 키나 내부 스택을 노출하지 않는가?
   - CLAUDE.md CRITICAL 규칙(키는 서버에서만, 테스트에서 실 API 호출 금지)을 지켰는가?
3. 결과에 따라 `phases/0-mvp/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (라우트 경로, 요청/응답 형식, 상태 코드 포함)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 라우트를 2개보다 늘리거나 하나로 합치지 마라. 이유: ADR-005 (2단계 로딩, "다른 추천 받기"는 recommend만 재호출).
- 미들웨어, 인증, rate limit, 응답 캐시(`revalidate`, `unstable_cache` 등)를 넣지 마라. 이유: MVP 오버엔지니어링 금지.
- 에러 메시지에 `error.message` 원문(YouTube/Anthropic 내부 메시지)을 그대로 내보내지 마라 (`RecommendError` 제외). 이유: 내부 정보 노출 방지, 사용자에게는 한국어 안내만 보여준다.
- 기존 테스트를 깨뜨리지 마라
