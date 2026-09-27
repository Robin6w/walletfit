import type { SpendCategory, MonthlySpend } from "@/domain/types/card";

/**
 * 지출을 카테고리별로 직접 입력하기 번거로운 사용자를 위해, 월 소득만으로 대략적인 카테고리별
 * 지출을 추정하는 도구입니다.
 *
 * 이 값들은 실측 데이터가 아니라 통계청 가계동향조사 등에서 흔히 보이는 소비성향(소득 중
 * 소비지출 비중)과 국내 카드 결제 비중을 참고해 만든 근사치입니다. "이 정도면 대략 맞겠다"는
 * 출발점일 뿐이고, 사용자가 실제 지출을 알고 있다면 지출 시뮬레이터에서 언제든 값을 고쳐 쓸
 * 수 있습니다(추정값이 최종 계산 근거로 고정되지 않도록, 적용 후에도 카테고리별 슬라이더는
 * 그대로 열려 있습니다).
 *
 * 사용자가 "이 40%는 무슨 근거냐"고 물었을 때 화면에서 바로 근거를 확인하고, 원하면 자기
 * 상황에 맞게 비율을 직접 조정할 수 있도록 CARD_SPEND_RATIO_BASIS와 MIN/MAX 상수를 함께
 * 내보냅니다(IncomeCardCountEstimator.tsx의 "이 비율, 어떻게 나왔나요?" 패널 참고).
 */

/**
 * 월 소득 중 카드로 결제하는 지출의 비중 가정. 아래 두 근사치의 곱입니다:
 * - consumptionPropensity(소비성향): 통계청 가계동향조사에서 흔히 보이는 소득 대비 소비지출
 *   비중의 평균적인 수준(약 60%). 저축·투자·세금 등을 제외한 "쓰는 돈"의 비율입니다.
 * - cardPaymentShare(카드결제비율): 그 소비지출 중 신용/체크카드로 결제되는 비중(국내
 *   지급수단 통계에서 흔히 보이는 65~70% 구간의 중간값, 약 67%).
 * 0.6 × 0.67 ≈ 0.4 → 기본값 40%. 이 값은 인구 전체의 평균적인 근사치일 뿐 개인차가 크므로,
 * 화면에서 사용자가 직접 20~60% 범위로 조정할 수 있게 열어둡니다.
 */
export const CARD_SPEND_RATIO_BASIS = {
  consumptionPropensity: 0.6,
  cardPaymentShare: 0.67,
};

export const ASSUMED_CARD_SPEND_RATIO = 0.4;

/** UI에서 사용자가 비율을 직접 조정할 때 허용하는 범위. */
export const MIN_CARD_SPEND_RATIO = 0.2;
export const MAX_CARD_SPEND_RATIO = 0.6;

/**
 * 카테고리별 지출 비중 가정 (합계 1.0). data/categories.json의 카테고리 구성에 맞춰 만들었고,
 * 새 카테고리가 추가되면 이 표도 같이 갱신해야 합니다.
 */
export const CATEGORY_SPEND_SHARE: Record<string, number> = {
  dining: 0.22,
  mart: 0.15,
  onlineShopping: 0.15,
  transport: 0.08,
  gas: 0.08,
  cafe: 0.08,
  mobile: 0.07,
  convenience: 0.06,
  etc: 0.06,
  culture: 0.05,
};

/**
 * "카드 수 추천"을 계산할 때 solver에게 넉넉하게 열어주는 후보 상한입니다. 실제로 이만큼
 * 담아야 한다는 뜻이 아니라, MILP가 이 범위 안에서 스스로 가장 유리한 카드 수를 찾아내도록
 * 여유를 주는 값입니다(목적함수에 관리 비용·연회비가 이미 포함돼 있어서, 더 담아봤자 순혜택이
 * 떨어지는 카드는 solver가 알아서 선택하지 않습니다).
 */
export const DISCOVERY_MAX_CARDS_CEILING = 8;

/**
 * 월 소득 → 카테고리별 추정 월 지출. 소득이 0 이하면 전부 0원으로 채웁니다.
 * cardSpendRatio를 생략하면 기본 가정치(ASSUMED_CARD_SPEND_RATIO)를 쓰고, 사용자가 화면에서
 * 직접 조정한 비율이 있으면 그 값을 그대로 전달받아 계산합니다.
 */
export function estimateSpendingFromIncome(
  monthlyIncome: number,
  categories: SpendCategory[],
  cardSpendRatio: number = ASSUMED_CARD_SPEND_RATIO,
): MonthlySpend {
  const totalCardSpend = Math.max(0, monthlyIncome) * cardSpendRatio;
  const spending: MonthlySpend = {};
  for (const category of categories) {
    const share = CATEGORY_SPEND_SHARE[category.id] ?? 0;
    spending[category.id] = Math.round(totalCardSpend * share);
  }
  return spending;
}
