import { describe, it, expect } from "vitest";
import { catalogCards, isDiscontinued, issuableCards, catalogBySourceId, isVerified, isRestricted } from "@/v1/catalog";
import benefit from "@data/catalog/cards-benefit.json";

// 발급 중단 표시와 카드 검색 필터 점검(2026-10-06)
describe("발급 중단 카드", () => {
  it("이름 목록(discontinued-cards.json)으로 지정한 카드도 중단으로 본다", () => {
    // 카드고릴라는 아직 '발급 중'이지만 2026-06-25 신한카드 단종 기사로 확인한 카드
    expect(isDiscontinued(catalogBySourceId.get(43)!)).toBe(true); // 신한카드 Deep Store
    expect(isDiscontinued(catalogBySourceId.get(687)!)).toBe(true); // 신한카드 Unboxing
  });

  it("새 카드 후보(issuableCards)에는 발급 중단 카드가 하나도 없다", () => {
    const issuable = issuableCards();
    expect(issuable.length).toBeGreaterThan(0);
    expect(issuable.some((c) => isDiscontinued(c))).toBe(false);
  });

  it("계산 엔진의 혜택 표와 화면이 같은 카드를 발급 중단으로 본다", () => {
    const fromTable = new Set(
      (benefit as { cards: { sid: number; record: { card: { discontinued: boolean } } }[] }).cards
        .filter((c) => c.record.card.discontinued)
        .map((c) => c.sid),
    );
    const fromApp = new Set(catalogCards.filter((c) => isDiscontinued(c)).map((c) => c.sourceId));
    expect([...fromTable].sort()).toEqual([...fromApp].sort());
  });
});

describe("카드 검색 필터", () => {
  it("카드사 이름이 빈 카드가 없다(카드사 필터에서 빠지지 않게)", () => {
    expect(catalogCards.filter((c) => !c.issuer.trim()).map((c) => c.name)).toEqual([]);
  });

  it("BC 칩이 찾는 카드사 이름이 카탈로그에 있다", () => {
    expect(catalogCards.some((c) => c.issuer === "BC 바로카드")).toBe(true);
  });
});

describe("새 카드 추천 후보", () => {
  it("기본은 원문과 대조한 카드만, 대상 한정 카드는 빼고 쓴다", () => {
    const pool = issuableCards();
    expect(pool.every((c) => isVerified(c) && !isRestricted(c) && !isDiscontinued(c))).toBe(true);
    expect(pool.length).toBe(58);
    const ids = new Set(pool.map((c) => c.sourceId));
    for (const sid of [2934, 712, 2857, 1202]) expect(ids.has(sid)).toBe(false);
  });

  it("검수 전 카드도 넣으면 자동 변환 카드가 더해지고, 10대 카드는 여전히 빠진다", () => {
    const all = issuableCards({ includeUnverified: true });
    expect(all.length).toBeGreaterThan(1000);
    expect(all.some((c) => c.sourceId === 2887)).toBe(false); // 신한카드 처음 체크(10대)
  });
});
