/** 지출 카테고리 ID. data/categories.json 과 1:1로 매칭됩니다. */
export type SpendCategoryId = string;

export interface SpendCategory {
  id: SpendCategoryId;
  label: string;
}

export type RewardKind = "discount" | "point" | "cashback";

export interface RewardRule {
  /** 혜택이 적용되는 카테고리 ID */
  category: SpendCategoryId;
  /** 할인 / 포인트적립 / 캐시백 구분 */
  type: RewardKind;
  /** 0.05 = 5% */
  rate: number;
  /** 월 혜택 한도 (원). 없으면 무제한 */
  capPerMonth?: number;
  description?: string;
}

export interface SpendTier {
  /** 이 구간의 혜택을 받기 위한 전월실적 최소 금액 (원) */
  minSpend: number;
  benefits: RewardRule[];
}

export type CardKind = "credit" | "check";

export interface WalletCard {
  id: string;
  name: string;
  issuer: string;
  cardType: CardKind;
  /** 카드 이미지 URL (카탈로그 원본 출처) */
  imageUrl?: string;
  /** 연회비 (원) */
  annualFee: number;
  /** 전월실적 산정에서 제외되는 카테고리 */
  excludedCategories?: SpendCategoryId[];
  /** 전월실적 구간별 혜택. minSpend 오름차순으로 저장 */
  tiers: SpendTier[];
  notes?: string;
}

/** 카테고리별 월 지출액 입력값 */
export type MonthlySpend = Record<SpendCategoryId, number>;
