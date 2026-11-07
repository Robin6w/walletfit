import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useMonthlySpend } from "@/domain/state/useMonthlySpend";
import { AzuLlmConfigError, azuLlmErrorReason, requestAzuLlmChat } from "@/features/chatbot/azuLlmClient";
import { renderLiteMarkdown } from "@/features/chatbot/chatFormatting";
import { catalogBySourceId, categories } from "@/v1/catalog";
import { useAppData } from "@/v2/app/AppData";
import { useCompare } from "@/v2/app/compareStore";
import { cachedEngineCall } from "@/v2/app/engine";
import { paths } from "@/v2/app/paths";
import { navigate, useRoute } from "@/v2/app/router";
import { useBrandPicks } from "@/v2/app/state";
import { chatStore, useChatState } from "@/v2/chat/chatStore";
import { answerChoice, answerTyped, choiceDelay, clockText, contextLine, introText, maskPrivateInfo, MENUS, screenName, TYPED_MIN_DELAY, withChoices, type AskAi, type ChatAction, type ChatBlock, type ChatChoice, type ChatContext, type ChatMsg, type ChatPage, type EngineCall, type MenuId } from "@/v2/chat/chatModel";
import { LIMITS } from "@/v2/chat/chatRules";
import { Fitfit, type FitfitMood } from "@/v2/chat/Fitfit";
import { NavTransition } from "@/v2/chat/NavTransition";
import { conditionsStore } from "@/v2/make/flow";
import { picksToBrandShare } from "@/v2/model/brands";
import type { CardMeta } from "@/v2/model/compareView";
import { CardImage } from "@/v2/ui/CardImage";
import cardMetaFile from "@data/catalog/card-meta.json";

/**
 * 카드 상담 창(디자인 ChatPanel, 2026-10-29 v2). 어느 화면에서든 오른쪽에 열린다.
 * 버튼(선택지)은 chatModel.answerChoice, 직접 입력은 chatModel.answerTyped로 답한다(2026-10-31). 같은 뜻의 질문이면
 * 버튼이든 직접 입력이든 같은 답이 나오고, 아주LLM은 분류와 짧은 답에만 쓴다. 대화 규칙은 chatRules.ts에 모여 있다.
 */

const CARD_META = (cardMetaFile as { cards: Record<string, CardMeta> }).cards;
const HAS_GATEWAY = Boolean((import.meta.env.VITE_AZU_LLM_BASE_URL as string | undefined)?.trim());
const NUMF = "Outfit, 'IBM Plex Sans KR', sans-serif";
const svg = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

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
    tickets: rec ? lastRun!.tickets : useWallet ? wallet!.tickets : undefined,
    ownedIds: myCards.ids,
    page,
    pageSpending,
    pageBrandShare,
    cardMeta: CARD_META,
  };
}

/** 창이 오른쪽에서 밀려 들어오고 나가는 시간(2026-10-31). 움직임 줄이기 설정과 관계없이 항상 밀린다(팀 결정) */
const SLIDE_MS = 240;

export default function ChatDock() {
  const { open, msgs, pending } = useChatState();
  // 닫을 때 바로 지우지 않고, 오른쪽으로 밀려 나간 뒤에 지운다
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);
  if (open && !mounted) setMounted(true);
  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(id);
    }
    const t = setTimeout(
      () => {
        setMounted(false);
        setEntered(false);
      },
      SLIDE_MS,
    );
    return () => clearTimeout(t);
  }, [open]);
  if (!mounted) return null;
  return <ChatPanel msgs={msgs} pending={pending} shown={open && entered} />;
}

function ChatPanel({ msgs, pending, shown }: { msgs: ChatMsg[]; pending: string | null; shown: boolean }) {
  const ctx = useChatContext();
  const { azuLlm } = useAppData();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [openedAt, setOpenedAt] = useState(() => Date.now());
  const confirmRef = useRef(false);
  useEffect(() => {
    confirmRef.current = confirmReset;
  }, [confirmReset]);
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
    // Esc: 다시 시작 확인 창이 떠 있으면 그것만 닫고, 아니면 상담 창을 닫는다
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (confirmRef.current) setConfirmReset(false);
      else chatStore.setOpen(false);
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
    // 기다리는 동안은 '입력 중' 점만(2026-10-31). 개인정보가 든 말은 숫자를 가려서 남긴다
    chatStore.setMsgs((m) => [...m, { role: "user", text: maskPrivateInfo(q), at: Date.now() }, { role: "model", text: "", pending: true }]);
    // 최소 대기(TYPED_MIN_DELAY): 답이 먼저 와도 2초까지는 점을 보여 주고, 더 오래 걸리면 그대로 기다린다
    const startedAt = Date.now();
    // 아주LLM은 입력 판단(앞 대화를 보고 의도 고르기)과 짧은 답에만 쓴다(answerTyped, 규칙은 chatRules.ts, 의도 정의서는 intents.ts).
    // 답이 JSON 한 줄이라 스트리밍하지 않고 다 받은 뒤 보여 준다
    const ai: AskAi | null = online
      ? async (messages) => {
          try {
            return await requestAzuLlmChat(messages, { apiKey: azuLlm.apiKey, maxTokens: LIMITS.aiMaxTokens });
          } catch (e) {
            if (!(e instanceof AzuLlmConfigError)) console.warn("[상담] 아주LLM 호출 실패", e instanceof Error ? e.message : e);
            throw new Error(azuLlmErrorReason(e));
          }
        }
      : null;
    let answer: ChatMsg;
    try {
      answer = await answerTyped(q, ctxRef.current, call, ai, history);
    } catch {
      answer = withChoices({ role: "model", text: "계산하지 못했어요. 잠시 뒤에 다시 물어봐 주세요.", mood: "sorry" });
    }
    await new Promise((r) => setTimeout(r, Math.max(0, startedAt + TYPED_MIN_DELAY - Date.now())));
    chatStore.setMsgs((m) => [...m.slice(0, -1), { ...answer, at: Date.now() }]);
    setBusy(false);
  }

  // 선택지(큰 메뉴·질문형 버튼): 누른 문장을 내 말풍선으로 넣고, 아주LLM 없이 계산 결과로 답한다(2026-10-31).
  // 바로 뜨면 대화하는 느낌이 없어서 '입력 중' 점을 choiceDelay만큼 보여 준 뒤 답한다
  async function choose(choice: ChatChoice) {
    if (busy) return;
    setBusy(true);
    chatStore.setMsgs((m) => [...m, { role: "user", text: choice.label, at: Date.now() }, { role: "model", text: "", pending: true }]);
    let answer: ChatMsg;
    try {
      [answer] = await Promise.all([answerChoice(choice.id, ctxRef.current, call), new Promise((r) => setTimeout(r, choiceDelay(choice.id)))]);
    } catch {
      answer = withChoices({ role: "model", text: "계산하지 못했어요. 잠시 뒤에 다시 골라 주세요.", mood: "sorry" });
    }
    chatStore.setMsgs((m) => [...m.slice(0, -1), { ...answer, at: Date.now() }]);
    setBusy(false);
  }
  const chooseMenu = (id: MenuId) => void choose({ id: `menu:${id}`, label: MENUS.find((m) => m.id === id)?.label ?? id });

  // 다른 화면의 '물어보기' 버튼: 창이 열리면 그 질문을 바로 보낸다
  useEffect(() => {
    if (pending === null || busy) return;
    const q = chatStore.takePending();
    if (q) void send(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, busy]);

  // 이동 버튼: 바로 옮기지 않고 핏핏 완성 장면(NavTransition, 1.5초)을 띄운 뒤 그 뒤에서 화면을 바꾼다(2026-11-01). 상담 창은 열어 둔다
  const [moving, setMoving] = useState<{ to: string; before?: () => void } | null>(null);
  const act = (a: ChatAction) => {
    if (moving) return;
    if ("to" in a) setMoving({ to: a.to });
    else if (a.id === "pin") setMoving({ to: paths.start("new"), before: () => conditionsStore.set({ pinned: [a.sid] }) });
    else chatStore.setMsgs((m) => [...m, { role: "user", text: "지금 조합 유지할게요", at: Date.now() }, { role: "model", text: "좋아요. 지금 조합 그대로 두고, 실적 여유도 그대로 계산할게요. 조건을 바꾸고 싶으면 언제든 물어보세요.", at: Date.now() }]);
  };
  // 첫 인사 시각: 대화가 있으면 첫 말풍선 시각, 없으면 창을 열었을(또는 다시 시작한) 때
  const greetAt = msgs.find((m) => m.at)?.at ?? openedAt;

  const canSend = !!text.trim() && !busy;
  return (
    <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 40, width: "min(420px, 100vw)", display: "flex", flexDirection: "column", transform: shown ? "translateX(0)" : "translateX(100%)", transition: `transform ${SLIDE_MS}ms ease` }}>
      <aside
        id="w-chat-panel"
        aria-label="카드 상담"
        style={{ width: "100%", height: "100vh", minHeight: "min(640px, 100vh)", boxSizing: "border-box", display: "flex", flexDirection: "column", background: "#FFFFFF", color: "#0D1B4A", fontFamily: "'IBM Plex Sans KR', system-ui, sans-serif", wordBreak: "keep-all", borderLeft: "1px solid #E3EAF8", boxShadow: "-18px 0 40px rgba(13, 40, 120, 0.12)", lineHeight: "normal" }}
      >
        <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 12, padding: "16px 12px 16px 20px", borderBottom: "1px solid #EDF2FC" }}>
          {/* 핏핏: 창을 열 때마다 손을 3번 흔든다(2026-10-31) */}
          <span aria-hidden="true" style={{ flexShrink: 0, width: 44, height: 44, background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Fitfit variant="full" mood="hello" wave size={38} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>카드 상담사 핏핏</h2>
            <div style={{ fontSize: 12, color: "#5E6D96" }}>walletfit AI 챗봇</div>
          </div>
          <button type="button" aria-label="상담 다시 시작" title="상담 다시 시작" onClick={() => setConfirmReset(true)} style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 22, border: "none", background: "transparent", color: "#3A4A78", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <svg width={20} height={20} {...svg}>
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
          <button type="button" aria-label="카드 상담 닫기" title="닫기" onClick={() => chatStore.setOpen(false)} style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 22, border: "none", background: "#F3F7FF", color: "#0D1B4A", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <svg width={20} height={20} {...svg}>
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
        </div>
        {moving && (
          <NavTransition
            screen={screenName(moving.to)}
            onNavigate={() => {
              moving.before?.();
              navigate(moving.to);
            }}
            onDone={() => setMoving(null)}
          />
        )}
        {confirmReset && (
          <ResetConfirm
            onYes={() => {
              chatStore.reset();
              setOpenedAt(Date.now());
              setConfirmReset(false);
              inputRef.current?.focus();
            }}
            onNo={() => setConfirmReset(false)}
          />
        )}
        <div style={{ flex: "none", padding: "10px 20px", background: "#F7FAFF", borderBottom: "1px solid #EDF2FC", fontSize: 13, lineHeight: 1.5, color: "#3A4A78" }}>
          <ContextStrip line={contextLine(ctx)} />
        </div>
        <div ref={listRef} aria-live="polite" style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 18, padding: 20 }}>
          <BotMsg mood="hello" at={greetAt} extra={<MenuGrid onPick={chooseMenu} disabled={busy} />}>
            {introText()}
          </BotMsg>
          {msgs.map((m, i) =>
            m.role === "user" ? (
              <div key={i} style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{ maxWidth: "85%", padding: "10px 14px", borderRadius: "16px 16px 4px 16px", background: "#2457F5", color: "#FFFFFF", fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{m.text}</div>
              </div>
            ) : (
              <BotMsg key={i} muted={m.pending} at={m.pending ? undefined : m.at} mood={m.pending ? undefined : (m.mood ?? "happy")} extra={!m.pending && m.blocks?.map((b, j) => <Block key={j} block={b} onAction={act} onChoose={(c) => void choose(c)} onMenu={chooseMenu} busy={busy} />)}>
                {m.pending && !m.text ? <TypingDots /> : renderLiteMarkdown(m.text)}
              </BotMsg>
            ),
          )}
        </div>
        <div style={{ flex: "none", padding: "12px 16px 16px", borderTop: "1px solid #EDF2FC", display: "flex", flexDirection: "column", gap: 10 }}>
          {/* 포커스 표시: 공용 .w-field는 테두리를 진한 파랑으로 바꿔 안쪽에 검은 선처럼 보여서, 상담 입력칸은 연한 바깥 링만 둔다(2026-10-31) */}
          <div className="transition-shadow focus-within:shadow-[0_0_0_3px_rgba(36,87,245,0.18)]" style={{ position: "relative", display: "flex", alignItems: "flex-end", gap: 8, padding: "8px 8px 8px 14px", border: "1px solid #D3DDF2", borderRadius: 18, background: "#FFFFFF" }}>
            <label htmlFor="panel-input" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
              질문 입력
            </label>
            <textarea
              ref={inputRef}
              id="panel-input"
              rows={2}
              placeholder="원하는 질문이 위에 없으면 직접 입력해 주세요"
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

/** 위 띠: 모두 보통 굵기, 숫자(value)만 진한 색. 칸 사이는 ' / ' */
function ContextStrip({ line }: { line: ReturnType<typeof contextLine> }) {
  return (
    <>
      {line.label}:{" "}
      {line.items.map((it, i) => (
        <span key={i}>
          {i > 0 && " / "}
          {it.pre}
          {it.value && <span style={{ color: "#0D1B4A", fontWeight: 600 }}>{it.value}</span>}
        </span>
      ))}
    </>
  );
}

/** 선택지를 누른 뒤 기다리는 동안 말풍선 안 '입력 중' 점 3개(차례로 깜빡임) */
function TypingDots() {
  return (
    <output aria-label="답을 쓰는 중" style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 24 }}>
      <style>{"@keyframes wf-typing{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}"}</style>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ width: 7, height: 7, borderRadius: 4, background: "#5E6D96", animation: `wf-typing 1s ease-in-out ${i * 0.15}s infinite` }} />
      ))}
    </output>
  );
}

const CONFIRM_BTN =
  "h-11 flex-1 cursor-pointer rounded-[22px] border border-[#D3DDF2] bg-white text-[15px] font-bold text-[#0D1B4A] transition-colors hover:border-w-primary hover:bg-w-primary hover:text-white focus-visible:border-w-primary focus-visible:bg-w-primary focus-visible:text-white focus-visible:outline-none";

/**
 * '상담 다시 시작' 확인 창(2026-10-31). 화면 가운데 흰 창, 뒤는 흐리게.
 * 상담 창은 밀려 들어오는 움직임(transform) 때문에 그 안의 fixed가 창 기준이 되므로 body에 띄운다
 */
function ResetConfirm({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  // 처음 포커스는 창 자체에 둔다(버튼에 두면 마우스를 올리기 전부터 파랗게 보임). Tab으로 버튼을 고를 수 있다
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    boxRef.current?.focus();
  }, []);
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(13, 27, 74, 0.25)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}>
      <div
        ref={boxRef}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="reset-title"
        aria-describedby="reset-desc"
        style={{ outline: "none", width: "min(360px, 100%)", boxSizing: "border-box", padding: "28px 20px 20px", borderRadius: 20, background: "#FFFFFF", color: "#0D1B4A", boxShadow: "0 24px 60px -12px rgba(13, 40, 120, 0.35)", fontFamily: "'IBM Plex Sans KR', system-ui, sans-serif", textAlign: "center", wordBreak: "keep-all" }}
      >
        <h3 id="reset-title" style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
          상담을 다시 시작하시겠습니까?
        </h3>
        <p id="reset-desc" style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.6, color: "#3A4A78" }}>
          지금까지 나눈 대화가 모두 사라집니다.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 22 }}>
          <button type="button" className={CONFIRM_BTN} onClick={onNo}>
            아니오
          </button>
          <button type="button" className={CONFIRM_BTN} onClick={onYes}>
            예
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * 상담 답: 연한 파랑 말풍선(위 '최근에 저장된 정보' 띠와 같은 색, 2026-10-31). 표·버튼(extra)은 말풍선 밖 아래에 넓게.
 * 오른쪽 위 모서리에 핏핏 얼굴을 작게 걸친다(카카오톡 알림 말풍선처럼). 표정 = 그 답의 상태(mood).
 * 답을 쓰는 중에는 mood를 주지 않아 핏핏 없이 말풍선 안 '입력 중' 점만 보인다
 */
function BotMsg({ children, muted, extra, mood, at }: { children: ReactNode; muted?: boolean; extra?: ReactNode; mood?: FitfitMood; at?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
      {/* 말풍선 + 오른쪽 아래 시각(카톡처럼 말풍선 바깥, 상담 답에만, 2026-10-31) */}
      {/* 줄 폭을 창 폭에 고정해야 말풍선 maxWidth(%)가 내용 폭이 아니라 창 폭 기준이 된다 */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, width: "100%" }}>
        <div style={{ position: "relative", maxWidth: "calc(100% - 64px)", padding: "10px 20px 10px 14px", boxSizing: "border-box", borderRadius: "16px 16px 16px 4px", background: "#F7FAFF", border: "1px solid #EDF2FC", fontSize: 14, lineHeight: 1.7, color: muted ? "#5E6D96" : "#0D1B4A" }}>
          {children}
          {mood && (
            <span style={{ position: "absolute", top: -14, right: -12, pointerEvents: "none" }}>
              <Fitfit mood={mood} size={30} />
            </span>
          )}
        </div>
        {at && <span style={{ flexShrink: 0, paddingBottom: 2, fontSize: 11, color: "#5E6D96", whiteSpace: "nowrap" }}>{clockText(at)}</span>}
      </div>
      {extra && <div style={{ width: "100%" }}>{extra}</div>}
    </div>
  );
}

const amountStyle: CSSProperties = { fontFamily: NUMF, fontVariantNumeric: "tabular-nums", fontWeight: 700 };

/** 큰 메뉴 아이콘(지갑 만들기 / 지갑 확인 / 자주 묻는 질문). 색은 글자색을 따른다 */
const MENU_ICON: Record<MenuId, ReactNode> = {
  make: (
    <>
      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h8" />
      <path d="M18 15v6" />
      <path d="M15 18h6" />
    </>
  ),
  check: (
    <>
      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
      <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
    </>
  ),
  faq: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6" />
      <path d="M12 17h.01" />
    </>
  ),
};

const MENU_BTN =
  "group flex aspect-square min-w-0 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-[#D3DDF2] bg-white p-2 text-center text-[14px] leading-tight font-bold text-[#0D1B4A] transition-colors hover:border-w-primary hover:bg-w-primary hover:text-white disabled:cursor-default disabled:opacity-50";

/** 첫 인사(와 '처음으로') 아래 큰 정사각형 버튼 3개 */
function MenuGrid({ onPick, disabled }: { onPick: (id: MenuId) => void; disabled: boolean }) {
  return (
    <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
      {MENUS.map((m) => (
        <button key={m.id} type="button" className={MENU_BTN} disabled={disabled} onClick={() => onPick(m.id)}>
          <span className="text-w-primary group-hover:text-white group-disabled:text-w-primary">
            <svg width={28} height={28} {...svg}>
              {MENU_ICON[m.id]}
            </svg>
          </span>
          {m.label}
        </button>
      ))}
    </div>
  );
}

/** 선택지: 살짝 둥근 네모, 흰 배경·검은 글씨·테두리, 가져다 대면 파란 배경·흰 글씨(2026-10-31) */
const CHOICE_BTN =
  "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#D3DDF2] bg-white px-3 py-[7px] text-left text-[13px] text-[#0D1B4A] transition-colors hover:border-w-primary hover:bg-w-primary hover:text-white disabled:cursor-default disabled:opacity-50";

/** 답 아래 질문형 선택지(세로로). '처음으로'는 같은 모양에 되돌아가기 화살표(↩)를 앞에 붙인다 */
function ChoiceList({ items, onChoose, busy }: { items: ChatChoice[]; onChoose: (c: ChatChoice) => void; busy: boolean }) {
  return (
    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
      {items.map((c) => (
        <button key={c.id} type="button" disabled={busy} onClick={() => onChoose(c)} className={CHOICE_BTN}>
          {c.id === "home" && (
            <svg width={15} height={15} {...svg}>
              <path d="M9 14 4 9l5-5" />
              <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
            </svg>
          )}
          {c.label}
        </button>
      ))}
    </div>
  );
}

function Block({ block, onAction, onChoose, onMenu, busy }: { block: ChatBlock; onAction: (a: ChatAction) => void; onChoose: (c: ChatChoice) => void; onMenu: (id: MenuId) => void; busy: boolean }) {
  if (block.kind === "menu") return <MenuGrid onPick={onMenu} disabled={busy} />;
  if (block.kind === "choices") return <ChoiceList items={block.items} onChoose={onChoose} busy={busy} />;
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
  // 화면을 옮기는 버튼(to, pin)은 ↗ 표시와 '누르면 ○○ 화면으로 이동해요' 안내를 붙여 대화 안에서 답하는 버튼과 구분한다(2026-11-01)
  const target = (a: ChatAction) => ("to" in a ? a.to : a.id === "pin" ? paths.start("new") : null);
  return (
    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
      {block.actions.map((a) =>
        target(a) ? (
          <div key={a.label} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
            <a
              href={`#${target(a)}`}
              onClick={(e) => {
                e.preventDefault();
                onAction(a);
              }}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 40, padding: "0 14px", boxSizing: "border-box", borderRadius: 20, border: a.primary ? "1px solid #2457F5" : "1px solid #D3DDF2", background: a.primary ? "#2457F5" : "#FFFFFF", fontSize: 13, fontWeight: 700, color: a.primary ? "#FFFFFF" : "#0D1B4A", textDecoration: "none" }}
            >
              {a.label}
              <svg width={14} height={14} {...svg}>
                <path d="M7 17 17 7" />
                <path d="M7 7h10v10" />
              </svg>
            </a>
            <span style={{ paddingLeft: 4, fontSize: 12, color: "#5E6D96" }}>누르면 &apos;{screenName(target(a)!)}&apos; 화면으로 이동해요</span>
          </div>
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
