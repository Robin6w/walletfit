import { describe, it, expect } from "vitest";
import { scoreCard, computeQualifyingSpend } from "@/domain/engine/benefitCalculator";
import type { WalletCard } from "@/domain/types/card";

const sampleCard: WalletCard = {
  id: "test-card",
  name: "테스트 카드",
  issuer: "테스트카드사",
  cardType: "credit",
  annualFee: 12000, // 월 1,000원 환산
  excludedCategories: ["mobile"],
  tiers: [
    {
      minSpend: 300000,
      benefits: [
        { category: "cafe", type: "discount", rate: 0.1, capPerMonth: 5000 },
        { category: "transport", type: "discount", rate: 0.1 },
      ],
    },
    {
      minSpend: 700000,
      benefits: [
        { category: "cafe", type: "discount", rate: 0.1, capPerMonth: 10000 },
        { category: "transport", type: "discount", rate: 0.1 },
        { category: "onlineShopping", type: "discount", rate: 0.05 },
      ],
    },
  ],
};

describe("computeQualifyingSpend", () => {
  it("실적 제외 카테고리를 뺀 금액을 반환한다", () => {
    const spending = { cafe: 100000, mobile: 50000, transport: 30000 };
    expect(computeQualifyingSpend(sampleCard, spending)).toBe(130000);
  });
});

describe("scoreCard", () => {
  it("실적 미달이면 혜택이 0이다", () => {
    const spending = { cafe: 50000, mobile: 0, transport: 0 };
    const result = scoreCard(sampleCard, spending);
    expect(result.meetsMinimum).toBe(false);
    expect(result.totalMonthlyBenefit).toBe(0);
  });

  it("1구간을 만족하면 해당 구간 혜택을 계산한다", () => {
    const spending = { cafe: 100000, mobile: 0, transport: 200000 };
    const result = scoreCard(sampleCard, spending);
    expect(result.meetsMinimum).toBe(true);
    expect(result.tierIndex).toBe(0);
    // cafe: 100000 * 0.1 = 10000 -> cap 5000
    // transport: 200000 * 0.1 = 20000 (cap 없음)
    expect(result.totalMonthlyBenefit).toBe(25000);
    expect(result.netMonthlyBenefit).toBeCloseTo(25000 - 1000);
  });

  it("2구간을 만족하면 더 높은 한도의 혜택을 적용한다", () => {
    // 실적 인정 금액(mobile 제외) = 200000 + 300000 + 300000 = 800000 >= 700000
    const spending = { cafe: 200000, mobile: 0, transport: 300000, onlineShopping: 300000 };
    const result = scoreCard(sampleCard, spending);
    expect(result.tierIndex).toBe(1);
    // cafe: 200000 * 0.1 = 20000 -> cap 10000
    // transport: 300000 * 0.1 = 30000 (cap 없음)
    // onlineShopping: 300000 * 0.05 = 15000
    expect(result.totalMonthlyBenefit).toBe(55000);
  });
});
