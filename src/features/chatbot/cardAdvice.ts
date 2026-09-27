import type { SpendCategory } from "@/domain/types/card";
import type { CardFitScore } from "@/domain/types/recommendation";

/** 카드 id -> 한 문장 이내의 조언 */
export type CardAdviceMap = Record<string, string>;

/**
 * 실제 AI API 연동 전까지 임시로 쓰는 예시 조언 생성기입니다.
 *
 * 아직 팀에서 실제 API(모델/키)를 확정해 연동하지 못한 상태라, 외부 LLM을 호출하지 않고
 * 이미 계산된 카드별 혜택 데이터(evaluations)만으로 규칙 기반 한 문장 조언을 만들어
 * 돌려줍니다. 실제 연동을 붙일 때는 이 함수의 내부 구현만 API 호출로 교체하면 됩니다.
 */
export async function getCardAdvice(
  evaluations: CardFitScore[],
  categories: SpendCategory[],
): Promise<CardAdviceMap> {
  // 실제 응답을 기다리는 것처럼 느껴지도록 짧은 지연을 둡니다.
  await new Promise((resolve) => setTimeout(resolve, 400));

  if (evaluations.length === 0) {
    return {};
  }

  const categoryLabel = (id: string) => categories.find((c) => c.id === id)?.label ?? id;
  const sortedByBenefit = [...evaluations].sort((a, b) => b.netMonthlyBenefit - a.netMonthlyBenefit);
  const topCardId = sortedByBenefit[0]?.card.id;

  return evaluations.reduce<CardAdviceMap>((acc, ev) => {
    if (!ev.meetsMinimum) {
      acc[ev.card.id] = "아직 전월실적 조건을 채우지 못했어요. 지출을 조금 더 이 카드로 옮기면 혜택을 받을 수 있어요.";
      return acc;
    }

    const topCategory = [...ev.breakdown].sort((a, b) => b.benefitAmount - a.benefitAmount)[0];

    if (ev.card.id === topCardId) {
      acc[ev.card.id] = topCategory
        ? `지금 지출 기준으로 가장 유리한 카드예요. 특히 ${categoryLabel(topCategory.category)} 혜택이 커요.`
        : "지금 지출 기준으로 가장 유리한 카드예요.";
    } else if (topCategory && topCategory.benefitAmount > 0) {
      acc[ev.card.id] = `${categoryLabel(topCategory.category)} 지출이 더 늘어나면 이 카드가 상대적으로 유리해질 수 있어요.`;
    } else {
      acc[ev.card.id] = "실적 조건은 충족했지만, 현재 지출 기준으로는 받는 혜택이 크지 않아요.";
    }
    return acc;
  }, {});
}
