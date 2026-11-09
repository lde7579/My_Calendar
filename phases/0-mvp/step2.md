# Step 2: youtube-service

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md` (데이터 흐름 1단계, 레이어 규칙)
- `/docs/ADR.md` (ADR-002 fetch 직접 호출, ADR-003 인기 급상승 기준, ADR-006 테스트 mock)
- `/src/types/index.ts` (step 1: `Channel`, `Video`, `ChannelInput`)
- `/src/lib/analyze.ts` (step 1)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

`src/services/youtube.ts`에 YouTube Data API v3 래퍼를 **테스트 먼저(TDD)** 작성한다. 전역 `fetch`를 사용하고, 테스트에서는 `vi.stubGlobal("fetch", ...)` 또는 `vi.spyOn(globalThis, "fetch")`로 mock한다.

```ts
const BASE_URL = "https://www.googleapis.com/youtube/v3";

export class YouTubeError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function getChannel(input: ChannelInput, apiKey: string): Promise<Channel | null>;
export async function getRecentVideos(uploadsPlaylistId: string, apiKey: string, max?: number /* 기본 20 */): Promise<Video[]>;
export async function getTrendingVideos(categoryId: string, apiKey: string, max?: number /* 기본 20 */): Promise<{ videos: Video[]; fallback: boolean }>;
```

엔드포인트와 규칙:
- `getChannel`: `GET /channels?part=snippet,statistics,contentDetails&key=...` + 입력이 id면 `id=UC...`, handle이면 `forHandle=@...` (URL 인코딩). `items`가 없거나 비면 `null`.
  - `subscriberCount`: `statistics.subscriberCount`를 숫자로 (숨김 등으로 없으면 0)
  - `uploadsPlaylistId`: `contentDetails.relatedPlaylists.uploads`
- `getRecentVideos`: `GET /playlistItems?part=contentDetails&maxResults={max}&playlistId=...` → `contentDetails.videoId` 목록 → `GET /videos?part=snippet,statistics&id={쉼표로 연결}`. 반환 순서는 playlistItems 순서(최신순)를 유지한다. 영상이 0개면 `/videos`를 호출하지 않고 `[]`.
- `getTrendingVideos`: `GET /videos?part=snippet,statistics&chart=mostPopular&regionCode=KR&maxResults={max}&videoCategoryId={categoryId}`.
  - 응답이 HTTP 에러이거나 `items`가 비면 `videoCategoryId` 없이 한 번만 다시 조회하고 `fallback: true`.
  - 다시 조회한 것도 HTTP 에러면 `YouTubeError`를 던진다.
- 공통 매핑 (`/videos` 응답 item → `Video`, 내부 헬퍼 함수 1개로 처리):
  - `viewCount`: `statistics.viewCount` 숫자 변환, 없으면 0
  - `tags`: `snippet.tags` 없으면 `[]`
  - `thumbnailUrl`: `snippet.thumbnails.medium?.url ?? snippet.thumbnails.default?.url ?? ""`
- HTTP 응답이 `!ok`면(위 trending 재조회 경우 제외) `YouTubeError(메시지, response.status)`를 던진다. 메시지에 API 키를 넣지 마라.
- YouTube API 응답용 타입은 이 파일 안에 필요한 필드만 최소로 정의한다 (export 불필요).

테스트 `tests/services/youtube.test.ts`:
- id / handle 입력 시 요청 URL 쿼리 파라미터 확인 (`id=` vs `forHandle=`, `key=` 포함)
- 채널 없음 → `null`
- 최근 영상: playlist 순서 유지, 누락 필드(tags, viewCount) 기본값, 0개면 `/videos` 미호출
- 인기 급상승: 정상 → `fallback: false` / 빈 결과 → 카테고리 없이 재조회 + `fallback: true` / 첫 호출 400 → 재조회 / 재조회도 실패 → `YouTubeError`
- `!ok` → `YouTubeError`의 `status` 확인

## Acceptance Criteria

```bash
npm run test    # youtube + 기존 analyze 테스트 통과
npm run build   # 컴파일 에러 없음
npm run lint    # 에러 없음
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `services/youtube.ts`가 API 호출 + 타입 변환만 하고, 집계 로직(평균, 순위)은 없는가?
   - `process.env`를 읽지 않고 `apiKey`를 인자로 받는가?
   - 테스트가 실제 네트워크를 호출하지 않는가?
3. 결과에 따라 `phases/0-mvp/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (export 함수 시그니처 포함)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `googleapis` 등 YouTube SDK 패키지를 설치하지 마라. 이유: ADR-002.
- `search.list` 엔드포인트를 쓰지 마라. 이유: 호출당 100 units로 쿼터를 크게 소모한다 (ADR-003).
- 캐시, 재시도 루프(위 trending 1회 재조회 외), rate limiter를 넣지 마라. 이유: MVP 오버엔지니어링 금지.
- 실제 `YOUTUBE_API_KEY`로 API를 호출하는 테스트를 만들지 마라. 이유: CLAUDE.md CRITICAL 규칙.
- 기존 테스트를 깨뜨리지 마라
