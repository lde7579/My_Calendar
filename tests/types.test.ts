import { describe, expect, it } from "vitest";
import { RecommendRequestSchema, RecommendationResultSchema } from "@/types";

const video = {
  id: "abc",
  title: "영상",
  channelTitle: "채널",
  categoryId: "22",
  tags: ["태그"],
  viewCount: 10,
  publishedAt: "2026-11-01T00:00:00Z",
  thumbnailUrl: "https://i.ytimg.com/vi/abc/default.jpg",
};

const summary = {
  channelId: "UCabcdefghijklmnopqrstuv",
  title: "내 채널",
  subscriberCount: 100,
  thumbnailUrl: "https://yt3.ggpht.com/channel.jpg",
  videoCount: 1,
  topCategoryId: "22",
  topKeywords: ["태그"],
  averageViews: 10,
  topVideos: [video],
  recentTitles: ["영상"],
};

describe("RecommendRequestSchema", () => {
  it("올바른 요청 본문을 통과시킨다", () => {
    expect(RecommendRequestSchema.safeParse({ summary, trending: [video] }).success).toBe(true);
  });

  it("필드 타입이 틀린 요청 본문을 거부한다", () => {
    const bad = { summary: { ...summary, averageViews: "10" }, trending: [video] };
    expect(RecommendRequestSchema.safeParse(bad).success).toBe(false);
    expect(RecommendRequestSchema.safeParse({ summary }).success).toBe(false);
  });
});

describe("RecommendationResultSchema", () => {
  it("추천 개수 제약 없이 파싱한다 (개수는 프롬프트·후처리로 맞춘다)", () => {
    const rec = { title: "t", concept: "c", reason: "r", referenceVideoIds: [] };
    const result = { analysis: "a", recommendations: Array(6).fill(rec) };
    expect(RecommendationResultSchema.safeParse(result).success).toBe(true);
  });
});
