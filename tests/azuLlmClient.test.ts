import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 아주LLM 요청 형식 테스트(2026-10-29). 팀 기본 모델이 gpt-oss-120b → gpt-5.4-nano로 바뀌면서
 * max_tokens·temperature를 보내던 요청이 모델에 닿기 전에 거절됐다(크레딧 소모 없음).
 * 게이트웨이는 fetch를 가짜로 바꿔 흉내 낸다.
 */
type Client = typeof import("@/features/chatbot/azuLlmClient");

const sse = (chunks: object[]) => {
  const enc = new TextEncoder();
  const text = chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("") + "data: [DONE]\n\n";
  return new ReadableStream<Uint8Array>({
    start(ctrl) {
      ctrl.enqueue(enc.encode(text));
      ctrl.close();
    },
  });
};
const ok = (chunks: object[]) => ({ ok: true, status: 200, statusText: "OK", body: sse(chunks), text: async () => "" });
const fail = (status: number, body: string) => ({ ok: false, status, statusText: "", body: null, text: async () => body });
const delta = (content: string | null, finish: string | null = null) => ({ choices: [{ delta: { content }, finish_reason: finish }] });

async function load(model: string): Promise<Client> {
  vi.stubEnv("VITE_AZU_LLM_BASE_URL", "https://gateway.example/v1/gateway/");
  vi.stubEnv("VITE_AZU_LLM_MODEL", model);
  vi.resetModules();
  return import("@/features/chatbot/azuLlmClient");
}

const fetchMock = vi.fn();
const sent = (i: number) => JSON.parse(fetchMock.mock.calls[i][1].body as string) as Record<string, unknown>;
const msgs = [{ role: "user" as const, content: "안녕" }];

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("아주LLM 요청 형식", () => {
  it("추론 모델 구분", async () => {
    const c = await load("gpt-5.4-nano");
    expect(c.isReasoningModel("gpt-5.4-nano")).toBe(true);
    expect(c.isReasoningModel("openai/gpt-5-mini")).toBe(true);
    expect(c.isReasoningModel("o3-mini")).toBe(true);
    expect(c.isReasoningModel("gpt-oss-120b")).toBe(false);
    expect(c.isReasoningModel("gpt-4o")).toBe(false);
  });

  it("gpt-5.4-nano: max_completion_tokens와 추론 수준 보통으로 보내고 temperature는 뺀다", async () => {
    const c = await load("gpt-5.4-nano");
    fetchMock.mockResolvedValueOnce(ok([delta("안녕"), delta("하세요", "stop")]));
    const seen: string[] = [];
    const text = await c.requestAzuLlmChatStream(msgs, { apiKey: "k", maxTokens: 1200 }, (acc) => seen.push(acc));
    expect(text).toBe("안녕하세요");
    expect(seen).toEqual(["안녕", "안녕하세요"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://gateway.example/v1/gateway/chat/completions");
    expect(sent(0)).toEqual({ model: "gpt-5.4-nano", messages: msgs, stream: true, max_completion_tokens: 5000, reasoning_effort: "medium" });
  });

  it("gpt-oss: 예전 방식(temperature·max_tokens) 그대로", async () => {
    const c = await load("gpt-oss-120b");
    fetchMock.mockResolvedValueOnce(ok([delta("네")]));
    await c.requestAzuLlmChatStream(msgs, { apiKey: "k", maxTokens: 1500 }, () => {});
    expect(sent(0)).toEqual({ model: "gpt-oss-120b", messages: msgs, stream: true, temperature: 0.4, max_tokens: 1500 });
  });

  it("게이트웨이가 파라미터를 거절하면 다른 방식으로 한 번 더 보낸다", async () => {
    const c = await load("gpt-5.4-nano");
    fetchMock
      .mockResolvedValueOnce(fail(400, `{"error":{"message":"Unsupported parameter: 'reasoning_effort' is not supported with this model."}}`))
      .mockResolvedValueOnce(ok([delta("답")]));
    expect(await c.requestAzuLlmChatStream(msgs, { apiKey: "k" }, () => {})).toBe("답");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sent(1)).toEqual({ model: "gpt-5.4-nano", messages: msgs, stream: true, max_completion_tokens: 5000 });
  });

  it("예전 모델 이름인데 게이트웨이가 max_tokens를 거절하면 max_completion_tokens로 다시 보낸다", async () => {
    const c = await load("gpt-oss-120b");
    fetchMock
      .mockResolvedValueOnce(fail(400, "Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead."))
      .mockResolvedValueOnce(ok([delta("답")]));
    await c.requestAzuLlmChatStream(msgs, { apiKey: "k" }, () => {});
    expect(sent(0)).toHaveProperty("max_tokens");
    expect(sent(1)).toEqual({ model: "gpt-oss-120b", messages: msgs, stream: true, max_completion_tokens: 5000 });

    // 호출할 때 모델을 따로 넘기면 그 이름으로 형식을 고른다
    fetchMock.mockResolvedValueOnce(ok([delta("답")]));
    await c.requestAzuLlmChatStream(msgs, { apiKey: "k", model: "gpt-5.4-nano" }, () => {});
    expect(sent(2)).toMatchObject({ model: "gpt-5.4-nano", reasoning_effort: "medium" });
  });

  it("키·사용량 문제는 다시 보내지 않고 이유를 알린다", async () => {
    const c = await load("gpt-5.4-nano");
    fetchMock.mockResolvedValueOnce(fail(401, "invalid api key"));
    const e = await c.requestAzuLlmChatStream(msgs, { apiKey: "k" }, () => {}).catch((x: unknown) => x);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(e).toBeInstanceOf(c.AzuLlmRequestError);
    expect(c.azuLlmErrorReason(e)).toBe("API 키를 확인해 주세요");

    fetchMock.mockResolvedValueOnce(fail(429, "rate limit"));
    expect(c.azuLlmErrorReason(await c.requestAzuLlmChatStream(msgs, { apiKey: "k" }, () => {}).catch((x: unknown) => x))).toBe("사용량 한도에 걸렸어요");
  });

  it("실패 이유 문구", async () => {
    const c = await load("gpt-5.4-nano");
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(c.azuLlmErrorReason(await c.requestAzuLlmChatStream(msgs, { apiKey: "k" }, () => {}).catch((x: unknown) => x))).toBe("게이트웨이에 연결하지 못했어요(네트워크·CORS)");

    // 추론에 한도를 다 써서 답이 비면
    fetchMock.mockResolvedValueOnce(ok([delta(null), delta(null, "length")]));
    expect(c.azuLlmErrorReason(await c.requestAzuLlmChatStream(msgs, { apiKey: "k" }, () => {}).catch((x: unknown) => x))).toBe("답을 쓰기 전에 토큰 한도에 걸렸어요");

    expect(c.azuLlmErrorReason(new c.AzuLlmRequestError("아주LLM 호출 실패 (404): model not found"))).toBe("게이트웨이 주소나 모델 이름을 확인해 주세요");
    expect(c.azuLlmErrorReason(new c.AzuLlmConfigError("키 없음"))).toBe("");
  });

  it("스트리밍이 아닌 호출도 같은 형식", async () => {
    const c = await load("gpt-5.4-nano");
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, statusText: "OK", json: async () => ({ choices: [{ message: { content: " 네 " } }] }), text: async () => "" });
    expect(await c.requestAzuLlmChat(msgs, { apiKey: "k" })).toBe("네");
    expect(sent(0)).toEqual({ model: "gpt-5.4-nano", messages: msgs, max_completion_tokens: 5000, reasoning_effort: "medium" });
  });
});
