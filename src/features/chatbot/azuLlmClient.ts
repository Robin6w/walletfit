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
 * 관찰돼(finish_reason: "length") 여유 있게 늘려둡니다.
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
 * chat completions 한 번을 호출해 모델 응답 텍스트만 돌려줍니다(스트리밍 아님, 완전한
 * 응답이 올 때까지 기다립니다). 지금은 실제 화면에서는 안 쓰고 있고(Chatbot.tsx는
 * requestAzuLlmChatStream을 씁니다), 스트리밍이 막힌 환경을 위한 대체 경로로 남겨둡니다.
 */
export async function requestAzuLlmChat(
  messages: AzuLlmMessage[],
  options: RequestAzuLlmChatOptions,
): Promise<string> {
  const { apiKey, model, temperature, maxTokens } = resolveRequestConfig(options);

  let response: Response;
  try {
    response = await fetch(`${BASE_URL!.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
      signal: options.signal,
    });
  } catch (e) {
    throw new AzuLlmRequestError(e instanceof Error ? `네트워크 오류: ${e.message}` : "네트워크 오류가 발생했습니다.");
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    throw new AzuLlmRequestError(`아주LLM 호출 실패 (${response.status}): ${bodyText || response.statusText}`);
  }

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
  const { apiKey, model, temperature, maxTokens } = resolveRequestConfig(options);

  let response: Response;
  try {
    response = await fetch(`${BASE_URL!.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens, stream: true }),
      signal: options.signal,
    });
  } catch (e) {
    throw new AzuLlmRequestError(e instanceof Error ? `네트워크 오류: ${e.message}` : "네트워크 오류가 발생했습니다.");
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    throw new AzuLlmRequestError(`아주LLM 호출 실패 (${response.status}): ${bodyText || response.statusText}`);
  }
  if (!response.body) {
    throw new AzuLlmRequestError("아주LLM 응답 스트림을 열 수 없습니다.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  // 청크가 "data: {...}\n\n" 줄 경계와 어긋나게 잘려서 올 수 있어, 완성된 줄만 파싱하고
  // 마지막 미완성 줄은 다음 read()와 이어붙입니다.
  let lineBuffer = "";
  let accumulated = "";

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
          choices?: { delta?: { content?: string | null } }[];
        };
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
    throw new AzuLlmRequestError("아주LLM 응답에서 답변 내용을 찾지 못했습니다.");
  }
  return accumulated;
}
