import type { SpendCategory } from "@/domain/types/card";
import type { CardFitScore } from "@/domain/types/recommendation";

export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

function buildMyCardsSummary(evaluations: CardFitScore[], categories: SpendCategory[]): string {
  if (evaluations.length === 0) {
    return "사용자가 아직 등록한 카드가 없습니다.";
  }
  const categoryLabel = (id: string) => categories.find((c) => c.id === id)?.label ?? id;

  return evaluations
    .map((ev) => {
      const breakdown = ev.breakdown.length
        ? ev.breakdown
            .map((b) => `${categoryLabel(b.category)} 월 혜택 ${Math.round(b.benefitAmount).toLocaleString()}원`)
            .join(", ")
        : "현재 지출 기준 실적 조건 미충족";
      return `- ${ev.card.name} (${ev.card.issuer}, 연회비 ${ev.card.annualFee.toLocaleString()}원): ${breakdown}`;
    })
    .join("\n");
}

/**
 * 실제 AI API 연동 전까지 임시로 쓰는 예시 응답 생성기입니다.
 *
 * 아직 팀에서 실제 API(모델/키)를 확정해 연동하지 못한 상태라, 외부 LLM을 호출하지 않고
 * 사용자가 이미 등록한 카드/지출 데이터를 바탕으로 만든 규칙 기반 문장을 돌려줍니다. 실제
 * 연동을 붙일 때는 이 함수의 내부 구현만 API 호출로 교체하면 되도록, 호출부(Chatbot.tsx)가
 * 쓰는 시그니처(history/message/context)는 그대로 유지했습니다.
 */
export async function sendChatMessage(
  _history: ChatMessage[],
  message: string,
  context: { evaluations: CardFitScore[]; categories: SpendCategory[] },
): Promise<string> {
  // 실제 응답을 기다리는 것처럼 느껴지도록 짧은 지연을 둡니다(예시 응답이라는 걸 숨기려는
  // 목적이 아니라, 로딩 UI가 순간적으로 깜빡이지 않도록 하기 위함입니다).
  await new Promise((resolve) => setTimeout(resolve, 500));

  const { evaluations, categories } = context;

  if (evaluations.length === 0) {
    return "아직 등록된 카드가 없어서 구체적인 답변을 드리기 어려워요. 먼저 카드를 몇 장 등록해 주시면 지출에 맞는 답변을 드릴게요.";
  }

  const eligible = evaluations.filter((ev) => ev.meetsMinimum);
  const top = eligible[0] ?? null;

  if (/혜택|추천|좋은\s*카드|어떤\s*카드/.test(message)) {
    if (!top) {
      return "지금 지출 기준으로는 전월실적을 채운 카드가 없어요. 지출을 더 채우거나, 실적 조건이 낮은 카드를 확인해 보세요.";
    }
    return `지금은 ${top.card.name}가 월 ${Math.round(top.netMonthlyBenefit).toLocaleString()}원으로 가장 유리해요.`;
  }

  if (/연회비/.test(message)) {
    const worst = [...evaluations].sort((a, b) => a.netMonthlyBenefit - b.netMonthlyBenefit)[0];
    return worst
      ? `${worst.card.name}는 연회비(${worst.card.annualFee.toLocaleString()}원) 대비 순혜택이 가장 낮아요. 실제로 얼마나 쓰는지 확인해 보시는 걸 추천해요.`
      : "비교할 카드 정보가 부족해요.";
  }

  if (/몇\s*장|카드\s*수|개수/.test(message)) {
    return "보통 2~3장을 카테고리별로 나눠 쓰면 혜택과 실적 관리의 균형이 좋아요. '내 지갑 만들기'에서 원하는 카드 수를 입력하면 최적 조합을 계산해드려요.";
  }

  if (/실적/.test(message)) {
    const notMeeting = evaluations.filter((ev) => !ev.meetsMinimum);
    if (notMeeting.length === 0) {
      return "지금 등록된 카드는 모두 전월실적 조건을 채우고 있어요.";
    }
    return `${notMeeting.map((ev) => ev.card.name).join(", ")} 카드가 아직 전월실적 조건을 채우지 못했어요.`;
  }

  return `아직 실제 AI 연동 전이라 예시 응답으로 답해드리고 있어요. 지금 등록된 카드 기준 요약이에요:\n${buildMyCardsSummary(
    evaluations,
    categories,
  )}\n\n혜택 추천, 연회비, 카드 개수, 실적 조건 중 궁금한 걸 다시 물어보시면 더 자세히 답해드릴게요.`;
}
