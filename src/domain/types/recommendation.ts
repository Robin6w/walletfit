import type { WalletCard, SpendCategoryId } from "./card";

export interface CategoryRewardLine {
  category: SpendCategoryId;
  spend: number;
  benefitAmount: number;
  capped: boolean;
}

export interface CardFitScore {
  card: WalletCard;
  /** 입력한 지출 총액 중 전월실적 산정에 포함된 금액 */
  qualifyingSpend: number;
  /** 실적 조건을 만족했는지 여부 */
  meetsMinimum: boolean;
  /** 만족한 구간 (여러 구간을 만족하면 가장 혜택이 큰 구간을 선택) */
  tierIndex: number | null;
  /** 카테고리별 혜택 상세 */
  breakdown: CategoryRewardLine[];
  /** 월 총 혜택액 (할인 + 적립 + 캐시백 합산) */
  totalMonthlyBenefit: number;
  /** 총 혜택액 - (연회비 / 12) */
  netMonthlyBenefit: number;
}

export interface CategoryTopPick {
  category: SpendCategoryId;
  bestCard: WalletCard | null;
  benefitAmount: number;
}
