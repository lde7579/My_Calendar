import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  RecommendationResultSchema,
  type ChannelSummary,
  type RecommendationResult,
  type Video,
} from "@/types";

export const MODEL = "claude-opus-5-5";

const MAX_RECOMMENDATIONS = 5;
const TRENDING_TAG_LIMIT = 5;

export class RecommendError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RecommendError";
  }
}

const SYSTEM_PROMPT = `당신은 한국 유튜브 크리에이터를 돕는 콘텐츠 기획자입니다.
사용자의 채널 요약과 현재 한국 인기 급상승 영상 목록을 보고, 이 채널이 다음에 만들 영상을 추천합니다.

출력 규칙:
- analysis: 채널의 강점과 현재 인기 급상승 흐름을 연결한 2~4문장의 분석 코멘트.
- recommendations: 3~5개의 추천.
  - title: 실제로 그대로 업로드할 수 있는 영상 제목안.
  - concept: 한 줄 컨셉과 형식 제안(쇼츠 또는 롱폼)을 함께 적는다. 예: "롱폼 — ...".
  - reason: "내 채널 근거"(이미 잘 되는 영상·키워드·포맷)와 "참고한 인기 영상 근거"를 모두 포함한다.
  - referenceVideoIds: 참고한 인기 영상의 id. 반드시 아래 인기 급상승 목록에 있는 id만 사용한다. 참고한 영상이 없으면 빈 배열.

기획 원칙:
- 채널의 주제와 동떨어진 주제는 피한다.
- 채널이 이미 잘하는 포맷과 키워드를 현재 인기 흐름과 결합한다.
- 모든 내용은 한국어로 작성한다.`;

/**
 * 채널 요약과 인기 급상승 영상으로 다음 콘텐츠 추천을 생성한다.
 * 응답은 Zod 스키마로 검증되고, 모델이 지어낸 참고 영상 ID는 제거된다.
 */
export async function recommendNext(
  summary: ChannelSummary,
  trending: Video[],
  client: Anthropic = new Anthropic(), // ANTHROPIC_API_KEY를 SDK가 환경 변수에서 읽는다
): Promise<RecommendationResult> {
  let response;
  try {
    response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(summary, trending) }],
      output_config: {
        effort: "medium",
        format: zodOutputFormat(RecommendationResultSchema),
      },
    });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      throw new RecommendError("추천 서버 호출에 실패했어요", { cause: error });
    }
    throw error;
  }

  if (response.stop_reason === "refusal") {
    throw new RecommendError("추천을 생성할 수 없는 요청이에요");
  }
  if (response.stop_reason === "max_tokens" || response.parsed_output === null) {
    throw new RecommendError("추천 결과를 읽지 못했어요");
  }

  const trendingIds = new Set(trending.map((video) => video.id));
  const recommendations = response.parsed_output.recommendations
    .slice(0, MAX_RECOMMENDATIONS)
    .map((recommendation) => ({
      ...recommendation,
      referenceVideoIds: recommendation.referenceVideoIds.filter((id) => trendingIds.has(id)),
    }));

  if (recommendations.length === 0) {
    throw new RecommendError("추천 결과가 비어 있어요");
  }

  return { analysis: response.parsed_output.analysis, recommendations };
}

function buildUserPrompt(summary: ChannelSummary, trending: Video[]): string {
  const topVideos = summary.topVideos
    .map((video, i) => `${i + 1}. ${video.title} (조회수 ${video.viewCount})`)
    .join("\n");
  const recentTitles = summary.recentTitles.map((title) => `- ${title}`).join("\n");
  const trendingList = trending
    .map((video) =>
      [
        `- id: ${video.id}`,
        `  제목: ${video.title}`,
        `  채널: ${video.channelTitle}`,
        `  조회수: ${video.viewCount}`,
        `  태그: ${video.tags.slice(0, TRENDING_TAG_LIMIT).join(", ") || "없음"}`,
      ].join("\n"),
    )
    .join("\n");

  return `## 내 채널
채널명: ${summary.title}
구독자 수: ${summary.subscriberCount}
주력 카테고리 ID: ${summary.topCategoryId}
자주 쓰는 키워드: ${summary.topKeywords.join(", ") || "없음"}
평균 조회수: ${summary.averageViews} (최근 ${summary.videoCount}개 영상 기준)

조회수 상위 영상:
${topVideos || "없음"}

최근 영상 제목:
${recentTitles || "없음"}

## 현재 인기 급상승 영상 (KR)
${trendingList || "없음"}

위 정보를 바탕으로 이 채널의 다음 콘텐츠를 추천해 주세요.`;
}
