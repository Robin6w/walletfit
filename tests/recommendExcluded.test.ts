import { describe, expect, it } from "vitest";
import { catalogCards, isRecommendExcluded, issuableCards } from "@/v1/catalog";

describe("추천에서 빼는 카드(나라사랑카드, 2026-11-25)", () => {
  const nara = catalogCards.filter((c) => c.name.includes("나라사랑"));

  it("카드 목록의 나라사랑카드 5장을 모두 뺀다", () => {
    expect(nara.map((c) => c.sourceId).sort((a, b) => a - b)).toEqual([446, 739, 2933, 2934, 2941]);
    for (const c of nara) expect(isRecommendExcluded(c.sourceId)).toBe(true);
  });

  it("새 카드 후보(검수 안 한 카드 포함)에 하나도 없다", () => {
    const pool = new Set(issuableCards({ includeUnverified: true }).map((c) => c.sourceId));
    for (const c of nara) expect(pool.has(c.sourceId)).toBe(false);
  });

  it("다른 카드는 빼지 않는다", () => {
    const others = catalogCards.filter((c) => !c.name.includes("나라사랑"));
    expect(others.some((c) => isRecommendExcluded(c.sourceId))).toBe(false);
    expect(isRecommendExcluded(-1)).toBe(false);
  });
});
