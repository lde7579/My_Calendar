import { describe, expect, it } from "vitest";
import { categoryName, formatCount } from "@/lib/format";

describe("formatCount", () => {
  it("1만 미만은 ko-KR 천 단위 구분 기호로 표시한다", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(950)).toBe("950");
    expect(formatCount(9999)).toBe("9,999");
  });

  it("1만 이상은 소수점 한 자리 '만' 단위로 표시한다", () => {
    expect(formatCount(10000)).toBe("1만");
    expect(formatCount(12345)).toBe("1.2만");
    expect(formatCount(123456)).toBe("12.3만");
  });

  it("반올림하지 않고 내림해서 '10000만' 같은 표시가 나오지 않는다", () => {
    expect(formatCount(19999)).toBe("1.9만");
    expect(formatCount(99999999)).toBe("9999.9만");
  });

  it("1억 이상은 '억' 단위로 표시한다", () => {
    expect(formatCount(100000000)).toBe("1억");
    expect(formatCount(123456789)).toBe("1.2억");
  });
});

describe("categoryName", () => {
  it("YouTube 기본 카테고리 ID를 한국어 이름으로 바꾼다", () => {
    expect(categoryName("1")).toBe("영화/애니메이션");
    expect(categoryName("10")).toBe("음악");
    expect(categoryName("20")).toBe("게임");
    expect(categoryName("22")).toBe("인물/블로그");
    expect(categoryName("28")).toBe("과학기술");
  });

  it("목록에 없는 ID는 '카테고리 {id}'를 반환한다", () => {
    expect(categoryName("999")).toBe("카테고리 999");
    expect(categoryName("")).toBe("카테고리 ");
  });
});
