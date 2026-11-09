"use client";

import { useRef, useState, type FormEvent } from "react";
import ChannelSummary from "@/components/ChannelSummary";
import RecommendationList from "@/components/RecommendationList";
import TrendingList from "@/components/TrendingList";
import type { ChannelResponse, ErrorResponse, RecommendResponse } from "@/types";

type RequestState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: string };

const SECTION_TITLE = "text-sm font-medium text-neutral-400 uppercase tracking-wide";
const PRIMARY_BUTTON =
  "rounded-md bg-white text-black px-4 py-2 text-sm font-medium hover:bg-neutral-200 disabled:opacity-50";

/** POST JSON 요청. 실패하면 응답의 { error } 문구로 Error를 던진다 */
async function postJson<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("서버에 연결하지 못했어요");
  }
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (data as Partial<ErrorResponse> | null)?.error;
    throw new Error(typeof message === "string" ? message : "요청에 실패했어요");
  }
  return data as T;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "요청에 실패했어요";
}

export default function Home() {
  const [channel, setChannel] = useState(process.env.NEXT_PUBLIC_DEFAULT_CHANNEL ?? "");
  const [channelState, setChannelState] = useState<RequestState<ChannelResponse>>({
    status: "idle",
  });
  const [recommendState, setRecommendState] = useState<RequestState<RecommendResponse>>({
    status: "idle",
  });
  // 다시 분석했을 때 이전 채널의 늦게 도착한 추천 응답을 무시하기 위한 요청 번호
  const recommendRequestId = useRef(0);

  async function recommend(data: ChannelResponse) {
    const requestId = ++recommendRequestId.current;
    setRecommendState({ status: "loading" });
    try {
      const result = await postJson<RecommendResponse>("/api/recommend", {
        summary: data.summary,
        trending: data.trending,
      });
      if (requestId === recommendRequestId.current) {
        setRecommendState({ status: "success", data: result });
      }
    } catch (error) {
      if (requestId === recommendRequestId.current) {
        setRecommendState({ status: "error", error: errorMessage(error) });
      }
    }
  }

  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    recommendRequestId.current++; // 진행 중인 추천 응답은 버린다
    setChannelState({ status: "loading" });
    setRecommendState({ status: "idle" });
    try {
      const data = await postJson<ChannelResponse>("/api/channel", { channel });
      setChannelState({ status: "success", data });
      void recommend(data);
    } catch (error) {
      setChannelState({ status: "error", error: errorMessage(error) });
    }
  }

  const channelLoading = channelState.status === "loading";
  const recommendLoading = recommendState.status === "loading";
  const data = channelState.status === "success" ? channelState.data : null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 space-y-8">
      <h1 className="text-2xl font-semibold text-white">YouTube Next Content</h1>

      <form onSubmit={analyze} className="space-y-2">
        <label htmlFor="channel" className="block text-sm text-neutral-400">
          채널 ID 또는 @핸들
        </label>
        <div className="flex gap-2">
          <input
            id="channel"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            placeholder="UC... 또는 @handle"
            className="flex-1 rounded-md bg-neutral-900 border border-neutral-800 px-4 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:border-amber-500 focus:outline-none"
          />
          <button type="submit" disabled={channelLoading} className={PRIMARY_BUTTON}>
            {channelLoading ? "분석 중…" : "분석하기"}
          </button>
        </div>
        {channelState.status === "error" && (
          <p className="text-sm text-[#ef4444]">{channelState.error}</p>
        )}
      </form>

      {data && (
        <div className="fade-in space-y-8">
          <ChannelSummary summary={data.summary} />

          {recommendState.status === "success" && (
            <section className="fade-in space-y-4">
              <h2 className={SECTION_TITLE}>분석 코멘트</h2>
              <p className="text-sm text-neutral-300 leading-relaxed">
                {recommendState.data.analysis}
              </p>
            </section>
          )}

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className={SECTION_TITLE}>다음 콘텐츠 추천</h2>
              {recommendState.status !== "idle" && (
                <button
                  type="button"
                  onClick={() => recommend(data)}
                  disabled={recommendLoading}
                  className={PRIMARY_BUTTON}
                >
                  {recommendState.status === "error" ? "추천 다시 시도" : "다른 추천 받기"}
                </button>
              )}
            </div>
            {recommendLoading && (
              <p className="text-sm text-neutral-400">추천 생성 중… 보통 20~30초</p>
            )}
            {recommendState.status === "error" && (
              <p className="text-sm text-[#ef4444]">{recommendState.error}</p>
            )}
            {recommendState.status === "success" && (
              <div className="fade-in">
                <RecommendationList
                  recommendations={recommendState.data.recommendations}
                  trending={data.trending}
                />
              </div>
            )}
          </section>

          <TrendingList trending={data.trending} fallback={data.trendingFallback} />
        </div>
      )}
    </main>
  );
}
