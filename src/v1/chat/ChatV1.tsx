import { useEffect, useRef, useState } from "react";
import { ArrowUp, MessageCircle, Plus } from "lucide-react";
import { requestAzuLlmChatStream, AzuLlmConfigError } from "@/features/chatbot/azuLlmClient";
import { renderLiteMarkdown } from "@/features/chatbot/chatFormatting";
import { ApiKeySettings } from "@/features/settings/ApiKeySettings";
import type { UseAzuLlmApiKeyResult } from "@/shared/hooks/useAzuLlmApiKey";
import { Btn, Section } from "@/v1/ui";
import { PerfBars } from "@/v1/wizard/ResultStep";
import { approxKor, korWon, won } from "@/v1/format";
import { benefitLine, shortCard } from "@/v1/wallet/model";
import { answerLocal, buildMessages, introMessage, type ChatCtx, type ChatMsg } from "@/v1/chat/chatModel";

interface Props {
  ctx: ChatCtx;
  azuLlm: UseAzuLlmApiKeyResult;
  initialQuestion: string | null;
  onConsumed: () => void;
  onOpenResult: () => void;
  onNoMargin: () => void;
}

const HAS_GATEWAY = Boolean((import.meta.env.VITE_AZU_LLM_BASE_URL as string | undefined)?.trim());

export function ChatV1({ ctx, azuLlm, initialQuestion, onConsumed, onOpenResult, onNoMargin }: Props) {
  const [msgs, setMsgs] = useState<ChatMsg[]>(() => [introMessage(ctx)]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const online = HAS_GATEWAY && !!azuLlm.apiKey.trim();

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [msgs]);
  useEffect(() => {
    if (initialQuestion) {
      void send(initialQuestion);
      onConsumed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    const history = msgs;
    setMsgs((m) => [...m, { role: "user", text: q }]);
    if (!online) {
      setMsgs((m) => [...m, answerLocal(ctx, q)]);
      return;
    }
    setBusy(true);
    setMsgs((m) => [...m, { role: "model", text: "" }]);
    try {
      const local = answerLocal(ctx, q);
      const final = await requestAzuLlmChatStream(buildMessages(ctx, history, q), { apiKey: azuLlm.apiKey, maxTokens: 1500 }, (acc) =>
        setMsgs((m) => [...m.slice(0, -1), { role: "model", text: acc }]),
      );
      // 표·버튼은 계산 기록에서 바로 만든다(모델이 숫자를 새로 만들지 않게)
      setMsgs((m) => [...m.slice(0, -1), { role: "model", text: final, blocks: local.blocks, sources: local.sources, followups: local.followups }]);
    } catch (e) {
      const local = answerLocal(ctx, q);
      const note = e instanceof AzuLlmConfigError ? "" : "(아주LLM 연결이 안 돼서 계산 기록으로 바로 답했어요) ";
      setMsgs((m) => [...m.slice(0, -1), { ...local, text: note + local.text }]);
    } finally {
      setBusy(false);
    }
  }

  const rec = ctx.rec && !ctx.rec.empty ? ctx.rec : null;
  const total = Object.values(ctx.spending).reduce((s, v) => s + v, 0);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <section className="flex min-h-[70vh] flex-col rounded-[20px] border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft p-4 md:p-5">
          <div className="flex items-center gap-3">
            <h1 className="text-[22px] font-extrabold">카드 상담</h1>
            <span className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
              <span className={`h-2 w-2 rounded-full ${online ? "bg-positive" : "bg-line-strong"}`} />
              {online ? "아주LLM 연결됨" : "계산 기록으로 답해요"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {HAS_GATEWAY && (
              <ApiKeySettings
                apiKey={azuLlm.apiKey}
                storageType={azuLlm.storageType}
                onChange={azuLlm.setApiKey}
                onSave={azuLlm.save}
                onRemove={azuLlm.remove}
                onStorageTypeChange={azuLlm.setStorageType}
              />
            )}
            <Btn size="sm" onClick={() => setMsgs([introMessage(ctx)])}>
              <Plus className="h-4 w-4" /> 새 대화
            </Btn>
          </div>
        </div>
        {rec && (
          <div className="mx-4 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[12px] bg-tint px-3 py-2 text-[13px] md:mx-5">
            <span>
              상담 기준 <strong>추천 결과</strong> · 카드 {rec.result.cards.length}장 · 월 지출 {korWon(total)} · 실적 여유 {ctx.margin ? korWon(ctx.margin) : "없음"}
            </span>
            <button type="button" onClick={onOpenResult} className="font-bold text-primary">
              결과 보기
            </button>
          </div>
        )}

        <ol className="flex-1 space-y-4 overflow-y-auto p-4 md:p-5" aria-live="polite">
          {msgs.map((m, i) => (
            <li key={i} className={m.role === "user" ? "flex justify-end" : "flex gap-3"}>
              {m.role === "user" ? (
                <div className="max-w-[80%] rounded-[16px] rounded-br-[4px] bg-primary px-4 py-2.5 text-[14px] text-white">{m.text}</div>
              ) : (
                <>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tint text-primary">
                    <MessageCircle className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1 text-[14.5px] leading-relaxed">
                    <div className="whitespace-pre-line">{m.text ? renderLiteMarkdown(m.text) : <span className="text-ink-3">답을 쓰고 있어요…</span>}</div>
                    {m.blocks?.map((b, j) =>
                      b.kind === "benefits" ? (
                        <div key={j} className="mt-3 overflow-hidden rounded-[12px] border border-line">
                          <div className="bg-ground px-3 py-2 text-[12.5px] font-bold">{shortCard(b.card.name)}가 맡은 혜택</div>
                          {b.card.benefits
                            .filter((x) => x.final > 0.5)
                            .map((x) => (
                              <div key={x.id} className="flex justify-between gap-3 border-t border-line-soft px-3 py-2 text-[13px]">
                                <span className="text-ink-2">{benefitLine(x)}</span>
                                <span className="tnum font-bold">{won(x.final)}</span>
                              </div>
                            ))}
                          <div className="flex justify-between border-t border-line-soft px-3 py-2 text-[13px] font-bold">
                            <span>합계</span>
                            <span className="tnum text-positive">월 {won(b.card.total)}</span>
                          </div>
                        </div>
                      ) : b.kind === "compare" ? (
                        <table key={j} className="mt-3 w-full overflow-hidden rounded-[12px] border border-line text-[13px]">
                          <thead className="bg-ground">
                            <tr>
                              {b.head.map((h) => (
                                <th key={h} className="px-3 py-2 text-left font-semibold">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {b.rows.map((r) => (
                              <tr key={r[0]} className="border-t border-line-soft">
                                {r.map((c, k) => (
                                  <td key={k} className="tnum px-3 py-2">
                                    {c}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div key={j} className="mt-3 flex flex-wrap gap-2">
                          {b.actions.map((a) => (
                            <Btn key={a.id} kind={a.primary ? "primary" : "secondary"} size="sm" onClick={() => (a.id === "noMargin" ? onNoMargin() : a.id === "result" ? onOpenResult() : send("지금 조합을 유지할게요"))}>
                              {a.label}
                            </Btn>
                          ))}
                        </div>
                      ),
                    )}
                    {m.sources && m.sources.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-3">
                        근거
                        {m.sources.map((s) => (
                          <span key={s} className="rounded-full border border-line px-2 py-0.5">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    {i === msgs.length - 1 && m.followups && (
                      <div className="mt-3">
                        <div className="text-[12px] text-ink-3">이어서 물어보기</div>
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          {m.followups.map((f) => (
                            <button key={f} type="button" onClick={() => send(f)} className="min-h-10 rounded-full border border-tint-line bg-surface px-3.5 text-[13px] text-primary">
                              {f}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
          <div ref={endRef} />
        </ol>

        <form
          className="border-t border-line-soft p-4 md:p-5"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <div className="flex items-end gap-2 rounded-[16px] border border-line-strong p-2 focus-within:border-primary">
            <label className="sr-only" htmlFor="chat-input">
              결과나 카드에 대해 물어보세요
            </label>
            <textarea
              id="chat-input"
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder="결과나 카드에 대해 물어보세요"
              className="min-w-0 flex-1 resize-none bg-transparent px-2 py-1 text-[14.5px] outline-none"
            />
            <button type="submit" disabled={busy || !input.trim()} aria-label="보내기" className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-primary text-white disabled:opacity-40">
              <ArrowUp className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap justify-between gap-2 text-[12px] text-ink-3">
            <span>Enter 보내기 · Shift+Enter 줄바꿈</span>
            <span>계산 결과와 카드사 원문만 근거로 답해요. 실제 혜택은 카드사 약관에서 확인하세요.</span>
          </div>
        </form>
      </section>

      <aside className="space-y-5">
        <Section title="답변 근거">
          {rec ? (
            <>
              <p className="-mt-2 mb-3 text-[12.5px] text-ink-3">마지막 답변이 비교한 조합 · 계산 엔진 값</p>
              <div className="text-[13px] font-bold">지금 · {rec.result.cards.map((c) => shortCard(c.name)).join(" + ")}</div>
              <div className="mt-2">
                <PerfBars pack={rec.result} compact />
              </div>
              {rec.alt && (
                <p className="mt-4 text-[13px] text-ink-2">
                  여유 없이 · <strong>{rec.alt.names.map(shortCard).join(" + ")}</strong> 월 {approxKor(rec.alt.net)}
                </p>
              )}
              <button type="button" onClick={onOpenResult} className="mt-4 text-[13.5px] font-bold text-primary">
                추천 결과 화면에서 보기 →
              </button>
            </>
          ) : (
            <p className="text-[13px] text-ink-3">추천 결과를 계산하면 여기에 카드별 실적과 비교한 조합이 나와요.</p>
          )}
        </Section>
        <Section title="상담이 할 수 있는 것">
          <ul className="list-disc space-y-1.5 pl-5 text-[13px] text-ink-2">
            <li>결과의 숫자와 카드 배분 이유를 계산 근거 그대로 설명</li>
            <li>실적 여유·카드 수·연회비 상한·지출을 바꿔 다시 계산 제안</li>
            <li>카드사 원문 문장 찾아 주기</li>
          </ul>
          <p className="mt-3 text-[12px] text-ink-3">계산은 계산 엔진이 하고, 상담은 그 결과와 계산 근거를 설명해요. 상담이 숫자를 새로 만들지 않아요.</p>
        </Section>
      </aside>
    </div>
  );
}
