import type { WalletCard, MonthlySpend } from "@/domain/types/card";
import type { CardFitScore, CategoryRewardLine } from "@/domain/types/recommendation";

/**
 * 카테고리별 지출 총합에서 전월실적 제외 카테고리를 뺀 실적 인정 금액을 계산합니다.
 */
export function computeQualifyingSpend(card: WalletCard, spending: MonthlySpend): number {
  const excluded = card.excludedCategories ?? [];
  let total = 0;
  for (const [category, amount] of Object.entries(spending)) {
    if (excluded.includes(category)) continue;
    total += amount || 0;
  }
  return total;
}

/**
 * tiers가 minSpend 오름차순으로 정렬되어 있다는 전제 하에, 이분 탐색으로
 * "실적 인정 금액 이상인 조건 중 가장 높은(=혜택이 큰) 구간"의 인덱스를 찾습니다.
 * 구간 수가 늘어나도 순차 스캔 없이 O(log n)에 판정할 수 있습니다.
 */
export function resolveTierIndex(card: WalletCard, qualifyingSpend: number): number | null {
  const tiers = card.tiers;
  let lo = 0;
  let hi = tiers.length - 1;
  let best: number | null = null;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (qualifyingSpend >= tiers[mid].minSpend) {
      best = mid;
      lo = mid + 1; // 조건을 만족하는 더 높은 구간이 있는지 오른쪽을 계속 탐색
    } else {
      hi = mid - 1;
    }
  }

  return best;
}

function applyBenefitCap(spend: number, rate: number, capPerMonth?: number): { amount: number; capped: boolean } {
  const rawAmount = spend * rate;
  if (capPerMonth === undefined) {
    return { amount: rawAmount, capped: false };
  }
  return { amount: Math.min(rawAmount, capPerMonth), capped: rawAmount > capPerMonth };
}

/** 카드 한 장에 대해 주어진 지출 프로필 기준 혜택을 계산합니다. */
export function scoreCard(card: WalletCard, spending: MonthlySpend): CardFitScore {
  const qualifyingSpend = computeQualifyingSpend(card, spending);
  const tierIndex = resolveTierIndex(card, qualifyingSpend);
  const activeBenefits = tierIndex !== null ? card.tiers[tierIndex].benefits : [];

  const breakdown: CategoryRewardLine[] = activeBenefits.map((benefit) => {
    const spend = spending[benefit.category] ?? 0;
    const { amount, capped } = applyBenefitCap(spend, benefit.rate, benefit.capPerMonth);
    return { category: benefit.category, spend, benefitAmount: amount, capped };
  });

  const totalMonthlyBenefit = breakdown.reduce((sum, line) => sum + line.benefitAmount, 0);
  const netMonthlyBenefit = totalMonthlyBenefit - card.annualFee / 12;

  return {
    card,
    qualifyingSpend,
    meetsMinimum: tierIndex !== null,
    tierIndex,
    breakdown,
    totalMonthlyBenefit,
    netMonthlyBenefit,
  };
}
