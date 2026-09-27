import { catalogCards } from "@/domain/engine/loadCatalog";
import { toWalletCard } from "@/domain/engine/cardConverter";
import type { CatalogListing } from "@/domain/types/catalog";
import type { RewardRule, SpendCategoryId } from "@/domain/types/card";

/**
 * 카탈로그 카드 각각의 "기본(0구간) 혜택 목록"을 미리 한 번만 계산해 둔 인덱스입니다.
 * toWalletCard 변환 + 혜택 요약 파싱은 카드 수가 많아지면(카탈로그 갤러리의 카테고리
 * 필터 칩, 맞춤 추천 배너 등에서) 반복 비용이 커서, 매번 다시 계산하지 않도록 모듈
 * 로드 시 한 번만 만들어 둡니다(카탈로그 자체가 앱 실행 중 바뀌지 않는 정적 데이터라
 * 안전합니다). 다구간 카드도 tiers[0]이 항상 "실적을 전혀 안 채웠을 때 보장되는 가장
 * 낮은 요율"이므로(cardConverter.ts 참고), 여기서는 그 보수적인 기준값만 사용합니다.
 */
const BASELINE_BENEFITS_BY_SOURCE_ID = new Map<number, RewardRule[]>(
  catalogCards.map((entry) => [entry.sourceId, toWalletCard(entry).tiers[0]?.benefits ?? []]),
);

export function cardBaselineBenefits(sourceId: number): RewardRule[] {
  return BASELINE_BENEFITS_BY_SOURCE_ID.get(sourceId) ?? [];
}

export function cardSupportsCategory(sourceId: number, categoryId: SpendCategoryId): boolean {
  return cardBaselineBenefits(sourceId).some((b) => b.category === categoryId && b.rate > 0);
}

export function bestRateForCategory(sourceId: number, categoryId: SpendCategoryId): number {
  const rule = cardBaselineBenefits(sourceId).find((b) => b.category === categoryId);
  return rule?.rate ?? 0;
}

/** 후보 목록 중 특정 카테고리에서 가장 좋은 요율을 주는 카드(entry)를 찾습니다. 없으면 null. */
export function findBestCardForCategory(
  candidates: CatalogListing[],
  categoryId: SpendCategoryId,
): { entry: CatalogListing; rate: number } | null {
  let best: { entry: CatalogListing; rate: number } | null = null;
  for (const entry of candidates) {
    const rate = bestRateForCategory(entry.sourceId, categoryId);
    if (rate > 0 && (!best || rate > best.rate)) {
      best = { entry, rate };
    }
  }
  return best;
}
