import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/channel/route";
import { getChannel, getRecentVideos, getTrendingVideos, YouTubeError } from "@/services/youtube";
import type { Channel, ChannelResponse, Video } from "@/types";

// 서비스 함수만 mock하고 YouTubeError 클래스는 실제 것을 쓴다
vi.mock("@/services/youtube", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/youtube")>();
  return {
    ...actual,
    getChannel: vi.fn(),
    getRecentVideos: vi.fn(),
    getTrendingVideos: vi.fn(),
  };
});

const CHANNEL_ID = "UC" + "a".repeat(22);

const channel: Channel = {
  id: CHANNEL_ID,
  title: "테스트채널",
  subscriberCount: 1000,
  uploadsPlaylistId: "UUplaylist",
  thumbnailUrl: "https://img/ch.jpg",
};

function video(id: string, overrides: Partial<Video> = {}): Video {
  return {
    id,
    title: `title-${id}`,
    channelTitle: "테스트채널",
    categoryId: "20",
    tags: ["게임"],
    viewCount: 100,
    publishedAt: "2026-11-01T00:00:00Z",
    thumbnailUrl: `https://img/${id}.jpg`,
    ...overrides,
  };
}

const myVideos = [video("v1", { viewCount: 300 }), video("v2", { viewCount: 100 })];
const trendingVideos = [video("tr1", { channelTitle: "다른채널" })];

function postRaw(body: string): Promise<Response> {
  return POST(new Request("http://localhost/api/channel", { method: "POST", body }));
}

function post(body: unknown): Promise<Response> {
  return postRaw(JSON.stringify(body));
}

beforeEach(() => {
  vi.stubEnv("YOUTUBE_API_KEY", "test-youtube-key");
  vi.mocked(getChannel).mockResolvedValue(channel);
  vi.mocked(getRecentVideos).mockResolvedValue(myVideos);
  vi.mocked(getTrendingVideos).mockResolvedValue({ videos: trendingVideos, fallback: false });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("POST /api/channel", () => {
  it("200: 채널 요약과 인기 급상승 목록을 돌려준다", async () => {
    const res = await post({ channel: CHANNEL_ID });
    expect(res.status).toBe(200);

    const body = (await res.json()) as ChannelResponse;
    expect(body.summary.channelId).toBe(CHANNEL_ID);
    expect(body.summary.title).toBe("테스트채널");
    expect(body.summary.videoCount).toBe(2);
    expect(body.summary.averageViews).toBe(200);
    expect(body.summary.topCategoryId).toBe("20");
    expect(body.trending).toEqual(trendingVideos);
    expect(body.trendingFallback).toBe(false);

    expect(getChannel).toHaveBeenCalledWith({ type: "id", value: CHANNEL_ID }, "test-youtube-key");
    expect(getRecentVideos).toHaveBeenCalledWith("UUplaylist", "test-youtube-key");
    expect(getTrendingVideos).toHaveBeenCalledWith("20", "test-youtube-key");
  });

  it("@핸들 입력도 받는다 (앞뒤 공백 무시)", async () => {
    const res = await post({ channel: "  @mychannel " });
    expect(res.status).toBe(200);
    expect(getChannel).toHaveBeenCalledWith(
      { type: "handle", value: "@mychannel" },
      "test-youtube-key",
    );
  });

  it("200: 인기 급상승 대체(fallback) 여부를 전달한다", async () => {
    vi.mocked(getTrendingVideos).mockResolvedValue({ videos: trendingVideos, fallback: true });
    const res = await post({ channel: CHANNEL_ID });
    expect(res.status).toBe(200);
    const body = (await res.json()) as ChannelResponse;
    expect(body.trendingFallback).toBe(true);
  });

  it("500: YOUTUBE_API_KEY가 없으면 서버 설정 안내", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "");
    const res = await post({ channel: CHANNEL_ID });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "서버 설정(.env)의 YOUTUBE_API_KEY를 확인하세요" });
    expect(getChannel).not.toHaveBeenCalled();
  });

  describe("400: 입력 형식 오류", () => {
    const message = { error: "채널 ID(UC...) 또는 @핸들로 입력해 주세요" };

    it("본문이 JSON이 아니면", async () => {
      const res = await postRaw("not json");
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual(message);
    });

    it("channel이 문자열이 아니면", async () => {
      const res = await post({ channel: 123 });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual(message);
    });

    it("본문이 null이면", async () => {
      const res = await post(null);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual(message);
    });

    it("UC ID도 @핸들도 아니면", async () => {
      const res = await post({ channel: "그냥채널이름" });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual(message);
      expect(getChannel).not.toHaveBeenCalled();
    });
  });

  it("404: 채널이 없으면", async () => {
    vi.mocked(getChannel).mockResolvedValue(null);
    const res = await post({ channel: CHANNEL_ID });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "채널을 찾을 수 없어요" });
    expect(getRecentVideos).not.toHaveBeenCalled();
  });

  it("422: 최근 영상이 0개면", async () => {
    vi.mocked(getRecentVideos).mockResolvedValue([]);
    const res = await post({ channel: CHANNEL_ID });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "분석할 영상이 없어요" });
    expect(getTrendingVideos).not.toHaveBeenCalled();
  });

  describe("502: YouTube 호출 실패", () => {
    const message = { error: "YouTube 데이터를 가져오지 못했어요" };

    it("YouTubeError는 내부 메시지를 노출하지 않는다", async () => {
      vi.mocked(getChannel).mockRejectedValue(
        new YouTubeError("YouTube API channels 요청 실패 (HTTP 403)", 403),
      );
      const res = await post({ channel: CHANNEL_ID });
      expect(res.status).toBe(502);
      expect(await res.json()).toEqual(message);
    });

    it("인기 급상승 조회가 실패해도 502", async () => {
      vi.mocked(getTrendingVideos).mockRejectedValue(new YouTubeError("fail", 500));
      const res = await post({ channel: CHANNEL_ID });
      expect(res.status).toBe(502);
      expect(await res.json()).toEqual(message);
    });

    it("예상 못 한 에러도 502로 응답하고 console.error로 남긴다", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(getRecentVideos).mockRejectedValue(new TypeError("fetch failed: secret detail"));
      const res = await post({ channel: CHANNEL_ID });
      expect(res.status).toBe(502);
      const body = await res.json();
      expect(body).toEqual(message);
      expect(JSON.stringify(body)).not.toContain("secret");
      expect(consoleError).toHaveBeenCalled();
    });
  });
});
