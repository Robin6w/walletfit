import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Sparkles, RotateCcw } from "lucide-react";
import { sendChatMessage, type ChatMessage } from "@/features/chatbot/cardChatbot";
import type { ChatbotResponseMeta } from "@/features/chatbot/responseParser";
import { renderLiteMarkdown } from "@/features/chatbot/chatFormatting";
import { ApiKeySettings } from "@/features/settings/ApiKeySettings";
import type { StorageType } from "@/shared/hooks/useAzuLlmApiKey";
import type { SpendCategory } from "@/domain/types/card";
import type { CardFitScore } from "@/domain/types/recommendation";
import type { WalletBlueprint } from "@/domain/types/optimization";

/** 카드 칩/핵심 수치/후속 질문 중 하나라도 있어야 메시지 아래에 추가 UI를 그립니다. */
function hasMetaContent(meta: ChatbotResponseMeta): boolean {
  return meta.cards.length > 0 || meta.highlight !== null || meta.followups.length > 0;
}

interface ChatbotProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evaluations: CardFitScore[];
  categories: SpendCategory[];
  /** 지갑 마법사(WalletWizardPage)가 계산한 추천 조합. 아직 계산 전/방문 전이면 null. */
  walletResult: WalletBlueprint | null;
  /** 아주LLM API Key 상태 — App.tsx의 useAzuLlmApiKey 훅을 그대로 받아 씁니다. */
  apiKey: string;
  storageType: StorageType;
  onApiKeyChange: (value: string) => void;
  onApiKeySave: (storageType?: StorageType) => void;
  onApiKeyRemove: () => void;
  onApiKeyStorageTypeChange: (type: StorageType) => void;
}

const GREETING: ChatMessage = {
  role: "model",
  text: "안녕하세요! walletfit 카드 상담 챗봇이에요. 지금 등록한 카드와 지갑 만들기 추천 결과를 보고 답해드릴게요. 아래 질문 중 하나를 눌러보거나 직접 물어보세요.",
};

/** 사용자가 바로 눌러볼 수 있는 퀵 질문. 매번 직접 타이핑하는 번거로움을 줄여준다. */
const QUICK_QUESTIONS = [
  "지금 제 카드 중에 가장 혜택이 좋은 건 뭐예요?",
  "연회비 대비 손해 보는 카드가 있나요?",
  "카드를 몇 장 들고 다니는 게 적당할까요?",
  "실적 조건을 못 채우고 있는 카드가 있나요?",
  "방금 계산된 지갑 조합은 왜 이렇게 나왔어요?",
];

export function Chatbot({
  open,
  onOpenChange,
  evaluations,
  categories,
  walletResult,
  apiKey,
  storageType,
  onApiKeyChange,
  onApiKeySave,
  onApiKeyRemove,
  onApiKeyStorageTypeChange,
}: ChatbotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // null = 스트리밍 중이 아님. "" = 스트리밍은 시작됐지만 아직 보여줄 텍스트가 없음(추론
  // 단계 — gpt-oss-120b는 실제 답변 전에 내부적으로 한참 "생각"하느라 이 상태가 몇 초 이어질
  // 수 있습니다). 그 외 = 지금까지 도착한 답변 텍스트.
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const hasApiKey = apiKey.trim().length > 0;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, loading, streamingText]);

  const sendText = async (text: string) => {
    if (!text || loading) return;

    const nextHistory = [...messages, { role: "user", text } as ChatMessage];
    setMessages(nextHistory);
    setInput("");
    setLoading(true);
    setError(null);
    // 오프라인(규칙 기반) 응답은 스트리밍하지 않으니, API 키가 없을 땐 굳이 빈 스트리밍
    // 버블을 띄우지 않고 곧바로 "생각하는 중" 표시만 보여줍니다.
    setStreamingText(hasApiKey ? "" : null);

    try {
      const result = await sendChatMessage(
        messages,
        text,
        { evaluations, categories, walletResult },
        { apiKey },
        hasApiKey ? (visibleSoFar) => setStreamingText(visibleSoFar) : undefined,
      );
      setMessages((prev) => [...prev, { role: "model", text: result.text, meta: result.meta }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "답변을 가져오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
      setStreamingText(null);
    }
  };

  const handleSend = () => sendText(input.trim());
  const handleQuickQuestion = (question: string) => sendText(question);
  const handleResetChat = () => {
    setMessages([GREETING]);
    setError(null);
  };

  const showQuickQuestions = messages.length <= 1 && !loading;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          aria-label="카드 상담 챗봇 열기"
          className="brand-gradient-soft absolute right-8 bottom-8 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_8px_18px_rgba(27,63,196,0.4)] transition hover:scale-105"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {open && (
        <div className="glass-panel absolute right-8 bottom-8 flex h-[540px] w-[380px] flex-col overflow-hidden rounded-2xl border border-brand-blue/20 shadow-2xl">
          <div className="brand-gradient flex items-center justify-between px-4 py-3 text-white">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold">
                <Sparkles className="h-4 w-4" /> 카드 상담 챗봇
              </div>
              <div className="mt-0.5 text-[10px] font-medium text-brand-sky">
                {hasApiKey ? "아주LLM으로 답변하고 있어요" : "예시 응답으로 동작 중이에요"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {messages.length > 1 && (
                <button
                  type="button"
                  onClick={handleResetChat}
                  aria-label="대화 새로 시작하기"
                  title="대화 새로 시작하기"
                  className="rounded-full p-1 transition hover:bg-white/15"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}
              <button type="button" onClick={() => onOpenChange(false)} aria-label="닫기" className="rounded-full p-1 transition hover:bg-white/15">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end border-b border-slate-100 px-3 py-2">
            <ApiKeySettings
              apiKey={apiKey}
              storageType={storageType}
              onChange={onApiKeyChange}
              onSave={onApiKeySave}
              onRemove={onApiKeyRemove}
              onStorageTypeChange={onApiKeyStorageTypeChange}
            />
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
                {messages.map((m, i) => (
                  <div key={i}>
                    <div className={`flex items-end gap-1.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      {m.role === "model" && (
                        <span className="mb-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-sky/50 text-brand-blue-deep">
                          <Sparkles className="h-3 w-3" />
                        </span>
                      )}
                      <div
                        className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[12.5px] leading-relaxed ${
                          m.role === "user" ? "bg-brand-blue text-white" : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {m.role === "model" ? renderLiteMarkdown(m.text) : m.text}
                      </div>
                    </div>

                    {m.role === "model" && m.meta && hasMetaContent(m.meta) && (
                      <div className="mt-1.5 flex flex-col gap-1.5 pl-6.5">
                        {m.meta.cards.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {m.meta.cards.map((card) => (
                              <span
                                key={card}
                                className="rounded-full bg-brand-sky/20 px-2 py-0.5 text-[10.5px] font-semibold text-brand-blue-deep"
                              >
                                {card}
                              </span>
                            ))}
                          </div>
                        )}
                        {m.meta.highlight && (
                          <div className="w-fit rounded-lg border border-brand-blue/15 bg-white px-3 py-1.5 shadow-sm">
                            <p className="text-[10px] font-medium text-slate-400">{m.meta.highlight.label}</p>
                            <p className="text-[14.5px] font-extrabold text-brand-blue-deep">{m.meta.highlight.value}</p>
                          </div>
                        )}
                        {m.meta.followups.length > 0 && (
                          <div className="flex flex-col gap-1">
                            {m.meta.followups.map((q) => (
                              <button
                                key={q}
                                type="button"
                                onClick={() => handleQuickQuestion(q)}
                                disabled={loading}
                                className="w-fit rounded-full border border-brand-blue/20 bg-brand-sky/10 px-2.5 py-1 text-left text-[11px] font-medium text-brand-blue-deep transition hover:bg-brand-sky/25 disabled:opacity-40"
                              >
                                {q}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {showQuickQuestions && (
                  <div className="flex flex-col gap-1.5 pt-1">
                    {QUICK_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => handleQuickQuestion(q)}
                        className="rounded-xl border border-brand-blue/20 bg-brand-sky/15 px-3 py-2 text-left text-[11.5px] font-medium text-brand-blue-deep transition hover:bg-brand-sky/30"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}

                {loading && (
                  <div className="flex items-end justify-start gap-1.5">
                    <span className="mb-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-sky/50 text-brand-blue-deep">
                      <Sparkles className="h-3 w-3" />
                    </span>
                    <div className="max-w-[78%] rounded-2xl bg-slate-100 px-3.5 py-2 text-[12.5px] leading-relaxed text-slate-700">
                      {streamingText ? (
                        <>
                          {renderLiteMarkdown(streamingText)}
                          <span className="ml-0.5 inline-block h-3 w-1 animate-pulse bg-slate-400 align-middle" />
                        </>
                      ) : (
                        <span className="text-slate-400">
                          {hasApiKey ? "아주LLM이 답변을 생각하는 중..." : "답변을 생각하는 중..."}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {error && <p className="text-center text-[11px] text-rose-500">{error}</p>}
              </div>
              <div className="flex items-center gap-2 border-t border-slate-100 p-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="카드에 대해 물어보세요"
                  className="flex-1 rounded-full border border-slate-200 px-3.5 py-2 text-[12.5px] outline-none focus:border-brand-blue"
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={loading || !input.trim()}
                  aria-label="전송"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-blue text-white disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
        </div>
      )}
    </>
  );
}
