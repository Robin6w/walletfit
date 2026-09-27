import type { WalletCard, SpendCategoryId, MonthlySpend } from "@/domain/types/card";
import type { CardFitScore, CategoryTopPick } from "@/domain/types/recommendation";
import { scoreCard } from "./benefitCalculator";

/**
 * 보유 카드 전체를 지출 프로필 기준으로 평가하고, 순혜택(netMonthlyBenefit) 내림차순으로 정렬합니다.
 * 실적 미달 카드도 결과에는 포함하되 meetsMinimum: false 로 표시되므로, 화면에서 필터링해서 보여줄 수 있습니다.
 */
export function rankByNetReward(cards: WalletCard[], spending: MonthlySpend): CardFitScore[] {
  const evaluations: CardFitScore[] = [];
  for (const card of cards) {
    evaluations.push(scoreCard(card, spending));
  }
  return evaluations.sort((a, b) => b.netMonthlyBenefit - a.netMonthlyBenefit);
}

/**
 * 카테고리별로 가장 유리한 카드를 매칭합니다.
 * "편의점은 A카드, 대중교통은 B카드" 처럼 여러 장을 조합해 쓰는 전략을 세울 때 사용합니다.
 *
 * 카테고리마다 전체 카드를 다시 훑는 대신, 실적 조건을 만족한 카드들의 혜택 내역을 한 번만 순회하며
 * 카테고리별 최댓값을 해시맵에 누적하는 방식입니다. 카드 수 × 카테고리 수만큼 반복하던 이중 루프를
 * (카드 수 × 카드별 혜택 항목 수) 한 번의 순회로 줄입니다.
 */
export function topPickPerCategory(
  cards: WalletCard[],
  spending: MonthlySpend,
  categories: SpendCategoryId[],
): CategoryTopPick[] {
  const winners = new Map<SpendCategoryId, CategoryTopPick>(
    categories.map((category) => [category, { category, bestCard: null, benefitAmount: 0 }]),
  );

  for (const card of cards) {
    const evaluation = scoreCard(card, spending);
    if (!evaluation.meetsMinimum) continue;

    for (const line of evaluation.breakdown) {
      const current = winners.get(line.category);
      // current가 없으면 이 함수가 요청받지 않은 카테고리이므로 무시합니다.
      if (current && line.benefitAmount > current.benefitAmount) {
        winners.set(line.category, { category: line.category, bestCard: card, benefitAmount: line.benefitAmount });
      }
    }
  }

  return categories.map((category) => winners.get(category)!);
}
