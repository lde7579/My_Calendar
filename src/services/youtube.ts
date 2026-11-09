import type { Channel, ChannelInput, Video } from "@/types";

const BASE_URL = "https://www.googleapis.com/youtube/v3";
const DEFAULT_MAX = 20;
const REGION_CODE = "KR";

export class YouTubeError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "YouTubeError";
  }
}

// YouTube API 응답 타입 — 사용하는 필드만 최소로 정의한다
interface Thumbnails {
  default?: { url: string };
  medium?: { url: string };
}

interface ChannelsResponse {
  items?: {
    id: string;
    snippet: { title: string; thumbnails: Thumbnails };
    statistics: { subscriberCount?: string };
    contentDetails: { relatedPlaylists: { uploads: string } };
  }[];
}

interface PlaylistItemsResponse {
  items?: { contentDetails: { videoId: string } }[];
}

interface VideoItem {
  id: string;
  snippet: {
    title: string;
    channelTitle: string;
    categoryId: string;
    tags?: string[];
    publishedAt: string;
    thumbnails: Thumbnails;
  };
  statistics: { viewCount?: string };
}

interface VideosResponse {
  items?: VideoItem[];
}

/** 채널 ID 또는 핸들로 채널 정보를 조회한다. 없으면 null. */
export async function getChannel(input: ChannelInput, apiKey: string): Promise<Channel | null> {
  const data = await request<ChannelsResponse>("channels", apiKey, {
    part: "snippet,statistics,contentDetails",
    [input.type === "id" ? "id" : "forHandle"]: input.value,
  });

  const item = data.items?.[0];
  if (!item) return null;

  return {
    id: item.id,
    title: item.snippet.title,
    subscriberCount: Number(item.statistics.subscriberCount ?? 0),
    uploadsPlaylistId: item.contentDetails.relatedPlaylists.uploads,
    thumbnailUrl: thumbnailUrl(item.snippet.thumbnails),
  };
}

/** 업로드 재생목록의 최근 영상을 최신순으로 조회한다. */
export async function getRecentVideos(
  uploadsPlaylistId: string,
  apiKey: string,
  max: number = DEFAULT_MAX,
): Promise<Video[]> {
  const playlist = await request<PlaylistItemsResponse>("playlistItems", apiKey, {
    part: "contentDetails",
    maxResults: String(max),
    playlistId: uploadsPlaylistId,
  });

  const ids = (playlist.items ?? []).map((item) => item.contentDetails.videoId);
  if (ids.length === 0) return [];

  const data = await request<VideosResponse>("videos", apiKey, {
    part: "snippet,statistics",
    id: ids.join(","),
  });

  // videos.list 응답 순서는 보장되지 않으므로 playlist 순서로 다시 맞춘다
  const byId = new Map((data.items ?? []).map((item) => [item.id, toVideo(item)]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

/**
 * KR 인기 급상승 영상을 카테고리로 조회한다.
 * 카테고리 조회가 실패하거나 비면 카테고리 없이 한 번만 다시 조회하고 fallback: true.
 */
export async function getTrendingVideos(
  categoryId: string,
  apiKey: string,
  max: number = DEFAULT_MAX,
): Promise<{ videos: Video[]; fallback: boolean }> {
  const params = {
    part: "snippet,statistics",
    chart: "mostPopular",
    regionCode: REGION_CODE,
    maxResults: String(max),
  };

  const byCategory = await request<VideosResponse>("videos", apiKey, {
    ...params,
    videoCategoryId: categoryId,
  }).catch((error: unknown) => {
    // HTTP 에러만 재조회 대상으로 삼는다
    if (error instanceof YouTubeError) return null;
    throw error;
  });

  if (byCategory?.items?.length) {
    return { videos: byCategory.items.map(toVideo), fallback: false };
  }

  const all = await request<VideosResponse>("videos", apiKey, params);
  return { videos: (all.items ?? []).map(toVideo), fallback: true };
}

/** GET 요청을 보내고 !ok면 YouTubeError를 던진다. 에러 메시지에 API 키를 넣지 않는다. */
async function request<T>(
  endpoint: string,
  apiKey: string,
  params: Record<string, string>,
): Promise<T> {
  const query = new URLSearchParams({ ...params, key: apiKey });
  const response = await fetch(`${BASE_URL}/${endpoint}?${query}`);
  if (!response.ok) {
    throw new YouTubeError(
      `YouTube API ${endpoint} 요청 실패 (HTTP ${response.status})`,
      response.status,
    );
  }
  return (await response.json()) as T;
}

function toVideo(item: VideoItem): Video {
  return {
    id: item.id,
    title: item.snippet.title,
    channelTitle: item.snippet.channelTitle,
    categoryId: item.snippet.categoryId,
    tags: item.snippet.tags ?? [],
    viewCount: Number(item.statistics.viewCount ?? 0),
    publishedAt: item.snippet.publishedAt,
    thumbnailUrl: thumbnailUrl(item.snippet.thumbnails),
  };
}

function thumbnailUrl(thumbnails: Thumbnails): string {
  return thumbnails.medium?.url ?? thumbnails.default?.url ?? "";
}
