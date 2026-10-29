/**
 * 아주LLM API Gateway(Mindlogic FactChat 기반, OpenAI SDK 호환 프록시) 호출 클라이언트입니다.
 *
 * 백엔드 서버 없이 브라우저에서 직접 호출합니다 — 이전에 시도했던 Gemini/Groq 연동과
 * 같은 구조(클라이언트 전용, 키는 사용자 브라우저 저장소에만 저장)를 그대로 따릅니다.
 * 게이트웨이 주소와 기본 모델명은 코드에 박아두지 않고 .env(VITE_AZU_LLM_BASE_URL,
 * VITE_AZU_LLM_MODEL)에서 읽습니다. 실제 값은 팀이 게이트웨이 발급 정보를 받은 뒤
 * .env에 채워 넣으면 되고(.env.example 참고), API Key는 화면의 "아주LLM API 설정"에서
 * 입력합니다. 아직 둘 다 비어 있으면 AzuLlmConfigError를 던져서, 호출부(cardChatbot.ts)가
 * 곧바로 규칙 기반 응답으로 넘어갈 수 있게 합니다.
 */

export interface AzuLlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** 설정(주소/모델/키)이 비어 있어서 아예 호출을 시도하지 못한 경우 */
export class AzuLlmConfigError extends Error {}

/** 호출은 시도했지만 네트워크 오류, 게이트웨이 오류 응답, 빈 응답 등으로 실패한 경우 */
export class AzuLlmRequestError extends Error {}

const BASE_URL = (import.meta.env.VITE_AZU_LLM_BASE_URL as string | undefined)?.trim();
const DEFAULT_MODEL = (import.meta.env.VITE_AZU_LLM_MODEL as string | undefined)?.trim();

interface RequestAzuLlmChatOptions {
  apiKey: string;
  /** 지정하지 않으면 .env의 VITE_AZU_LLM_MODEL(41개 모델 중 팀이 고른 기본값)을 씁니다. */
  model?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

interface ResolvedRequestConfig {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

/**
 * 두 호출 함수(스트리밍/비스트리밍)가 똑같이 하던 설정 검증을 한 곳으로 모았습니다.
 * gpt-oss-120b처럼 답변 전에 내부적으로 "추론(reasoning)"을 하는 모델은 그 추론 토큰도
 * max_tokens 예산을 함께 써서, 600 정도로는 실제 답변이 문장 중간에 끊기는 경우가 많이
 * 관찰돼(finish_reason: "length") 여유 있게 늘려둡니다. GPT-5 계열은 requestBody()가
 * max_completion_tokens(이 값의 4배, 최소 5000)와 reasoning_effort(보통)로 바꿔 보냅니다.
 */
function resolveRequestConfig(options: RequestAzuLlmChatOptions): ResolvedRequestConfig {
  const { apiKey, model = DEFAULT_MODEL, temperature = 0.4, maxTokens = 1200 } = options;

  if (!BASE_URL) {
    throw new AzuLlmConfigError("아주LLM 게이트웨이 주소(VITE_AZU_LLM_BASE_URL)가 설정되지 않았습니다.");
  }
  if (!model) {
    throw new AzuLlmConfigError("아주LLM 모델명(VITE_AZU_LLM_MODEL)이 설정되지 않았습니다.");
  }
  if (!apiKey.trim()) {
    throw new AzuLlmConfigError("아주LLM API Key가 설정되지 않았습니다.");
  }
  return { apiKey, model, temperature, maxTokens };
}

/**
 * 추론 모델(GPT-5 계열, o 시리즈)인지(2026-10-29). 이 모델들은 max_tokens·temperature를 받지 않고
 * ('Unsupported parameter: max_tokens ... Use max_completion_tokens instead') max_completion_tokens를 쓴다.
 * 팀 기본 모델이 gpt-oss-120b → gpt-5.4-nano로 바뀌면서 요청이 모델에 닿기 전에 거절되던 문제를 고친다.
 */
export function isReasoningModel(model: string): boolean {
  return /(^|\/)(gpt-5|o[1-9])/i.test(model.trim());
}

/** 추론 수준: 보통(팀 결정, 2026-10-29) */
export const REASONING_EFFORT = "medium";

/** 추론 토큰도 한도를 같이 쓰므로 넉넉히(쓴 만큼만 크레딧이 나간다) */
function reasoningBudget(maxTokens: number): number {
  return Math.max(maxTokens * 4, 5000);
}

export type AzuLlmBodyVariant = "classic" | "reasoning" | "reasoning-plain";

/** 요청 본문. classic = 예전 방식(temperature·max_tokens), reasoning = 추론 모델 방식 */
export function requestBody(
  variant: AzuLlmBodyVariant,
  cfg: { model: string; temperature: number; maxTokens: number },
  messages: AzuLlmMessage[],
  stream: boolean,
): Record<string, unknown> {
  const base: Record<string, unknown> = { model: cfg.model, messages, ...(stream ? { stream: true } : {}) };
  if (variant === "classic") return { ...base, temperature: cfg.temperature, max_tokens: cfg.maxTokens };
  if (variant === "reasoning") return { ...base, max_completion_tokens: reasoningBudget(cfg.maxTokens), reasoning_effort: REASONING_EFFORT };
  return { ...base, max_completion_tokens: reasoningBudget(cfg.maxTokens) };
}

/** 모델에 맞는 본문부터 보내고, 게이트웨이가 파라미터를 거절하면(400·422) 다음 방식으로 한 번씩 더 보낸다 */
export function variantsFor(model: string): AzuLlmBodyVariant[] {
  return isReasoningModel(model) ? ["reasoning", "reasoning-plain", "classic"] : ["classic", "reasoning-plain"];
}

const PARAM_REJECTED = /max_tokens|max_completion_tokens|temperature|reasoning_effort|unsupported|not supported|unknown param|unrecognized|invalid param/i;

async function postChat(cfg: ResolvedRequestConfig, messages: AzuLlmMessage[], stream: boolean, signal?: AbortSignal): Promise<Response> {
  const url = `${BASE_URL!.replace(/\/$/, "")}/chat/completions`;
  let lastError = "";
  for (const variant of variantsFor(cfg.model)) {
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
        body: JSON.stringify(requestBody(variant, cfg, messages, stream)),
        signal,
      });
    } catch (e) {
      throw new AzuLlmRequestError(e instanceof Error ? `네트워크 오류: ${e.message}` : "네트워크 오류가 발생했습니다.");
    }
    if (response.ok) return response;
    const bodyText = await response.text().catch(() => "");
    lastError = `아주LLM 호출 실패 (${response.status}): ${bodyText || response.statusText}`;
    // 파라미터 문제로 거절된 경우만 다른 방식으로 다시 보낸다(키·주소·사용량 문제는 바로 알린다)
    if (!((response.status === 400 || response.status === 422) && PARAM_REJECTED.test(bodyText))) break;
  }
  throw new AzuLlmRequestError(lastError);
}

/** 상담 창에 붙일 짧은 실패 이유 */
export function azuLlmErrorReason(e: unknown): string {
  if (e instanceof AzuLlmConfigError) return "";
  const m = e instanceof Error ? e.message : String(e);
  if (m.includes("네트워크 오류")) return "게이트웨이에 연결하지 못했어요(네트워크·CORS)";
  if (/\((401|403)\)/.test(m)) return "API 키를 확인해 주세요";
  if (/\(404\)/.test(m)) return "게이트웨이 주소나 모델 이름을 확인해 주세요";
  if (/\((400|422)\)/.test(m)) return "모델이 요청 형식을 받지 않았어요";
  if (/\(429\)/.test(m)) return "사용량 한도에 걸렸어요";
  if (/\(5\d\d\)/.test(m)) return "게이트웨이 서버 오류예요";
  if (m.includes("한도에서 끊겼")) return "답을 쓰기 전에 토큰 한도에 걸렸어요";
  if (m.includes("답변 내용을 찾지 못했습니다")) return "답이 비어 있었어요";
  return "잠시 뒤 다시 시도해 주세요";
}

/**
 * chat completions 한 번을 호출해 모델 응답 텍스트만 돌려줍니다(스트리밍 아님, 완전한
 * 응답이 올 때까지 기다립니다). 지금은 실제 화면에서는 안 쓰고 있고(Chatbot.tsx는
 * requestAzuLlmChatStream을 씁니다), 스트리밍이 막힌 환경을 위한 대체 경로로 남겨둡니다.
 */
export async function requestAzuLlmChat(
  messages: AzuLlmMessage[],
  options: RequestAzuLlmChatOptions,
): Promise<string> {
  const cfg = resolveRequestConfig(options);
  const response = await postChat(cfg, messages, false, options.signal);

  const data: unknown = await response.json().catch(() => null);
  const content = (data as { choices?: { message?: { content?: string } }[] } | null)?.choices?.[0]?.message
    ?.content;
  if (typeof content !== "string" || content.trim() === "") {
    throw new AzuLlmRequestError("아주LLM 응답에서 답변 내용을 찾지 못했습니다.");
  }
  return content.trim();
}

/**
 * chat completions를 스트리밍(stream: true)으로 호출해서, 토큰이 도착하는 대로
 * onDelta(그때까지 누적된 전체 텍스트)를 호출합니다. 최종적으로는 누적된 전체 텍스트를
 * 반환합니다.
 *
 * gpt-oss-120b는 실제 답변(content)을 내놓기 전에 내부 "추론" 과정을 reasoning_content
 * 델타로 먼저 스트리밍합니다(끝날 때까지 content는 null로 옵니다). 이 함수는
 * delta.content만 누적하고 reasoning_content는 그냥 버려서, 화면에는 실제 답변만
 * 타이핑되듯 나타납니다.
 */
export async function requestAzuLlmChatStream(
  messages: AzuLlmMessage[],
  options: RequestAzuLlmChatOptions,
  onDelta: (accumulatedText: string) => void,
): Promise<string> {
  const cfg = resolveRequestConfig(options);
  const response = await postChat(cfg, messages, true, options.signal);
  if (!response.body) {
    throw new AzuLlmRequestError("아주LLM 응답 스트림을 열 수 없습니다.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  // 청크가 "data: {...}\n\n" 줄 경계와 어긋나게 잘려서 올 수 있어, 완성된 줄만 파싱하고
  // 마지막 미완성 줄은 다음 read()와 이어붙입니다.
  let lineBuffer = "";
  let accumulated = "";
  let finishReason: string | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    lineBuffer += decoder.decode(value, { stream: true });

    const lines = lineBuffer.split("\n");
    lineBuffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice("data:".length).trim();
      if (payload === "" || payload === "[DONE]") continue;

      try {
        const chunk = JSON.parse(payload) as {
          choices?: { delta?: { content?: string | null }; finish_reason?: string | null }[];
        };
        finishReason = chunk.choices?.[0]?.finish_reason ?? finishReason;
        const delta = chunk.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta.length > 0) {
          accumulated += delta;
          onDelta(accumulated);
        }
      } catch {
        // 청크 하나가 깨져서 파싱이 안 되면 그 줄만 버리고 스트림은 계속 읽습니다.
      }
    }
  }

  if (accumulated.trim() === "") {
    throw new AzuLlmRequestError(finishReason === "length" ? "아주LLM 답이 토큰 한도에서 끊겼습니다(추론에 한도를 다 씀)." : "아주LLM 응답에서 답변 내용을 찾지 못했습니다.");
  }
  return accumulated;
}
