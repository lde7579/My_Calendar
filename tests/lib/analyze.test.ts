import { describe, expect, it } from "vitest";
import { parseChannelInput, summarizeChannel } from "@/lib/analyze";
import type { Channel, Video } from "@/types";

// 테스트용 Video 생성 헬퍼
let seq = 0;
function makeVideo(overrides: Partial<Video> = {}): Video {
  seq += 1;
  return {
    id: `video${seq}`,
    title: `영상 ${seq}`,
    channelTitle: "내 채널",
    categoryId: "22",
    tags: [],
    viewCount: 0,
    publishedAt: "2026-11-01T00:00:00Z",
    thumbnailUrl: `https://i.ytimg.com/vi/video${seq}/default.jpg`,
    ...overrides,
  };
}

const channel: Channel = {
  id: "UCabcdefghijklmnopqrstuv",
  title: "내 채널",
  subscriberCount: 12345,
  uploadsPlaylistId: "UUabcdefghijklmnopqrstuv",
  thumbnailUrl: "https://yt3.ggpht.com/channel.jpg",
};

describe("parseChannelInput", () => {
  it("UC로 시작하는 24자 채널 ID를 id로 인식한다", () => {
    expect(parseChannelInput("UCabcdefghij_-1234567890")).toEqual({
      type: "id",
      value: "UCabcdefghij_-1234567890",
    });
  });

  it("앞뒤 공백을 제거한 뒤 판단한다", () => {
    expect(parseChannelInput("  UCabcdefghijklmnopqrstuv \n")).toEqual({
      type: "id",
      value: "UCabcdefghijklmnopqrstuv",
    });
  });

  it("길이가 24자가 아닌 UC ID는 거부한다", () => {
    expect(parseChannelInput("UCabcdefghijklmnopqrstu")).toBeNull(); // 23자
    expect(parseChannelInput("UCabcdefghijklmnopqrstuvw")).toBeNull(); // 25자
  });

  it("허용되지 않는 문자가 섞인 UC ID는 거부한다", () => {
    expect(parseChannelInput("UCabcdefghijklmnopqrst.v")).toBeNull();
  });

  it("영문 핸들을 handle로 인식한다 (@ 포함)", () => {
    expect(parseChannelInput("@mychannel")).toEqual({
      type: "handle",
      value: "@mychannel",
    });
  });

  it("한글 핸들을 허용한다", () => {
    expect(parseChannelInput(" @내채널 ")).toEqual({
      type: "handle",
      value: "@내채널",
    });
  });

  it("@만 있거나 공백이 포함된 핸들은 거부한다", () => {
    expect(parseChannelInput("@")).toBeNull();
    expect(parseChannelInput("@my channel")).toBeNull();
  });

  it("빈 문자열과 URL은 거부한다", () => {
    expect(parseChannelInput("")).toBeNull();
    expect(parseChannelInput("   ")).toBeNull();
    expect(parseChannelInput("https://www.youtube.com/@mychannel")).toBeNull();
    expect(
      parseChannelInput("https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv"),
    ).toBeNull();
  });
});

describe("summarizeChannel", () => {
  it("빈 영상 배열이면 에러를 던진다", () => {
    expect(() => summarizeChannel(channel, [])).toThrow(Error);
  });

  it("채널 기본 정보와 분석 영상 수를 담는다", () => {
    const videos = [makeVideo(), makeVideo()];
    const summary = summarizeChannel(channel, videos);
    expect(summary.channelId).toBe(channel.id);
    expect(summary.title).toBe(channel.title);
    expect(summary.subscriberCount).toBe(channel.subscriberCount);
    expect(summary.thumbnailUrl).toBe(channel.thumbnailUrl);
    expect(summary.videoCount).toBe(2);
  });

  it("가장 많이 등장한 categoryId를 topCategoryId로 고른다", () => {
    const videos = [
      makeVideo({ categoryId: "10" }),
      makeVideo({ categoryId: "20" }),
      makeVideo({ categoryId: "20" }),
    ];
    expect(summarizeChannel(channel, videos).topCategoryId).toBe("20");
  });

  it("카테고리 동점이면 배열에서 먼저 나온 것을 고른다", () => {
    const videos = [
      makeVideo({ categoryId: "24" }),
      makeVideo({ categoryId: "10" }),
      makeVideo({ categoryId: "10" }),
      makeVideo({ categoryId: "24" }),
    ];
    expect(summarizeChannel(channel, videos).topCategoryId).toBe("24");
  });

  it("태그는 대소문자 무시·trim 후 합산하고, 처음 나온 표기를 유지한다", () => {
    const videos = [
      makeVideo({ tags: ["Vlog", "여행"] }),
      makeVideo({ tags: [" vlog ", "먹방"] }),
      makeVideo({ tags: ["VLOG", "여행"] }),
    ];
    const { topKeywords } = summarizeChannel(channel, videos);
    expect(topKeywords).toEqual(["Vlog", "여행", "먹방"]);
  });

  it("태그 동점이면 먼저 나온 순서를 유지한다", () => {
    const videos = [
      makeVideo({ tags: ["b", "a"] }),
      makeVideo({ tags: ["c", "a"] }),
    ];
    expect(summarizeChannel(channel, videos).topKeywords).toEqual(["a", "b", "c"]);
  });

  it("키워드는 최대 10개까지만 반환한다", () => {
    const tags = Array.from({ length: 15 }, (_, i) => `tag${i}`);
    const videos = [makeVideo({ tags })];
    const { topKeywords } = summarizeChannel(channel, videos);
    expect(topKeywords).toHaveLength(10);
    expect(topKeywords).toEqual(tags.slice(0, 10));
  });

  it("태그가 전부 비어 있으면 제목 단어(특수문자 제거, 2글자 이상)로 집계한다", () => {
    const videos = [
      makeVideo({ title: "[브이로그] 제주도 여행 #1", tags: [] }),
      makeVideo({ title: "제주도 맛집 투어!", tags: [] }),
      makeVideo({ title: "Vlog | 제주도, \"맛집\" 정리", tags: [] }),
    ];
    const { topKeywords } = summarizeChannel(channel, videos);
    expect(topKeywords).toEqual(["제주도", "맛집", "브이로그", "여행", "투어", "Vlog", "정리"]);
  });

  it("평균 조회수를 반올림한 정수로 계산한다", () => {
    const videos = [
      makeVideo({ viewCount: 100 }),
      makeVideo({ viewCount: 101 }),
    ];
    expect(summarizeChannel(channel, videos).averageViews).toBe(101); // 100.5 → 101

    const videos2 = [
      makeVideo({ viewCount: 10 }),
      makeVideo({ viewCount: 10 }),
      makeVideo({ viewCount: 11 }),
    ];
    expect(summarizeChannel(channel, videos2).averageViews).toBe(10); // 10.33 → 10
  });

  it("조회수 내림차순 상위 3개를 topVideos로 반환한다", () => {
    const a = makeVideo({ viewCount: 50 });
    const b = makeVideo({ viewCount: 500 });
    const c = makeVideo({ viewCount: 5 });
    const d = makeVideo({ viewCount: 300 });
    const { topVideos } = summarizeChannel(channel, [a, b, c, d]);
    expect(topVideos.map((v) => v.id)).toEqual([b.id, d.id, a.id]);
  });

  it("영상이 2개면 topVideos도 2개다", () => {
    const a = makeVideo({ viewCount: 1 });
    const b = makeVideo({ viewCount: 2 });
    const { topVideos } = summarizeChannel(channel, [a, b]);
    expect(topVideos.map((v) => v.id)).toEqual([b.id, a.id]);
  });

  it("recentTitles는 입력 순서 그대로 제목 배열이다", () => {
    const videos = [
      makeVideo({ title: "최신", viewCount: 1 }),
      makeVideo({ title: "중간", viewCount: 100 }),
      makeVideo({ title: "오래됨", viewCount: 10 }),
    ];
    expect(summarizeChannel(channel, videos).recentTitles).toEqual(["최신", "중간", "오래됨"]);
  });

  it("입력 배열을 변경하지 않는다", () => {
    const videos = [makeVideo({ viewCount: 1 }), makeVideo({ viewCount: 2 })];
    const ids = videos.map((v) => v.id);
    summarizeChannel(channel, videos);
    expect(videos.map((v) => v.id)).toEqual(ids);
  });
});
