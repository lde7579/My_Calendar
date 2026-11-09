"use client";

import { useState } from "react";
import type { Recommendation, Video } from "@/types";

export default function RecommendationList({
  recommendations,
  trending,
}: {
  recommendations: Recommendation[];
  trending: Video[];
}) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  async function copyTitle(title: string, index: number) {
    try {
      await navigator.clipboard.writeText(title);
    } catch {
      return; // 클립보드 권한이 없으면 아무 것도 바꾸지 않는다
    }
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex((current) => (current === index ? null : current)), 1500);
  }

  return (
    <ol className="grid grid-cols-1 gap-4">
      {recommendations.map((rec, i) => {
        const references = rec.referenceVideoIds
          .map((id) => trending.find((video) => video.id === id))
          .filter((video): video is Video => video !== undefined);

        return (
          <li key={i} className="rounded-md bg-[#141414] border border-neutral-800 p-5 space-y-3">
            <div className="flex items-start gap-3">
              <h3 className="flex-1 text-base font-medium text-white">
                <span className="text-amber-500 tabular-nums">{i + 1}.</span> {rec.title}
              </h3>
              <button
                type="button"
                onClick={() => copyTitle(rec.title, i)}
                className="shrink-0 text-xs text-neutral-500 hover:text-neutral-300"
              >
                {copiedIndex === i ? "복사됨" : "복사"}
              </button>
            </div>
            <p className="text-sm text-neutral-300 leading-relaxed">{rec.concept}</p>
            <p className="text-sm text-neutral-400 leading-relaxed">{rec.reason}</p>
            {references.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-neutral-500">참고 영상</p>
                <ul className="space-y-1">
                  {references.map((video) => (
                    <li key={video.id}>
                      <a
                        href={`https://www.youtube.com/watch?v=${video.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-neutral-300 underline decoration-neutral-700 underline-offset-2 hover:text-white"
                      >
                        {video.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
