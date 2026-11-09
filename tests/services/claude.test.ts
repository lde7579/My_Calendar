import Anthropic from "@anthropic-ai/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MODEL, RecommendError, recommendNext } from "@/services/claude";
import type { ChannelSummary, Recommendation, RecommendationResult, Video } from "@/types";

function video(id: string, overrides: Partial<Video> = {}): Video {
  return {
    id,
    title: `title-${id}`,
    channelTitle: `channel-${id}`,
    categoryId: "20",
    tags: ["t1", "t2", "t3", "t4", "t5", "t6"],
    viewCount: 1000,
    publishedAt: "2026-11-01T00:00:00Z",
    thumbnailUrl: `https://img/${id}.jpg`,
    ...overrides,
  };
}

const summary: ChannelSummary = {
  channelId: "UC123",
  title: "테스트채널",
  subscriberCount: 12345,
  thumbnailUrl: "https://img/ch.jpg",
  videoCount: 3,
  topCategoryId: "20",
  topKeywords: ["게임", "공략"],
  averageViews: 5000,
  topVideos: [video("my1", { title: "내 인기 영상", viewCount: 9000 })],
  recentTitles: ["최근 영상 1", "최근 영상 2"],
};

const trending: Video[] = [video("tr1"), video("tr2")];

function rec(n: number, referenceVideoIds: string[] = ["tr1"]): Recommendation {
  return {
    title: `추천 ${n}`,
    concept: `컨셉 ${n} (롱폼)`,
    reason: `이유 ${n}`,
    referenceVideoIds,
  };
}

function parsedResponse(
  parsed: RecommendationResult | null,
  stopReason: string = "end_turn",
) {
  return { stop_reason: stopReason, parsed_output: parsed, content: [] };
}

const parse = vi.fn();
const client = { messages: { parse } } as unknown as Anthropic;

beforeEach(() => {
  parse.mockReset();
});

describe("recommendNext", () => {
  it("올바른 모델·effort·format과 채널/인기 영상 정보가 담긴 프롬프트로 호출한다", async () => {
    parse.mockResolvedValue(
      parsedResponse({ analysis: "분석", recommendations: [rec(1), rec(2), rec(3)] }),
    );

    await recommendNext(summary, trending, client);

    expect(parse).toHaveBeenCalledTimes(1);
    const params = parse.mock.calls[0][0];
    expect(params.model).toBe("claude-opus-5-5");
    expect(MODEL).toBe("claude-opus-5-5");
    expect(params.max_tokens).toBe(16000);
    expect(params.output_config.effort).toBe("medium");
    expect(params.output_config.format).toBeDefined();
    expect(typeof params.system).toBe("string");

    // 금지 파라미터 미사용 (ADR-004)
    expect(params).not.toHaveProperty("thinking");
    expect(params).not.toHaveProperty("temperature");
    expect(params).not.toHaveProperty("top_p");
    expect(params).not.toHaveProperty("top_k");
    expect(params).not.toHaveProperty("tool_choice");

    // 마지막 메시지는 user (assistant prefill 금지)
    expect(params.messages).toHaveLength(1);
    expect(params.messages[0].role).toBe("user");
    const prompt: string = params.messages[0].content;
    expect(prompt).toContain("테스트채널");
    expect(prompt).toContain("tr1");
    expect(prompt).toContain("tr2");
    expect(prompt).toContain("내 인기 영상");
    // 태그는 앞 5개만
    expect(prompt).toContain("t5");
    expect(prompt).not.toContain("t6");
  });

  it("정상 응답이면 결과를 그대로 반환한다", async () => {
    const result: RecommendationResult = {
      analysis: "채널 분석 코멘트",
      recommendations: [rec(1), rec(2, ["tr1", "tr2"]), rec(3, [])],
    };
    parse.mockResolvedValue(parsedResponse(result));

    await expect(recommendNext(summary, trending, client)).resolves.toEqual(result);
  });

  it("trending에 없는 referenceVideoId를 제거한다", async () => {
    parse.mockResolvedValue(
      parsedResponse({
        analysis: "분석",
        recommendations: [rec(1, ["tr1", "fake"]), rec(2, ["nope"]), rec(3, ["tr2"])],
      }),
    );

    const result = await recommendNext(summary, trending, client);
    expect(result.recommendations.map((r) => r.referenceVideoIds)).toEqual([
      ["tr1"],
      [],
      ["tr2"],
    ]);
  });

  it("추천이 5개를 넘으면 앞의 5개만 남긴다", async () => {
    parse.mockResolvedValue(
      parsedResponse({
        analysis: "분석",
        recommendations: [1, 2, 3, 4, 5, 6].map((n) => rec(n)),
      }),
    );

    const result = await recommendNext(summary, trending, client);
    expect(result.recommendations).toHaveLength(5);
    expect(result.recommendations.map((r) => r.title)).toEqual([
      "추천 1",
      "추천 2",
      "추천 3",
      "추천 4",
      "추천 5",
    ]);
  });

  it("stop_reason이 refusal이면 RecommendError", async () => {
    parse.mockResolvedValue(parsedResponse(null, "refusal"));

    await expect(recommendNext(summary, trending, client)).rejects.toThrow(
      new RecommendError("추천을 생성할 수 없는 요청이에요"),
    );
  });

  it("stop_reason이 max_tokens이면 RecommendError", async () => {
    parse.mockResolvedValue(
      parsedResponse({ analysis: "분석", recommendations: [rec(1)] }, "max_tokens"),
    );

    await expect(recommendNext(summary, trending, client)).rejects.toThrow(
      new RecommendError("추천 결과를 읽지 못했어요"),
    );
  });

  it("parsed_output이 null이면 RecommendError", async () => {
    parse.mockResolvedValue(parsedResponse(null));

    await expect(recommendNext(summary, trending, client)).rejects.toThrow(
      new RecommendError("추천 결과를 읽지 못했어요"),
    );
  });

  it("추천이 0개면 RecommendError", async () => {
    parse.mockResolvedValue(parsedResponse({ analysis: "분석", recommendations: [] }));

    await expect(recommendNext(summary, trending, client)).rejects.toThrow(
      new RecommendError("추천 결과가 비어 있어요"),
    );
  });

  it("Anthropic.APIError는 RecommendError로 바꾸고 원본을 cause로 남긴다", async () => {
    const apiError = new Anthropic.InternalServerError(500, undefined, "boom", new Headers());
    parse.mockRejectedValue(apiError);

    const error = await recommendNext(summary, trending, client).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RecommendError);
    expect((error as RecommendError).message).toBe("추천 서버 호출에 실패했어요");
    expect((error as RecommendError).cause).toBe(apiError);
  });

  it("API 에러가 아닌 예외는 그대로 던진다", async () => {
    const bug = new TypeError("unexpected");
    parse.mockRejectedValue(bug);

    await expect(recommendNext(summary, trending, client)).rejects.toBe(bug);
  });
});
