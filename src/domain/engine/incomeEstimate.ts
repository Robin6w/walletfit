import type { SpendCategory, MonthlySpend } from "@/domain/types/card";
import spendModel from "@data/catalog/spend-model.json";

/**
 * 지출을 카테고리별로 직접 입력하기 번거로운 사용자를 위해, 월 소득(세전)만으로 카테고리별 지출을 추정하는 도구입니다.
 *
 * 2026-11-03: 출처 없던 비중표(외식 22% 등, 10개 카테고리)와 일괄 40%를 통계청 가계동향조사 기반 모델로 바꿨습니다.
 * 모델: data/catalog/spend-model.json(만드는 곳 2_지출추정/build_model.py)
 *  - 근거: KOSIS 소득5분위별 가구당 가계수지(전국, 1인이상) 2019~2025, 세부 품목 약 110개를 앱 카테고리로 나눔
 *  - 카드 지출 = 소비지출에서 카드로 내기 어려운 항목(월세·보험·자동차 구입·등록금·복권 등)을 뺀 것
 *  - 카드 지출 비율(소득 대비) = a + b·ln(월 소득): 소득이 낮을수록 높다(2025 1분위 0.96 → 5분위 0.38)
 *  - 카테고리 비중 = a + b·ln(카드 지출)(엥겔 곡선): 지출이 클수록 교육·여행 비중↑, 병원·마트·생활요금 비중↓
 *  - 검증(연도 하나 빼고 예측, JSD): 이 모델 0.0028 / 소득과 무관한 평균 비중 0.0107 / 예전 비중표 0.2990
 * 가구 단위 통계라 1인 가구·학생처럼 소득과 지출이 따로 노는 경우는 맞지 않을 수 있습니다. 출발값일 뿐이고
 * 화면에서 비율과 카테고리별 금액을 바로 고칠 수 있습니다.
 */

/** 화면 설명용 근거(이 비율 어떻게 나왔나요?) */
export const SPEND_MODEL_SOURCE = spendModel.source;

/** UI에서 사용자가 비율을 직접 조정할 때 허용하는 범위. 저소득층은 소득 대부분을 쓰므로 위쪽을 100%까지 연다 */
export const MIN_CARD_SPEND_RATIO = 0.2;
export const MAX_CARD_SPEND_RATIO = 1.0;

/** 소득을 모를 때(또는 v1 화면)의 기본 비율: 2025 3분위(월 소득 약 445만원)의 카드 지출 비율 */
export const ASSUMED_CARD_SPEND_RATIO = spendModel.profiles2025["3분위"].ratio;

/**
 * 예전 화면(v1 IncomeCardCountEstimator)이 쓰는 설명 값. 소비성향 × 카드 결제 비중으로 풀어 보여 준다.
 * 2025 3분위: 평균소비성향 약 74%(통계청), 소비지출 중 카드로 낼 만한 몫 = 카드 지출 ÷ 소비지출
 */
export const CARD_SPEND_RATIO_BASIS = {
  consumptionPropensity: spendModel.profiles2025["3분위"].consumption / spendModel.profiles2025["3분위"].income,
  cardPaymentShare: spendModel.profiles2025["3분위"].cardable / spendModel.profiles2025["3분위"].consumption,
};

/**
 * "카드 수 추천"을 계산할 때 solver에게 넉넉하게 열어주는 후보 상한입니다. 실제로 이만큼
 * 담아야 한다는 뜻이 아니라, MILP가 이 범위 안에서 스스로 가장 유리한 카드 수를 찾아내도록
 * 여유를 주는 값입니다(목적함수에 관리 비용·연회비가 이미 포함돼 있어서, 더 담아봤자 순혜택이
 * 떨어지는 카드는 solver가 알아서 선택하지 않습니다).
 */
export const DISCOVERY_MAX_CARDS_CEILING = 8;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 월 소득(세전) → 그 소득의 가구가 카드로 낼 만한 지출의 비율(기본값). 소득이 없으면 ASSUMED_CARD_SPEND_RATIO */
export function defaultCardSpendRatio(monthlyIncome: number): number {
  if (!(monthlyIncome > 0)) return ASSUMED_CARD_SPEND_RATIO;
  const { a, b } = spendModel.ratio;
  return clamp(a + b * Math.log(monthlyIncome), MIN_CARD_SPEND_RATIO, MAX_CARD_SPEND_RATIO);
}

/** 월 카드 지출 총액 → 카테고리 비중(엥겔 곡선, 음수는 0으로 자르고 합 1로 맞춤) */
export function categoryShares(totalCardSpend: number, categoryIds: string[]): Record<string, number> {
  const engel = spendModel.engel as Record<string, { a: number; b: number }>;
  const x = Math.log(Math.max(totalCardSpend, 1));
  const raw = Object.fromEntries(categoryIds.map((id) => [id, engel[id] ? Math.max(0, engel[id].a + engel[id].b * x) : 0]));
  const sum = Object.values(raw).reduce((s, v) => s + v, 0);
  return Object.fromEntries(Object.entries(raw).map(([id, v]) => [id, sum > 0 ? v / sum : 0]));
}

/** 예전 화면이 쓰는 고정 비중표: 2025 3분위 카드 지출 수준의 엥겔 곡선 비중(25개 카테고리) */
export const CATEGORY_SPEND_SHARE: Record<string, number> = categoryShares(
  spendModel.profiles2025["3분위"].cardable,
  Object.keys(spendModel.engel),
);

/**
 * 월 소득 → 카테고리별 추정 월 지출. 소득이 0 이하면 전부 0원으로 채웁니다.
 * cardSpendRatio를 생략하면 그 소득의 기본 비율(defaultCardSpendRatio)을 쓰고, 사용자가 화면에서
 * 직접 조정한 비율이 있으면 그 값을 그대로 전달받아 계산합니다.
 */
export function estimateSpendingFromIncome(
  monthlyIncome: number,
  categories: SpendCategory[],
  cardSpendRatio: number = defaultCardSpendRatio(monthlyIncome),
): MonthlySpend {
  const totalCardSpend = Math.max(0, monthlyIncome) * cardSpendRatio;
  const shares = categoryShares(totalCardSpend, categories.map((c) => c.id));
  const spending: MonthlySpend = {};
  for (const category of categories) {
    spending[category.id] = Math.round(totalCardSpend * (shares[category.id] ?? 0));
  }
  return spending;
}
