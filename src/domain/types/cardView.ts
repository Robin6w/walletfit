/**
 * 화면용 카드 혜택 요약(data/catalog/card-view.json, scripts/buildCardView.ts가 만듦).
 * 혜택 표(cards-benefit.json)에서 전체 카드 화면·카드 상세 창이 쓰는 칸만 골랐다. 키를 짧게 둔 건 파일 크기 때문이다.
 */
export interface TierAmount {
  tier: string | null;
  won: number;
}

export interface CardViewBenefit {
  id: string;
  /** 혜택 제목(원문 기준) */
  t: string;
  /** 앱 카테고리(없으면 전 가맹점 또는 앱 밖 업종) */
  c: string | null;
  /** 전 가맹점 혜택(특정 업종이 아님) */
  all?: boolean;
  /** discount | point | cashback | mileage | donation | coupon */
  k: string;
  /** percent | won_per_txn | per_unit_spend | won_per_period | won_per_liter | free_item */
  ty: string;
  v: { tier: string | null; value: number }[];
  /** per_unit_spend: 이 금액마다 v만큼 */
  unit?: number;
  caps: { period: string; amounts: TierAmount[] }[];
  /** 묶음 한도 id */
  sh?: string[];
  /** auto | review | no_calc */
  st: string;
  /** 원문 문장(240자까지) */
  q: string;
  m: string[];
  ch: string;
  reg: string;
  pc?: string;
  minTxn?: number;
  perTxn?: number;
  /** per_day | per_month | per_year | per_half_year → 횟수 */
  cnt?: Record<string, number>;
  /** 이 혜택이 적용되는 실적 구간 id */
  in?: string[];
}

export interface CardViewEntry {
  /** 혜택 표 출처: extracted(원문 정제) | gold_ai | reviewed | auto(요약 한 줄) */
  st: string;
  /** prev_month | this_month | none | unknown */
  basis: string;
  tiers: { id: string; min: number; max: number | null }[];
  exItems: string[];
  exCats: string[];
  /** 할인받은 결제는 실적에서 빠짐 */
  disc: boolean;
  /** 신규 발급 후 실적 유예 개월 */
  grace: number | null;
  shared: { id: string; label: string; period: string; amounts: TierAmount[] }[];
  choice: { label: string; options: string[] }[];
  b: CardViewBenefit[];
}

export interface CardViewFile {
  generatedAt: string;
  cards: Record<string, CardViewEntry>;
}
