import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useMonthlySpend } from "@/domain/state/useMonthlySpend";
import { AzuLlmConfigError, requestAzuLlmChatStream } from "@/features/chatbot/azuLlmClient";
import { renderLiteMarkdown } from "@/features/chatbot/chatFormatting";
import { catalogBySourceId, categories } from "@/v1/catalog";
import { useAppData } from "@/v2/app/AppData";
import { useCompare } from "@/v2/app/compareStore";
import { cachedEngineCall } from "@/v2/app/engine";
import { paths } from "@/v2/app/paths";
import { navigate, useRoute } from "@/v2/app/router";
import { useBrandPicks } from "@/v2/app/state";
import { chatStore, useChatState } from "@/v2/chat/chatStore";
import { answerLocal, buildMessages, classify, contextLine, introText, suggestions, type ChatAction, type ChatBlock, type ChatContext, type ChatMsg, type ChatPage, type EngineCall } from "@/v2/chat/chatModel";
import { conditionsStore } from "@/v2/make/flow";
import { picksToBrandShare } from "@/v2/model/brands";
import type { CardMeta } from "@/v2/model/compareView";
import { CardImage } from "@/v2/ui/CardImage";
import cardMetaFile from "@data/catalog/card-meta.json";

/**
 * 카드 상담 창(디자인 ChatPanel, 2026-10-29 v2). 어느 화면에서든 오른쪽에 열린다.
 * 답의 숫자·표·버튼은 계산 엔진 결과로 만들고(chatModel.answerLocal), 아주LLM이 연결되어 있으면 문장만 다듬는다.
 * 정해진 유형에 맞지 않는 질문은 아주LLM이 계산 기록·카드 혜택 표를 근거로 직접 답한다(표·버튼 없이, 2026-10-29).
 */

const CARD_META = (cardMetaFile as { cards: Record<string, CardMeta> }).cards;
const HAS_GATEWAY = Boolean((import.meta.env.VITE_AZU_LLM_BASE_URL as string | undefined)?.trim());
const NUMF = "Outfit, 'IBM Plex Sans KR', sans-serif";
const svg = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
const Bubble = ({ size }: { size: number }) => (
  <svg width={size} height={size} {...svg}>
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
  </svg>
);

const call: EngineCall = (fn, args) => cachedEngineCall(fn, args) as ReturnType<EngineCall>;

function parseIds(raw: string | null): number[] {
  return (raw ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && catalogBySourceId.has(n));
}

/** 지금 화면과 계산 결과로 상담 맥락을 만든다 */
function useChatContext(): ChatContext {
  const route = useRoute();
  const { wallet, lastRun, myCards } = useAppData();
  const compare = useCompare();
  const { spending } = useMonthlySpend(categories);
  const [picks] = useBrandPicks();
  const pageSpending = useMemo(() => Object.fromEntries(Object.entries(spending).filter(([, v]) => v > 0)), [spending]);
  const pageBrandShare = useMemo(() => picksToBrandShare(pageSpending, picks), [pageSpending, picks]);
  const [a, , c] = route.parts;
  const page: ChatPage =
    a === "compare"
      ? { kind: "compare", ids: (parseIds(route.query.get("ids")).length ? parseIds(route.query.get("ids")) : compare).slice(0, 3) }
      : a === "benefit"
        ? { kind: "benefit", cat: route.query.get("cat") ?? "convenience" }
        : a === "wallet"
          ? { kind: "wallet" }
          : a === "make" && c === "result"
            ? { kind: "result" }
            : { kind: "other" };
  // 내 지갑 화면에서는 저장한 지갑, 그 밖에는 마지막으로 계산한 결과(없으면 저장한 지갑)
  const useWallet = !!wallet?.pack?.cards?.length && (page.kind === "wallet" || !lastRun);
  const rec = !useWallet && lastRun?.rec && !lastRun.rec.empty ? lastRun.rec : null;
  const pack = rec?.result ?? (useWallet ? wallet!.pack : null);
  return {
    rec,
    pack: pack && pack.cards?.length ? pack : null,
    basis: rec ? "result" : useWallet ? "wallet" : null,
    flow: rec ? lastRun!.flow : useWallet ? (wallet!.flow ?? "own") : null,
    at: rec ? lastRun!.at : useWallet ? Date.parse(wallet!.savedAt) || null : null,
    spending: rec ? lastRun!.spending : useWallet ? wallet!.spending : pageSpending,
    margin: rec ? lastRun!.margin : useWallet ? wallet!.margin : 20000,
    brandShare: rec ? lastRun!.brandShare : useWallet ? (wallet!.brandShare ?? {}) : pageBrandShare,
    ownedIds: myCards.ids,
    page,
    pageSpending,
    pageBrandShare,
    cardMeta: CARD_META,
  };
}

export default function ChatDock() {
  const { open, msgs, pending } = useChatState();
  if (!open) return null;
  return <ChatPanel msgs={msgs} pending={pending} />;
}

function ChatPanel({ msgs, pending }: { msgs: ChatMsg[]; pending: string | null }) {
  const ctx = useChatContext();
  const { azuLlm } = useAppData();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const ctxRef = useRef(ctx);
  useEffect(() => {
    ctxRef.current = ctx;
  });
  const online = HAS_GATEWAY && !!azuLlm.apiKey.trim();

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);
  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") chatStore.setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function send(raw: string) {
    const q = raw.trim();
    if (!q || busy) return;
    setText("");
    setBusy(true);
    const history = chatStore.get().msgs;
    chatStore.setMsgs((m) => [...m, { role: "user", text: q }, { role: "model", text: "계산 결과와 카드사 원문을 확인하고 있어요…", pending: true }]);
    const replaceLast = (msg: ChatMsg, persist = true) => chatStore.setMsgs((m) => [...m.slice(0, -1), msg], persist);
    const intent = classify(q, ctxRef.current);
    let local: ChatMsg;
    try {
      local = await answerLocal(q, ctxRef.current, call);
    } catch {
      local = { role: "model", text: "계산하지 못했어요. 잠시 뒤에 다시 물어봐 주세요." };
    }
    if (!online) {
      replaceLast(local);
      setBusy(false);
      return;
    }
    try {
      const final = (
        await requestAzuLlmChatStream(buildMessages(ctxRef.current, history, q, local, intent), { apiKey: azuLlm.apiKey, maxTokens: 1200 }, (acc) =>
          replaceLast({ role: "model", text: acc, pending: true }, false),
        )
      ).trim();
      // 자유 질문은 아주LLM 답만(요약 표·버튼은 질문과 맞지 않을 수 있음). 빈 답이면 계산 결과 답
      if (intent === "free") replaceLast(final ? { role: "model", text: final } : local);
      else replaceLast({ ...local, text: final || local.text });
    } catch (e) {
      const note = e instanceof AzuLlmConfigError ? "" : "(아주LLM 연결이 안 돼서 계산 결과로 바로 답했어요) ";
      replaceLast({ ...local, text: note + local.text });
    } finally {
      setBusy(false);
    }
  }

  // 다른 화면의 '물어보기' 버튼: 창이 열리면 그 질문을 바로 보낸다
  useEffect(() => {
    if (pending === null || busy) return;
    const q = chatStore.takePending();
    if (q) void send(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, busy]);

  const act = (a: ChatAction) => {
    if ("to" in a) navigate(a.to);
    else if (a.id === "pin") {
      conditionsStore.set({ pinned: [a.sid] });
      navigate(paths.start("new"));
    } else chatStore.setMsgs((m) => [...m, { role: "user", text: "지금 조합 유지할게요" }, { role: "model", text: "좋아요. 지금 조합 그대로 두고, 실적 여유도 그대로 계산할게요. 조건을 바꾸고 싶으면 언제든 물어보세요." }]);
  };

  const canSend = !!text.trim() && !busy;
  return (
    <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 40, width: "min(420px, 100vw)", display: "flex", flexDirection: "column" }}>
      <aside
        id="w-chat-panel"
        aria-label="카드 상담"
        style={{ width: "100%", height: "100vh", minHeight: "min(640px, 100vh)", boxSizing: "border-box", display: "flex", flexDirection: "column", background: "#FFFFFF", color: "#0D1B4A", fontFamily: "'IBM Plex Sans KR', system-ui, sans-serif", wordBreak: "keep-all", borderLeft: "1px solid #E3EAF8", boxShadow: "-18px 0 40px rgba(13, 40, 120, 0.12)", lineHeight: "normal" }}
      >
        <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 12, padding: "16px 12px 16px 20px", borderBottom: "1px solid #EDF2FC" }}>
          <span aria-hidden="true" style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 14, background: "#2457F5", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Bubble size={20} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>카드 상담</h2>
            <div style={{ fontSize: 13, color: "#5E6D96" }}>계산 결과와 카드사 원문으로 답해요</div>
          </div>
          <button type="button" aria-label="새 상담" onClick={() => chatStore.reset()} style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 22, border: "none", background: "transparent", color: "#3A4A78", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <svg width={20} height={20} {...svg}>
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          </button>
          <button type="button" aria-label="카드 상담 닫기" onClick={() => chatStore.setOpen(false)} style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 22, border: "none", background: "#F3F7FF", color: "#0D1B4A", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <svg width={20} height={20} {...svg}>
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        <div style={{ flex: "none", padding: "10px 20px", background: "#F7FAFF", borderBottom: "1px solid #EDF2FC", fontSize: 13, lineHeight: 1.5, color: "#3A4A78" }}>
          <b style={{ color: "#0D1B4A" }}>상담 기준</b> · {contextLine(ctx)}
        </div>
        <div ref={listRef} aria-live="polite" style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 18, padding: 20 }}>
          <BotMsg>{introText(ctx)}</BotMsg>
          {msgs.map((m, i) =>
            m.role === "user" ? (
              <div key={i} style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{ maxWidth: "85%", padding: "10px 14px", borderRadius: "16px 16px 4px 16px", background: "#2457F5", color: "#FFFFFF", fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{m.text}</div>
              </div>
            ) : (
              <BotMsg key={i} muted={m.pending}>
                {renderLiteMarkdown(m.text)}
                {!m.pending && m.blocks?.map((b, j) => <Block key={j} block={b} onAction={act} />)}
              </BotMsg>
            ),
          )}
        </div>
        <div style={{ flex: "none", padding: "12px 16px 16px", borderTop: "1px solid #EDF2FC", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {suggestions(ctx).map((sg) => (
              <button key={sg} type="button" disabled={busy} onClick={() => void send(sg)} style={{ minHeight: 36, padding: "6px 12px", borderRadius: 18, border: "1px solid #C9D6F5", background: "#F5F8FF", fontFamily: "inherit", fontSize: 13, color: "#2457F5", cursor: busy ? "default" : "pointer", textAlign: "left" }}>
                {sg}
              </button>
            ))}
          </div>
          <div className="w-field" style={{ position: "relative", display: "flex", alignItems: "flex-end", gap: 8, padding: "8px 8px 8px 14px", border: "1px solid #D3DDF2", borderRadius: 18, background: "#FFFFFF" }}>
            <label htmlFor="panel-input" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
              질문 입력
            </label>
            <textarea
              ref={inputRef}
              id="panel-input"
              rows={2}
              placeholder="보고 있는 화면에 대해 물어보세요"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send(text);
                }
              }}
              style={{ flex: 1, minWidth: 0, border: "none", outline: "none", resize: "none", fontFamily: "inherit", fontSize: 15, lineHeight: 1.5, color: "#0D1B4A", background: "transparent", padding: 2, boxSizing: "content-box" }}
            />
            <button
              type="button"
              aria-label="보내기"
              disabled={!canSend}
              onClick={() => void send(text)}
              style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 22, border: "none", display: "flex", alignItems: "center", justifyContent: "center", ...(canSend ? { background: "#2457F5", cursor: "pointer" } : { background: "#A9B4CF", cursor: "default" }) }}
            >
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14" />
                <path d="m13 6 6 6-6 6" />
              </svg>
            </button>
          </div>
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: "#5E6D96" }}>
            Enter 보내기 · Shift+Enter 줄바꿈 · 실제 혜택은 카드사 약관에서 확인하세요
            {HAS_GATEWAY && (
              <>
                {" · "}
                <button type="button" aria-expanded={keyOpen} onClick={() => setKeyOpen((v) => !v)} style={{ padding: 0, border: "none", background: "transparent", fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: online ? "#1747D6" : "#3A4A78", textDecoration: "underline", cursor: "pointer" }}>
                  {online ? "아주LLM 연결됨" : "아주LLM 연결하기"}
                </button>
              </>
            )}
          </p>
          {HAS_GATEWAY && keyOpen && <KeyForm onDone={() => setKeyOpen(false)} />}
        </div>
      </aside>
    </div>
  );
}

function BotMsg({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <span aria-hidden="true" style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 16, background: "#E8EEFF", color: "#2457F5", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Bubble size={16} />
      </span>
      <div style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1.7, color: muted ? "#5E6D96" : "#0D1B4A" }}>{children}</div>
    </div>
  );
}

const amountStyle: CSSProperties = { fontFamily: NUMF, fontVariantNumeric: "tabular-nums", fontWeight: 700 };

function Block({ block, onAction }: { block: ChatBlock; onAction: (a: ChatAction) => void }) {
  if (block.kind === "benefits") {
    return (
      <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 14, background: "#F3F7FF" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 6, fontSize: 13, fontWeight: 700 }}>
          <CardImage sid={block.sid} width={40} shadow={false} />
          {block.name}
        </div>
        {block.rows.length > 0 && (
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {block.rows.map((r, i) => (
              <li key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "6px 0", fontSize: 13 }}>
                <span style={{ color: "#3A4A78" }}>
                  <b style={{ color: "#0D1B4A" }}>{r.label}</b> · {r.sub}
                </span>
                <span style={{ ...amountStyle, whiteSpace: "nowrap" }}>{r.amount}</span>
              </li>
            ))}
          </ul>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, marginTop: 4, borderTop: "1px solid #E3EAF8", fontSize: 14, fontWeight: 700 }}>
          <span>합계</span>
          <span style={{ ...amountStyle, color: "#1747D6" }}>{block.total}</span>
        </div>
      </div>
    );
  }
  if (block.kind === "tiles") {
    return (
      <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
        {block.tiles.map((t) => (
          <div key={t.label} style={{ flex: "1 1 140px", minWidth: 0, padding: 12, borderRadius: 14, background: "#FFFFFF", border: t.highlight ? "2px solid #2457F5" : "1px solid #E3EAF8" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: t.highlight ? "#1747D6" : "#5E6D96" }}>{t.label}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 700 }}>
              <span aria-hidden="true" style={{ display: "inline-flex" }}>
                {t.sids.slice(0, 3).map((sid, i) => (
                  <CardImage key={sid} sid={sid} width={28} shadow={false} style={{ marginLeft: i ? -12 : 0 }} />
                ))}
              </span>
              {t.names}
            </div>
            {t.rows.map((r) => (
              <div key={r.k} style={{ marginTop: 6 }}>
                <div style={{ fontSize: 12, color: "#5E6D96" }}>{r.k}</div>
                <div style={{ ...amountStyle, fontSize: 14, color: r.warn ? "#A3420B" : "#0D1B4A" }}>{r.v}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }
  if (block.kind === "cards") {
    return (
      <ul style={{ margin: "10px 0 0", padding: "4px 14px", listStyle: "none", borderRadius: 14, background: "#F3F7FF" }}>
        {block.items.map((it, i) => (
          <li key={it.sid} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: i ? "1px solid #E3EAF8" : undefined }}>
            <CardImage sid={it.sid} width={44} shadow={false} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#0D1B4A" }}>{it.name}</span>
              <span style={{ display: "block", fontSize: 12, color: "#5E6D96" }}>{it.note}</span>
            </span>
            <span style={{ ...amountStyle, fontSize: 13, whiteSpace: "nowrap", color: it.strong ? "#1747D6" : "#0D1B4A" }}>{it.value}</span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
      {block.actions.map((a) =>
        "to" in a ? (
          <a
            key={a.label}
            href={`#${a.to}`}
            onClick={(e) => {
              e.preventDefault();
              onAction(a);
            }}
            style={{ display: "inline-flex", alignItems: "center", height: 40, padding: "0 14px", boxSizing: "border-box", borderRadius: 20, border: a.primary ? "1px solid #2457F5" : "1px solid #D3DDF2", background: a.primary ? "#2457F5" : "#FFFFFF", fontSize: 13, fontWeight: 700, color: a.primary ? "#FFFFFF" : "#0D1B4A", textDecoration: "none" }}
          >
            {a.label}
          </a>
        ) : (
          <button
            key={a.label}
            type="button"
            onClick={() => onAction(a)}
            style={{ height: 40, padding: "0 14px", borderRadius: 20, border: "none", background: a.primary ? "#2457F5" : "#E8EEFF", fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: a.primary ? "#FFFFFF" : "#2457F5", cursor: "pointer" }}
          >
            {a.label}
          </button>
        ),
      )}
    </div>
  );
}

/** 아주LLM 키(디자인에 없는 칸이라 같은 색·글꼴로 작게) */
function KeyForm({ onDone }: { onDone: () => void }) {
  const { azuLlm } = useAppData();
  const has = !!azuLlm.apiKey.trim();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, borderRadius: 14, background: "#F7FAFF", border: "1px solid #E3EAF8" }}>
      <label htmlFor="azu-key" style={{ fontSize: 12, fontWeight: 700, color: "#0D1B4A" }}>
        아주LLM API 키
      </label>
      <input
        id="azu-key"
        type="password"
        autoComplete="off"
        value={azuLlm.apiKey}
        onChange={(e) => azuLlm.setApiKey(e.target.value)}
        placeholder="키를 붙여 넣어 주세요"
        style={{ height: 40, padding: "0 12px", boxSizing: "border-box", borderRadius: 10, border: "1px solid #D3DDF2", fontFamily: "inherit", fontSize: 14, color: "#0D1B4A" }}
      />
      <div role="radiogroup" aria-label="키 저장 방식" style={{ display: "flex", gap: 12, fontSize: 12, color: "#3A4A78" }}>
        {(["session", "local"] as const).map((t) => (
          <label key={t} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <input type="radio" name="azu-store" checked={azuLlm.storageType === t} onChange={() => azuLlm.setStorageType(t)} />
            {t === "session" ? "이 탭에서만" : "이 브라우저에 저장"}
          </label>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          disabled={!has}
          onClick={() => {
            azuLlm.save();
            onDone();
          }}
          style={{ height: 36, padding: "0 14px", borderRadius: 18, border: "none", background: has ? "#2457F5" : "#A9B4CF", fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: "#FFFFFF", cursor: has ? "pointer" : "default" }}
        >
          저장
        </button>
        <button
          type="button"
          onClick={() => {
            azuLlm.remove();
            onDone();
          }}
          style={{ height: 36, padding: "0 14px", borderRadius: 18, border: "1px solid #D3DDF2", background: "#FFFFFF", fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: "#3A4A78", cursor: "pointer" }}
        >
          지우기
        </button>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: "#5E6D96" }}>키가 없으면 계산 결과로 바로 답해요. 키는 이 브라우저에 두고, 질문할 때만 아주LLM으로 보내요.</p>
    </div>
  );
}
