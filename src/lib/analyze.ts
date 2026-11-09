import type { Channel, ChannelInput, ChannelSummary, Video } from "@/types";

const CHANNEL_ID_PATTERN = /^UC[A-Za-z0-9_-]{22}$/;
const HANDLE_PATTERN = /^@\S+$/;
const TITLE_STRIP_PATTERN = /[[\]()#|,.!?"']/g;
const TOP_KEYWORD_LIMIT = 10;
const TOP_VIDEO_LIMIT = 3;

/** 입력 문자열을 채널 ID(UC...) 또는 핸들(@...)로 해석한다. 둘 다 아니면 null. */
export function parseChannelInput(raw: string): ChannelInput | null {
  const value = raw.trim();
  if (CHANNEL_ID_PATTERN.test(value)) return { type: "id", value };
  if (HANDLE_PATTERN.test(value)) return { type: "handle", value };
  return null;
}

/** 최신순 영상 목록으로 채널 요약을 만든다. 빈 배열이면 에러를 던진다. */
export function summarizeChannel(channel: Channel, videos: Video[]): ChannelSummary {
  if (videos.length === 0) {
    throw new Error("분석할 영상이 없습니다.");
  }

  const totalViews = videos.reduce((sum, v) => sum + v.viewCount, 0);

  return {
    channelId: channel.id,
    title: channel.title,
    subscriberCount: channel.subscriberCount,
    thumbnailUrl: channel.thumbnailUrl,
    videoCount: videos.length,
    topCategoryId: mostFrequent(videos.map((v) => v.categoryId)),
    topKeywords: topKeywords(videos),
    averageViews: Math.round(totalViews / videos.length),
    // sort는 안정 정렬이라 조회수 동점이면 입력 순서를 유지한다
    topVideos: [...videos].sort((a, b) => b.viewCount - a.viewCount).slice(0, TOP_VIDEO_LIMIT),
    recentTitles: videos.map((v) => v.title),
  };
}

/** 가장 많이 나온 값. 동점이면 먼저 나온 값. */
function mostFrequent(values: string[]): string {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);

  let best = values[0];
  for (const [value, count] of counts) {
    if (count > (counts.get(best) ?? 0)) best = value;
  }
  return best;
}

/** 태그 빈도 상위 키워드. 태그가 하나도 없으면 제목 단어로 대체한다. */
function topKeywords(videos: Video[]): string[] {
  const fromTags = rankWords(videos.flatMap((v) => v.tags));
  if (fromTags.length > 0) return fromTags;

  const titleWords = videos.flatMap((v) =>
    v.title
      .split(/\s+/)
      .map((word) => word.replace(TITLE_STRIP_PATTERN, ""))
      .filter((word) => word.length >= 2),
  );
  return rankWords(titleWords);
}

/** 대소문자 무시·trim 후 빈도 내림차순 상위 N개. 표기는 처음 나온 것, 동점이면 먼저 나온 순. */
function rankWords(words: string[]): string[] {
  const entries = new Map<string, { label: string; count: number }>();
  for (const raw of words) {
    const label = raw.trim();
    if (label === "") continue;
    const key = label.toLowerCase();
    const entry = entries.get(key);
    if (entry) entry.count += 1;
    else entries.set(key, { label, count: 1 });
  }

  return [...entries.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_KEYWORD_LIMIT)
    .map((entry) => entry.label);
}
