import { recommendNext, RecommendError } from "@/services/claude";
import { RecommendRequestSchema, type ErrorResponse, type RecommendResponse } from "@/types";

function errorResponse(error: string, status: number): Response {
  return Response.json({ error } satisfies ErrorResponse, { status });
}

/** 채널 요약 + 인기 급상승 목록 → Claude 추천 (2단계) */
export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return errorResponse("서버 설정(.env)의 ANTHROPIC_API_KEY를 확인하세요", 500);
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = RecommendRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("요청 형식이 올바르지 않아요", 400);
  }

  try {
    const result = await recommendNext(parsed.data.summary, parsed.data.trending);
    return Response.json(result satisfies RecommendResponse);
  } catch (error) {
    // RecommendError는 사용자용 한국어 메시지라 그대로 보여준다
    if (error instanceof RecommendError) return errorResponse(error.message, 502);
    console.error(error);
    return errorResponse("추천을 생성하지 못했어요", 502);
  }
}
