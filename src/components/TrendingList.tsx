import { formatCount } from "@/lib/format";
import type { Video } from "@/types";

export default function TrendingList({
  trending,
  fallback,
}: {
  trending: Video[];
  fallback: boolean;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wide">
          참고한 인기 급상승
        </h2>
        {fallback && (
          <p className="text-xs text-neutral-500">카테고리 차트가 없어 전체 인기 급상승 기준</p>
        )}
      </div>

      <div className="rounded-md bg-[#141414] border border-neutral-800">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-neutral-500">
            <tr className="border-b border-neutral-800">
              <th className="w-28 px-4 py-2 font-normal" />
              <th className="px-4 py-2 font-normal">제목</th>
              <th className="px-4 py-2 font-normal">채널</th>
              <th className="px-4 py-2 text-right font-normal">조회수</th>
            </tr>
          </thead>
          <tbody>
            {trending.map((video) => (
              <tr key={video.id} className="border-b border-neutral-800 last:border-b-0">
                <td className="px-4 py-2">
                  {video.thumbnailUrl && (
                    // 썸네일 1장 표시용이라 next/image(원격 도메인 설정 필요) 대신 img를 쓴다
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={video.thumbnailUrl} alt="" className="w-24 rounded-sm" />
                  )}
                </td>
                <td className="px-4 py-2 text-neutral-300">{video.title}</td>
                <td className="px-4 py-2 text-neutral-400">{video.channelTitle}</td>
                <td className="px-4 py-2 text-right text-neutral-300 tabular-nums">
                  {formatCount(video.viewCount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
