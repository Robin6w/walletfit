/**
 * 아주LLM 응답 안에서 "화면에 보여줄 자연어 텍스트"와 "화면 뒤에서 UI로 따로 그릴 구조화
 * 데이터"를 분리합니다. promptBuilder.ts의 시스템 프롬프트가 모델에게 답변 맨 끝에
 *
 *   [[DATA]]
 *   {"cards": [...], "highlight": {...} | null, "followups": [...]}
 *   [[/DATA]]
 *
 * 형식으로 한 줄 JSON을 덧붙이도록 지시하고, 이 파일이 그걸 파싱합니다. 스트리밍 중에는
 * 이 블록이 아직 도착하지 않았거나 절반만 왔을 수 있어서, 완성 전까지는 절대 화면에 그대로
 * 노출되면 안 됩니다 — visiblePortion()이 그 역할을 합니다.
 */

const DATA_START = "[[DATA]]";
const DATA_END = "[[/DATA]]";

export interface ChatbotResponseMeta {
  /** 이번 답변에서 언급된 카드명. 없으면 빈 배열. */
  cards: string[];
  /** 강조할 핵심 수치 하나(예: 월 순혜택 9,167원). 없으면 null. */
  highlight: { label: string; value: string } | null;
  /** 이어서 물어볼 만한 후속 질문. 최대 2개까지만 씁니다. */
  followups: string[];
}

export const EMPTY_CHATBOT_META: ChatbotResponseMeta = { cards: [], highlight: null, followups: [] };

/**
 * 스트리밍 도중 지금까지 누적된 원문에서 사용자에게 보여줘도 되는 부분만 잘라냅니다.
 * [[DATA]] 마커가 나타나는 순간부터는 뒤에 JSON이 이어지므로, 그 지점 이전까지만 반환합니다.
 */
export function visiblePortion(raw: string): string {
  const idx = raw.indexOf(DATA_START);
  return idx === -1 ? raw : raw.slice(0, idx);
}

function parseMetaJson(jsonPart: string): ChatbotResponseMeta {
  try {
    const parsed = JSON.parse(jsonPart) as {
      cards?: unknown;
      highlight?: unknown;
      followups?: unknown;
    };
    const cards = Array.isArray(parsed.cards) ? parsed.cards.filter((c): c is string => typeof c === "string") : [];
    const highlightRaw = parsed.highlight as { label?: unknown; value?: unknown } | null | undefined;
    const highlight =
      highlightRaw && typeof highlightRaw.label === "string" && typeof highlightRaw.value === "string"
        ? { label: highlightRaw.label, value: highlightRaw.value }
        : null;
    const followups = Array.isArray(parsed.followups)
      ? parsed.followups.filter((f): f is string => typeof f === "string").slice(0, 2)
      : [];
    return { cards, highlight, followups };
  } catch {
    // 모델이 JSON 형식을 잘못 냈으면 구조화 데이터 없이 텍스트만 씁니다 — 화면이 깨지는 것보다 낫습니다.
    return EMPTY_CHATBOT_META;
  }
}

/**
 * 스트리밍이 끝난 뒤(또는 오프라인 규칙 기반 응답처럼 애초에 데이터 블록이 없는 응답에)
 * 전체 원문 하나를 받아서 "화면 텍스트"와 "구조화 데이터"로 분리합니다.
 */
export function splitResponse(raw: string): { text: string; meta: ChatbotResponseMeta } {
  const startIdx = raw.indexOf(DATA_START);
  if (startIdx === -1) return { text: raw.trim(), meta: EMPTY_CHATBOT_META };

  const text = raw.slice(0, startIdx).trim();
  const endIdx = raw.indexOf(DATA_END, startIdx);
  const jsonPart = raw.slice(startIdx + DATA_START.length, endIdx === -1 ? undefined : endIdx).trim();

  return { text, meta: parseMetaJson(jsonPart) };
}
