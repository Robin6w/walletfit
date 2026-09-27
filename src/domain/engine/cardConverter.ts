import type { WalletCard, RewardRule, RewardKind, SpendCategoryId, SpendTier } from "@/domain/types/card";
import type { CatalogListing, CategoryTierData } from "@/domain/types/catalog";
import { KEYWORD_CATEGORY_PAIRS, blankOutAll, stripFalsePositivePhrases } from "@/features/statement/importerParser";

/**
 * 카탈로그에는 혜택별 정확한 월 한도가 없어(요약 텍스트에만 존재하는 경우가 대부분),
 * 할인/적립률 구간에 따라 한도를 다르게 근사합니다. 실제 카드 상품 다수가
 * "할인율이 높을수록 한도가 타이트하다"는 경향을 보이므로 이를 반영해
 * 모든 혜택이 동일하게 "월 10,000원"으로 수렴해 보이는 문제를 완화합니다.
 */
function estimateCapPerMonth(rate: number): number {
  if (rate >= 0.08) return 10000;
  if (rate >= 0.05) return 15000;
  if (rate >= 0.03) return 20000;
  if (rate >= 0.015) return 30000;
  return 50000;
}

const GENERIC_MERCHANT_KEYWORDS = ["가맹점", "전국", "국내외", "모든", "마일", "해외"];

/** 혜택 요약 한 문장을 개별 혜택 단위(절)로 쪼갭니다. */
function splitBenefitClauses(summary: string): string[] {
  // 혜택 유형 키워드가 끝나는 시점의 쉼표/플러스 기호로만 분할한다.
  // lookbehind로 '마트,편의점'처럼 명사 나열에 쓰인 쉼표에서 잘못 쪼개지는 것을 막는다.
  return summary.split(/(?<=(?:할인|적립|캐시백|포인트|마일|원|%|L))\s*[,+]\s*/);
}

/**
 * 절 하나에서 KEYWORD_MAP에 매칭되는 지출 카테고리들을 찾는다. 못 찾으면 범용 가맹점 문구를 본다.
 *
 * KEYWORD_CATEGORY_PAIRS는 글자 수가 긴 키워드부터 정렬돼 있다. 긴 키워드가 매칭되면 그
 * 글자 구간을 공백으로 지워서, 그 안에 우연히 들어있는 짧은 키워드가 다른 카테고리로 또
 * 잡히지 않게 한다. 예: "KTX/SRT 10% 할인"에서 "KTX"(교통)가 먼저 매칭되면 그 글자를
 * 지우므로, "KT"(통신비)는 더 이상 같은 자리에서 매칭되지 않는다. 반대로 "마트,편의점"처럼
 * 서로 겹치지 않는 키워드는 각자 정상적으로 매칭된다.
 */
function matchCategories(clause: string): SpendCategoryId[] {
  let working = stripFalsePositivePhrases(clause.toLowerCase());
  const matched = new Set<SpendCategoryId>();

  for (const { keyword, category } of KEYWORD_CATEGORY_PAIRS) {
    const keywordLower = keyword.toLowerCase();
    if (working.includes(keywordLower)) {
      matched.add(category as SpendCategoryId);
      working = blankOutAll(working, keywordLower);
    }
  }

  if (matched.size === 0 && GENERIC_MERCHANT_KEYWORDS.some((keyword) => clause.includes(keyword))) {
    matched.add("etc");
  }

  return [...matched];
}

interface RateExtraction {
  rate: number;
  type: RewardKind;
  /**
   * 명시적으로 알아낸 월 한도(원)가 있으면 여기 채운다. 있으면 estimateCapPerMonth의
   * 요율 기반 추정치보다 이 값을 우선한다 — 원문에 실제 금액이 적혀 있는데 굳이
   * 요율 구간표로 다시 추정하면 오히려 부정확해지기 때문이다.
   */
  capPerMonth?: number;
}

/** "5%", "0.2~2.0%" 같은 정률 할인/적립 표현을 읽는다. */
function extractPercentRate(clause: string): RateExtraction | null {
  // "0.2~2.0%"처럼 범위로 적힌 요율은 상한(2.0%)만 뽑으면 실적 구간 데이터가 없는 카드의
  // 경우 "무조건 받는 최고 요율"처럼 과대평가된다. 범위가 감지되면 최소·최댓값의 평균을
  // 대표값으로 쓴다(entry.categoryTiers로 실제 구간 데이터가 있으면 toWalletCard에서
  // 이 값 대신 그 데이터로 덮어쓴다).
  const rangeMatch = clause.match(/(\d+(?:\.\d+)?)\s*~\s*(\d+(?:\.\d+)?)\s*%/);
  if (rangeMatch) {
    const low = parseFloat(rangeMatch[1]);
    const high = parseFloat(rangeMatch[2]);
    return { rate: (low + high) / 2 / 100, type: "discount" };
  }

  const match = clause.match(/(\d+(?:\.\d+)?)\s*%/);
  if (!match) return null;
  return { rate: parseFloat(match[1]) / 100, type: "discount" };
}

/** "1,500원당 1마일" 같은 마일리지 적립 표현을 읽어, 원화 환산 적립률(1마일=15원 가정)로 바꾼다. */
function extractMileageRate(clause: string): RateExtraction | null {
  if (!clause.includes("마일")) return null;

  const wonMatch = clause.replace(/,/g, "").match(/(\d+)\s*원당/);
  const mileMatch = clause.match(/(\d+(?:\.\d+)?)\s*마일/);
  if (!wonMatch || !mileMatch) return null;

  const wonPerUnit = parseFloat(wonMatch[1]);
  const milesPerUnit = parseFloat(mileMatch[1]);
  return { rate: (milesPerUnit * 15) / wonPerUnit, type: "point" };
}

/** 리터당 할인("150원/L")이나 정액 할인("5,000원", "200~600원")을, 카테고리별 기준 금액 대비 비율로 환산한다. */
function extractAmountBasedRate(clause: string, category: SpendCategoryId): RateExtraction | null {
  const wonMatch = clause.replace(/,/g, "").match(/(\d+)\s*(?:~\s*(\d+))?\s*원/);
  if (!wonMatch) return null;

  const minWon = parseInt(wonMatch[1], 10);
  const maxWon = wonMatch[2] ? parseInt(wonMatch[2], 10) : minWon;
  const averageWon = (minWon + maxWon) / 2;

  const isPerLiter = clause.includes("/L") || clause.includes("L당") || clause.includes("리터당");
  if (isPerLiter) {
    return { rate: averageWon / 1500, type: "discount" };
  }

  // "3,000원 할인"처럼 정액으로 적힌 혜택은 "쓸수록 비율로 계속 커지는 혜택"이 아니라
  // "한 달에 최대 이 금액까지"에 가깝다. rate는 이 금액에 적당한 지출 규모에서 도달하도록
  // 잡는 보조값일 뿐이고, 진짜 한도는 원문에 적힌 금액 그대로 쓴다. 예전에는 이 rate를
  // estimateCapPerMonth의 요율 구간표에 다시 넣어 한도를 추정했는데, 그 구간표의 최저
  // 구간(10,000원)조차 웬만한 정액 혜택(예: 3,000원)보다 커서 실제보다 몇 배 부풀려진
  // 한도가 나오는 문제가 있었다.
  //
  // averageWon이 referenceAmount보다 크면(예: "최대 25,000원 할인") 비율이 100%를 넘어
  // "할인 250%"처럼 말이 안 되는 숫자가 화면(계산 과정 설명)에 그대로 노출된다. 실제
  // 카드 혜택 중에 100% 넘게 돌려주는 건 없으므로 100%를 상한으로 둔다 — capPerMonth가
  // 이미 실제 한도를 정확히 반영하므로, rate를 100%로 눌러도 "그 한도에 도달하는 데
  // 필요한 지출 규모"만 약간 커질 뿐 한도 자체가 줄어들지는 않는다.
  const referenceAmount = category === "transport" ? 1500 : category === "mobile" ? 50000 : 10000;
  const rate = Math.min(averageWon / referenceAmount, 1);
  return { rate, type: "discount", capPerMonth: Math.round(averageWon) };
}

// 정률 표현 -> 마일리지 -> 정액/리터당 순으로 시도하고, 먼저 매칭되는 결과를 채택한다.
const RATE_EXTRACTORS: Array<(clause: string, category: SpendCategoryId) => RateExtraction | null> = [
  (clause) => extractPercentRate(clause),
  (clause) => extractMileageRate(clause),
  extractAmountBasedRate,
];

function extractRate(clause: string, category: SpendCategoryId): RateExtraction {
  for (const extractor of RATE_EXTRACTORS) {
    const extracted = extractor(clause, category);
    if (extracted) return extracted;
  }
  return { rate: 0, type: "discount" };
}

/** 절에 "적립/포인트/캐시백" 같은 명시적 유형 단서가 있으면 그 유형으로 덮어쓴다. */
function resolveRewardKind(clause: string, extracted: RewardKind): RewardKind {
  if (clause.includes("적립") || clause.includes("포인트")) return "point";
  if (clause.includes("캐시백")) return "cashback";
  return extracted;
}

/** 같은 카테고리에 후보가 여러 개면, 가장 높은 할인/적립률 하나만 남긴다. */
function keepHighestRatePerCategory(candidates: RewardRule[]): RewardRule[] {
  const bestByCategory = new Map<SpendCategoryId, RewardRule>();
  for (const candidate of candidates) {
    const current = bestByCategory.get(candidate.category);
    if (!current || candidate.rate > current.rate) {
      bestByCategory.set(candidate.category, candidate);
    }
  }
  return [...bestByCategory.values()];
}

function parseBenefitSummary(benefitSummary: string): RewardRule[] {
  const candidates: RewardRule[] = [];

  for (const clause of splitBenefitClauses(benefitSummary)) {
    for (const category of matchCategories(clause)) {
      const { rate, type, capPerMonth } = extractRate(clause, category);
      if (rate <= 0) continue;

      candidates.push({
        category,
        type: resolveRewardKind(clause, type),
        rate,
        capPerMonth: capPerMonth ?? estimateCapPerMonth(rate),
        description: clause.trim(),
      });
    }
  }

  return keepHighestRatePerCategory(candidates);
}

/**
 * 실적 구간별로 실제 요율이 달라지는 카테고리(entry.categoryTiers)가 있으면, 그 구간
 * 경계들을 모두 합친 카드 공통 구간표를 만들고, 구간마다 해당 카테고리의 그 시점 요율을
 * 채운다. 구간 데이터가 없는 카테고리(flatBenefits)는 모든 구간에서 동일한 값을 쓴다.
 *
 * 주의: 지금 최적화 엔진(walletOptimizerCore.py)은 아직 tiers[0]만 본다(다구간 실적을
 * "당월 배정된 실적 스스로가 구간을 정한다"는 식으로 endogenous하게 판단하는 기능은
 * 아직 없음). 그래서 tiers[0]은 항상 minSpend=0 구간, 즉 "실적을 전혀 안 채웠을 때도
 * 보장되는 가장 낮은 요율"이 되도록 만든다 — 실제보다 부풀려진 요율을 보여주는 것보다
 * 안전한 쪽으로 근사한 것이다. 다구간 자체를 반영하는 최적화는 추후 작업.
 */
function buildTieredSpendTiers(flatBenefits: RewardRule[], categoryTiers: CategoryTierData[]): SpendTier[] {
  const breakpoints = [...new Set([0, ...categoryTiers.flatMap((ct) => ct.tiers.map((t) => t.minSpend))])].sort(
    (a, b) => a - b,
  );

  return breakpoints.map((minSpend) => {
    const tierBenefits: RewardRule[] = [...flatBenefits];
    for (const ct of categoryTiers) {
      const applicable = [...ct.tiers].reverse().find((t) => t.minSpend <= minSpend) ?? ct.tiers[0];
      tierBenefits.push({
        category: ct.category as SpendCategoryId,
        type: ct.type,
        rate: applicable.rate,
        capPerMonth: estimateCapPerMonth(applicable.rate),
        description: `전월실적 ${(minSpend / 10000).toFixed(0)}만원 이상 구간 요율`,
      });
    }
    return { minSpend, benefits: tierBenefits };
  });
}

/**
 * 카탈로그 카드 정보(CatalogListing)를 혜택 계산기용 카드 객체(WalletCard)로 변환합니다.
 * 혜택 요약 텍스트를 파싱하여 카테고리별 할인/적립률과 유형을 추정합니다. 실제 전월실적
 * 구간별 요율 데이터(entry.categoryTiers)가 있는 카테고리는 텍스트 파싱 대신 그 데이터를
 * 우선 사용합니다.
 */
export function toWalletCard(entry: CatalogListing): WalletCard {
  const parsedBenefits = entry.benefitSummary ? parseBenefitSummary(entry.benefitSummary) : [];
  const categoryTiers = entry.categoryTiers ?? [];
  const tieredCategoryIds = new Set(categoryTiers.map((ct) => ct.category));

  // 구간 데이터가 있는 카테고리는 요약 텍스트 파싱 결과를 버리고 구간 데이터로 대체한다
  // (요약 텍스트는 대표 요율 하나만 담고 있어서 부정확함 — 예: "0.2~2.0%"에서 상한만 뽑힘).
  const flatBenefits = parsedBenefits.filter((b) => !tieredCategoryIds.has(b.category));

  // 혜택 요약 문구가 매칭 카테고리 키워드/요율 패턴 어디에도 걸리지 않아 혜택을 하나도
  // 못 읽어낸 카드는, 예전에는 "그 외 일반가맹점 0.7%"라는 임의의 기본값을 부여했다.
  // 하지만 이건 실제로는 혜택 정보를 못 읽어낸 것뿐인데, 마치 검증된 낮은 혜택 카드처럼
  // 보이게 만드는 문제가 있었다(실제로는 5~50% 할인처럼 큰 혜택을 주는 카드도 이 경로를
  // 타면 0.7%짜리 카드로 취급됨). 지금은 혜택을 비워 둬서(순혜택 계산 시 0원으로 처리),
  // 추천 순위에서 실제로 알려진 혜택이 있는 카드에 밀리도록 한다. 원문 혜택 요약 텍스트
  // 자체는 카드 상세/타일에서 그대로 보여주므로(entry.benefitSummary), 정보가 사라지진
  // 않는다.
  const benefits: RewardRule[] = flatBenefits;

  const tiers: SpendTier[] =
    categoryTiers.length > 0
      ? buildTieredSpendTiers(benefits, categoryTiers)
      : [
          {
            minSpend: 0, // 시뮬레이션에서 바로 보일 수 있도록 실적 기준을 0으로 설정
            benefits,
          },
        ];

  return {
    id: `catalog-${entry.sourceId}`,
    name: entry.name,
    issuer: entry.issuer,
    cardType: entry.category === "체크" ? "check" : "credit",
    imageUrl: entry.imageUrl,
    annualFee: entry.annualFee || 0,
    excludedCategories: [],
    tiers,
  };
}
