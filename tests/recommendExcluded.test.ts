import { describe, expect, it } from "vitest";
import { catalogBySourceId, catalogCards, isRecommendExcluded, issuableCards } from "@/v1/catalog";

describe("추천에서 빼는 카드(나라사랑·국민행복·청소년, 2026-11-25)", () => {
  const excluded = catalogCards.filter((c) => isRecommendExcluded(c.sourceId));
  const ids = new Set(excluded.map((c) => c.sourceId));

  it("나라사랑카드 5장을 모두 뺀다", () => {
    const nara = catalogCards.filter((c) => c.name.includes("나라사랑")).map((c) => c.sourceId);
    expect(nara.sort((a, b) => a - b)).toEqual([446, 739, 2933, 2934, 2941]);
    for (const s of nara) expect(ids.has(s)).toBe(true);
  });

  it("국민행복카드를 모두 뺀다", () => {
    const happy = catalogCards.filter((c) => c.name.includes("국민행복"));
    expect(happy.length).toBe(25);
    for (const c of happy) expect(ids.has(c.sourceId)).toBe(true);
  });

  it("청소년 카드를 뺀다: 이름(청소년·틴즈·틴업·Teens·Hi teen)과 이름에 안 드러나는 10대 전용 카드", () => {
    for (const s of [1298, 685, 2852, 330, 2236, 2782, 2439, 679, 680, 686, 2060, 2419, 2639, 2665, 2857, 2887, 2889, 3019]) {
      expect(ids.has(s), `${s} ${catalogBySourceId.get(s)?.name}`).toBe(true);
    }
  });

  it("이름에 teen이 들어가도 청소년 카드가 아니면 빼지 않는다(위버스 SEVENTEEN), 아이행복도 그대로", () => {
    expect(isRecommendExcluded(2247)).toBe(false);
    expect(isRecommendExcluded(2249)).toBe(false);
    expect(isRecommendExcluded(344)).toBe(false);
    expect(isRecommendExcluded(-1)).toBe(false);
  });

  it("뺀 카드는 새 카드 후보(검수 안 한 카드 포함)에 하나도 없다", () => {
    const pool = issuableCards({ includeUnverified: true });
    expect(pool.some((c) => ids.has(c.sourceId))).toBe(false);
    expect(excluded.length).toBe(5 + 25 + 18);
  });
});
