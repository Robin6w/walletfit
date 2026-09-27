import { describe, it, expect } from "vitest";
import { buildWalletBlueprint, shortlistCandidates } from "@/domain/engine/walletOptimizer";
import type { WalletCard } from "@/domain/types/card";

// 카페 특화 카드 (연회비 0)
const cardA: WalletCard = {
  id: "card-a",
  name: "카드 A (카페 특화)",
  issuer: "A사",
  cardType: "credit",
  annualFee: 0,
  tiers: [
    {
      minSpend: 0,
      benefits: [{ category: "cafe", type: "discount", rate: 0.1 }],
    },
  ],
};

// 외식 특화 카드 (연회비 0)
const cardB: WalletCard = {
  id: "card-b",
  name: "카드 B (외식 특화)",
  issuer: "B사",
  cardType: "credit",
  annualFee: 0,
  tiers: [
    {
      minSpend: 0,
      benefits: [{ category: "dining", type: "discount", rate: 0.1 }],
    },
  ],
};

// 두 카테고리를 다 커버하지만 혜택률이 낮고 연회비가 비싼 제너럴리스트 카드
const cardC: WalletCard = {
  id: "card-c",
  name: "카드 C (제너럴리스트, 연회비 높음)",
  issuer: "C사",
  cardType: "credit",
  annualFee: 120000, // 월 10,000원
  tiers: [
    {
      minSpend: 0,
      benefits: [
        { category: "cafe", type: "discount", rate: 0.05 },
        { category: "dining", type: "discount", rate: 0.05 },
      ],
    },
  ],
};

const spending = { cafe: 100000, dining: 100000 };

describe("buildWalletBlueprint", () => {
  it("카드를 2장까지 담을 수 있으면 카테고리별 특화 카드 조합(A+B)을 선택한다", () => {
    const result = buildWalletBlueprint([cardA, cardB, cardC], spending, { maxCards: 2 });

    expect(result.feasible).toBe(true);
    expect(result.selectedCards.map((c) => c.id).sort()).toEqual(["card-a", "card-b"]);
    expect(result.totalMonthlyFee).toBe(0);
    // cafe 100,000*0.1 + dining 100,000*0.1 = 20,000
    expect(result.totalMonthlyBenefit).toBeCloseTo(20000);
    expect(result.netMonthlyBenefit).toBeCloseTo(20000);

    const cafeAssignment = result.assignments.find((a) => a.category === "cafe");
    const diningAssignment = result.assignments.find((a) => a.category === "dining");
    expect(cafeAssignment?.card.id).toBe("card-a");
    expect(diningAssignment?.card.id).toBe("card-b");
  });

  it("카드를 1장만 담을 수 있으면, 연회비가 비싼 제너럴리스트(C)보다 특화 카드 1장이 더 유리하다", () => {
    const result = buildWalletBlueprint([cardA, cardB, cardC], spending, { maxCards: 1 });

    expect(result.feasible).toBe(true);
    expect(result.selectedCards).toHaveLength(1);
    expect(result.selectedCards[0].id).not.toBe("card-c");
    // 특화 카드 1장은 자기 카테고리에서만 10,000원, 다른 카테고리는 0원 -> 순혜택 10,000원
    expect(result.netMonthlyBenefit).toBeCloseTo(10000);
  });

  it("후보 카드가 없거나 지출이 전부 0이면 빈 결과를 feasible=true로 반환한다", () => {
    expect(buildWalletBlueprint([], spending, { maxCards: 2 }).feasible).toBe(true);
    expect(buildWalletBlueprint([cardA, cardB], { cafe: 0, dining: 0 }, { maxCards: 2 }).selectedCards).toHaveLength(0);
  });

  it("maxCards가 0이면 아무 카드도 선택하지 않는다", () => {
    const result = buildWalletBlueprint([cardA, cardB, cardC], spending, { maxCards: 0 });
    expect(result.selectedCards).toHaveLength(0);
    expect(result.netMonthlyBenefit).toBe(0);
  });

  it("월 한도에 걸리면 남는 지출을 다음으로 유리한 카드로 넘겨 한 카테고리를 여러 카드로 분할한다", () => {
    // 카드 D: 10% 할인이지만 월 5,000원 한도 (50,000원 지출에서 한도 도달)
    const cardD: WalletCard = {
      id: "card-d",
      name: "카드 D (한도 있음)",
      issuer: "D사",
      cardType: "credit",
      annualFee: 0,
      tiers: [
        { minSpend: 0, benefits: [{ category: "cafe", type: "discount", rate: 0.1, capPerMonth: 5000 }] },
      ],
    };
    // 카드 E: 한도는 없지만 할인율이 낮음
    const cardE: WalletCard = {
      id: "card-e",
      name: "카드 E (한도 없음)",
      issuer: "E사",
      cardType: "credit",
      annualFee: 0,
      tiers: [{ minSpend: 0, benefits: [{ category: "cafe", type: "discount", rate: 0.05 }] }],
    };

    const result = buildWalletBlueprint([cardD, cardE], { cafe: 100000 }, { maxCards: 2 });

    expect(result.feasible).toBe(true);
    expect(result.selectedCards.map((c) => c.id).sort()).toEqual(["card-d", "card-e"]);
    // D: 50,000원까지 채워 한도 5,000원 획득, 나머지 50,000원은 E에서 5% = 2,500원 -> 합계 7,500원
    expect(result.totalMonthlyBenefit).toBeCloseTo(7500, 1);
    expect(result.netMonthlyBenefit).toBeCloseTo(7500, 1);

    const dAssignment = result.assignments.find((a) => a.card.id === "card-d");
    const eAssignment = result.assignments.find((a) => a.card.id === "card-e");
    expect(dAssignment?.spend).toBeCloseTo(50000, 1);
    expect(dAssignment?.benefitAmount).toBeCloseTo(5000, 1);
    expect(eAssignment?.spend).toBeCloseTo(50000, 1);
    expect(eAssignment?.benefitAmount).toBeCloseTo(2500, 1);
  });

  it("연회비 0원 카드만 담아도 관리 비용은 totalMonthlyManagementCost로 따로 계산되고, totalMonthlyFee(실제 연회비)는 0을 유지한다", () => {
    const result = buildWalletBlueprint([cardA, cardB], spending, { maxCards: 2, managementCostPerCard: 2500 });

    expect(result.selectedCards).toHaveLength(2);
    expect(result.totalMonthlyFee).toBe(0); // cardA, cardB 모두 연회비 0원
    expect(result.totalMonthlyManagementCost).toBeCloseTo(5000); // 카드 2장 × 2,500원
    expect(result.netMonthlyBenefit).toBeCloseTo(result.totalMonthlyBenefit - 5000);
  });

  it("maxTotalAnnualFee를 지정하면 그 금액을 넘는 연회비 조합은 후보에서 아예 제외한다", () => {
    // 카드 F: 연회비는 높지만(연 120,000원) 혜택률이 훨씬 좋아서, 연회비 제한이 없으면 최선의 선택
    const cardF: WalletCard = {
      id: "card-f",
      name: "카드 F (연회비 높음, 혜택 좋음)",
      issuer: "F사",
      cardType: "credit",
      annualFee: 120000,
      tiers: [{ minSpend: 0, benefits: [{ category: "cafe", type: "discount", rate: 0.3 }] }],
    };
    // 카드 G: 연회비는 없지만 혜택률이 낮음
    const cardG: WalletCard = {
      id: "card-g",
      name: "카드 G (연회비 없음, 혜택 낮음)",
      issuer: "G사",
      cardType: "credit",
      annualFee: 0,
      tiers: [{ minSpend: 0, benefits: [{ category: "cafe", type: "discount", rate: 0.05 }] }],
    };
    const cafeSpending = { cafe: 100000 };

    const withoutCeiling = buildWalletBlueprint([cardF, cardG], cafeSpending, { maxCards: 1 });
    expect(withoutCeiling.selectedCards.map((c) => c.id)).toEqual(["card-f"]);

    const withCeiling = buildWalletBlueprint([cardF, cardG], cafeSpending, {
      maxCards: 1,
      maxTotalAnnualFee: 50000, // 카드 F의 연회비(120,000원)보다 낮게 설정
    });
    expect(withCeiling.selectedCards.map((c) => c.id)).toEqual(["card-g"]);
  });

  it("managementCostPerCard가 크면 maxCards가 넉넉해도 실익이 없는 추가 카드는 제외한다", () => {
    const withoutCost = buildWalletBlueprint([cardA, cardB, cardC], spending, { maxCards: 2 });
    expect(withoutCost.selectedCards).toHaveLength(2); // 관리 비용이 없으면 A+B 2장이 최적

    const withCost = buildWalletBlueprint([cardA, cardB, cardC], spending, {
      maxCards: 2,
      managementCostPerCard: 15000,
    });
    // 카드 1장을 추가로 드는 데 15,000원의 관리 비용이 든다면, 두 번째 카드가 주는
    // 추가 혜택(10,000원)보다 비용이 더 크므로 카드 1장만 담는 편이 더 유리하다.
    expect(withCost.selectedCards.length).toBeLessThan(2);
  });
});

describe("shortlistCandidates", () => {
  it("카테고리별 상위 N장만 후보로 남기고, 어디에서도 상위권이 아닌 카드는 제외한다", () => {
    const pruned = shortlistCandidates([cardA, cardB, cardC], spending, 1);
    const ids = pruned.map((c) => c.id).sort();
    // cafe 1위: A(10%) > C(5%), dining 1위: B(10%) > C(5%) => C는 어디서도 1위가 아니므로 제외
    expect(ids).toEqual(["card-a", "card-b"]);
  });
});
