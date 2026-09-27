import { describe, it, expect } from "vitest";
import { getCardAdvice } from "@/features/chatbot/cardAdvice";
import type { CardFitScore } from "@/domain/types/recommendation";
import type { SpendCategory } from "@/domain/types/card";

/**
 * getCardAdvice는 외부 LLM(Gemini 등)을 호출하지 않는 순수 규칙 기반 함수입니다
 * (팀 결정: LLM 미사용 — README/.cursorrules 참고). 이 테스트는 그 규칙들이
 * evaluations 배열만으로 올바른 문구를 만들어내는지 확인합니다.
 */

function makeScore(overrides: Partial<CardFitScore> & { cardId: string }): CardFitScore {
  const { cardId, ...rest } = overrides;
  return {
    card: {
      id: cardId,
      name: `카드 ${cardId}`,
      issuer: "A사",
      cardType: "credit",
      annualFee: 10000,
      tiers: [],
    },
    qualifyingSpend: 300000,
    meetsMinimum: true,
    tierIndex: 0,
    totalMonthlyBenefit: 5000,
    netMonthlyBenefit: 4000,
    breakdown: [],
    ...rest,
  };
}

const sampleCategories: SpendCategory[] = [{ id: "cafe", label: "카페" }];

describe("getCardAdvice", () => {
  it("evaluations가 빈 배열이면 바로 빈 객체를 반환해야 한다", async () => {
    const result = await getCardAdvice([], sampleCategories);
    expect(result).toEqual({});
  });

  it("전월실적 조건을 못 채운 카드는 실적 안내 문구를 반환해야 한다", async () => {
    const evaluations = [makeScore({ cardId: "card-1", meetsMinimum: false })];
    const result = await getCardAdvice(evaluations, sampleCategories);
    expect(result["card-1"]).toContain("전월실적 조건을 채우지 못했어요");
  });

  it("순혜택이 가장 큰 카드는 최우선 추천 문구와 최고 혜택 카테고리를 함께 반환해야 한다", async () => {
    const evaluations = [
      makeScore({
        cardId: "card-1",
        netMonthlyBenefit: 8000,
        breakdown: [{ category: "cafe", spend: 50000, benefitAmount: 5000, capped: false }],
      }),
      makeScore({ cardId: "card-2", netMonthlyBenefit: 2000 }),
    ];
    const result = await getCardAdvice(evaluations, sampleCategories);
    expect(result["card-1"]).toContain("가장 유리한 카드");
    expect(result["card-1"]).toContain("카페");
  });

  it("1위가 아니지만 특정 카테고리 혜택이 있는 카드는 잠재적 유리 문구를 반환해야 한다", async () => {
    const evaluations = [
      makeScore({ cardId: "card-1", netMonthlyBenefit: 8000 }),
      makeScore({
        cardId: "card-2",
        netMonthlyBenefit: 2000,
        breakdown: [{ category: "cafe", spend: 30000, benefitAmount: 3000, capped: false }],
      }),
    ];
    const result = await getCardAdvice(evaluations, sampleCategories);
    expect(result["card-2"]).toContain("카페");
    expect(result["card-2"]).toContain("유리해질 수 있어요");
  });

  it("실적 조건은 채웠지만 혜택이 0에 가까운 카드는 밋밋한 안내 문구를 반환해야 한다", async () => {
    const evaluations = [
      makeScore({ cardId: "card-1", netMonthlyBenefit: 8000 }),
      makeScore({ cardId: "card-2", netMonthlyBenefit: 0, breakdown: [] }),
    ];
    const result = await getCardAdvice(evaluations, sampleCategories);
    expect(result["card-2"]).toContain("혜택이 크지 않아요");
  });
});
