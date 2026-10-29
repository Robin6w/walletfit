import type { BrandShare, EngineCard, EnginePack, RankRow, RecommendResponse } from "@/domain/types/engine";
import type { AzuLlmMessage } from "@/features/chatbot/azuLlmClient";
import { catLabel, catalogBySourceId } from "@/v1/catalog";
import { approxKor, korWon, num, won } from "@/v1/format";
import { paths, type Flow } from "@/v2/app/paths";
import { headVM, insightsVM, sumVM, type CardMeta, type CmpCardInput } from "@/v2/model/compareView";
import { nickOf, noMarginVM, perfVM, roleCard, shortOf, type CompareTileVM, type ViewCtx } from "@/v2/model/resultView";
import { catShort, countWord, josa, joinDot, korAmount } from "@/v2/model/text";

/**
 * 카드 상담(2026-10-29 v2). 상담은 숫자를 새로 만들지 않는다.
 *  - 답의 숫자·표·버튼은 모두 계산 엔진 결과(추천 결과, 저장한 지갑, 카드 비교 계산)에서 만든다(answerLocal)
 *  - 아주LLM이 연결되어 있으면 같은 근거를 넘겨 문장만 다듬게 하고, 표·버튼은 answerLocal 것을 그대로 붙인다
 *  - 정해진 유형에 맞지 않는 질문(free)은 아주LLM이 계산 기록·카드 혜택 표를 근거로 답한다. 키가 없으면 요약으로 답한다
 */

export type ChatBlock =
  | { kind: "benefits"; sid: number; name: string; rows: { label: string; sub: string; amount: string }[]; total: string }
  | { kind: "tiles"; tiles: { label: string; names: string; sids: number[]; highlight: boolean; rows: { k: string; v: string; warn?: boolean }[] }[] }
  | { kind: "cards"; items: { sid: number; name: string; value: string; note: string; strong?: boolean }[] }
  | { kind: "actions"; actions: ChatAction[] };

export type ChatAction = { label: string; primary?: boolean } & ({ to: string } | { id: "keep" } | { id: "pin"; sid: number });

export interface ChatMsg {
  role: "user" | "model";
  text: string;
  blocks?: ChatBlock[];
  /** 답을 쓰는 중 */
  pending?: boolean;
}

export type ChatPage = { kind: "compare"; ids: number[] } | { kind: "benefit"; cat: string } | { kind: "result" } | { kind: "wallet" } | { kind: "other" };

export interface ChatContext {
  /** 지갑 만들기에서 마지막으로 계산한 결과(없으면 저장한 지갑) */
  rec: RecommendResponse | null;
  pack: EnginePack | null;
  basis: "result" | "wallet" | null;
  flow: Flow | null;
  /** 계산한 때(ms) 또는 저장한 때 */
  at: number | null;
  spending: Record<string, number>;
  margin: number;
  brandShare: BrandShare;
  ownedIds: number[];
  page: ChatPage;
  /** 카드 비교·혜택별 추천 계산에 쓰는 지출(지출 입력 그대로) */
  pageSpending: Record<string, number>;
  pageBrandShare: BrandShare;
  cardMeta: Record<string, CardMeta>;
}

/** 엔진 호출(테스트에서는 fixture로 바꾼다) */
export type EngineCall = (fn: "rank" | "explain" | "recommend" | "alt", args: unknown) => Promise<{ ok: boolean; error?: string } & Record<string, unknown>>;

const sum = (r: Record<string, number>) => Object.values(r).reduce((s, v) => s + v, 0);
const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();

function dateText(ms: number | null): string {
  if (!ms) return "";
  const d = new Date(ms);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 `;
}

/** 위 띠: '상담 기준 · 10월 6일 추천 결과 · 카드 2장 · 월 지출 83만 5천원' */
export function contextLine(ctx: ChatContext): string {
  if (ctx.page.kind === "compare" && ctx.page.ids.length >= 2) {
    const names = ctx.page.ids.map((s) => nickOf({ sid: s, name: catalogBySourceId.get(s)?.name ?? String(s) }));
    const t = sum(ctx.pageSpending);
    return `카드 비교 · ${joinDot(names)}${t ? ` · 월 지출 ${korAmount(t)}원` : ""}`;
  }
  if (!ctx.pack) return "아직 계산한 추천 결과가 없어요";
  const what = ctx.basis === "wallet" ? "저장한 지갑" : "추천 결과";
  return `${dateText(ctx.at)}${what} · 카드 ${ctx.pack.cards.length}장 · 월 지출 ${korAmount(sum(ctx.spending))}원`;
}

export function introText(ctx: ChatContext): string {
  if (ctx.page.kind === "compare" && ctx.page.ids.length >= 2) return "비교함에 담은 카드를 내 지출로 계산한 결과와 카드사 원문을 바탕으로 답할게요. 화면을 보면서 궁금한 걸 물어보세요.";
  if (!ctx.pack) return "아직 계산한 추천 결과가 없어요. 지갑 만들기에서 카드와 지출을 넣으면, 그 결과와 카드별 계산 근거를 바탕으로 답할게요.";
  if (ctx.basis === "wallet") return "저장한 지갑과 카드별 계산 근거를 바탕으로 답할게요. 화면을 보면서 궁금한 걸 물어보세요.";
  return "방금 계산한 추천 결과와 카드별 계산 근거를 바탕으로 답할게요. 화면을 보면서 궁금한 걸 물어보세요.";
}

const BASE_SUGGEST = ["통신비는 왜 할인 카드에 안 걸었어요?", "실적이 모자라면 어떻게 돼요?", "새 카드까지 넣으면 얼마나 늘어요?"];

/** 입력칸 위 추천 질문 */
export function suggestions(ctx: ChatContext): string[] {
  if (ctx.page.kind === "compare" && ctx.page.ids.length >= 2) {
    const names = ctx.page.ids.map((s) => nickOf({ sid: s, name: catalogBySourceId.get(s)?.name ?? String(s) }));
    const list = names.length === 2 ? `${josa(names[0], "과/와")} ${names[1]}` : names.join(", ");
    return [`${list} 중 내 지출에는 어떤 카드가 더 나아?`, "실적이 모자라면 어떻게 돼요?", "새 카드까지 넣으면 얼마나 늘어요?"];
  }
  if (!ctx.pack) return ["카드 조합 추천은 어떻게 계산해요?", "실적 여유는 뭐예요?", "명세서로도 계산할 수 있어요?"];
  const out = [...BASE_SUGGEST];
  const top = ctx.pack.cards[0];
  if (top && !ctx.pack.cards.some((c) => (c.alloc.mobile ?? 0) > 0)) out[0] = `왜 ${shortOf(top)}${josa(shortOf(top), "이/가").slice(shortOf(top).length)} 들어갔어요?`;
  return out;
}

/* ---------------- 의도 나누기 ---------------- */

export type Intent = "compare" | "noMargin" | "card" | "mobile" | "perf" | "newCards" | "howto" | "summary" | "free";

/** 조합 전체를 묻는 질문(요약으로 답한다) */
const SUMMARY_RE = /요약|정리|조합|지갑|결과|합계|모두 합|총 |얼마나 받|얼마 받|어떤 카드(를|로) (써|쓰)/;

export function findCard(q: string, pack: EnginePack | null): EngineCard | null {
  if (!pack) return null;
  const nq = norm(q);
  for (const c of pack.cards) {
    const names = [catalogBySourceId.get(c.sid)?.name ?? c.name, shortOf(c), nickOf(c)].map(norm).filter((n) => n.length >= 2);
    if (names.some((n) => nq.includes(n))) return c;
  }
  return null;
}

export function classify(q: string, ctx: ChatContext): Intent {
  const compareReady = ctx.page.kind === "compare" && ctx.page.ids.length >= 2;
  if (compareReady && /비교|중.*(나아|좋|유리)|어떤 카드가|어느 카드/.test(q)) return "compare";
  if (/여유|대안|더 받는다|더 받아/.test(q)) return "noMargin";
  if (/통신/.test(q)) return "mobile";
  if (/실적/.test(q)) return "perf";
  if (/새 카드/.test(q)) return "newCards";
  if (findCard(q, ctx.pack)) return "card";
  if (/어떻게 계산|명세서|뭐예요|무엇/.test(q) && !ctx.pack) return "howto";
  if (compareReady) return "compare";
  if (!ctx.pack || SUMMARY_RE.test(q)) return "summary";
  return "free";
}

/* ---------------- 답 만들기(계산 결과로) ---------------- */

function viewCtx(ctx: ChatContext): ViewCtx {
  return { spending: ctx.spending, brandShare: ctx.brandShare, margin: ctx.margin, ownedIds: ctx.ownedIds, source: "manual" };
}

function benefitsBlock(card: EngineCard, ctx: ChatContext): ChatBlock {
  const vm = roleCard(card, viewCtx(ctx), 5);
  return {
    kind: "benefits",
    sid: card.sid,
    name: catalogBySourceId.get(card.sid)?.name ?? card.name,
    rows: vm.rows.map((r) => ({ label: r.label, sub: r.sub, amount: r.amountText })),
    total: `월 ${won(card.total)}`,
  };
}

function cardsBlock(pack: EnginePack): ChatBlock {
  return {
    kind: "cards",
    items: pack.cards.map((c) => {
      const cats = Object.entries(c.alloc)
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([k]) => catShort(k));
      return { sid: c.sid, name: catalogBySourceId.get(c.sid)?.name ?? c.name, value: `월 ${won(c.total)}`, note: cats.length ? `${joinDot(cats.slice(0, 3))} 결제` : "실적 채우기" };
    }),
  };
}

function tilesOf(base: CompareTileVM, pick: CompareTileVM): ChatBlock {
  const rows = (t: CompareTileVM) => t.rows.map(([k, v]) => ({ k, v, warn: k === "가장 작은 실적 여유" && /^(0원|[1-4]천원|[1-9]백원)/.test(v) }));
  return {
    kind: "tiles",
    tiles: [
      { label: "지금", names: base.names, sids: base.sids, highlight: true, rows: rows(base) },
      { label: "여유 없이", names: pick.names, sids: pick.sids, highlight: false, rows: rows(pick) },
    ],
  };
}

function shareWord(part: number, total: number): string {
  if (total <= 0) return "";
  const r = part / total;
  if (r > 0.5) return "이 조합 혜택의 절반이 넘는 ";
  if (r > 0.45) return "이 조합 혜택의 절반쯤인 ";
  return `이 조합 혜택의 ${Math.round(r * 100)}%인 `;
}

async function answerCompare(ctx: ChatContext, call: EngineCall): Promise<ChatMsg> {
  const ids = ctx.page.kind === "compare" ? ctx.page.ids : [];
  const total = sum(ctx.pageSpending);
  if (!total) {
    return { role: "model", text: "지출을 넣으면 비교함의 카드를 내 지출로 계산해서 비교해 드릴게요.", blocks: [{ kind: "actions", actions: [{ label: "지출 입력하기", to: paths.make("own", "spend"), primary: true }] }] };
  }
  const res = (await call("rank", { ids, spending: ctx.pageSpending, brandShare: ctx.pageBrandShare, detail: true })) as { ok: boolean; error?: string; rows?: RankRow[] };
  if (!res.ok || !res.rows) return { role: "model", text: `계산하지 못했어요${res.error ? ` · ${res.error}` : ""}. 카드 비교 화면에서 다시 열어 주세요.` };
  const inputs: CmpCardInput[] = ids.map((sid) => ({ sid, entry: catalogBySourceId.get(sid), view: res.rows!.find((r) => r.sid === sid)?.view ?? null, meta: ctx.cardMeta[String(sid)] }));
  const sums = sumVM(inputs);
  const heads = inputs.map((x) => headVM(x, { spending: ctx.pageSpending, brandShare: ctx.pageBrandShare, ownedIds: ctx.ownedIds, wallet: null, today: new Date() }));
  const sorted = [...sums].sort((a, b) => b.total - a.total);
  const top = sorted[0];
  const nickBy = (sid: number) => heads.find((h) => h.sid === sid)?.nick ?? String(sid);
  const lines: string[] = [];
  if (sorted.length >= 2 && top.total - sorted[1].total >= 1) {
    const head = `한 장으로 지출 전부(월 ${korAmount(total)}원)를 결제하면 **${nickBy(top.sid)}**${josa(nickBy(top.sid), "이/가").slice(nickBy(top.sid).length)} 월 ${won(top.total)}으로 가장 많이 받아요.`;
    const second = sorted[1];
    const rest =
      sorted.length === 2
        ? `${josa(nickBy(second.sid), "은/는")} 월 ${won(second.total)}이라 차이는 월 ${won(top.total - second.total)}이에요.`
        : `${sorted.slice(1).map((s) => `${nickBy(s.sid)} 월 ${won(s.total)}`).join(", ")} 순이에요.`;
    lines.push(`${head} ${rest}`);
  } else {
    lines.push(`한 장으로 지출 전부(월 ${korAmount(total)}원)를 결제하면 ${countWord(sorted.length)} 카드가 받는 금액이 같아요(월 ${won(top?.total ?? 0)}).`);
  }
  for (const ins of insightsVM(inputs, null).filter((x) => x.id !== "diff").slice(0, 2)) lines.push(`${ins.title}. ${ins.text}`);
  const notOwned = inputs.find((x) => !ctx.ownedIds.includes(x.sid));
  const actions: ChatAction[] = notOwned
    ? [{ label: `${nickBy(notOwned.sid)}까지 넣어서 지갑 다시 짜기`, id: "pin", sid: notOwned.sid, primary: true }, { label: "카드 비교 보기", to: paths.compare(ids) }]
    : [{ label: "카드 비교 보기", to: paths.compare(ids) }];
  return {
    role: "model",
    text: lines.join("\n"),
    blocks: [
      { kind: "cards", items: sums.map((s) => ({ sid: s.sid, name: s.name, value: `월 ${won(s.total)}`, note: s.feeLine.lead.includes("연회비가 없어서") ? "연회비 없음" : `연회비 빼면 ${s.feeLine.value}`, strong: s.winner })) },
      { kind: "actions", actions },
    ],
  };
}

async function answerNoMargin(ctx: ChatContext, call: EngineCall): Promise<ChatMsg> {
  const pack = ctx.pack!;
  const rec = ctx.rec;
  // 이미 여유 없이 계산한 결과면 기본 추천(여유 2만원)과, 아니면 여유 없이 계산한 조합과 비교한다
  if (ctx.margin === 0) {
    const ids = ctx.ownedIds.length ? ctx.ownedIds : pack.sids;
    const base = (await call("recommend", { ids, spending: ctx.spending, margin: 20000, mode: "maxBenefit", maxCards: 5, brandShare: ctx.brandShare, withAlt: false })) as unknown as RecommendResponse;
    if (!base.ok || !base.result?.cards?.length) return { role: "model", text: "기본 추천을 다시 계산하지 못했어요. 결과 화면에서 '여유 두고 계산하기'를 눌러 비교해 보세요." };
    const vm = noMarginVM(base.result, pack, 20000);
    return {
      role: "model",
      text: `${vm.title.replace(/요$/, "요.")} ${vm.lines.join(" ")}`,
      blocks: [tilesOf({ ...vm.base, label: "기본 추천" }, vm.pick), { kind: "actions", actions: [{ label: "여유 두고 계산하기", to: paths.make("own", "result"), primary: true }] }],
    };
  }
  // 결과 화면은 대안 조합을 미리 계산하지 않는다(2026-10-29). 없으면 여기서 계산한다
  let alt = rec?.alt ?? null;
  if (!alt && rec && rec.margin > 0 && rec.pool?.length) {
    const res = (await call("alt", { ids: rec.pool, k: rec.k, spending: ctx.spending, brandShare: ctx.brandShare })) as unknown as { ok: boolean; alt?: RecommendResponse["alt"] };
    alt = res.ok ? (res.alt ?? null) : null;
  }
  if (!alt || alt.net < pack.net + 100) {
    return { role: "model", text: `실적 여유를 없애도 순혜택이 거의 늘지 않아요. 지금 조합(월 ${approxKor(pack.net)})을 그대로 쓰는 게 나아요.`, blocks: [{ kind: "actions", actions: [{ id: "keep", label: "지금 조합 유지", primary: true }] }] };
  }
  const ex = (await call("explain", { ids: alt.sids, spending: ctx.spending, margin: 0, brandShare: ctx.brandShare })) as { ok: boolean; result?: EnginePack };
  const altPack = ex.ok && ex.result ? ex.result : null;
  const diff = alt.net - pack.net;
  const names = alt.names.map((n) => nickOf({ sid: 0, name: n })).join(" + ");
  let text = `실적 여유를 두지 않으면 **${names}**${josa(names, "이/가").slice(names.length)} 월 ${approxKor(alt.net)}으로 ${korWon(diff)} 더 받아요.`;
  if (altPack) {
    const vm = noMarginVM(pack, altPack, ctx.margin);
    text += ` 다만 ${vm.lines.join(" ")}`;
    return {
      role: "model",
      text,
      blocks: [tilesOf(vm.base, vm.pick), { kind: "actions", actions: [{ label: "여유 없이 다시 계산", to: paths.make(ctx.flow ?? "own", "result", { margin: 0 }) }, { id: "keep", label: "지금 조합 유지" }] }],
    };
  }
  return { role: "model", text, blocks: [{ kind: "actions", actions: [{ label: "여유 없이 다시 계산", to: paths.make(ctx.flow ?? "own", "result", { margin: 0 }) }, { id: "keep", label: "지금 조합 유지" }] }] };
}

function answerCard(card: EngineCard, ctx: ChatContext): ChatMsg {
  const pack = ctx.pack!;
  const got = card.benefits.filter((b) => b.final >= 1);
  const cats = Array.from(new Set(got.map((b) => (b.category ? catShort(b.category) : "모든 가맹점"))));
  const allCapped = got.length > 0 && got.every((b) => b.caps.some((c) => c.hit));
  const name = catalogBySourceId.get(card.sid)?.name ?? card.name;
  if (!got.length) {
    const pay = Object.entries(card.alloc).filter(([, v]) => v > 0).map(([k, v]) => `${catShort(k)} ${korWon(v)}`);
    return {
      role: "model",
      text: `**${name}**${josa(name, "은/는").slice(name.length)} 이 조합에서 할인보다 실적을 채우는 데 쓰여요.${pay.length ? ` ${joinDot(pay)}을 이 카드로 내서 실적 ${korWon(card.perf.q)}을 채워요.` : ""}`,
      blocks: [benefitsBlock(card, ctx)],
    };
  }
  const text = `**${name}**${josa(name, "은/는").slice(name.length)} ${joinDot(cats)}에서 ${allCapped ? "원문에 적힌 한도까지 받아" : "받아"}, ${shareWord(card.total, pack.total)}**월 ${won(card.total)}**을 맡아요. 연회비 ${won(card.annualFee)}은 월 ${num(card.feeMonthly)}원꼴이에요.`;
  return { role: "model", text, blocks: [benefitsBlock(card, ctx)] };
}

function answerMobile(ctx: ChatContext): ChatMsg {
  const pack = ctx.pack!;
  const m = pack.cards.find((c) => (c.alloc.mobile ?? 0) > 0);
  if (!m) return { role: "model", text: "이번 지출에는 통신비가 없어요. 지출 입력에 통신비를 넣으면 다시 계산해요." };
  const got = m.benefits.filter((b) => b.category === "mobile" && b.final >= 1).reduce((s, b) => s + b.final, 0);
  const nick = nickOf(m);
  if (got >= 1) return { role: "model", text: `통신비 ${korWon(m.alloc.mobile)}은 **${nick}**로 내서 월 ${won(got)} 할인받아요.`, blocks: [benefitsBlock(m, ctx)] };
  const pv = perfVM(pack);
  const line = pv.lines.find((l) => l.includes("할인받은 결제는 실적에서 빠져요")) ?? "";
  return {
    role: "model",
    text: `통신비 ${korWon(m.alloc.mobile)}은 **${nick}**로 내도록 배정했어요. ${line || "통신비처럼 매달 나가는 큰 결제는 할인보다 실적을 채우는 쪽이 조합 전체로 더 나았어요."}`.trim(),
    blocks: [benefitsBlock(m, ctx)],
  };
}

function answerPerf(ctx: ChatContext): ChatMsg {
  const pv = perfVM(ctx.pack!);
  return {
    role: "model",
    text: `${pv.summary}. ${pv.lines.join(" ")}\n실적이 모자라면 그 달에는 해당 구간 혜택을 못 받아요. 실적 여유를 늘리면 더 안전한 조합을 골라요.`,
  };
}

function answerNewCards(ctx: ChatContext): ChatMsg {
  if (ctx.flow === "new" && ctx.pack) {
    return { role: "model", text: `지금 보고 있는 결과가 새 카드까지 넣어서 계산한 조합이에요. 연회비를 빼면 월 ${approxKor(ctx.pack.net)}이에요.`, blocks: [cardsBlock(ctx.pack)] };
  }
  return {
    role: "model",
    text: "새 카드까지 넣으면 발급 가능한 카드 중에서 지금 가진 카드와 함께 쓰기 좋은 카드를 골라 다시 계산해요. 카드 종류(신용·체크)를 고르면 바로 계산할게요.",
    blocks: [{ kind: "actions", actions: [{ label: "새 카드까지 넣어서 계산", to: paths.start("new"), primary: true }] }],
  };
}

function answerSummary(ctx: ChatContext): ChatMsg {
  const pack = ctx.pack!;
  const what = ctx.basis === "wallet" ? "저장한 지갑" : "지금 조합";
  const parts = pack.cards.map((c) => `${shortOf(c)}(월 ${won(c.total)})`).join(", ");
  return {
    role: "model",
    text: `${what}은 ${parts}이고, 연회비를 빼면 월 ${approxKor(pack.net)}이에요. 카드 이름을 넣어 물어보시면 그 카드의 계산 근거로 답할게요.`,
    blocks: [cardsBlock(pack)],
  };
}

function answerNoResult(): ChatMsg {
  return {
    role: "model",
    text: "카드 조합 추천은 가진 카드(또는 새 카드 후보)와 지출을 넣으면, 카드사 원문 혜택 표로 카드마다 받는 금액을 계산하고 지출을 나눠 맡겨서 연회비를 뺀 금액이 가장 큰 조합을 골라요. 실적 여유는 지출이 조금 줄어도 다음 달 혜택이 이어지게 실적 기준보다 더 쓰도록 맞추는 값이에요. 카드 명세서(PDF·CSV)로도 지출을 넣을 수 있어요.",
    blocks: [{ kind: "actions", actions: [{ label: "지갑 만들기", to: paths.start("own"), primary: true }] }],
  };
}

export async function answerLocal(q: string, ctx: ChatContext, call: EngineCall): Promise<ChatMsg> {
  const intent = classify(q, ctx);
  if (intent === "compare") return answerCompare(ctx, call);
  if (!ctx.pack) return answerNoResult();
  switch (intent) {
    case "noMargin":
      return answerNoMargin(ctx, call);
    case "mobile":
      return answerMobile(ctx);
    case "perf":
      return answerPerf(ctx);
    case "newCards":
      return answerNewCards(ctx);
    case "card":
      return answerCard(findCard(q, ctx.pack)!, ctx);
    case "free": {
      // 아주LLM이 없을 때: 맞는 계산 기록을 못 찾았다고 먼저 말하고 요약으로 답한다
      const s = answerSummary(ctx);
      return { ...s, text: `이 질문에 딱 맞는 계산 기록을 찾지 못해서 지금 조합 요약으로 답할게요. ${s.text}` };
    }
    default:
      return answerSummary(ctx);
  }
}

/* ---------------- 아주LLM에 넘길 근거 ---------------- */

export function recordLines(ctx: ChatContext): string[] {
  const lines: string[] = [];
  const p = ctx.pack;
  if (p) {
    lines.push(`[${ctx.basis === "wallet" ? "저장한 지갑" : "추천 조합"}] ${p.cards.map((c) => c.name).join(" + ")} · 월 혜택 ${won(p.total)} − 연회비 월 ${won(p.fee)} = 순혜택 ${won(p.net)} · 실적 여유 ${won(ctx.margin)}`);
    lines.push(`[지출] ${Object.entries(ctx.spending).map(([c, v]) => `${catLabel(c)} ${won(v)}`).join(", ")}`);
    if (ctx.rec?.bar?.length) lines.push(`[카드 수별 순혜택] ${ctx.rec.bar.map((b) => `${b.k}장 ${won(b.net)}`).join(", ")}`);
    if (ctx.rec?.alt) lines.push(`[여유 없이 계산한 대안] ${ctx.rec.alt.names.join(" + ")} · 순혜택 ${won(ctx.rec.alt.net)}`);
    for (const c of p.cards) {
      lines.push(`[카드] ${c.name} (연회비 ${won(c.annualFee)}) · 이 카드로 결제: ${Object.entries(c.alloc).map(([k, v]) => `${catLabel(k)} ${won(v)}`).join(", ")}`);
      lines.push(`  실적: 결제 ${won(c.perf.qRaw)} → 실적 ${won(c.perf.q)} (기준 ${c.perf.threshold ? won(c.perf.threshold) : "없음"}${c.perf.excludesDiscounted ? ", 할인받은 결제는 실적 제외" : ""})`);
      if (c.options.length) lines.push(`  선택한 패키지: ${c.options.map((o) => o.label).join(", ")}`);
      for (const b of c.benefits.filter((x) => x.final > 0.5)) lines.push(`  - ${b.title} → ${won(b.final)}${b.caps.some((k) => k.hit) ? " (월 한도까지)" : ""}`);
      for (const s of c.shared.filter((x) => x.factor < 0.999)) lines.push(`  - 묶음 한도 ${s.label}: ${won(s.sum)} → ${won(s.cap)}`);
      // 이번 지출로 받지 못한 혜택도 넘긴다(자유 질문: '영화 할인도 돼요?' 등)
      const idle = c.benefits.filter((x) => x.final <= 0.5).slice(0, 12);
      if (idle.length) lines.push(`  이번 지출로 받지 못한 혜택: ${idle.map((b) => `${b.title}${b.category ? `(${catLabel(b.category)})` : ""}${b.skip ? ` - ${b.skip}` : ""}`).join("; ")}`);
      // 가정 앞의 내부 혜택 ID('sbux50: ')는 떼고 넘긴다
      if (c.flags.length) lines.push(`  계산 가정: ${c.flags.slice(0, 5).map((f) => f.replace(/^[A-Za-z0-9_]+:\s*/, "")).join("; ")}`);
      if (c.status === "auto") lines.push("  주의: 카드고릴라 혜택 요약을 해석한 카드(원문 대조 전). 실적 조건·통합 한도가 빠져 실제보다 크게 나올 수 있음");
      const q = c.benefits.find((x) => x.final > 0.5)?.quote;
      if (q) lines.push(`  원문: "${q.slice(0, 160)}"`);
    }
  }
  return lines;
}

/** 정해진 유형에 맞지 않는 질문: 계산 기록과 카드 혜택 표를 근거로 아주LLM이 직접 답한다 */
function freeSystem(ctx: ChatContext): string {
  return [
    "너는 WalletFit 카드 상담이야. 해요체로 짧게(3~6문장) 답해.",
    "사용자 질문에 아래 [계산 기록]을 근거로 답해. 카드별 혜택·받지 못한 혜택·계산 가정·실적이 모두 들어 있어.",
    "숫자는 [계산 기록]에 있는 값만 써. 새로 계산하거나 추정한 숫자, 기록에 없는 카드 조건(연회비 면제, 이벤트, 발급 조건 등)은 만들지 마. 기록에 없으면 '계산 기록에는 없어요'라고 말하고 카드사 약관에서 확인하라고 안내하거나, 화면에서 할 수 있는 일(조건 바꾸기, 지출 다시 입력, 카드 비교)을 알려 줘.",
    "전월실적·실적 여유·연회비 같은 낱말 뜻은 일반 설명을 해도 돼. 카드와 관계없는 질문이면 카드 상담만 할 수 있다고 짧게 말해.",
    "'AI가 분석' 같은 말, 개발 용어(MILP, trace, JSON)는 쓰지 마. 굵게는 **카드 이름**에만 써.",
    "",
    "[계산 기록]",
    recordLines(ctx).join("\n") || "아직 계산 결과가 없음",
  ].join("\n");
}

export function buildMessages(ctx: ChatContext, history: ChatMsg[], question: string, local: ChatMsg, intent: Intent = classify(question, ctx)): AzuLlmMessage[] {
  if (intent === "free") {
    const msgs: AzuLlmMessage[] = [{ role: "system", content: freeSystem(ctx) }];
    for (const m of history.filter((x) => !x.pending && x.text).slice(-6)) msgs.push({ role: m.role === "user" ? "user" : "assistant", content: m.text });
    msgs.push({ role: "user", content: question });
    return msgs;
  }
  const system = [
    "너는 WalletFit 카드 상담이야. 해요체로 짧게(3~5문장) 답해.",
    "숫자는 아래 [계산 기록]과 [계산 엔진 답]에 있는 값만 써. 새로 계산하거나 추정한 숫자를 만들지 마. 기록에 없으면 '계산 엔진으로 다시 계산해 볼게요'라고 안내해.",
    "근거를 말할 때는 카드 이름과 혜택 제목을 그대로 써. 'AI가 분석' 같은 말, 개발 용어(MILP, trace, JSON)는 쓰지 마. 굵게는 **카드 이름**에만 써.",
    "'최대', '무조건' 같은 단정 대신 계산 조건(실적 여유 등)을 같이 말해. 표와 버튼은 화면이 따로 붙이니 표를 글로 다시 쓰지 마.",
    "",
    "[계산 기록]",
    recordLines(ctx).join("\n") || "아직 계산 결과가 없음",
    "",
    "[계산 엔진 답] 이 내용을 바탕으로 질문에 맞게 다듬어 답해.",
    local.text,
  ].join("\n");
  const msgs: AzuLlmMessage[] = [{ role: "system", content: system }];
  for (const m of history.filter((x) => !x.pending && x.text).slice(-6)) msgs.push({ role: m.role === "user" ? "user" : "assistant", content: m.text });
  msgs.push({ role: "user", content: question });
  return msgs;
}
