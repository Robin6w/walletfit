import solver from "javascript-lp-solver";
import type { LpModel } from "javascript-lp-solver";
import type { WalletCard, MonthlySpend } from "@/domain/types/card";
import type { SlotAssignment, WalletBlueprint } from "@/domain/types/optimization";
import { computeQualifyingSpend, resolveTierIndex } from "@/domain/engine/benefitCalculator";

/**
 * walletfit의 핵심 차별점: "카드 한 장 추천"이 아니라 "카드 K장 조합 + 카테고리별 배정"을
 * 동시에 정수계획법(MILP)으로 최적화합니다.
 *
 * 결정 변수 (카드 c가 카테고리 i에 혜택 규칙이 있는 조합에 대해서만 만듭니다 — 아래 "성능" 참고)
 *  - y_c ∈ {0,1}: 카드 c를 지갑에 포함할지 여부
 *  - x_{c,i} ≥ 0: 카테고리 i의 지출 중 카드 c로 결제하기로 한 금액 (연속값 — 한 카테고리를
 *    여러 카드로 나눠 배정할 수 있습니다. 예: 월 한도가 있는 카드는 한도까지만 채우고,
 *    나머지는 다음으로 유리한 카드로 넘깁니다.)
 *  - b_{c,i} ≥ 0: x_{c,i}에서 실제로 발생하는 혜택액 (요율과 월 한도를 반영)
 *
 * 목적함수: maximize  Σ b_{c,i}  −  Σ (annualFee_c / 12 + managementCost)·y_c
 *
 * 제약조건
 *  - 각 카테고리 i에 대해  Σ_c x_{c,i} ≤ spend_i        (카테고리 지출 한도 내에서만 배정 가능.
 *    등호가 아니라 부등호인 이유: 혜택을 주는 카드가 하나도 없는 카테고리라면 아무 데도
 *    배정하지 않아도(=0) 자연스럽게 실행가능해야 하기 때문입니다.)
 *  - 모든 c,i에 대해       x_{c,i} ≤ spend_i · y_c        (선택 안 한 카드로는 배정 불가)
 *  - 모든 c,i에 대해       b_{c,i} ≤ rate_{c,i} · x_{c,i}  (혜택은 배정 금액 × 요율을 못 넘음)
 *  - 월 한도가 있으면       b_{c,i} ≤ capPerMonth_{c,i}
 *  - Σ_c y_c ≤ maxCards                                    (지갑에 담을 카드 개수 상한)
 *
 * b_{c,i}를 "≤" 제약으로만 묶고 목적함수에서 maximize하는 것은 표준적인 LP 트릭입니다.
 * 목적함수가 b를 최대한 키우려 하고 b를 키울수록 손해보는 제약이 없으므로, 최적해에서는
 * 항상 b_{c,i} = min(rate_{c,i}·x_{c,i}, capPerMonth_{c,i})가 되어 실제 혜택 계산식과 일치합니다.
 *
 * 성능: x_{c,i}/b_{c,i}는 카드 c가 카테고리 i에 실제 혜택 규칙을 가진 조합에만 만듭니다.
 * 카드 하나가 보통 몇 개 카테고리에만 혜택을 주므로, 모든 (카드, 카테고리) 조합에 변수를
 * 만드는 것보다 실제 변수/제약 개수가 훨씬 적습니다. 후보가 많을 때(전체 카드 범위)
 * 이 가지치기가 없으면 이 라이브러리의 LP 풀이 자체가 눈에 띄게 느려집니다.
 *
 * 알려진 단순화:
 *  - 이 파일(javascript-lp-solver 버전)의 buildWalletBlueprint 자체는 실제 서비스에서
 *    쓰이지 않는 legacy 코드입니다(현재 어디서도 import되지 않음 — src/legacy/SimulatorPage.tsx가
 *    참고용으로만 남아있음). 실제 최적화는 Web Worker 안의 walletOptimizerCore.py(Pyodide +
 *    scipy.optimize.milp)로 계산하고, 그 파일은 구간 선택(어느 전월실적 구간에 도달했는지)까지
 *    이진 변수로 최적화가 스스로 판단하게 하는 확장이 이미 들어가 있습니다.
 *  - 다만 이 파일의 shortlistCandidates(아래)는 legacy가 아니라 "전체 카드 중 추천"에서
 *    Python 솔버에 넘길 후보를 미리 추릴 때 실제로 쓰입니다. findBenefitRule/categoryBenefit은
 *    카드가 주어진 지출 프로필에서 실제 도달 가능한 구간(computeQualifyingSpend +
 *    resolveTierIndex)을 기준으로 후보 순위를 매깁니다 — 예전에는 항상 tiers[0](실적
 *    미달 시 최저 구간)만 봐서, 실적 조건을 충족하는데도 좋은 구간 카드가 후보 자체에서
 *    배제되는 문제가 있었습니다.
 *  - excludedCategories(전월실적 산정 제외 카테고리)는 이 파일에서는 아직 사용하지
 *    않습니다. walletOptimizerCore.py 쪽은 이미 반영되어 있습니다.
 */

/**
 * "카드 개수를 몇 장까지 추천할지"를 사용자가 직접 숫자로 정하는 대신, 두 가지 성향 중
 * 하나를 고르는 것으로 바꿔주는 모드입니다.
 *  - maxBenefit(혜택 최대화): 관리 비용 없이 MILP를 한 번 풀어서 나온 결과를 그대로 씁니다.
 *    연회비만으로도 이미, 선택된 카드는 항상 자기 연회비 이상을 벌어주고 있어야 최적해가
 *    됩니다(그렇지 않으면 그 카드를 빼는 게 objective 상 항상 더 유리하기 때문).
 *  - efficient(효율적): 같은 결과에서 "카드별로 실제 얼마나 벌어줬는지"를 사후에 비교해,
 *    1등 카드 대비 기여도가 낮은 카드를 추려냅니다. 실제로 카드 수가 줄어들 때만 그 줄어든
 *    카드 수로 다시 한 번 풀어서 남은 카드들에 지출을 재배정합니다.
 * 예전에는 이 구분을 "카드 1장당 가상의 관리 비용"을 objective에 얼마나 크게 넣느냐로
 * 구현했지만, 그러면 두 모드가 우연히 완전히 같은 카드 조합을 추천해도 그 가상 비용이
 * 다르게 빠져서 화면에 보이는 혜택 숫자가 달라지는 문제가 있었습니다. 지금은 기여도 기준
 * 사후 필터링 방식(useWalletBlueprintAsync.ts의 solveWalletWithMode/resolveEfficientCardCount
 * 참고)이라, 두 모드가 같은 조합을 고르면 숫자도 항상 완전히 같습니다.
 */
export type OptimizationMode = "maxBenefit" | "efficient";

/**
 * 연회비 상한 조절 UI가 표현할 수 있는 최댓값(원/년). 카탈로그 카드의 96% 이상이 이 값
 * 이하라서, 이 값 이상으로 올리면 사실상 "제한 없음"과 같은 효과를 냅니다.
 */
export const ANNUAL_FEE_CEILING_MAX = 300000;
/** 연회비 상한 조절 UI 한 칸의 크기(원/년). */
export const ANNUAL_FEE_CEILING_STEP = 30000;

/** LP solver의 부동소수점 오차로 생기는 의미 없는 배정(예: 0.0000003원)을 걸러내는 기준값 */
const MIN_MEANINGFUL_SPEND = 1;

const BUDGET_CONSTRAINT = "__maxCards";
const ANNUAL_FEE_CONSTRAINT = "__maxAnnualFee";
const OBJECTIVE = "netBenefit";

function yVar(cardId: string): string {
  return `y__${cardId}`;
}

/** 카드 c가 카테고리 i에서 실제로 결제하기로 한 금액을 나타내는 변수 */
function xVar(cardId: string, category: string): string {
  return `x__${cardId}__${category}`;
}

/** xVar에서 나오는 혜택액을 나타내는 변수 (요율·월 한도 반영) */
function bVar(cardId: string, category: string): string {
  return `b__${cardId}__${category}`;
}

/**
 * 카드가 주어진 지출 프로필에서 실제로 도달할 구간의 혜택 규칙을 찾는다. 예전에는 항상
 * tiers[0](실적을 전혀 안 채웠을 때의 최저 구간)만 봤는데, 이러면 실적 조건이 있는
 * 카테고리 구간 카드(예: 전월실적 30만원 이상 카페 5%)가 실제로는 사용자가 그 실적을
 * 충분히 채우는데도 "실적 미달 시 최저 요율"로만 평가돼 후보 선별(shortlistCandidates)
 * 단계에서 부당하게 낮은 점수를 받는 문제가 있었다. computeQualifyingSpend/
 * resolveTierIndex(benefitCalculator.ts, 실제 조합 결과 화면에서 카드 한 장 평가에 쓰는
 * 것과 동일한 로직)로 이 지출 프로필이라면 실제로 도달 가능한 가장 유리한 구간을 찾아
 * 그 구간 기준으로 후보를 추린다.
 */
function findBenefitRule(card: WalletCard, category: string, spending: MonthlySpend) {
  const qualifyingSpend = computeQualifyingSpend(card, spending);
  const tierIndex = resolveTierIndex(card, qualifyingSpend) ?? 0;
  return card.tiers[tierIndex]?.benefits.find((b) => b.category === category);
}

/** 카드 한 장이 카테고리 하나의 지출 "전액"을 받는다고 가정했을 때의 월 혜택액 (실제 도달 구간 기준, capPerMonth 적용) */
function categoryBenefit(card: WalletCard, category: string, spend: number, spending: MonthlySpend): number {
  if (spend <= 0) return 0;
  const rule = findBenefitRule(card, category, spending);
  if (!rule) return 0;
  const raw = spend * rule.rate;
  return rule.capPerMonth !== undefined ? Math.min(raw, rule.capPerMonth) : raw;
}

export interface WalletBlueprintOptions {
  /** 지갑에 담을 수 있는 카드 개수 상한 (사용자가 직접 입력) */
  maxCards: number;
  /**
   * 카드 1장을 추가로 지갑에 담을 때 발생한다고 가정하는 월 관리 비용(원).
   * 연회비가 0원인 카드라도 여러 장을 발급/관리하는 데는 실제로 비용(실적 관리, 분실 위험,
   * 카드사 앱 관리 등)이 따르므로, 이 비용을 objective에 반영해 "혜택 차이가 미미한데도
   * 카드 수만 늘리는" 비현실적인 조합을 걸러냅니다. 기본값 0 (기존 동작과 동일).
   */
  managementCostPerCard?: number;
  /**
   * 지갑에 담긴 카드들의 "연회비 합계" 상한(원/년). 지정하면 이 금액을 넘는 조합은 아예
   * 후보에서 제외합니다(관리 비용은 이 상한에 포함하지 않습니다). 지정하지 않으면
   * 연회비 자체에는 제한을 두지 않고, 카드 한 장 늘릴 때의 월 관리 비용만으로 억제합니다.
   */
  maxTotalAnnualFee?: number;
  /**
   * 카드ID -> 원/월. 이 앱이 카테고리로 잡지 못하는 지출(공과금, 이미 그 카드로 나가는
   * 고정 지출 등)이 있어도 실제로는 전월실적에 잡히는 경우가 있습니다. 여기 넣은 금액은
   * "혜택 계산에는 안 들어가지만 그 카드의 구간 도달 판정에는 더해지는" 가상의 기본
   * 실적으로 취급됩니다(walletOptimizerCore.py 쪽에만 반영되어 있습니다 — 위 "알려진
   * 단순화" 참고). 아직 이 값을 입력받는 화면이 없어서 지금은 항상 빈 값(=기존과 동일)
   * 입니다.
   */
  baselineSpendByCardId?: Record<string, number>;
}

/**
 * 후보 카드들과 지출 프로필이 주어졌을 때, maxCards 이하로 카드를 골라
 * 카테고리별 배정(필요하면 한 카테고리를 여러 카드로 분할)까지 동시에 최적화합니다.
 *
 * 후보 카드 수가 많을수록(수백~천 단위) 변수 개수(카드 수 × 카테고리 수)가 커져
 * 브라우저에서 체감 가능한 지연이 생길 수 있습니다. "전체 카드" 범위에서 쓸 때는
 * 카테고리별 상위 후보만 추리는 등 candidates 자체를 미리 줄여서 넘기는 걸 권장합니다.
 */
export function buildWalletBlueprint(
  candidates: WalletCard[],
  spending: MonthlySpend,
  { maxCards, managementCostPerCard = 0, maxTotalAnnualFee }: WalletBlueprintOptions,
): WalletBlueprint {
  const empty: WalletBlueprint = {
    feasible: false,
    selectedCards: [],
    assignments: [],
    totalMonthlyBenefit: 0,
    totalMonthlyFee: 0,
    totalMonthlyManagementCost: 0,
    netMonthlyBenefit: 0,
    // 이 legacy 경로는 구간 선택 로직을 이식하지 않았으므로 항상 빈 값입니다(위 파일 상단
    // "알려진 단순화" 참고).
    cardTierStatus: {},
  };

  const categoriesWithSpend = Object.entries(spending).filter(([, amount]) => (amount ?? 0) > 0);

  if (candidates.length === 0 || categoriesWithSpend.length === 0 || maxCards <= 0) {
    // 후보/지출/카드 한도 중 하나라도 없으면 최적화할 게 없는 자명한 케이스입니다.
    // feasible을 true로 두어 "선택할 카드가 없는 것이 최적해"임을 구분합니다.
    return { ...empty, feasible: true };
  }

  const model: LpModel = {
    optimize: OBJECTIVE,
    opType: "max",
    constraints: {},
    variables: {},
    binaries: {},
  };

  // 카드 개수 상한 제약
  model.constraints[BUDGET_CONSTRAINT] = { max: Math.min(maxCards, candidates.length) };

  // 연회비 합계 상한 제약 (지정한 경우에만). 관리 비용은 이 상한과 무관하게 objective에서만 반영합니다.
  if (maxTotalAnnualFee !== undefined) {
    model.constraints[ANNUAL_FEE_CONSTRAINT] = { max: maxTotalAnnualFee };
  }

  // 카테고리별 지출 상한 제약 (등호가 아니라 상한: 혜택 주는 카드가 없으면 0을 배정해도 실행가능해야 함)
  for (const [category, amount] of categoriesWithSpend) {
    model.constraints[`catcap__${category}`] = { max: amount ?? 0 };
  }

  for (const card of candidates) {
    const y = yVar(card.id);
    model.variables[y] = {
      [OBJECTIVE]: -(card.annualFee / 12) - managementCostPerCard,
      [BUDGET_CONSTRAINT]: 1,
      ...(maxTotalAnnualFee !== undefined ? { [ANNUAL_FEE_CONSTRAINT]: card.annualFee } : {}),
    };
    model.binaries![y] = 1;

    for (const [category, amount] of categoriesWithSpend) {
      const rule = findBenefitRule(card, category, spending);
      if (!rule || rule.rate <= 0) continue; // 이 카드는 이 카테고리에 혜택이 없으니 변수 자체를 만들지 않는다

      const spend = amount ?? 0;
      const x = xVar(card.id, category);
      model.variables[x] = {
        [`catcap__${category}`]: 1,
      };

      // 선택 안 한 카드(y=0)에는 한 푼도 배정되지 않도록: x - spend*y <= 0
      const xLink = `xlink__${card.id}__${category}`;
      model.constraints[xLink] = { max: 0 };
      model.variables[x][xLink] = 1;
      model.variables[y][xLink] = -spend;

      const b = bVar(card.id, category);
      model.variables[b] = {
        [OBJECTIVE]: 1,
      };

      // 혜택은 배정 금액 × 요율을 넘을 수 없다: b - rate*x <= 0
      const bRateLink = `brate__${card.id}__${category}`;
      model.constraints[bRateLink] = { max: 0 };
      model.variables[b][bRateLink] = 1;
      model.variables[x][bRateLink] = -rule.rate;

      // 월 한도가 있으면 그 이상은 인정하지 않는다: b <= capPerMonth
      if (rule.capPerMonth !== undefined) {
        const bCapLink = `bcap__${card.id}__${category}`;
        model.constraints[bCapLink] = { max: rule.capPerMonth };
        model.variables[b][bCapLink] = 1;
      }
    }
  }

  const solution = solver.Solve(model);

  if (!solution.feasible) {
    return empty;
  }

  const selectedCards: WalletCard[] = [];
  for (const card of candidates) {
    if (((solution[yVar(card.id)] as number | undefined) ?? 0) > 0.5) {
      selectedCards.push(card);
    }
  }

  const assignments: SlotAssignment[] = [];
  let totalMonthlyBenefit = 0;

  for (const card of selectedCards) {
    for (const [category] of categoriesWithSpend) {
      const rule = findBenefitRule(card, category, spending);
      if (!rule || rule.rate <= 0) continue; // 이 (카드, 카테고리) 조합은 애초에 변수를 만들지 않았다

      const spend = (solution[xVar(card.id, category)] as number | undefined) ?? 0;
      if (spend < MIN_MEANINGFUL_SPEND) continue;

      const benefitAmount = (solution[bVar(card.id, category)] as number | undefined) ?? 0;
      assignments.push({ category, card, spend, benefitAmount });
      totalMonthlyBenefit += benefitAmount;
    }
  }

  // "실제 연회비"와 "관리 비용"을 분리해서 계산합니다. 예전에는 이 둘을 더한 값을
  // "월 환산 연회비 합계"라는 이름으로 화면에 보여줘서, 연회비 0원인 카드만 담아도
  // 관리 비용 때문에 마치 연회비가 있는 것처럼 보이는 혼동이 있었습니다.
  const totalMonthlyFee = selectedCards.reduce((sum, card) => sum + card.annualFee / 12, 0);
  const totalMonthlyManagementCost = selectedCards.length * managementCostPerCard;

  return {
    feasible: true,
    selectedCards,
    assignments,
    totalMonthlyBenefit,
    totalMonthlyFee,
    totalMonthlyManagementCost,
    netMonthlyBenefit: totalMonthlyBenefit - totalMonthlyFee - totalMonthlyManagementCost,
    cardTierStatus: {},
  };
}

/**
 * 원래 이 값은 20이었습니다: javascript-lp-solver(순수 JS)가 메인 스레드에서 동기적으로
 * 돌 때는 (카드, 카테고리) 변수 수가 늘어날수록 풀이 시간이 거의 지수적으로 늘어나서
 * (실측: 후보 22장→0.1초, 27장→0.6초, 33장→4.7초, 44장→36초) 브라우저가 멈추는 걸 막으려면
 * 후보 풀 자체를 작게 강제해야 했습니다.
 *
 * 지금은 실제 MILP 풀이를 Web Worker 안에서 Pyodide + scipy.optimize.milp(HiGHS)로 수행합니다
 * (src/domain/engine/useWalletBlueprintAsync.ts, walletOptimizer.worker.ts 참고). 이 경로는
 * (1) 별도 스레드라 오래 걸려도 UI를 막지 않고, (2) HiGHS 자체가 훨씬 빠른 솔버라서, 이 상한을
 * 훨씬 넉넉하게(20 → 60) 올려도 안전합니다. 그래도 무제한으로 두지 않는 이유는, 후보가
 * 수백~천 단위로 커지면 변수/제약 개수가 그만큼 커져 Worker 쪽 계산 시간이 체감될 수 있고,
 * "카테고리별 상위 N장" 전처리로 후보를 추려도 실질적으로 최적해 품질 손실이 크지 않기
 * 때문입니다(성능-품질 안전망 성격의 상한).
 */
const CANDIDATE_POOL_CEILING = 60;

/**
 * "전체 카드" 같은 큰 후보 풀을 MILP에 그대로 넣으면 변수가 너무 많아져 느려집니다.
 * 카테고리별로 "이 카드가 지출 전액을 받는다면" 기준 혜택이 가장 좋은 상위 N장만 추려서
 * 후보를 줄이는 전처리 함수입니다. (실제 최적해가 카테고리를 분할하더라도, 분할에 참여할
 * 만한 카드는 결국 이 기준으로도 상위권일 가능성이 높다는 휴리스틱)
 *
 * 카테고리 수가 많으면 카테고리별 상위 N장을 합친 후보 풀이 여전히 커질 수 있으므로,
 * 마지막에 CANDIDATE_POOL_CEILING으로 한 번 더 잘라서 solver가 절대 느려지지 않게 합니다.
 */
export function shortlistCandidates(
  candidates: WalletCard[],
  spending: MonthlySpend,
  topNPerCategory = 8,
): WalletCard[] {
  const categoriesWithSpend = Object.entries(spending).filter(([, amount]) => (amount ?? 0) > 0);
  // 카드별로, 어떤 카테고리에서든 얻을 수 있는 최고 혜택액을 기록해둔다 (풀 크기를 줄일 때 우선순위로 사용)
  const picked = new Map<string, { card: WalletCard; bestBenefit: number }>();

  for (const [category, amount] of categoriesWithSpend) {
    const ranked = [...candidates]
      .map((card) => ({ card, benefit: categoryBenefit(card, category, amount ?? 0, spending) }))
      .filter((entry) => entry.benefit > 0)
      .sort((a, b) => b.benefit - a.benefit)
      .slice(0, topNPerCategory);

    for (const { card, benefit } of ranked) {
      const existing = picked.get(card.id);
      if (!existing || benefit > existing.bestBenefit) {
        picked.set(card.id, { card, bestBenefit: benefit });
      }
    }
  }

  const pool = Array.from(picked.values());
  if (pool.length <= CANDIDATE_POOL_CEILING) {
    return pool.map(({ card }) => card);
  }

  // 카테고리 수가 많아 후보 풀이 상한을 넘으면, 전반적으로 혜택이 가장 큰 카드부터 남긴다.
  return pool
    .sort((a, b) => b.bestBenefit - a.bestBenefit)
    .slice(0, CANDIDATE_POOL_CEILING)
    .map(({ card }) => card);
}
