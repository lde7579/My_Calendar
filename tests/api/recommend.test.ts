import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/recommend/route";
import { recommendNext, RecommendError } from "@/services/claude";
import type { ChannelSummary, RecommendResponse, Video } from "@/types";

// recommendNext만 mock하고 RecommendError 클래스는 실제 것을 쓴다
vi.mock("@/services/claude", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/claude")>();
  return { ...actual, recommendNext: vi.fn() };
});

function video(id: string): Video {
  return {
    id,
    title: `title-${id}`,
    channelTitle: `channel-${id}`,
    categoryId: "20",
    tags: ["게임"],
    viewCount: 1000,
    publishedAt: "2026-11-01T00:00:00Z",
    thumbnailUrl: `https://img/${id}.jpg`,
  };
}

const summary: ChannelSummary = {
  channelId: "UC123",
  title: "테스트채널",
  subscriberCount: 12345,
  thumbnailUrl: "https://img/ch.jpg",
  videoCount: 2,
  topCategoryId: "20",
  topKeywords: ["게임"],
  averageViews: 5000,
  topVideos: [video("my1")],
  recentTitles: ["최근 영상 1", "최근 영상 2"],
};

const trending: Video[] = [video("tr1"), video("tr2")];

const result: RecommendResponse = {
  analysis: "분석 코멘트",
  recommendations: [
    { title: "추천 1", concept: "롱폼 — 컨셉", reason: "이유", referenceVideoIds: ["tr1"] },
  ],
};

function postRaw(body: string): Promise<Response> {
  return POST(new Request("http://localhost/api/recommend", { method: "POST", body }));
}

function post(body: unknown): Promise<Response> {
  return postRaw(JSON.stringify(body));
}

beforeEach(() => {
  vi.stubEnv("ANTHROPIC_API_KEY", "test-anthropic-key");
  vi.mocked(recommendNext).mockResolvedValue(result);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("POST /api/recommend", () => {
  it("200: 추천 결과를 돌려준다", async () => {
    const res = await post({ summary, trending });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(result);
    expect(recommendNext).toHaveBeenCalledWith(summary, trending);
  });

  it("500: ANTHROPIC_API_KEY가 없으면 서버 설정 안내", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const res = await post({ summary, trending });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "서버 설정(.env)의 ANTHROPIC_API_KEY를 확인하세요",
    });
    expect(recommendNext).not.toHaveBeenCalled();
  });

  describe("400: 요청 형식 오류", () => {
    const message = { error: "요청 형식이 올바르지 않아요" };

    it("본문이 JSON이 아니면", async () => {
      const res = await postRaw("{oops");
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual(message);
    });

    it("summary가 없으면", async () => {
      const res = await post({ trending });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual(message);
      expect(recommendNext).not.toHaveBeenCalled();
    });

    it("trending 항목 형식이 틀리면", async () => {
      const res = await post({ summary, trending: [{ id: "tr1" }] });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual(message);
    });
  });

  describe("502: 추천 실패", () => {
    it("RecommendError는 메시지를 그대로 전달한다 (거절 포함)", async () => {
      vi.mocked(recommendNext).mockRejectedValue(
        new RecommendError("추천을 생성할 수 없는 요청이에요"),
      );
      const res = await post({ summary, trending });
      expect(res.status).toBe(502);
      expect(await res.json()).toEqual({ error: "추천을 생성할 수 없는 요청이에요" });
    });

    it("예상 못 한 에러는 고정 메시지 + console.error", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(recommendNext).mockRejectedValue(new Error("internal secret detail"));
      const res = await post({ summary, trending });
      expect(res.status).toBe(502);
      expect(await res.json()).toEqual({ error: "추천을 생성하지 못했어요" });
      expect(consoleError).toHaveBeenCalled();
    });
  });
});
