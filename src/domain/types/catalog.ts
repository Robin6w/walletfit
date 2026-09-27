export type CatalogListingKind = "신용" | "체크" | "기타";

/** 전월실적 구간별로 실제 요율이 달라지는 카테고리 하나의 구간 데이터 (buildTieredCatalog.ts가 채움). */
export interface CategoryTierData {
  category: string;
  type: "discount" | "point" | "cashback";
  /** minSpend 오름차순. 표에 나온 구간표 원본 그대로(원 단위 minSpend, 0~1 사이 rate) */
  tiers: { minSpend: number; rate: number }[];
}

export interface CatalogListing {
  sourceId: number;
  sourceUrl: string;
  name: string;
  issuer: string;
  category: string;
  annualFeeText?: string;
  annualFee?: number;
  /** annualFee가 "국내전용/해외겸용" 등 여러 값 중 하나로 근사됐는지 여부 (walletfit 보정) */
  annualFeeApprox?: boolean;
  imageUrl?: string;
  benefitSummary?: string;
  fetchedAt: string;
  /**
   * 카드사가 신규 발급을 중단했는지 여부. 카드고릴라 내부 API(api.card-gorilla.com/v1/cards/{id})의
   * is_discon 필드를 그대로 수집한 값입니다. 예전에 수집된 항목에는 이 필드가 아예 없을 수 있습니다
   * (재수집 전에는 undefined).
   */
  isDiscontinued?: boolean;
  /**
   * 카드고릴라 내부 API의 key_benefit[].info 안 구간표를 파싱해서 얻은, 진짜 전월실적
   * 구간별 요율 데이터. 실제로는 극소수 카드/카테고리에만 존재합니다(buildTieredCatalog.ts
   * 참고 — 30장 표본 기준 대략 10% 카드의 카테고리 1~2개 정도). 없으면 지금처럼
   * benefitSummary 텍스트에서 단일(구간 없는) 요율을 추정합니다.
   */
  categoryTiers?: CategoryTierData[];
}
