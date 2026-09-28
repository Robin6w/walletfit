import type { SpendCategory } from "@/domain/types/card";
import type { CardFitScore } from "@/domain/types/recommendation";
import type { WalletBlueprint } from "@/domain/types/optimization";
import { requestAzuLlmChat, AzuLlmConfigError, AzuLlmRequestError } from "@/features/chatbot/azuLlmClient";
import { buildAzuLlmMessages } from "@/features/chatbot/promptBuilder";

export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export interface ChatContext {
  evaluations: CardFitScore[];
  categories: SpendCategory[];
  /** 지갑 마법사(WalletWizardPage)가 계산한 추천 조합. 아직 계산 전/방문 전이면 null. */
  walletResult?: WalletBlueprint | null;
}

/** 아주LLM 호출에 필요한 최소 정보. apiKey가 비어 있으면 sendChatMessage는 곧바로 규칙 기반으로 답합니다. */
export interface AzuLlmConnection {
  apiKey: string;
  model?: string;
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
 * 아주LLM API Key가 없거나 호출이 실패했을 때 쓰는 규칙 기반 응답입니다. 예전에는 이 함수가
 * sendChatMessage 자체였는데, 실제 API 연동을 붙이면서 폴백 전용으로 내렸습니다. 팀원들이
 * 키 없이도 UI를 테스트할 수 있고, 발표 시연 중 네트워크 문제가 나도 챗봇이 완전히
 * 멈추지는 않게 하려는 목적입니다.
 */
async function sendChatMessageOffline(
  _history: ChatMessage[],
  message: string,
  context: ChatContext,
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

/**
 * 챗봇의 실제 진입점입니다. connection.apiKey가 있으면 아주LLM API Gateway로 실제 호출을
 * 시도하고, 키가 없거나(AzuLlmConfigError) 호출이 실패하면(AzuLlmRequestError, 네트워크
 * 오류 등) 화면이 멈추지 않도록 조용히 규칙 기반 응답(sendChatMessageOffline)으로
 * 넘어갑니다. Chatbot.tsx가 부르는 시그니처는 그대로 유지했습니다(connection만 추가).
 */
export async function sendChatMessage(
  history: ChatMessage[],
  message: string,
  context: ChatContext,
  connection?: AzuLlmConnection,
): Promise<string> {
  if (connection?.apiKey?.trim()) {
    try {
      const messages = buildAzuLlmMessages(history, message, context);
      return await requestAzuLlmChat(messages, { apiKey: connection.apiKey, model: connection.model });
    } catch (e) {
      if (import.meta.env.DEV) {
        const reason = e instanceof AzuLlmConfigError || e instanceof AzuLlmRequestError ? e.message : e;
        console.warn("[chatbot] 아주LLM 호출 실패, 규칙 기반 응답으로 전환합니다.", reason);
      }
      // 설정 누락(AzuLlmConfigError)이든 호출 실패(AzuLlmRequestError)든, 사용자에게는
      // 그냥 규칙 기반 응답을 보여줍니다 — 챗봇이 아예 멈추는 것보다 낫습니다.
    }
  }
  return sendChatMessageOffline(history, message, context);
}
