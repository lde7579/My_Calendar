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
  publishedAt: string; // ISO 8601
  thumbnailUrl: string;
}

export interface ChannelSummary {
  channelId: string;
  title: string;
  subscriberCount: number;
  thumbnailUrl: string;
  videoCount: number; // 분석에 쓴 영상 수
  topCategoryId: string; // 가장 많이 나온 categoryId
  topKeywords: string[]; // 최대 10개
  averageViews: number; // 정수 (반올림)
  topVideos: Video[]; // 조회수 상위 최대 3개
  recentTitles: string[]; // 분석한 영상 제목 전체 (입력 순서 유지)
}

export type ChannelInput =
  | { type: "id"; value: string } // "UC..."
  | { type: "handle"; value: string }; // "@..." (앞의 @ 포함)

// /api/recommend 요청 본문 검증용 스키마
export const VideoSchema = z.object({
  id: z.string(),
  title: z.string(),
  channelTitle: z.string(),
  categoryId: z.string(),
  tags: z.array(z.string()),
  viewCount: z.number(),
  publishedAt: z.string(),
  thumbnailUrl: z.string(),
}) satisfies z.ZodType<Video>;

export const ChannelSummarySchema = z.object({
  channelId: z.string(),
  title: z.string(),
  subscriberCount: z.number(),
  thumbnailUrl: z.string(),
  videoCount: z.number(),
  topCategoryId: z.string(),
  topKeywords: z.array(z.string()),
  averageViews: z.number(),
  topVideos: z.array(VideoSchema),
  recentTitles: z.array(z.string()),
}) satisfies z.ZodType<ChannelSummary>;

export const RecommendRequestSchema = z.object({
  summary: ChannelSummarySchema,
  trending: z.array(VideoSchema),
});

// Claude 구조화 출력 스키마 (step 3에서 사용)
// 주의: 개수·길이 제약(.min/.max/.length)을 넣지 않는다. 구조화 출력이 지원하지 않아 파싱 전체가 실패할 수 있다.
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
export interface ErrorResponse {
  error: string;
}
