import { categoryName, formatCount } from "@/lib/format";
import type { ChannelSummary as ChannelSummaryData } from "@/types";

const CARD = "rounded-md bg-[#141414] border border-neutral-800 p-5";
const SECTION_TITLE = "text-sm font-medium text-neutral-400 uppercase tracking-wide";
const BIG_NUMBER = "text-3xl font-semibold text-white tabular-nums";

export default function ChannelSummary({ summary }: { summary: ChannelSummaryData }) {
  const stats = [
    { label: "구독자", value: formatCount(summary.subscriberCount) },
    { label: "평균 조회수", value: formatCount(summary.averageViews) },
    { label: "분석 영상 수", value: formatCount(summary.videoCount) },
  ];

  return (
    <section className="space-y-4">
      <h2 className={SECTION_TITLE}>내 채널</h2>
      <p className="text-white">
        <span className="font-medium">{summary.title}</span>
        <span className="text-neutral-500"> · </span>
        <span className="text-neutral-400">{categoryName(summary.topCategoryId)}</span>
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className={CARD}>
            <p className="text-xs text-neutral-400">{stat.label}</p>
            <p className={`mt-1 ${BIG_NUMBER}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className={CARD}>
          <p className="text-xs text-neutral-400">자주 쓰는 키워드</p>
          {summary.topKeywords.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {summary.topKeywords.map((keyword) => (
                <li
                  key={keyword}
                  className="rounded bg-neutral-900 border border-neutral-800 px-2 py-0.5 text-xs text-neutral-300"
                >
                  {keyword}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-neutral-500">키워드가 없어요</p>
          )}
        </div>

        <div className={CARD}>
          <p className="text-xs text-neutral-400">조회수 TOP 3</p>
          <ol className="mt-3 space-y-2">
            {summary.topVideos.map((video, i) => (
              <li key={video.id} className="flex gap-3 text-sm">
                <span className="text-neutral-500 tabular-nums">{i + 1}</span>
                <span className="flex-1 text-neutral-300">{video.title}</span>
                <span className="text-amber-500 tabular-nums">{formatCount(video.viewCount)}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
