import { describe, it, expect } from "vitest";
import { rankByNetReward, topPickPerCategory } from "@/domain/engine/recommender";
import type { WalletCard } from "@/domain/types/card";

// 테스트용 카드 2장 구성
const cardA: WalletCard = {
  id: "card-a",
  name: "카드 A (카페 특화)",
  issuer: "A사",
  cardType: "credit",
  annualFee: 12000, // 월 1,000원
  excludedCategories: [],
  tiers: [
    {
      minSpend: 300000,
      benefits: [
        { category: "cafe", type: "discount", rate: 0.2, capPerMonth: 10000 },
        { category: "transport", type: "discount", rate: 0.05, capPerMonth: 5000 },
      ],
    },
  ],
};

const cardB: WalletCard = {
  id: "card-b",
  name: "카드 B (교통 특화)",
  issuer: "B사",
  cardType: "credit",
  annualFee: 24000, // 월 2,000원
  excludedCategories: [],
  tiers: [
    {
      minSpend: 300000,
      benefits: [
        { category: "cafe", type: "discount", rate: 0.05, capPerMonth: 5000 },
        { category: "transport", type: "discount", rate: 0.2, capPerMonth: 10000 },
      ],
    },
  ],
};

describe("recommender - rankByNetReward", () => {
  it("카드들의 순혜택액(netMonthlyBenefit)에 따라 내림차순 정렬해야 한다", () => {
    // 지출 시나리오: 카페 50,000원, 교통 200,000원, 쇼핑 100,000원 (총 350,000원으로 두 카드 모두 실적 충족)
    // 카드 A:
    // - cafe: 50,000 * 0.2 = 10,000원 (한도 내)
    // - transport: 200,000 * 0.05 = 10,000원 -> 한도 초과로 5,000원
    // - 총 혜택: 15,000원, 순혜택: 15,000 - 1,000 = 14,000원
    // 카드 B:
    // - cafe: 50,000 * 0.05 = 2,500원 (한도 내)
    // - transport: 200,000 * 0.2 = 40,000원 -> 한도 초과로 10,000원
    // - 총 혜택: 12,500원, 순혜택: 12,500 - 2,000 = 10,500원
    // 따라서 카드 A가 1위, 카드 B가 2위가 되어야 함.
    const spending = { cafe: 50000, transport: 200000, onlineShopping: 100000 };
    const ranked = rankByNetReward([cardB, cardA], spending);

    expect(ranked[0].card.id).toBe("card-a");
    expect(ranked[0].netMonthlyBenefit).toBe(14000);
    expect(ranked[1].card.id).toBe("card-b");
    expect(ranked[1].netMonthlyBenefit).toBe(10500);
  });

  it("실적 미달인 카드도 랭킹 결과에 포함되어야 하며 meetsMinimum: false여야 한다", () => {
    // 실적 미달 지출 시나리오 (총 100,000원)
    const spending = { cafe: 50000, transport: 50000 };
    const ranked = rankByNetReward([cardA], spending);

    expect(ranked.length).toBe(1);
    expect(ranked[0].meetsMinimum).toBe(false);
    expect(ranked[0].netMonthlyBenefit).toBe(-1000); // 혜택 0원 - 월 연회비 1000원
  });
});

describe("recommender - topPickPerCategory", () => {
  it("카테고리별로 실적 조건을 충족한 카드 중 혜택이 가장 큰 카드를 매칭해야 한다", () => {
    // 지출 시나리오: 카페 50,000원, 교통 200,000원, 쇼핑 100,000원 (두 카드 모두 실적 충족)
    const spending = { cafe: 50000, transport: 200000, onlineShopping: 100000 };
    const categories: ("cafe" | "transport" | "onlineShopping")[] = ["cafe", "transport", "onlineShopping"];

    const winners = topPickPerCategory([cardA, cardB], spending, categories);

    // 카페 카테고리: 카드 A(10,000원 혜택) vs 카드 B(2,500원 혜택) -> 카드 A 우승
    const cafeWinner = winners.find((w) => w.category === "cafe");
    expect(cafeWinner).toBeDefined();
    expect(cafeWinner?.bestCard?.id).toBe("card-a");
    expect(cafeWinner?.benefitAmount).toBe(10000);

    // 교통 카테고리: 카드 A(5,000원 혜택) vs 카드 B(10,000원 혜택) -> 카드 B 우승
    const transportWinner = winners.find((w) => w.category === "transport");
    expect(transportWinner).toBeDefined();
    expect(transportWinner?.bestCard?.id).toBe("card-b");
    expect(transportWinner?.benefitAmount).toBe(10000);

    // 쇼핑 카테고리: 둘 다 혜택 없음 -> winner의 bestCard는 null이고 benefitAmount는 0
    const shoppingWinner = winners.find((w) => w.category === "onlineShopping");
    expect(shoppingWinner).toBeDefined();
    expect(shoppingWinner?.bestCard).toBeNull();
    expect(shoppingWinner?.benefitAmount).toBe(0);
  });
});

describe("recommender - topPickPerCategory with different minSpends", () => {
  it("실적 조건을 충족하지 못한 카드는 카테고리 혜택 후보에서 제외해야 한다", () => {
    const cardHighSpend: WalletCard = {
      id: "card-high",
      name: "고실적 카드",
      issuer: "C사",
      cardType: "credit",
      annualFee: 10000,
      excludedCategories: [],
      tiers: [{ minSpend: 500000, benefits: [{ category: "cafe", type: "discount", rate: 0.5 }] }],
    };
    const cardLowSpend: WalletCard = {
      id: "card-low",
      name: "저실적 카드",
      issuer: "D사",
      cardType: "credit",
      annualFee: 10000,
      excludedCategories: [],
      tiers: [{ minSpend: 100000, benefits: [{ category: "cafe", type: "discount", rate: 0.1 }] }],
    };

    const spending = { cafe: 200000 }; // 총 200,000원 지출 -> cardHigh는 미달, cardLow는 충족
    const winners = topPickPerCategory([cardHighSpend, cardLowSpend], spending, ["cafe"]);

    const cafeWinner = winners.find((w) => w.category === "cafe");
    expect(cafeWinner).toBeDefined();
    // cardHigh가 50% 할인으로 혜택은 크지만 실적 미달이므로 cardLow가 우승해야 함.
    expect(cafeWinner?.bestCard?.id).toBe("card-low");
    expect(cafeWinner?.benefitAmount).toBe(20000); // 200,000 * 0.1
  });
});
