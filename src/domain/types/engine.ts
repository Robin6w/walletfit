/** 새 계산 엔진(wf_engine.py)이 돌려주는 값의 타입. 필드 이름은 Python 쪽과 같습니다. */

export type BenefitStatus = "reviewed" | "gold_ai" | "extracted" | "auto";

/** 카테고리별 브랜드 금액 비중. 예: { cafe: { 스타벅스: 0.4 } } */
export type BrandShare = Record<string, Record<string, number>>;

export interface TraceCat {
  cat: string;
  spend: number;
  /** 대상 비중(브랜드·요일·시간대 반영) */
  share: number;
  target: number;
}

export interface TraceCap {
  period: string;
  amount: number;
  monthly: number;
  hit: boolean;
}

export interface TraceBenefit {
  id: string;
  title: string;
  category: string | null;
  specificity: string;
  merchants: string[];
  kind: string;
  type: string;
  value: number | null;
  cats: TraceCat[];
  raw: number;
  afterOwn: number;
  caps: TraceCap[];
  final: number;
  skip: string | null;
  quote: string;
  /** 이 혜택이 속한 묶음 한도 id(EngineCard.shared의 id). 2026-10-28 추가, 이전 결과에는 없을 수 있음 */
  sharedIds?: string[];
  /* 아래는 혜택 표 원문 조건(카드 비교 화면용, 2026-10-29 추가). 이전 결과에는 없을 수 있음 */
  region?: string | null;
  channel?: string | null;
  /** 결제 조건(예: '후불 교통기능 선택 시') */
  condition?: string | null;
  /** 건당 할인 한도(원) */
  perTxnCap?: number | null;
  /** 최소 결제 금액(원) */
  minTxn?: number | null;
  countLimits?: { per_day?: number; per_month?: number; per_year?: number } | null;
  appliesInTiers?: string[] | null;
  valueTiers?: { tier: string | null; value: number | null }[];
  capTiers?: { period: string; tiers: { tier: string | null; amount: number | null }[] }[];
}

export interface TracePerf {
  basis: string;
  tiers: { id: string; min: number; max: number | null }[];
  tier: string | null;
  threshold: number | null;
  margin: number;
  qRaw: number;
  q: number;
  excluded: string[];
  excludesDiscounted: boolean;
  /* 원문 조건(카드 비교 화면용, 2026-10-29 추가). 이전 결과에는 없을 수 있음 */
  excludedItems?: string[];
  excludedCats?: string[];
  grace?: { months_after_issue?: number; assumed_tier?: string | null; note?: string } | null;
}

export interface EngineCard {
  sid: number;
  name: string;
  issuer: string;
  status: BenefitStatus;
  annualFee: number;
  feeMonthly: number;
  alloc: Record<string, number>;
  pay: number;
  total: number;
  net: number;
  options: { id: string; label: string }[];
  choiceAll: { ids: string[]; label: string; total: number }[];
  perf: TracePerf;
  benefits: TraceBenefit[];
  shared: { id: string; label: string; sum: number; cap: number; factor: number }[];
  flags: string[];
  log: string[];
  url?: string;
  /** 선택형 혜택 그룹. auto=카드사가 이용금액으로 자동 적용(2026-10-28 추가, 이전 결과에는 없을 수 있음) */
  choiceGroups?: { id: string; label: string; rule: string | null; auto: boolean }[];
  /** credit / check (2026-10-29 추가) */
  cardType?: string;
}

export interface EnginePack {
  cards: EngineCard[];
  total: number;
  fee: number;
  net: number;
  sids: number[];
}

export interface RecommendResponse {
  ok: boolean;
  empty?: boolean;
  error?: string;
  k: number;
  mode: "maxBenefit" | "efficient";
  margin: number;
  efficientCeiling: number | null;
  result: EnginePack;
  /** sids: 그 장수에서 고른 카드(2026-10-28 추가, 이전 결과에는 없을 수 있음) */
  bar: { k: number; net: number; cards: number; same: boolean; sids?: number[] }[];
  alt: { net: number; sids: number[]; names: string[] } | null;
  pool: number[];
  spending: Record<string, number>;
  elapsed: number;
}

export interface RecommendArgs {
  ids: number[];
  spending: Record<string, number>;
  margin: number;
  mode: "maxBenefit" | "efficient";
  maxCards: number;
  feeCap?: number;
  fixed?: number[];
  brandShare?: BrandShare;
  withAlt?: boolean;
  /** 같은 조건으로 다시 계산할 때 바꾸는 값(엔진은 읽지 않음) */
  retry?: number;
}

export interface RankRow {
  sid: number;
  total: number;
  net: number;
  tier?: string | null;
  error?: string;
  view?: EngineCard;
}

export interface BrandRow {
  name: string;
  cards: string[];
}
