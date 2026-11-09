# Step 3: claude-service

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/PRD.md` (핵심 기능 3번: 추천 형식, 쇼츠/롱폼 제안)
- `/docs/ADR.md` (ADR-004 Claude 사용 규칙 — 반드시 지킬 것)
- `/src/types/index.ts` (step 1: `ChannelSummary`, `Video`, `RecommendationResultSchema`, `RecommendationResult`)
- `/src/services/youtube.ts` (step 2: 서비스 파일 작성 스타일 참고)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

`src/services/claude.ts`에 추천 생성 함수를 **테스트 먼저(TDD)** 작성한다.

```ts
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

export const MODEL = "claude-opus-5-5";

export class RecommendError extends Error {}

export async function recommendNext(
  summary: ChannelSummary,
  trending: Video[],
  client: Anthropic = new Anthropic(), // ANTHROPIC_API_KEY를 SDK가 환경 변수에서 읽는다
): Promise<RecommendationResult>;
```

API 호출 형태 (이 형태를 지킨다):
```ts
const response = await client.messages.parse({
  model: MODEL,
  max_tokens: 16000,
  system: SYSTEM_PROMPT,
  messages: [{ role: "user", content: buildUserPrompt(summary, trending) }],
  output_config: {
    effort: "medium",
    format: zodOutputFormat(RecommendationResultSchema),
  },
});
```

처리 규칙:
1. `response.stop_reason === "refusal"` → `RecommendError("추천을 생성할 수 없는 요청이에요")`
2. `response.stop_reason === "max_tokens"` 또는 `response.parsed_output`이 `null` → `RecommendError("추천 결과를 읽지 못했어요")`
3. 후처리 (데이터 무결성):
   - 각 추천의 `referenceVideoIds`에서 `trending`에 없는 ID를 제거한다 (모델이 지어낸 ID 방지)
   - `recommendations`가 5개를 넘으면 앞의 5개만 남긴다
   - `recommendations`가 0개면 `RecommendError("추천 결과가 비어 있어요")`
4. SDK의 API 에러(`Anthropic.APIError` 계열)는 잡아서 `RecommendError("추천 서버 호출에 실패했어요")`로 바꿔 던진다. 원본 에러는 `cause`로 남긴다.

프롬프트 (`SYSTEM_PROMPT` 상수 + `buildUserPrompt` 내부 함수, 한국어):
- 역할: 한국 유튜브 크리에이터를 돕는 콘텐츠 기획자
- 출력: `analysis`는 채널의 강점과 현재 인기 급상승 흐름을 연결한 2~4문장. `recommendations`는 **3~5개**.
- 각 추천: `title`은 실제 업로드할 수 있는 영상 제목안, `concept`은 한 줄 컨셉 + 형식 제안(쇼츠 또는 롱폼), `reason`은 "내 채널 근거 + 참고한 인기 영상 근거"를 모두 포함, `referenceVideoIds`는 **아래 인기 급상승 목록에 있는 id만** 사용.
- 채널과 동떨어진 주제는 피하고, 채널이 이미 잘하는 포맷을 인기 흐름과 결합하라는 지시.
- `buildUserPrompt`에는 summary(채널명, 구독자 수, 주력 카테고리 ID, 키워드, 평균 조회수, TOP3 제목+조회수, 최근 제목 목록)와 trending(id, 제목, 채널명, 조회수, 태그 앞 5개)을 읽기 쉬운 텍스트로 넣는다.

테스트 `tests/services/claude.test.ts`:
- 가짜 client 객체 `{ messages: { parse: vi.fn() } }`를 만들어 `as unknown as Anthropic`로 주입한다.
- 호출 파라미터 확인: `model === "claude-opus-5-5"`, `output_config.effort === "medium"`, `output_config.format` 존재, 프롬프트에 채널명과 trending id 포함
- 정상 응답 → 결과 반환
- 존재하지 않는 referenceVideoId 제거
- 6개 → 5개로 자르기
- refusal / parsed_output null / 0개 → `RecommendError`
- parse가 `Anthropic.APIError`를 던지면 → `RecommendError`

## Acceptance Criteria

```bash
npm run test    # claude + 기존 테스트 통과
npm run build   # 컴파일 에러 없음
npm run lint    # 에러 없음
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ADR-004 금지 파라미터를 쓰지 않았는가?
   - 테스트가 실제 Claude API를 호출하지 않는가? (`ANTHROPIC_API_KEY` 없이 통과해야 함)
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
3. 결과에 따라 `phases/0-mvp/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (export 이름, 에러 클래스, 후처리 규칙 포함)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `thinking` 파라미터, `temperature`/`top_p`/`top_k`, `budget_tokens`, assistant prefill(마지막 메시지를 assistant로 두기)을 쓰지 마라. 이유: `claude-opus-5-5`는 이것들을 400 에러로 거부한다 (ADR-004).
- 모델 ID에 날짜 접미사를 붙이거나 다른 모델로 바꾸지 마라. 이유: ADR-004.
- `tool_choice: { type: "any" }` / `{ type: "tool" }`로 JSON을 강제하지 마라. 이유: 이 모델은 400을 반환한다. JSON은 `output_config.format`으로 받는다.
- 응답 텍스트를 직접 `JSON.parse`하거나 정규식으로 파싱하지 마라. 이유: `messages.parse`가 스키마 검증까지 처리한다.
- 스트리밍, 캐싱, 재시도 로직을 직접 구현하지 마라. 이유: MVP. SDK 기본 재시도(2회)로 충분하다.
- 기존 테스트를 깨뜨리지 마라
