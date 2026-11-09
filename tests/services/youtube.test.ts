import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  YouTubeError,
  getChannel,
  getRecentVideos,
  getTrendingVideos,
} from "@/services/youtube";

const API_KEY = "test-key";
const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** n번째 fetch 호출의 URL 객체 */
function calledUrl(n = 0): URL {
  return new URL(String(fetchMock.mock.calls[n][0]));
}

function videoItem(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    snippet: {
      title: `title-${id}`,
      channelTitle: "채널",
      categoryId: "20",
      tags: ["게임"],
      publishedAt: "2026-11-01T00:00:00Z",
      thumbnails: {
        default: { url: `https://img/${id}/default.jpg` },
        medium: { url: `https://img/${id}/medium.jpg` },
      },
    },
    statistics: { viewCount: "1000" },
    ...overrides,
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getChannel", () => {
  const channelItem = {
    id: "UCabcdefghijklmnopqrstuv",
    snippet: {
      title: "내 채널",
      thumbnails: { default: { url: "https://img/ch/default.jpg" } },
    },
    statistics: { subscriberCount: "12345" },
    contentDetails: { relatedPlaylists: { uploads: "UUabcdefghijklmnopqrstuv" } },
  };

  it("id 입력이면 id= 파라미터로 조회하고 Channel로 변환한다", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [channelItem] }));

    const channel = await getChannel({ type: "id", value: "UCabcdefghijklmnopqrstuv" }, API_KEY);

    const url = calledUrl();
    expect(url.origin + url.pathname).toBe("https://www.googleapis.com/youtube/v3/channels");
    expect(url.searchParams.get("part")).toBe("snippet,statistics,contentDetails");
    expect(url.searchParams.get("id")).toBe("UCabcdefghijklmnopqrstuv");
    expect(url.searchParams.has("forHandle")).toBe(false);
    expect(url.searchParams.get("key")).toBe(API_KEY);
    expect(channel).toEqual({
      id: "UCabcdefghijklmnopqrstuv",
      title: "내 채널",
      subscriberCount: 12345,
      uploadsPlaylistId: "UUabcdefghijklmnopqrstuv",
      thumbnailUrl: "https://img/ch/default.jpg",
    });
  });

  it("handle 입력이면 forHandle= 파라미터로 조회한다 (URL 인코딩)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [channelItem] }));

    await getChannel({ type: "handle", value: "@내채널" }, API_KEY);

    const raw = String(fetchMock.mock.calls[0][0]);
    expect(raw).toContain(`forHandle=${encodeURIComponent("@내채널")}`);
    const url = calledUrl();
    expect(url.searchParams.get("forHandle")).toBe("@내채널");
    expect(url.searchParams.has("id")).toBe(false);
    expect(url.searchParams.get("key")).toBe(API_KEY);
  });

  it("구독자 수가 숨겨져 있으면 0", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ items: [{ ...channelItem, statistics: { hiddenSubscriberCount: true } }] }),
    );

    const channel = await getChannel({ type: "id", value: channelItem.id }, API_KEY);

    expect(channel?.subscriberCount).toBe(0);
  });

  it("items가 없거나 비면 null", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    expect(await getChannel({ type: "handle", value: "@none" }, API_KEY)).toBeNull();

    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }));
    expect(await getChannel({ type: "handle", value: "@none" }, API_KEY)).toBeNull();
  });

  it("!ok 응답이면 status를 담은 YouTubeError를 던지고 메시지에 API 키가 없다", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { message: "forbidden" } }, 403));

    const error = await getChannel({ type: "id", value: channelItem.id }, API_KEY).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(YouTubeError);
    expect((error as YouTubeError).status).toBe(403);
    expect((error as YouTubeError).message).not.toContain(API_KEY);
  });
});

describe("getRecentVideos", () => {
  it("playlistItems → videos 순으로 조회하고 playlist 순서(최신순)를 유지한다", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            { contentDetails: { videoId: "v1" } },
            { contentDetails: { videoId: "v2" } },
            { contentDetails: { videoId: "v3" } },
          ],
        }),
      )
      // videos 응답은 순서가 뒤섞여 올 수 있다
      .mockResolvedValueOnce(
        jsonResponse({ items: [videoItem("v3"), videoItem("v1"), videoItem("v2")] }),
      );

    const videos = await getRecentVideos("UUplaylist", API_KEY);

    const playlistUrl = calledUrl(0);
    expect(playlistUrl.pathname).toBe("/youtube/v3/playlistItems");
    expect(playlistUrl.searchParams.get("part")).toBe("contentDetails");
    expect(playlistUrl.searchParams.get("maxResults")).toBe("20");
    expect(playlistUrl.searchParams.get("playlistId")).toBe("UUplaylist");
    expect(playlistUrl.searchParams.get("key")).toBe(API_KEY);

    const videosUrl = calledUrl(1);
    expect(videosUrl.pathname).toBe("/youtube/v3/videos");
    expect(videosUrl.searchParams.get("part")).toBe("snippet,statistics");
    expect(videosUrl.searchParams.get("id")).toBe("v1,v2,v3");
    expect(videosUrl.searchParams.get("key")).toBe(API_KEY);

    expect(videos.map((v) => v.id)).toEqual(["v1", "v2", "v3"]);
    expect(videos[0]).toEqual({
      id: "v1",
      title: "title-v1",
      channelTitle: "채널",
      categoryId: "20",
      tags: ["게임"],
      viewCount: 1000,
      publishedAt: "2026-11-01T00:00:00Z",
      thumbnailUrl: "https://img/v1/medium.jpg",
    });
  });

  it("max 인자를 maxResults로 전달한다", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }));

    await getRecentVideos("UUplaylist", API_KEY, 5);

    expect(calledUrl(0).searchParams.get("maxResults")).toBe("5");
  });

  it("누락된 tags/viewCount/medium 썸네일은 기본값으로 채운다", async () => {
    const item = videoItem("v1");
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ items: [{ contentDetails: { videoId: "v1" } }] }))
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: "v1",
              snippet: {
                ...item.snippet,
                tags: undefined,
                thumbnails: { default: { url: "https://img/v1/default.jpg" } },
              },
              statistics: {},
            },
          ],
        }),
      );

    const [video] = await getRecentVideos("UUplaylist", API_KEY);

    expect(video.tags).toEqual([]);
    expect(video.viewCount).toBe(0);
    expect(video.thumbnailUrl).toBe("https://img/v1/default.jpg");
  });

  it("썸네일이 전혀 없으면 빈 문자열", async () => {
    const item = videoItem("v1");
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ items: [{ contentDetails: { videoId: "v1" } }] }))
      .mockResolvedValueOnce(
        jsonResponse({ items: [{ ...item, snippet: { ...item.snippet, thumbnails: {} } }] }),
      );

    const [video] = await getRecentVideos("UUplaylist", API_KEY);

    expect(video.thumbnailUrl).toBe("");
  });

  it("영상이 0개면 /videos를 호출하지 않고 []", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }));

    const videos = await getRecentVideos("UUplaylist", API_KEY);

    expect(videos).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("playlistItems가 !ok면 status를 담은 YouTubeError", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 404));

    await expect(getRecentVideos("UUplaylist", API_KEY)).rejects.toMatchObject({
      name: "YouTubeError",
      status: 404,
    });
  });

  it("videos가 !ok면 status를 담은 YouTubeError", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ items: [{ contentDetails: { videoId: "v1" } }] }))
      .mockResolvedValueOnce(jsonResponse({}, 500));

    await expect(getRecentVideos("UUplaylist", API_KEY)).rejects.toMatchObject({
      name: "YouTubeError",
      status: 500,
    });
  });
});

describe("getTrendingVideos", () => {
  it("정상 응답이면 카테고리로 조회하고 fallback: false", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [videoItem("t1"), videoItem("t2")] }));

    const result = await getTrendingVideos("20", API_KEY);

    const url = calledUrl(0);
    expect(url.pathname).toBe("/youtube/v3/videos");
    expect(url.searchParams.get("part")).toBe("snippet,statistics");
    expect(url.searchParams.get("chart")).toBe("mostPopular");
    expect(url.searchParams.get("regionCode")).toBe("KR");
    expect(url.searchParams.get("maxResults")).toBe("20");
    expect(url.searchParams.get("videoCategoryId")).toBe("20");
    expect(url.searchParams.get("key")).toBe(API_KEY);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.fallback).toBe(false);
    expect(result.videos.map((v) => v.id)).toEqual(["t1", "t2"]);
  });

  it("빈 결과면 카테고리 없이 한 번 재조회하고 fallback: true", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ items: [] }))
      .mockResolvedValueOnce(jsonResponse({ items: [videoItem("t1")] }));

    const result = await getTrendingVideos("29", API_KEY);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryUrl = calledUrl(1);
    expect(retryUrl.searchParams.has("videoCategoryId")).toBe(false);
    expect(retryUrl.searchParams.get("chart")).toBe("mostPopular");
    expect(retryUrl.searchParams.get("regionCode")).toBe("KR");
    expect(result).toEqual({ videos: [expect.objectContaining({ id: "t1" })], fallback: true });
  });

  it("첫 호출이 400이면 카테고리 없이 재조회한다", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: { message: "bad category" } }, 400))
      .mockResolvedValueOnce(jsonResponse({ items: [videoItem("t1")] }));

    const result = await getTrendingVideos("29", API_KEY);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(calledUrl(1).searchParams.has("videoCategoryId")).toBe(false);
    expect(result.fallback).toBe(true);
    expect(result.videos).toHaveLength(1);
  });

  it("재조회도 실패하면 YouTubeError를 던진다", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, 400))
      .mockResolvedValueOnce(jsonResponse({}, 503));

    const error = await getTrendingVideos("29", API_KEY).catch((e: unknown) => e);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(error).toBeInstanceOf(YouTubeError);
    expect((error as YouTubeError).status).toBe(503);
  });
});
