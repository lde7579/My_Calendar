import { describe, expect, it } from "vitest";

// vitest 동작 확인용 스모크 테스트 (이후 step에서 삭제 가능)
describe("smoke", () => {
  it("vitest가 동작한다", () => {
    expect(1 + 1).toBe(2);
  });
});
