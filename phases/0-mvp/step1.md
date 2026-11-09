# Step 1: domain-core

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/PRD.md` (핵심 기능 1번: 채널 요약에 표시할 항목)
- `/docs/ARCHITECTURE.md` (레이어 규칙: `lib/`는 순수 함수만)
- `/docs/ADR.md`
- `/package.json`, `/vitest.config.ts`, `/tsconfig.json` (step 0에서 생성)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

도메인 타입과 채널 요약 순수 함수를 **테스트 먼저(TDD)** 작성한다. 외부 API 호출은 없다.

### 1. `src/types/index.ts`

```ts
import { z } from "zod";

export interface Channel {
  id: string;
  title: string;
  subscriberCount: number;
  uploadsPlaylistId: string;
  thumbnailUrl: string;
}

export interface Video {
  id: string;
  title: string;
  channelTitle: string;
  categoryId: string;
  tags: string[];
  viewCount: number;
  publishedAt: string;   // ISO 8601
  thumbnailUrl: string;
}

export interface ChannelSummary {
  channelId: string;
  title: string;
  subscriberCount: number;
  thumbnailUrl: string;
  videoCount: number;        // 분석에 쓴 영상 수
  topCategoryId: string;     // 가장 많이 나온 categoryId
  topKeywords: string[];     // 최대 10개
  averageViews: number;      // 정수 (반올림)
  topVideos: Video[];        // 조회수 상위 최대 3개
  recentTitles: string[];    // 분석한 영상 제목 전체 (입력 순서 유지)
}

export type ChannelInput =
  | { type: "id"; value: string }      // "UC..."
  | { type: "handle"; value: string }; // "@..." (앞의 @ 포함)

// Claude 구조화 출력 스키마 (step 3에서 사용)
export const RecommendationSchema = z.object({
  title: z.string(),
  concept: z.string(),
  reason: z.string(),
  referenceVideoIds: z.array(z.string()),
});
export const RecommendationResultSchema = z.object({
  analysis: z.string(),
  recommendations: z.array(RecommendationSchema),
});
export type Recommendation = z.infer<typeof RecommendationSchema>;
export type RecommendationResult = z.infer<typeof RecommendationResultSchema>;

// API 응답 타입 (step 4에서 사용)
export interface ChannelResponse {
  summary: ChannelSummary;
  trending: Video[];
  trendingFallback: boolean;
}
export type RecommendResponse = RecommendationResult;
export interface ErrorResponse { error: string }
```

위 타입은 이 형태 그대로 만든다 (이후 step들이 이 이름과 필드에 의존한다). `ChannelSummary`/`Video`를 검증하는 Zod 스키마(`/api/recommend` 요청 본문 검증용)도 같은 파일에 `ChannelSummarySchema`, `VideoSchema`, `RecommendRequestSchema = z.object({ summary: ChannelSummarySchema, trending: z.array(VideoSchema) })`로 정의한다.

**주의**: `RecommendationResultSchema`에 `.min()`, `.max()`, `.length()` 같은 개수·길이 제약을 넣지 마라. 이유: Claude 구조화 출력은 이 제약을 지원하지 않아 SDK가 클라이언트 쪽 검증으로 돌리고, 모델이 6개를 주면 파싱 전체가 실패한다. 개수(3~5개)는 프롬프트와 step 3의 후처리로 맞춘다.

### 2. `src/lib/analyze.ts`

```ts
export function parseChannelInput(raw: string): ChannelInput | null;
export function summarizeChannel(channel: Channel, videos: Video[]): ChannelSummary;
```

규칙:
- `parseChannelInput`
  - 앞뒤 공백 제거 후 판단한다.
  - `UC`로 시작하고 총 24자, 나머지가 `[A-Za-z0-9_-]` → `{ type: "id" }`
  - `@`로 시작하고 공백이 없으며 `@` 뒤에 1자 이상 → `{ type: "handle", value: "@..." }` (한글 핸들 허용)
  - 그 외(빈 문자열, URL, 공백 포함 등) → `null`
- `summarizeChannel`
  - `videos`는 최신순으로 들어온다고 가정한다. 빈 배열이면 `Error`를 던진다 (호출 측이 미리 막는다).
  - `topCategoryId`: 가장 많이 등장한 `categoryId`. 동점이면 배열에서 먼저 나온 것.
  - `topKeywords`: 모든 영상 `tags`의 등장 횟수(대소문자 무시, 공백 trim, 원래 표기는 처음 나온 것 유지) 내림차순 상위 10개. 동점이면 먼저 나온 순. **태그가 전부 비어 있으면** 제목을 공백으로 나눈 단어(특수문자 `[]()#|,.!?"'` 제거, 2글자 이상)로 같은 방식으로 집계한다.
  - `averageViews`: `viewCount` 평균을 `Math.round`
  - `topVideos`: `viewCount` 내림차순 상위 3개 (영상이 3개 미만이면 전부)
  - `recentTitles`: 입력 순서 그대로 제목 배열

### 3. 테스트 (먼저 작성)

- `tests/lib/analyze.test.ts`: 위 규칙 각각에 대한 케이스 (UC ID 정상/길이 오류, 한글 핸들, URL 거부, 카테고리 동점, 태그 대소문자 합산, 태그 없을 때 제목 대체, 평균 반올림, 영상 2개일 때 topVideos 2개, 빈 배열 에러).
- 테스트용 `Video` 생성 헬퍼는 테스트 파일 안에 둔다.
- `tests/smoke.test.ts`는 삭제한다.

## Acceptance Criteria

```bash
npm run test    # analyze 테스트 전부 통과
npm run build   # 컴파일 에러 없음
npm run lint    # 에러 없음
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `src/lib/analyze.ts`에 `fetch`, `process.env`, 외부 import(zod·types 제외)가 없는가?
   - 타입 이름과 필드가 위 명세와 정확히 같은가?
   - CLAUDE.md CRITICAL 규칙(TDD, MVP)을 위반하지 않았는가?
3. 결과에 따라 `phases/0-mvp/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (생성 파일과 export 이름 포함)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 형태소 분석기, 불용어 사전, 다른 NLP 패키지를 쓰지 마라. 이유: MVP. 단순 빈도 집계로 충분하다.
- `src/services/`, `src/app/api/` 파일을 만들지 마라. 이유: 다음 step의 scope다.
- 위 명세에 없는 필드(참여율, 업로드 주기 등)를 `ChannelSummary`에 추가하지 마라. 이유: PRD 범위 밖이고 이후 step이 이 타입에 의존한다.
- 기존 테스트를 깨뜨리지 마라
