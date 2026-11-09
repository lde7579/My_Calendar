import { parseChannelInput, summarizeChannel } from "@/lib/analyze";
import { getChannel, getRecentVideos, getTrendingVideos, YouTubeError } from "@/services/youtube";
import type { ChannelResponse, ErrorResponse } from "@/types";

function errorResponse(error: string, status: number): Response {
  return Response.json({ error } satisfies ErrorResponse, { status });
}

/** 채널 입력 → 채널 요약 + 인기 급상승 목록 (1단계) */
export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return errorResponse("서버 설정(.env)의 YOUTUBE_API_KEY를 확인하세요", 500);
  }

  const body: unknown = await request.json().catch(() => null);
  const raw =
    typeof body === "object" && body !== null && "channel" in body ? body.channel : undefined;
  const input = typeof raw === "string" ? parseChannelInput(raw) : null;
  if (!input) {
    return errorResponse("채널 ID(UC...) 또는 @핸들로 입력해 주세요", 400);
  }

  try {
    const channel = await getChannel(input, apiKey);
    if (!channel) return errorResponse("채널을 찾을 수 없어요", 404);

    const videos = await getRecentVideos(channel.uploadsPlaylistId, apiKey);
    if (videos.length === 0) return errorResponse("분석할 영상이 없어요", 422);

    const summary = summarizeChannel(channel, videos);
    const { videos: trending, fallback } = await getTrendingVideos(summary.topCategoryId, apiKey);

    return Response.json({
      summary,
      trending,
      trendingFallback: fallback,
    } satisfies ChannelResponse);
  } catch (error) {
    // 내부 메시지는 서버 로그에만 남기고 사용자에게는 한국어 안내만 보여준다
    if (!(error instanceof YouTubeError)) console.error(error);
    return errorResponse("YouTube 데이터를 가져오지 못했어요", 502);
  }
}
