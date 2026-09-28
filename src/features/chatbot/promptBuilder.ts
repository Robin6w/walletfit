import type { SpendCategory } from "@/domain/types/card";
import type { CardFitScore } from "@/domain/types/recommendation";
import type { WalletBlueprint } from "@/domain/types/optimization";
import type { AzuLlmMessage } from "@/features/chatbot/azuLlmClient";

/**
 * "추천 결과 설명" 역할의 프롬프트 조립 로직만 담당합니다. 챗봇 역할이 늘어나면(약관 QA 등)
 * 이 파일에 컨텍스트 블록을 추가하면 되고, cardChatbot.ts/Chatbot.tsx는 손대지 않아도
 * 됩니다.
 */

const SYSTEM_PROMPT = `당신은 신용카드 다중 추천 서비스 "WalletFit"의 상담 챗봇입니다.
사용자가 등록한 카드와, 서비스가 계산한 카드 조합(지갑) 추천 결과를 근거로
왜 이런 결과가 나왔는지 쉬운 말로 설명하는 것이 역할입니다.

지켜야 할 것:
- 존댓말을 쓰고, 실제 숫자(금액)는 아래 [참고 데이터]에 있는 값만 사용합니다. 데이터에 없는
  숫자를 만들어내지 않습니다.
- 투자나 대출처럼 이 서비스가 계산하지 않은 금융 조언은 하지 않고, 카드 혜택 계산 결과를
  설명하는 데에만 집중합니다.
- [참고 데이터]로 답할 수 없는 질문이면 모른다고 답하고, 어떤 정보가 더 있으면 답할 수
  있는지 안내합니다.
- 답변은 3~5문장 정도로 간결하게 씁니다.

서식 규칙:
- 카드명이나 핵심 금액처럼 강조하고 싶은 부분만 **이렇게** 굵게 표시합니다. 그 외
  마크다운(제목 #, 목록 기호 -나 1., 코드블록, 링크 등)은 쓰지 않습니다.

답변 마지막에는 반드시 아래 형식으로 한 줄짜리 JSON을 덧붙입니다. 이 부분은 사용자
화면에는 보이지 않고, 뒤에서 카드 칩·핵심 수치 카드·후속 질문 버튼을 그리는 데만 쓰입니다.

[[DATA]]
{"cards": ["이번 답변에서 실제로 언급한 카드명만"], "highlight": {"label": "핵심 수치 이름", "value": "핵심 수치 값(단위 포함)"} 또는 강조할 수치가 없으면 null, "followups": ["이어서 물어볼 만한 질문(최대 2개)"]}
[[/DATA]]

- cards/followups에 해당 사항이 없으면 빈 배열 []을 씁니다.
- highlight는 이번 답변에서 가장 중요한 숫자 하나에만 씁니다(여러 개면 가장 핵심적인 것 하나만).
- JSON은 줄바꿈 없이 한 줄로, 정확히 이 형식으로 씁니다. [[DATA]]/[[/DATA]] 마커를 절대 생략하지 않습니다.`;

/** cardChatbot.ts의 ChatMessage와 구조가 같은 최소 형태. 순환 참조를 피하려고 여기서 따로 둡니다. */
interface HistoryMessage {
  role: "user" | "model";
  text: string;
}

export interface ChatContext {
  evaluations: CardFitScore[];
  categories: SpendCategory[];
  /** 지갑 마법사(WalletWizardPage)가 계산한 추천 조합. 아직 계산 전/방문 전이면 null. */
  walletResult?: WalletBlueprint | null;
}

/** 최근 몇 턴까지만 프롬프트에 실어 보낼지. 너무 길게 이어 붙이면 토큰이 커집니다. */
const HISTORY_TURN_LIMIT = 6;

function formatWon(amount: number): string {
  return `${Math.round(amount).toLocaleString()}원`;
}

function buildMyCardsBlock(evaluations: CardFitScore[], categoryLabel: (id: string) => string): string {
  if (evaluations.length === 0) return "사용자가 등록한 카드: 없음";
  const lines = evaluations.map((ev) => {
    const breakdown = ev.breakdown.length
      ? ev.breakdown.map((b) => `${categoryLabel(b.category)} ${formatWon(b.benefitAmount)}`).join(", ")
      : "이번 달 실적 조건 미충족";
    return `- ${ev.card.name}(${ev.card.issuer}, 연회비 ${formatWon(ev.card.annualFee)}): 월 순혜택 ${formatWon(
      ev.netMonthlyBenefit,
    )} / ${breakdown}`;
  });
  return `사용자가 등록한 카드:\n${lines.join("\n")}`;
}

function buildWalletResultBlock(
  result: WalletBlueprint | null | undefined,
  categoryLabel: (id: string) => string,
): string {
  if (!result) return "지갑 만들기 추천 결과: 아직 계산되지 않음(사용자가 '내 지갑 만들기'를 아직 안 해봄)";
  if (!result.feasible || result.selectedCards.length === 0) {
    return "지갑 만들기 추천 결과: 조건에 맞는 카드 조합을 찾지 못함";
  }
  const cardLines = result.selectedCards.map((card) => {
    const assigned = result.assignments.filter((a) => a.card.id === card.id);
    const detail = assigned.length
      ? assigned
          .map((a) => `${categoryLabel(a.category)}에 ${formatWon(a.spend)} 배정(혜택 ${formatWon(a.benefitAmount)})`)
          .join(", ")
      : "배정된 카테고리 없음";
    return `- ${card.name}(${card.issuer}): ${detail}`;
  });
  return [
    "지갑 만들기 추천 결과:",
    ...cardLines,
    `월 총 혜택 ${formatWon(result.totalMonthlyBenefit)}, 월 연회비 ${formatWon(
      result.totalMonthlyFee,
    )}, 월 순혜택 ${formatWon(result.netMonthlyBenefit)}`,
  ].join("\n");
}

export function buildAzuLlmMessages(
  history: HistoryMessage[],
  message: string,
  context: ChatContext,
): AzuLlmMessage[] {
  const categoryLabel = (id: string) => context.categories.find((c) => c.id === id)?.label ?? id;
  const contextBlock = [
    buildMyCardsBlock(context.evaluations, categoryLabel),
    buildWalletResultBlock(context.walletResult, categoryLabel),
  ].join("\n\n");

  const recentHistory = history.slice(-HISTORY_TURN_LIMIT);

  return [
    { role: "system", content: `${SYSTEM_PROMPT}\n\n[참고 데이터]\n${contextBlock}` },
    ...recentHistory.map(
      (m): AzuLlmMessage => ({ role: m.role === "model" ? "assistant" : "user", content: m.text }),
    ),
    { role: "user", content: message },
  ];
}
