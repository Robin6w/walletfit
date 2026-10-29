import type { RecommendResponse, EngineCard } from "@/domain/types/engine";
import type { AzuLlmMessage } from "@/features/chatbot/azuLlmClient";
import { catLabel } from "@/v1/catalog";
import { approxKor, korWon, num, won } from "@/v1/format";
import { benefitLine, capCaption, shortCard } from "@/v1/wallet/model";

/** 상담은 숫자를 새로 만들지 않고, 계산 엔진이 남긴 과정 기록(trace)과 카드사 원문만 근거로 씁니다. */

export interface ChatCtx {
  rec: RecommendResponse | null;
  spending: Record<string, number>;
  margin: number;
}

export type ChatBlock =
  | { kind: "benefits"; card: EngineCard }
  | { kind: "compare"; rows: [string, string, string][]; head: [string, string, string] }
  | { kind: "actions"; actions: { id: "noMargin" | "keep" | "result"; label: string; primary?: boolean }[] };

export interface ChatMsg {
  role: "user" | "model";
  text: string;
  blocks?: ChatBlock[];
  sources?: string[];
  followups?: string[];
}

const FOLLOWUPS = ["통신비는 왜 할인 카드에 안 걸었어요?", "실적이 모자라면 어떻게 돼요?", "새 카드까지 넣으면 얼마나 늘어요?"];

export function introMessage(ctx: ChatCtx): ChatMsg {
  if (!ctx.rec || ctx.rec.empty) {
    return {
      role: "model",
      text: "아직 계산한 추천 결과가 없어요. 지갑 만들기에서 카드와 지출을 넣으면, 그 결과와 카드별 계산 근거를 바탕으로 답할게요.",
      followups: ["카드 조합 추천은 어떻게 계산해요?"],
    };
  }
  const n = ctx.rec.result.cards.length;
  return {
    role: "model",
    text: `방금 계산한 ${n}장 조합과 카드별 계산 근거를 바탕으로 답할게요. 조건을 바꿔 보고 싶으면 다시 계산할 수 있게 버튼을 같이 드려요.`,
    followups: [`왜 ${shortCard(ctx.rec.result.cards[0].name)}가 들어갔어요?`, ...(ctx.rec.alt ? ["실적 여유를 없애면 더 받나요?"] : []), FOLLOWUPS[0]],
  };
}

/** 아주LLM에 보낼 메시지: 계산 기록을 그대로 넣고, 그 안의 숫자만 쓰게 한다 */
export function buildMessages(ctx: ChatCtx, history: ChatMsg[], question: string): AzuLlmMessage[] {
  const rec = ctx.rec;
  const lines: string[] = [];
  if (rec && !rec.empty) {
    const p = rec.result;
    lines.push(`[추천 조합] ${p.cards.map((c) => c.name).join(" + ")} · 월 혜택 ${won(p.total)} − 연회비 월 ${won(p.fee)} = 순혜택 ${won(p.net)} · 실적 여유 ${won(ctx.margin)}`);
    lines.push(`[지출] ${Object.entries(ctx.spending).map(([c, v]) => `${catLabel(c)} ${won(v)}`).join(", ")}`);
    lines.push(`[카드 수별 순혜택] ${rec.bar.map((b) => `${b.k}장 ${won(b.net)}`).join(", ")}`);
    if (rec.alt) lines.push(`[여유 없이 계산한 대안] ${rec.alt.names.join(" + ")} · 순혜택 ${won(rec.alt.net)}`);
    for (const c of p.cards) {
      lines.push(`\n[카드] ${c.name} (연회비 ${won(c.annualFee)}) · 이 카드로 결제: ${Object.entries(c.alloc).map(([k, v]) => `${catLabel(k)} ${won(v)}`).join(", ")}`);
      lines.push(`  실적: 결제 ${won(c.perf.qRaw)} → 실적 ${won(c.perf.q)} (기준 ${c.perf.threshold ? won(c.perf.threshold) : "없음"}${c.perf.excludesDiscounted ? ", 할인받은 결제는 실적 제외" : ""})`);
      if (c.options.length) lines.push(`  선택한 패키지: ${c.options.map((o) => o.label).join(", ")}`);
      for (const b of c.benefits.filter((x) => x.final > 0.5)) lines.push(`  - ${b.title}: ${benefitLine(b)} → ${won(b.final)} (${capCaption(b, c)})`);
      for (const s of c.shared.filter((x) => x.factor < 0.999)) lines.push(`  - 묶음 한도 ${s.label}: ${won(s.sum)} → ${won(s.cap)}`);
      if (c.flags.length) lines.push(`  가정: ${c.flags.map((f) => f.replace(/^[^:]+:\s*/, "")).slice(0, 4).join(" / ")}`);
      const q = c.benefits.find((x) => x.final > 0.5)?.quote;
      if (q) lines.push(`  원문: "${q.slice(0, 200)}"`);
    }
  }
  const system = [
    "너는 WalletFit 카드 상담이야. 해요체로 짧게 답해.",
    "숫자는 아래 [계산 기록]에 있는 값만 써. 새로 계산하거나 추정한 숫자를 만들지 마. 기록에 없으면 '계산 엔진으로 다시 계산해 볼게요'라고 안내해.",
    "근거를 말할 때는 카드 이름과 혜택 제목, 원문 문장을 그대로 인용해. 'AI가 분석' 같은 말, 개발 용어(MILP, trace)는 쓰지 마.",
    "'최대', '무조건' 같은 단정 대신 계산 조건(실적 여유 등)을 같이 말해.",
    "",
    "[계산 기록]",
    lines.join("\n") || "아직 계산 결과가 없음",
  ].join("\n");
  const msgs: AzuLlmMessage[] = [{ role: "system", content: system }];
  for (const m of history.slice(-6)) msgs.push({ role: m.role === "user" ? "user" : "assistant", content: m.text });
  msgs.push({ role: "user", content: question });
  return msgs;
}

/** 아주LLM을 못 쓸 때: 계산 기록으로 바로 답한다 */
export function answerLocal(ctx: ChatCtx, q: string): ChatMsg {
  const rec = ctx.rec;
  if (!rec || rec.empty) return introMessage(ctx);
  const p = rec.result;
  if (/여유|더 받|대안/.test(q) && rec.alt) {
    const alt = rec.alt;
    const diff = alt.net - p.net;
    return {
      role: "model",
      text:
        diff > 0
          ? `실적 여유를 두지 않으면 **${alt.names.map(shortCard).join(" + ")}**으로 월 ${approxKor(alt.net)}(${korWon(diff)} 더)을 받아요. 다만 실적이 기준에 딱 맞으면 한 달만 덜 써도 혜택이 끊겨서, 지금은 여유 ${korWon(ctx.margin)}을 두는 조합을 추천했어요.`
          : `실적 여유를 없애도 순혜택이 늘지 않아요. 지금 조합을 그대로 쓰는 게 나아요.`,
      blocks: [
        {
          kind: "compare",
          head: ["", `지금 · ${p.cards.map((c) => shortCard(c.name)).join(" + ")}`, `여유 없이 · ${alt.names.map(shortCard).join(" + ")}`],
          rows: [
            ["월 순혜택", approxKor(p.net), approxKor(alt.net)],
            ["실적 여유", korWon(ctx.margin), "없음"],
          ],
        },
        { kind: "actions", actions: [{ id: "noMargin", label: "여유 없이 다시 계산", primary: true }, { id: "keep", label: "지금 조합 유지" }] },
      ],
      sources: ["실적 여유별 계산"],
      followups: FOLLOWUPS.slice(1),
    };
  }
  const card = p.cards.find((c) => q.replace(/\s+/g, "").includes(shortCard(c.name).replace(/\s+/g, "").slice(0, 4)));
  if (card) {
    const share = p.total ? Math.round((card.total / p.total) * 100) : 0;
    const cats = Object.keys(card.alloc).filter((k) => card.benefits.some((b) => b.category === k && b.final > 0.5));
    return {
      role: "model",
      text: `**${card.name}**는 ${cats.map(catLabel).join("·") || "실적 채우기"}에서 원문에 적힌 한도까지 받아, 이 조합 혜택의 ${share}%인 **월 ${won(card.total)}**을 맡아요. 연회비 ${won(card.annualFee)}은 월 ${num(card.feeMonthly)}원꼴이에요.`,
      blocks: [{ kind: "benefits", card }],
      sources: [`계산 근거 · ${shortCard(card.name)}`, "카드사 원문 · 카드고릴라"],
      followups: FOLLOWUPS,
    };
  }
  if (/통신/.test(q)) {
    const m = p.cards.find((c) => (c.alloc.mobile ?? 0) > 0);
    return {
      role: "model",
      text: m
        ? `통신비는 **${m.name}**로 내도록 배정했어요. 통신비처럼 한 달에 한 번 내는 요금은 할인을 받으면 결제 전액이 실적에서 빠지는 카드가 있어서, 할인보다 실적을 채우는 쪽이 조합 전체로 더 나았어요.`
        : "이번 지출에는 통신비가 없어요.",
      sources: m ? [`계산 근거 · ${shortCard(m.name)}`] : [],
      followups: FOLLOWUPS.slice(1),
    };
  }
  if (/실적/.test(q)) {
    return {
      role: "model",
      text: p.cards
        .map((c) =>
          c.perf.threshold
            ? `${shortCard(c.name)}: 실적 ${korWon(c.perf.q)}, 기준 ${korWon(c.perf.threshold)} → ${c.perf.q >= c.perf.threshold ? `여유 ${korWon(c.perf.q - c.perf.threshold)}` : `${korWon(c.perf.threshold - c.perf.q)} 모자라요`}`
            : `${shortCard(c.name)}: 실적 조건 없음`,
        )
        .join("\n") + "\n실적이 모자라면 그 달에는 해당 구간 혜택을 못 받아요. 실적 여유를 늘리면 더 안전한 조합을 골라요.",
      actions: undefined,
      followups: FOLLOWUPS,
    } as ChatMsg;
  }
  return {
    role: "model",
    text: `지금 조합은 ${p.cards.map((c) => `${shortCard(c.name)}(월 ${won(c.total)})`).join(", ")}이고, 연회비를 빼면 월 ${approxKor(p.net)}이에요. 카드 이름을 넣어 물어보시면 그 카드의 계산 근거로 답할게요.`,
    followups: [`왜 ${shortCard(p.cards[0].name)}가 들어갔어요?`, ...FOLLOWUPS.slice(0, 2)],
  };
}
