import type { BrandShare, EngineCard, EnginePack, RankRow, RecommendResponse, Tickets } from "@/domain/types/engine";
import type { AzuLlmMessage } from "@/features/chatbot/azuLlmClient";
import type { CatalogListing } from "@/domain/types/catalog";
import { CATEGORY_LABEL, catLabel, catalogBySourceId, catalogCards, isDiscontinued } from "@/v1/catalog";
import { approxKor, korWon, num, won } from "@/v1/format";
import { paths, type Flow } from "@/v2/app/paths";
import { headVM, insightsVM, sumVM, type CardMeta, type CmpCardInput } from "@/v2/model/compareView";
import { monotoneBar } from "@/v2/model/guards";
import { nickOf, noMarginVM, perfVM, roleCard, shortOf, type CompareTileVM, type ViewCtx } from "@/v2/model/resultView";
import { catShort, countWord, josa, joinDot, korAmount } from "@/v2/model/text";
import {
  AI_TEXT_FIXES,
  ASK_ABOUT_CARD,
  ASK_BEST_CARD,
  ASK_CATEGORY,
  ASK_COMPARE,
  ASK_FEE,
  ASK_GUIDE,
  ASK_ISSUER,
  ASK_STATUS,
  ASK_TOTAL_FEE,
  ASK_YEARLY,
  CARD_USE_WORDS,
  CATEGORY_WORDS,
  COMPARE_ELSEWHERE,
  CRISIS,
  CRISIS_DEBT,
  CRISIS_DEBT_REPLY,
  CRISIS_REPLY,
  EMAIL,
  EMOJI_ONLY,
  FIXED,
  FOLLOW_UP,
  GUARD,
  LIMITS,
  LINK,
  MEANINGFUL,
  MENU_KEYWORDS,
  NEW_CARD_CONTEXT,
  NEW_CARD_REQUEST,
  NEW_CARD_REQUEST_EXCEPT,
  OFTEN_GO,
  OFTEN_GO_REPLY,
  PRIVATE_INFO,
  intentSystem,
  QUICK_TALK,
  SAFETY,
  TOPIC_REPLIES,
  UNCLEAR_STEPS,
  type FixedReply,
  type GoTarget,
} from "@/v2/chat/chatRules";
import { INTENT_BY_ID, INTENTS, type EngineFn } from "@/v2/chat/intents";

/**
 * 카드 상담(2026-10-29 v2). 상담은 숫자를 새로 만들지 않는다.
 *  - 답의 숫자·표·버튼은 모두 계산 엔진 결과(추천 결과, 저장한 지갑, 카드 비교 계산)에서 만든다(answerLocal)
 *  - 직접 입력(2026-10-31, answerTyped): 메뉴 질문과 같은 뜻이면 버튼과 똑같은 답. 아주LLM은 분류(MENU/CARD/TALK/OUT)와
 *    메뉴에 없는 카드 질문(3문장 이하)·인사 받기·거절(한 문장)에만 쓴다. 엔진 답을 아주LLM이 다시 쓰지 않는다. 규칙은 chatRules.ts
 *  - 선택지(2026-10-31): 첫 인사 아래 큰 메뉴 3개 → 질문형 선택지 → 답(answerChoice). 누른 선택지는 아주LLM을 거치지 않고
 *    계산 결과로 바로 답한다(빠르고 숫자가 항상 같음). 모든 답 끝에 이어질 선택지 1~3개와 '처음으로'를 붙인다
 */

export type ChatBlock =
  | { kind: "benefits"; sid: number; name: string; rows: { label: string; sub: string; amount: string }[]; total: string }
  | { kind: "tiles"; tiles: { label: string; names: string; sids: number[]; highlight: boolean; rows: { k: string; v: string; warn?: boolean }[] }[] }
  | { kind: "cards"; items: { sid: number; name: string; value: string; note: string; strong?: boolean }[] }
  | { kind: "actions"; actions: ChatAction[] }
  /** 큰 메뉴 버튼 3개(지갑 만들기 / 지갑 확인 / 자주 묻는 질문) */
  | { kind: "menu" }
  /** 질문형 선택지. 누르면 그 문장이 내 말풍선으로 들어가고 answerChoice(id)로 답한다 */
  | { kind: "choices"; items: ChatChoice[] };

export interface ChatChoice {
  id: string;
  label: string;
}

export type ChatAction = { label: string; primary?: boolean } & ({ to: string } | { id: "keep" } | { id: "pin"; sid: number });

/** 상담 답의 캐릭터(핏핏) 표정. 없으면 기쁨(답을 찾음). hello: 기본 표정(처음으로 뒤 '다른 것도 도와드릴까요?') */
export type ChatMood = "happy" | "sorry" | "hello";

export interface ChatMsg {
  role: "user" | "model";
  text: string;
  blocks?: ChatBlock[];
  /** 답을 쓰는 중 */
  pending?: boolean;
  /** sorry: 답을 못 했을 때(지갑 없음, 계산 실패, 맞는 계산 기록 없음, 아주LLM 실패) */
  mood?: ChatMood;
  /** 말풍선이 완성된 시각(ms). 화면에는 상담 답에만 '오후 8:31'처럼 보인다. 아주LLM에는 넘기지 않는다 */
  at?: number;
}

/** 이동 버튼이 데려가는 화면 이름(버튼 아래 안내·이동 애니메이션 문구에 쓴다, 2026-11-01) */
export function screenName(to: string): string {
  const [, a = "", , c = ""] = to.split("?")[0].split("/");
  if (a === "make") {
    const steps: Record<string, string> = { cards: "카드 선택", type: "카드 종류 선택", spend: "지출 입력", brands: "자주 가는 곳", statement: "명세서로 지출 채우기", result: "추천 결과" };
    return steps[c] ?? "지갑 만들기";
  }
  const pages: Record<string, string> = { "": "홈", wallet: "내 지갑", cards: "전체 카드", benefit: "혜택별 추천", compare: "카드 비교", guide: "이용 가이드" };
  return pages[a] ?? "다음";
}

/** 말풍선 옆 시각: '오후 8:31'. Intl 한국어 자료가 없는 환경(CI)에서도 같게 나오도록 직접 만든다 */
export function clockText(at: number): string {
  const d = new Date(at);
  const h = d.getHours();
  return `${h < 12 ? "오전" : "오후"} ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * 선택지를 누른 뒤 일부러 기다리는 시간(ms, 2026-10-31). 바로 뜨면 대화하는 느낌이 없어서
 * '입력 중' 점을 잠깐 보여 준다: 처음으로 0.5초, 큰 메뉴 0.6초, 질문 1.1초
 */
export function choiceDelay(id: string): number {
  if (id === "home") return 500;
  if (id.startsWith("menu:")) return 600;
  return 1100;
}

/**
 * 직접 입력한 질문의 최소 대기 시간(ms, 2026-10-31). 질문 내용이나 모델 속도와 관계없이 이만큼은 '입력 중' 점을 보여 준다.
 * 답이 더 오래 걸리면 그 시간을 따른다. 2초가 지난 뒤에는 아주LLM 글이 흘러나오는 대로 보여 준다
 */
export const TYPED_MIN_DELAY = 2000;

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
  /** 명세서로 계산한 결과면 그 결제 금액(엔진 건당 조건 계산용) */
  tickets?: Tickets;
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
/** 결과·지갑과 같은 숫자가 나오게 명세서 결제 금액도 넘긴다 */
const ticketArg = (ctx: ChatContext) => (ctx.tickets ? { tickets: ctx.tickets } : {});
const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();

/** 위 띠의 한 칸: pre는 보통 글자, value만 진하게(예: '카드 ' + '2장') */
export interface ContextItem {
  pre: string;
  value: string;
}

/**
 * 위 띠: '최근에 저장된 정보: 카드 2장 / 월 지출 83만 5천원'(2026-10-31, 날짜·결과 종류는 빼고 짧게, 칸은 ' / '로 나눔).
 * ctx가 지갑·계산 결과에서 바로 만들어지므로 지갑을 다시 짜면 같이 바뀐다
 */
export function contextLine(ctx: ChatContext): { label: string; items: ContextItem[] } {
  if (ctx.page.kind === "compare" && ctx.page.ids.length >= 2) {
    const names = ctx.page.ids.map((s) => nickOf({ sid: s, name: catalogBySourceId.get(s)?.name ?? String(s) }));
    const t = sum(ctx.pageSpending);
    return { label: "카드 비교", items: [{ pre: "", value: names.join(", ") }, ...(t ? [{ pre: "월 지출 ", value: `${korAmount(t)}원` }] : [])] };
  }
  if (!ctx.pack) return { label: "최근에 저장된 정보", items: [{ pre: "아직 없어요", value: "" }] };
  return {
    label: "최근에 저장된 정보",
    items: [
      { pre: "카드 ", value: `${ctx.pack.cards.length}장` },
      { pre: "월 지출 ", value: `${korAmount(sum(ctx.spending))}원` },
    ],
  };
}

/** 첫 인사는 짧게 한 줄, 캐릭터 이름을 드러낸다(2026-10-31). 무엇을 근거로 답하는지는 위 띠가 보여 주고, 아래에 큰 메뉴 3개가 붙는다 */
export function introText(): string {
  return "안녕하세요, 핏핏이에요! 무엇을 도와드릴까요?";
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

/** 카드마다 월 혜택과 결제할 업종. maxCats: 업종을 몇 개까지 적을지(결제 가이드는 전부) */
function cardsBlock(pack: EnginePack, maxCats = 3): ChatBlock {
  return {
    kind: "cards",
    items: pack.cards.map((c) => {
      const cats = Object.entries(c.alloc)
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([k]) => catShort(k));
      return { sid: c.sid, name: catalogBySourceId.get(c.sid)?.name ?? c.name, value: `월 ${won(c.total)}`, note: cats.length ? `${joinDot(cats.slice(0, maxCats))} 결제` : "실적 채우기" };
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
  // 카드 1장 조합에서 '절반이 넘는'이라고 했음(실제 시험 2026-11-02)
  if (r >= 0.999) return "이 조합 혜택 전부인 ";
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
  if (!res.ok || !res.rows) return { role: "model", text: `계산하지 못했어요${res.error ? ` · ${res.error}` : ""}. 카드 비교 화면에서 다시 열어 주세요.`, mood: "sorry" };
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
    const base = (await call("recommend", { ids, spending: ctx.spending, margin: 20000, mode: "maxBenefit", maxCards: 3, brandShare: ctx.brandShare, ...ticketArg(ctx), withAlt: false })) as unknown as RecommendResponse;
    if (!base.ok || !base.result?.cards?.length) return { role: "model", text: "기본 추천을 다시 계산하지 못했어요. 결과 화면에서 '여유 두고 계산하기'를 눌러 비교해 보세요.", mood: "sorry" };
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
    const res = (await call("alt", { ids: rec.pool, k: rec.k, spending: ctx.spending, brandShare: ctx.brandShare, ...ticketArg(ctx) })) as unknown as { ok: boolean; alt?: RecommendResponse["alt"] };
    alt = res.ok ? (res.alt ?? null) : null;
  }
  if (!alt || alt.net < pack.net + 100) {
    return { role: "model", text: `실적 여유를 없애도 순혜택이 거의 늘지 않아요. 지금 조합(월 ${approxKor(pack.net)})을 그대로 쓰는 게 나아요.`, blocks: [{ kind: "actions", actions: [{ id: "keep", label: "지금 조합 유지", primary: true }] }] };
  }
  const ex = (await call("explain", { ids: alt.sids, spending: ctx.spending, margin: 0, brandShare: ctx.brandShare, ...ticketArg(ctx) })) as { ok: boolean; result?: EnginePack };
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
  const text = `**${name}**${josa(name, "은/는").slice(name.length)} ${joinDot(cats)}에서 ${allCapped ? "원문에 적힌 한도까지 받아" : "받아"}, ${shareWord(card.total, pack.total)}**월 ${won(card.total)}**을 맡아요. ${card.annualFee < 1 ? "연회비는 없어요." : `연회비 ${won(card.annualFee)}은 월 ${num(card.feeMonthly)}원꼴이에요.`}`;
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

/** 순혜택 한 문장. 연회비가 0원이면 '연회비를 빼면'이라고 하지 않는다(연회비가 있는 줄 오해함, 2026-10-31) */
function netSentence(pack: EnginePack): string {
  return pack.fee < 1 ? `연회비가 없어서 월 ${approxKor(pack.net)}을 그대로 받아요` : `연회비를 빼면 월 ${approxKor(pack.net)}이에요`;
}

function answerNewCards(ctx: ChatContext): ChatMsg {
  if (ctx.flow === "new" && ctx.pack) {
    return { role: "model", text: `지금 보고 있는 결과가 새 카드까지 넣어서 계산한 조합이에요. ${netSentence(ctx.pack)}.`, blocks: [cardsBlock(ctx.pack)] };
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
    text: `${what}은 ${parts}이고, ${netSentence(pack)}.`,
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
      return { ...s, text: `이 질문에 딱 맞는 계산 기록을 찾지 못해서 지금 조합 요약으로 답할게요. ${s.text}`, mood: "sorry" };
    }
    default:
      return answerSummary(ctx);
  }
}

/* ---------------- 선택지(메뉴 → 질문 → 답, 2026-10-31) ---------------- */

export type MenuId = "make" | "check" | "faq";

/** 첫 인사 아래 큰 버튼 3개. 지갑이 있든 없든 누구에게나 같은 3개를 보여 준다 */
export const MENUS: { id: MenuId; label: string }[] = [
  { id: "make", label: "지갑 만들기" },
  { id: "check", label: "지갑 확인" },
  { id: "faq", label: "자주 묻는 질문" },
];

export const HOME_CHOICE: ChatChoice = { id: "home", label: "처음으로" };

/** 고정 문구 선택지(질문형). 카드별 선택지는 카드 이름으로 따로 만든다(cardChoice) */
const LABEL: Record<string, string> = {
  "menu:make": "지갑을 만들고 싶어요",
  "make:own": "가진 카드로 지갑을 만들고 싶어요",
  "make:new": "새 카드까지 넣어서 만들고 싶어요",
  "make:statement": "명세서로 지출을 넣을 수 있어요?",
  "make:respend": "지출을 바꿔서 다시 계산할래요",
  /** 버튼으로는 보이지 않고 직접 입력('카드 추천해줘')과 AI 분류에서만 쓰는 메뉴(2026-11-01) */
  "make:recommend": "새 카드를 추천받고 싶어요",
  "check:summary": "내 지갑 요약해 주세요",
  "check:perf": "실적은 다 채워져요?",
  "check:new": "새 카드까지 넣으면 얼마나 늘어요?",
  "check:nomargin": "실적 여유 없이 계산하면요?",
  "check:count": "카드 수를 바꾸면요?",
  "faq:how": "추천은 어떻게 계산해요?",
  "faq:perf": "전월실적이 뭐예요?",
  "faq:margin": "실적 여유는 뭐예요?",
  "faq:net": "순혜택은 뭐예요?",
  "faq:diff": "실제 혜택이랑 다를 수 있어요?",
};
const pick = (...ids: string[]): ChatChoice[] => ids.map((id) => ({ id, label: LABEL[id] }));

const cardName = (c: EngineCard) => catalogBySourceId.get(c.sid)?.name ?? c.name;

function cardChoice(c: EngineCard): ChatChoice {
  return { id: `check:card:${c.sid}`, label: `${josa(cardName(c), "은/는")} 어디에 써요?` };
}

/** 카드 수별 순혜택(결과 화면 막대와 같은 값). 저장한 지갑에는 없다 */
function countBar(ctx: ChatContext) {
  return ctx.rec?.bar?.length ? monotoneBar(ctx.rec.bar, ctx.pack) : [];
}

/** 메뉴를 눌렀을 때 보여 줄 질문형 선택지 */
export function menuChoices(menu: MenuId, ctx: ChatContext): ChatChoice[] {
  if (menu === "make") return pick("make:own", "make:new", "make:statement", ...(ctx.pack ? ["make:respend"] : []));
  if (menu === "check") return ctx.pack ? [...pick("check:summary"), ...ctx.pack.cards.map(cardChoice), ...pick("check:perf")] : pick("menu:make");
  return pick("faq:how", "faq:perf", "faq:margin", "faq:net", "faq:diff");
}

/** 답 끝에 이어질 선택지와 '처음으로'를 붙인다(직접 입력한 질문의 답에도 '처음으로'는 붙는다) */
export function withChoices(msg: ChatMsg, next: ChatChoice[] = []): ChatMsg {
  return { ...msg, blocks: [...(msg.blocks ?? []), { kind: "choices", items: [...next, HOME_CHOICE] }] };
}

const say = (text: string, blocks?: ChatBlock[]): ChatMsg => ({ role: "model", text, ...(blocks ? { blocks } : {}) });
const go = (label: string, to: string): ChatBlock => ({ kind: "actions", actions: [{ label, to, primary: true }] });
const noWallet = () => withChoices({ ...say("아직 저장한 지갑이 없어요. 지갑부터 만들어 볼까요?"), mood: "sorry" }, pick("menu:make"));

function answerCardCount(ctx: ChatContext): ChatMsg {
  const bar = countBar(ctx);
  const now = ctx.pack!.cards.length;
  if (bar.length < 2) return { ...say(`지금은 카드 ${now}장 조합이에요. 카드 수별 비교는 지갑 만들기에서 새로 계산한 결과로 볼 수 있어요.`), mood: "sorry" };
  return say(`카드를 최대 몇 장까지 쓰느냐에 따라 순혜택이 이렇게 달라져요. ${bar.map((b) => `${b.k}장 월 ${approxKor(b.net)}`).join(", ")}. 지금은 ${now}장 조합이에요.`);
}

function faqNet(ctx: ChatContext): string {
  const base = "순혜택은 카드로 받는 할인·적립을 모두 더한 금액에서 연회비(1년 치를 12로 나눈 값)를 뺀 금액이에요.";
  const p = ctx.pack;
  if (!p) return base;
  if (p.fee < 1) return `${base} 지금 지갑은 연회비가 없어서 월 혜택 ${won(p.total)}이 그대로 순혜택이에요.`;
  return `${base} 지금 지갑은 월 혜택 ${won(p.total)}에서 연회비 월 ${won(p.fee)}을 빼서 순혜택 ${won(p.net)}이에요.`;
}

/**
 * 선택지를 눌렀을 때의 답. 계산 결과와 정해 둔 설명만 쓰고 아주LLM은 거치지 않는다.
 * id: 'home' | 'menu:<MenuId>' | '<menu>:<leaf>' | 'check:card:<sid>'
 */
export async function answerChoice(id: string, ctx: ChatContext, call: EngineCall): Promise<ChatMsg> {
  if (id === "home") return { ...say("다른 것도 도와드릴까요?", [{ kind: "menu" }]), mood: "hello" };
  if (id.startsWith("menu:")) {
    const menu = id.slice("menu:".length) as MenuId;
    if (menu === "check" && !ctx.pack) return noWallet();
    const lead: Record<MenuId, string> = { make: "어떻게 만들어 볼까요?", check: "무엇이 궁금하세요?", faq: "궁금한 질문을 골라 주세요." };
    return withChoices(say(lead[menu] ?? "무엇을 도와드릴까요?"), menuChoices(menu, ctx));
  }
  const pack = ctx.pack;
  switch (id) {
    case "make:own":
      return withChoices(say("가진 카드를 고르고 한 달 지출을 넣으면, 그 카드들로 혜택이 가장 큰 조합과 어디서 어느 카드로 결제할지 알려 드려요.", [go("가진 카드로 시작하기", paths.start("own"))]), pick("make:new"));
    case "make:new":
      return withChoices(say("신용·체크 중 원하는 카드 종류를 고르고 지출을 넣으면, 새로 발급할 수 있는 카드까지 넣어서 가장 유리한 조합을 찾아 드려요.", [go("새 카드까지 넣어서 시작하기", paths.start("new"))]), pick("make:own"));
    case "make:statement":
      return withChoices(say("네. 지갑을 만들다가 지출 입력 단계에서 카드 명세서 파일(PDF·CSV)을 올리면, 지출을 카테고리별로 나눠서 채워 드려요.", [go("가진 카드로 시작하기", paths.start("own"))]), pick("make:new"));
    case "make:recommend":
      // 대화로 새 카드를 고르는 기능은 아직 없다(알고리즘 설계 예정). 지금 지갑을 추천인 척하지 않고 계산 화면으로 안내
      return withChoices(
        say("대화로 새 카드를 골라 드리는 건 아직 준비 중이에요. 새 카드까지 넣어서 계산하면 전체 카드 중에서 내 지출에 맞는 조합을 찾아 드려요.", [go("새 카드까지 넣어서 시작하기", paths.start("new"))]),
        pick("faq:how"),
      );
    case "make:respend":
      if (!pack) return noWallet();
      return withChoices(say("지출 입력 화면에서 금액을 고치면 그 지출로 다시 계산해요.", [go("지출 다시 입력", paths.make(ctx.flow ?? "own", "spend"))]), pick("check:summary"));
    case "faq:how":
      return withChoices(say("가진 카드(또는 새 카드 후보)와 한 달 지출을 넣으면, 카드사 원문 혜택 표로 카드마다 받는 금액을 계산하고 지출을 카드별로 나눠 맡겨서, 연회비를 뺀 혜택이 가장 큰 조합을 골라요."), pick("faq:net"));
    case "faq:perf":
      return withChoices(
        say("전월실적은 지난달 그 카드로 결제한 금액이에요. 카드마다 '전월실적 30만원 이상'처럼 기준이 있어서, 기준을 넘어야 이번 달 할인·적립을 받아요. 카드에 따라 할인받은 결제는 실적에서 빼기도 해요."),
        pack ? pick("check:perf") : [],
      );
    case "faq:margin":
      return withChoices(
        say(`실적 여유는 지출이 조금 줄어도 다음 달 혜택이 끊기지 않도록, 실적 기준보다 조금 더 쓰게 맞추는 값이에요. ${pack ? `지금 결과는 실적 여유 ${korWon(ctx.margin)}으로 계산했어요.` : "기본값은 2만원이에요."}`),
        pack ? pick("check:nomargin") : [],
      );
    case "faq:net":
      return withChoices(say(faqNet(ctx)), pack ? pick("check:summary") : pick("faq:how"));
    case "faq:diff":
      return withChoices(
        say("카드사 원문 혜택 표로 계산하지만, 가맹점 구분이나 이벤트, 약관 변경 때문에 실제 혜택과 다를 수 있어요. 일부 카드는 카드고릴라 혜택 요약만으로 계산해서 실적 조건이나 통합 한도가 빠져 있을 수 있어요. 발급 전에는 꼭 카드사 약관을 확인해 주세요."),
        pick("faq:how"),
      );
  }
  if (id.startsWith("check:")) {
    if (!pack) return noWallet();
    if (id.startsWith("check:card:")) {
      const card = pack.cards.find((c) => c.sid === Number(id.slice("check:card:".length)));
      return card ? withChoices(answerCard(card, ctx), pick("check:perf", "check:summary")) : withChoices(answerSummary(ctx));
    }
    switch (id) {
      case "check:summary":
        return withChoices(answerSummary(ctx), pick("check:new", "check:nomargin", ...(countBar(ctx).length >= 2 ? ["check:count"] : [])));
      case "check:perf":
        return withChoices(answerPerf(ctx), pick("faq:perf", "check:summary"));
      case "check:new":
        return withChoices(answerNewCards(ctx), pick("check:summary"));
      case "check:nomargin":
        return withChoices(await answerNoMargin(ctx, call), pick("faq:margin", "check:summary"));
      case "check:count":
        return withChoices(answerCardCount(ctx), pick("check:summary"));
    }
  }
  return say("무엇을 도와드릴까요?", [{ kind: "menu" }]);
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
      // 카드사·발급 중단은 '이 카드 발급 중단됐어?'처럼 이름 없이 물을 때 AI가 답할 수 있게 넘긴다(2026-11-01)
      const entry = catalogBySourceId.get(c.sid);
      const facts = [`연회비 ${won(c.annualFee)}`, ...(entry ? [`카드사 ${entry.issuer}`, isDiscontinued(entry) ? "신규 발급 중단" : "발급 중"] : [])];
      lines.push(`[카드] ${c.name} (${facts.join(", ")}) · 이 카드로 결제: ${Object.entries(c.alloc).map(([k, v]) => `${catLabel(k)} ${won(v)}`).join(", ")}`);
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

/* ---------------- 직접 입력(2026-10-31). 규칙은 chatRules.ts ---------------- */

/** 아주LLM 호출(화면이 키를 넣어 만든다. 실패하면 짧은 이유를 담은 Error를 던진다) */
export type AskAi = (messages: AzuLlmMessage[]) => Promise<string>;

/** AI 분류기가 고를 수 있는 메뉴 질문(지금 지갑 상태 기준). 번호 = 배열 순서 + 1 */
export function routerMenu(ctx: ChatContext): ChatChoice[] {
  const items = [
    ...menuChoices("make", ctx),
    ...(ctx.pack ? [...menuChoices("check", ctx), ...pick("check:new", "check:nomargin", ...(countBar(ctx).length >= 2 ? ["check:count"] : []))] : []),
    ...menuChoices("faq", ctx),
    ...pick("make:recommend"),
  ];
  return items.filter((c, i) => items.findIndex((x) => x.id === c.id) === i);
}

/** 버튼 문구와 글자가 같으면 그 버튼 id(띄어쓰기·끝의 물음표는 무시) */
export function exactChoice(q: string, ctx: ChatContext): string | null {
  const nq = norm(q).replace(/[?？!.~]+$/, "");
  return routerMenu(ctx).find((c) => norm(c.label).replace(/[?？!.~]+$/, "") === nq)?.id ?? null;
}

/** ③ 직접 입력을 메뉴 질문으로 바로 잇는다(예비 규칙): 버튼 문구와 같으면 그 버튼, 내 카드 이름 + 쓰임새 낱말이면 카드 버튼, 그다음 MENU_KEYWORDS */
export function matchChoice(q: string, ctx: ChatContext): string | null {
  const exact = exactChoice(q, ctx);
  if (exact) return exact;
  const card = findCard(q, ctx.pack);
  if (card && CARD_USE_WORDS.test(q)) return `check:card:${card.sid}`;
  const kw = MENU_KEYWORDS.find((r) => r.all.every((re) => re.test(q)))?.id;
  if (kw) return kw;
  return NEW_CARD_REQUEST.test(q.trim()) && NEW_CARD_CONTEXT.test(q) && !NEW_CARD_REQUEST_EXCEPT.test(q) ? "make:recommend" : null;
}

/* ---------------- AI 입력 판단(2026-11-01). 의도 정의서는 intents.ts ---------------- */

/** 글자 두 개씩 끊은 묶음(비슷한 예시 고르기용) */
function bigrams(s: string): Set<string> {
  const t = norm(s).replace(/[?？!.~,]/g, "");
  const out = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  if (t.length === 1) out.add(t);
  return out;
}

function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return a.size + b.size ? (2 * n) / (a.size + b.size) : 0;
}

/** AI가 고를 수 있는 의도(코드가 먼저 처리하는 의도는 뺀다) */
const AI_INTENTS = INTENTS.filter((x) => x.answer.kind !== "code");
const EXAMPLE_INDEX = AI_INTENTS.flatMap((x) => x.examples.filter((e) => !/^\(.*\)$/.test(e)).map((e) => ({ id: x.id, e, g: bigrams(e) })));

/**
 * 질문과 글자가 가장 많이 겹치는 예시 말 n개(업계 방식: 비슷한 예시만 골라 AI에 보여 준다).
 * 겹치는 글자가 없는 예시는 빈자리를 채우지 않는다(직접 읽어 보니 '안녕', '하이'가 잡음으로 붙었음)
 */
export function similarExamples(q: string, n: number = LIMITS.intentExamples): string[] {
  const g = bigrams(q);
  return EXAMPLE_INDEX.map((x) => ({ ...x, s: overlap(g, x.g) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((x) => `${x.e} → ${x.id}`);
}

/** 앞 대화를 짧게: 사용자 말은 그대로, 핏핏 답은 앞부분만(LIMITS.historyBotChars) */
export function historyLines(history: ChatMsg[]): string[] {
  const clip = (t: string) => {
    const s = t.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
    return s.length > LIMITS.historyBotChars ? `${s.slice(0, LIMITS.historyBotChars)}…` : s;
  };
  return history
    .filter((m) => !m.pending && m.text)
    .slice(-LIMITS.historyMessages)
    .map((m) => (m.role === "user" ? `사용자: ${m.text}` : `핏핏: ${clip(m.text)}`));
}

/** AI 입력 판단에 보낼 메시지: 지시문(의도 목록·비슷한 예시·앞 대화·계산 결과) + 지금 질문 */
export function intentMessages(ctx: ChatContext, history: ChatMsg[], question: string): AzuLlmMessage[] {
  const content = intentSystem({
    intents: AI_INTENTS.map((x) => `${x.id}: ${x.name} - ${x.desc}`),
    examples: similarExamples(question),
    cards: (ctx.pack?.cards ?? []).map(cardName),
    categories: Object.entries(CATEGORY_LABEL).map(([id, label]) => `${id}(${label})`),
    record: recordLines(ctx),
    history: historyLines(history),
  });
  return [
    { role: "system", content },
    { role: "user", content: question },
  ];
}

/** AI가 고른 의도와 값 */
export interface IntentPick {
  intent: string;
  card?: string;
  category?: string;
  /** 앞 대화를 반영해 고친 질문 */
  q?: string;
  /** AI가 쓰는 의도(AI_WRITES)의 글 */
  text?: string;
}

/** AI 답에서 JSON 한 줄을 읽는다. 형식이 아니거나 없는 의도면 null(→ 예비 규칙) */
export function parsePick(raw: string): IntentPick | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(m[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
  const s = (v: unknown) => (typeof v === "string" && v.trim() && v.trim() !== "null" ? v.trim() : undefined);
  const intent = s(o.intent);
  if (!intent || !INTENT_BY_ID.has(intent)) return null;
  return { intent, card: s(o.card), category: s(o.category), q: s(o.q), text: s(o.text) };
}

/** 앞에서 n문장만 남긴다. 문장 끝 = 마침표·느낌표·물음표 뒤에 띄어쓰기가 올 때('0.3%'처럼 숫자 사이 점에서는 자르지 않는다) */
export function firstSentences(text: string, n: number): string {
  return text.trim().replace(/\s+/g, " ").split(/(?<=[.!?。])\s+/).filter(Boolean).slice(0, n).join(" ").trim();
}

/** AI가 쓴 글 다듬기: 머리말·내부 용어 고치기(AI_TEXT_FIXES), 굵게는 내 지갑 카드 이름에만 */
export function cleanAiText(text: string, ctx: ChatContext): string {
  let t = AI_TEXT_FIXES.reduce((s, [re, to]) => s.replace(re, to), text.trim());
  const names = (ctx.pack?.cards ?? []).map(cardName).sort((a, b) => b.length - a.length);
  t = t.replace(/\*\*([^*]+)\*\*/g, (whole, inner: string) => (names.some((n) => norm(n) === norm(inner)) ? whole : inner));
  return t;
}

/** ⓪ 카드 번호·주민번호·비밀번호가 들어 있는지 */
export function hasPrivateInfo(q: string): boolean {
  return PRIVATE_INFO.some((re) => re.test(q));
}

/** 개인정보가 든 말을 대화(sessionStorage)에 남기지 않도록 이메일과 숫자를 •로 가린다 */
export function maskPrivateInfo(q: string): string {
  return hasPrivateInfo(q) ? q.replace(EMAIL, "•••@•••").replace(/\d/g, "•") : q;
}

/** 한 문장만, 너무 길거나 비면 대체 문장 */
function oneLine(text: string, fallback: string): string {
  const s = firstSentences(text, 1);
  return s && s.length <= LIMITS.oneLineMaxChars ? s : fallback;
}

/* ---------------- 정해 둔 답(chatRules.ts의 표)과 엔진 답(2026-11-01 대화 시나리오) ---------------- */

/** 정해 둔 답의 이동 버튼. 지갑이 없으면 지출·결과·카드 선택 대신 '가진 카드로 시작하기' */
function goBlock(target: GoTarget, ctx: ChatContext): ChatBlock {
  const flow = ctx.flow ?? "own";
  if (!ctx.pack && (target === "spend" || target === "result" || target === "pickCards")) return go("가진 카드로 시작하기", paths.start("own"));
  switch (target) {
    case "startOwn":
      return go("가진 카드로 시작하기", paths.start("own"));
    case "startNew":
      return go("새 카드까지 넣어서 시작하기", paths.start("new"));
    case "spend":
      return go("지출 다시 입력", paths.make(flow, "spend"));
    case "result":
      return go("추천 결과 보기", paths.make(flow, "result"));
    case "pickCards":
      return go("카드 다시 고르기", paths.make(flow, "cards"));
    case "wallet":
      return go("내 지갑 보기", paths.wallet);
    case "cards":
      return go("전체 카드 보기", paths.cards);
  }
}

/** 선택지 중 지금 지갑 상태로 답할 수 없는 것(지갑 없을 때 지갑 확인·지출 다시 입력, 카드 수 비교가 없을 때 카드 수)은 뺀다 */
function availableChoices(ids: string[], ctx: ChatContext): ChatChoice[] {
  return pick(...ids.filter((id) => (ctx.pack || !(id.startsWith("check:") || id === "make:respend")) && (id !== "check:count" || countBar(ctx).length >= 2)));
}

function ruleMatches(r: FixedReply, q: string): boolean {
  const tests = Array.isArray(r.test) ? r.test : [r.test];
  return tests.every((t) => t.test(q)) && !r.except?.test(q);
}

export function findRule(rules: FixedReply[], q: string): FixedReply | undefined {
  return rules.find((r) => ruleMatches(r, q));
}

/** 정해 둔 답을 말풍선으로: 이동 버튼 → 큰 메뉴 또는 선택지 + 처음으로 */
function fixedAnswer(r: FixedReply, ctx: ChatContext): ChatMsg {
  if (r.needWallet && !ctx.pack) return noWallet();
  const blocks: ChatBlock[] = [];
  if (r.go) blocks.push(goBlock(r.go, ctx));
  if (r.menu) blocks.push({ kind: "menu" });
  const msg: ChatMsg = { ...say(r.reply, blocks.length ? blocks : undefined), mood: r.mood ?? "hello" };
  return r.bare || r.menu ? msg : withChoices(msg, availableChoices(r.next ?? [], ctx));
}

/** 바로 앞 내 말 LIMITS.repeatCount개가 지금 말과 모두 같은지 */
function isRepeat(q: string, history: ChatMsg[]): boolean {
  const mine = history.filter((m) => m.role === "user").slice(-LIMITS.repeatCount);
  return mine.length === LIMITS.repeatCount && mine.every((m) => norm(m.text) === norm(q));
}

/** 카드 목록 전체에서 이름으로 찾기(긴 이름 먼저). '체크카드'처럼 흔한 말과 같은 이름, 다섯 글자 미만 이름은 빼서 잘못 걸리지 않게 한다 */
const CATALOG_NAMES = catalogCards
  .map((c) => ({ c, n: norm(c.name) }))
  .filter((x) => x.n.length >= 5 && !/^(체크카드|신용카드)$/.test(x.n))
  .sort((a, b) => b.n.length - a.n.length);

export function findCatalogCard(q: string): CatalogListing | null {
  const nq = norm(q);
  return CATALOG_NAMES.find((x) => nq.includes(x.n))?.c ?? null;
}

/** '**카드 이름**은' 처럼 이름만 굵게 하고 조사를 붙인다 */
const boldJosa = (name: string, kind: "은/는" | "으로/로" | "이/가") => `**${name}**${josa(name, kind).slice(name.length)}`;

function answerCategory(cat: string, ctx: ChatContext): ChatMsg {
  const pack = ctx.pack!;
  const label = catShort(cat);
  const users = pack.cards.filter((c) => (c.alloc[cat] ?? 0) > 0).sort((a, b) => (b.alloc[cat] ?? 0) - (a.alloc[cat] ?? 0));
  if (!users.length) return withChoices({ ...say(`이번 지출에는 ${josa(label, "이/가")} 없어요. 지출 입력에 넣으면 다시 계산해요.`, [goBlock("spend", ctx)]), mood: "sorry" });
  let text: string;
  if (users.length === 1) {
    const c = users[0];
    const got = c.benefits.filter((b) => b.category === cat && b.final >= 1).reduce((s, b) => s + b.final, 0);
    text = `${josa(label, "은/는")} ${boldJosa(nickOf(c), "으로/로")} 결제하면 돼요.${got >= 1 ? ` 월 ${won(got)}을 받아요.` : ""}`;
  } else {
    text = `${josa(label, "은/는")} ${users.map((c) => `${boldJosa(nickOf(c), "으로/로")} ${korWon(c.alloc[cat] ?? 0)}`).join(", ")} 나눠 결제하면 돼요.`;
  }
  return withChoices({ ...say(text), mood: "hello" }, [cardChoice(users[0])]);
}

/** 카드 목록에서 찾은 카드에 대한 답: 발급 여부·카드사·연회비, 지갑에 없는 카드면 '지갑에 없어서…' */
function cardInfo(kind: "status" | "issuer" | "fee" | "info", entry: CatalogListing, card: EngineCard | null, ctx: ChatContext): ChatMsg {
  const name = entry.name;
  const next = card ? [cardChoice(card)] : [];
  if (kind === "status") return withChoices({ ...say(`${boldJosa(name, "은/는")} ${isDiscontinued(entry) ? "신규 발급이 중단된 카드예요." : "지금도 발급되는 카드예요."}`), mood: "hello" }, next);
  // '우리카드 카드예요'가 되지 않게, 카드사 이름이 '카드'로 끝나면 그대로 쓴다
  if (kind === "issuer") return withChoices({ ...say(`${boldJosa(name, "은/는")} ${/카드$/.test(entry.issuer) ? entry.issuer : `${entry.issuer} 카드`}예요.`), mood: "hello" }, next);
  if (kind === "fee") {
    const fee = card ? card.annualFee : entry.annualFee;
    if (fee === undefined) return withChoices({ ...say(`${boldJosa(name, "은/는")} 연회비 정보가 없어요. 카드사에서 확인해 주세요.`), mood: "sorry" }, next);
    return withChoices({ ...say(fee < 1 ? `${boldJosa(name, "은/는")} 연회비가 없어요.` : `**${name}**의 연회비는 ${won(fee)}이에요.`), mood: "hello" }, next);
  }
  return withChoices({ ...say(`${boldJosa(name, "은/는")} 지금 지갑에 없어서 자세히 말씀드리기 어려워요. 전체 카드에서 혜택을 볼 수 있어요.`, [goBlock("cards", ctx)]), mood: "sorry" });
}

/** 지갑 전체로 답하는 엔진 답: 1년 혜택·연회비 합계·가장 큰 카드·결제 가이드(지갑이 없으면 '지갑부터 만들어 볼까요?') */
function walletAnswer(kind: "yearly" | "totalFee" | "best" | "guide", ctx: ChatContext): ChatMsg {
  const pack = ctx.pack;
  if (!pack) return noWallet();
  if (kind === "totalFee") {
    const annual = pack.cards.reduce((s, c) => s + c.annualFee, 0);
    return withChoices({ ...say(annual < 1 ? "지금 지갑은 연회비가 없어요." : `연회비는 1년에 ${won(annual)}(월 ${won(pack.fee)})이에요.`), mood: "hello" }, pick("faq:net", "check:summary"));
  }
  if (kind === "yearly") return withChoices({ ...say(`1년이면 ${approxKor(pack.net * 12)}이에요(월 순혜택 ${won(pack.net)} × 12).`), mood: "happy" }, pick("check:summary"));
  if (kind === "best") {
    const top = [...pack.cards].sort((a, b) => b.total - a.total)[0];
    // 카드가 1장이면 '가장 많이 받는'이 어색하다(실제 사용 2026-11-02)
    const text = pack.cards.length === 1 ? `지금 조합은 **${cardName(top)}** 한 장이라, 이 카드가 월 ${won(top.total)}을 모두 맡아요.` : `가장 많이 받는 카드는 **${cardName(top)}**(월 ${won(top.total)})이에요.`;
    return withChoices({ ...say(text), mood: "happy" }, [cardChoice(top), ...pick("check:summary")]);
  }
  return withChoices({ ...say("업종별로 이렇게 결제하면 돼요.", [cardsBlock(pack, 99)]), mood: "happy" }, pick("check:summary"));
}

/** 업종 id 찾기: AI가 준 id가 있으면 그것, 없으면 말에서 업종 낱말로 */
function categoryOf(id: string | undefined, hay: string): string | undefined {
  if (id && CATEGORY_LABEL[id]) return id;
  return CATEGORY_WORDS.find(([re]) => re.test(id ?? "") || re.test(hay))?.[1];
}

/**
 * ②-3 계산 결과·카드 목록에서 바로 답하는 질문(예비 규칙). 맞는 질문이 아니면 null.
 * 카드 이름이 있으면(지갑 카드 먼저, 없으면 카드 목록) 발급 중단·카드사·연회비, 지갑에 없는 카드의 혜택 질문.
 * 카드 이름이 없으면 연회비 합계·1년 혜택·가장 큰 카드·결제 가이드·업종별 카드(지갑이 없으면 '지갑부터 만들어 볼까요?')
 */
export function answerEngine(q: string, ctx: ChatContext): ChatMsg | null {
  const card = findCard(q, ctx.pack);
  const entry = card ? (catalogBySourceId.get(card.sid) ?? null) : findCatalogCard(q);
  if (entry) {
    if (ASK_STATUS.test(q)) return cardInfo("status", entry, card, ctx);
    if (ASK_ISSUER.test(q)) return cardInfo("issuer", entry, card, ctx);
    if (ASK_FEE.test(q)) return cardInfo("fee", entry, card, ctx);
    if (!card && ASK_ABOUT_CARD.test(q)) return cardInfo("info", entry, null, ctx);
    return null;
  }
  if (ASK_TOTAL_FEE.every((re) => re.test(q))) return walletAnswer("totalFee", ctx);
  if (ASK_YEARLY.every((re) => re.test(q)) && !/연회비/.test(q)) return walletAnswer("yearly", ctx);
  if (ASK_BEST_CARD.test(q)) return walletAnswer("best", ctx);
  if (ASK_GUIDE.test(q)) return walletAnswer("guide", ctx);
  const cat = ASK_CATEGORY.test(q) ? CATEGORY_WORDS.find(([re]) => re.test(q))?.[1] : undefined;
  if (!cat) return null;
  return ctx.pack ? answerCategory(cat, ctx) : noWallet();
}

/** 정해 둔 답 표(chatRules.ts) 전체를 의도 id로 찾기 */
const RULE_BY_ID = new Map([...SAFETY, ...GUARD, ...QUICK_TALK, ...TOPIC_REPLIES].map((r) => [r.id, r]));

/** '모르겠어요'류 답(단계 대응 문장과 '답하기 어려워요') */
const FAILED_TEXTS: readonly string[] = [...UNCLEAR_STEPS, FIXED.unknown];

/** 바로 앞 핏핏 답들이 연달아 '모르겠어요'류였던 횟수 */
function failStreak(history: ChatMsg[]): number {
  let n = 0;
  for (const m of [...history].reverse()) {
    if (m.role !== "model" || m.pending) continue;
    if (FAILED_TEXTS.includes(m.text)) n++;
    else break;
  }
  return n;
}

/** 단계 대응 n번째 문장(두 번째부터 큰 메뉴) */
function unclearStep(n: number): ChatMsg {
  const step = Math.min(n, UNCLEAR_STEPS.length - 1);
  return step === 0 ? withChoices({ ...say(UNCLEAR_STEPS[0]), mood: "sorry" }) : { ...say(UNCLEAR_STEPS[step], [{ kind: "menu" }]), mood: "sorry" };
}

/** 못 알아들을 때 단계 대응: 바로 앞 핏핏 답들이 연달아 '모르겠어요'류였던 횟수만큼 다음 단계로 */
function unclearAnswer(history: ChatMsg[]): ChatMsg {
  return unclearStep(failStreak(history));
}

/** 정해 둔 답이 없는 의도에서 AI가 쓴 글: 코드가 다듬고 길이를 제한한다(카드 질문 3문장, 잡담·거절 한 문장) */
function aiWritten(style: "card" | "talk" | "out", text: string, ctx: ChatContext): ChatMsg {
  const body = cleanAiText(text, ctx);
  if (style === "card") {
    const answer = firstSentences(body, LIMITS.cardAnswerSentences) || FIXED.unknown;
    // '정보에 없어요'로 답했으면 아쉬운 표정
    return withChoices({ ...say(answer), ...(/정보에\s*없/.test(answer) || answer === FIXED.unknown ? { mood: "sorry" as const } : {}) });
  }
  if (style === "talk") {
    const line = oneLine(body, FIXED.talk);
    return withChoices({ ...say(line), mood: /(고마워|좋아요|다행|좋은\s*하루|마음만|기뻐)/.test(line) ? "happy" : "hello" });
  }
  return withChoices({ ...say(oneLine(body, FIXED.offTopic)), mood: "sorry" });
}

/** 의도가 정해진 뒤의 답(엔진 답). 카드·업종 값은 AI가 준 값 → 고친 질문 → 원래 말 순서로 찾는다 */
async function engineIntent(fn: EngineFn, sel: IntentPick, hay: string, ctx: ChatContext, call: EngineCall): Promise<ChatMsg> {
  switch (fn) {
    case "cardFee":
    case "status":
    case "issuer":
    case "catalogInfo": {
      const card = findCard(hay, ctx.pack);
      const entry = card ? (catalogBySourceId.get(card.sid) ?? null) : findCatalogCard(hay);
      if (!entry) return withChoices({ ...say(FIXED.whichCard), mood: "sorry" });
      // 지갑에 있는 카드를 물었으면 그 카드의 버튼답
      if (fn === "catalogInfo") return card ? answerChoice(`check:card:${card.sid}`, ctx, call) : cardInfo("info", entry, null, ctx);
      return cardInfo(fn === "cardFee" ? "fee" : fn, entry, card, ctx);
    }
    case "compare":
      return ctx.page.kind === "compare" && ctx.page.ids.length >= 2 ? withChoices(await answerCompare(ctx, call)) : withChoices({ ...say(COMPARE_ELSEWHERE, [goBlock("cards", ctx)]), mood: "hello" });
    case "often": {
      const cat = categoryOf(sel.category, hay);
      const place = cat ? catShort(cat) : (hay.match(OFTEN_GO)?.[1] ?? "그 업종");
      return withChoices({ ...say(OFTEN_GO_REPLY(place), [goBlock("spend", ctx)]), mood: "hello" });
    }
    case "category": {
      if (!ctx.pack) return noWallet();
      if (sel.category === "mobile" || /통신/.test(hay)) return withChoices(answerMobile(ctx), pick("check:summary"));
      const cat = categoryOf(sel.category, hay);
      return cat ? answerCategory(cat, ctx) : withChoices({ ...say(FIXED.followUpUnresolved), mood: "sorry" });
    }
    default:
      return walletAnswer(fn, ctx);
  }
}

/** AI가 고른 의도로 답한다. 답은 정해진 곳(정해 둔 답·버튼답·엔진 답)에서, AI 글은 AI_WRITES 의도에서만. 답할 수 없으면 null */
export async function answerIntent(sel: IntentPick, q: string, ctx: ChatContext, call: EngineCall, history: ChatMsg[] = []): Promise<ChatMsg | null> {
  const def = INTENT_BY_ID.get(sel.intent);
  if (!def) return null;
  const hay = [sel.card, sel.q, q].filter(Boolean).join(" ");
  const a = def.answer;
  switch (a.kind) {
    case "fixed": {
      const r = RULE_BY_ID.get(def.id);
      return r ? fixedAnswer(r, ctx) : null;
    }
    case "choice":
      return answerChoice(a.id, ctx, call);
    case "card": {
      if (!ctx.pack) return noWallet();
      const card = findCard(hay, ctx.pack);
      if (card) return answerChoice(`check:card:${card.sid}`, ctx, call);
      const entry = findCatalogCard(hay);
      return entry ? cardInfo("info", entry, null, ctx) : withChoices({ ...say(FIXED.whichCard), mood: "sorry" }, menuChoices("check", ctx));
    }
    case "engine":
      return engineIntent(a.fn, sel, hay, ctx, call);
    case "ai":
      return aiWritten(a.style, sel.text ?? "", ctx);
    case "followup":
      return withChoices({ ...say(FIXED.followUpUnresolved), mood: "sorry" });
    case "unclear":
      return unclearAnswer(history);
    case "code":
      return null;
  }
}

/**
 * [코드가 먼저] AI로 보내기 전에 막는 것: 위기 표현·개인정보·안전·악용·긴 글·링크·반복·이모지·한글 없는 입력.
 * 해당 없으면 null
 */
function answerFirst(text: string, ctx: ChatContext, history: ChatMsg[]): ChatMsg | null {
  // 위기 표현: 다른 모든 규칙보다 먼저, 버튼 없이
  if (CRISIS.test(text)) return { ...say(CRISIS_DEBT.test(text) ? `${CRISIS_REPLY} ${CRISIS_DEBT_REPLY}` : CRISIS_REPLY), mood: "hello" };
  if (hasPrivateInfo(text)) return withChoices({ ...say(FIXED.privacy), mood: "sorry" });
  const early = findRule(SAFETY, text) ?? findRule(GUARD, text);
  if (early) return fixedAnswer(early, ctx);
  if (text.length > LIMITS.maxInputChars) return withChoices({ ...say(FIXED.tooLong), mood: "sorry" });
  if (LINK.test(text)) return withChoices({ ...say(FIXED.link), mood: "sorry" });
  if (isRepeat(text, history)) return { ...say(FIXED.repeat, [{ kind: "menu" }]), mood: "sorry" };
  if (EMOJI_ONLY.test(text)) return { ...say(FIXED.emoji, [{ kind: "menu" }]), mood: "hello" };
  // 한글 글자(가~힣)가 없으면: 'ㄱㅅ'·'thanks' 같은 짧은 인사는 받고, 영문 낱말이 둘 이상이면 외국어, 나머지('ㅋㅋㅋ', 'asdf')는 모르겠어요
  if (!/[가-힣]/.test(text)) {
    const quick = findRule(QUICK_TALK, text);
    if (quick) return fixedAnswer(quick, ctx);
    if (!/[ㄱ-ㅎㅏ-ㅣ]/.test(text) && (text.match(/[A-Za-z]{2,}/g)?.length ?? 0) >= 2) return withChoices({ ...say(FIXED.foreign), mood: "sorry" });
    return unclearAnswer(history);
  }
  return null;
}

/** [예비] AI를 쓸 수 없을 때의 규칙 순서. 규칙으로도 모르면 null */
async function answerByRules(text: string, ctx: ChatContext, call: EngineCall, history: ChatMsg[]): Promise<ChatMsg | null> {
  const quick = findRule(QUICK_TALK, text);
  if (quick) return fixedAnswer(quick, ctx);
  if (FOLLOW_UP.test(text)) return withChoices({ ...say(FIXED.followUp), mood: "sorry" });
  if (!MEANINGFUL.test(text)) return unclearAnswer(history);
  const often = text.match(OFTEN_GO);
  if (often) return withChoices({ ...say(OFTEN_GO_REPLY(often[1]), [goBlock("spend", ctx)]), mood: "hello" });
  const topic = findRule(TOPIC_REPLIES, text);
  if (topic) return fixedAnswer(topic, ctx);
  const compareReady = ctx.page.kind === "compare" && ctx.page.ids.length >= 2;
  if (!compareReady && ASK_COMPARE.test(text)) return withChoices({ ...say(COMPARE_ELSEWHERE, [goBlock("cards", ctx)]), mood: "hello" });
  const engine = answerEngine(text, ctx);
  if (engine) return engine;
  const id = matchChoice(text, ctx);
  if (id) return answerChoice(id, ctx, call);
  // 메뉴에는 없지만 계산 엔진이 바로 답할 수 있는 질문(카드 비교 화면, 통신비).
  // classify의 noMargin('여유'만 들어 있어도 걸림)은 쓰지 않는다: '실적 여유는 왜 둬?'가 여유 없이 계산 답으로 갔음(2026-11-01)
  const intent = classify(text, ctx);
  if (intent === "compare") return withChoices(await answerCompare(ctx, call));
  if (ctx.pack && intent === "mobile") return withChoices(answerMobile(ctx), pick("check:summary"));
  return null;
}

/**
 * 직접 입력한 말에 답한다(chatRules.ts 맨 위 순서). 코드가 먼저 막을 것을 막고 → 버튼 문구 그대로면 그 버튼 →
 * AI가 앞 대화까지 보고 의도를 고르면 정해진 곳에서 답한다. AI 키가 없거나 실패하면 예비 규칙으로 답한다
 */
export async function answerTyped(q: string, ctx: ChatContext, call: EngineCall, ai: AskAi | null, history: ChatMsg[] = []): Promise<ChatMsg> {
  const text = q.trim();
  const first = answerFirst(text, ctx, history);
  if (first) return first;
  const exact = exactChoice(text, ctx);
  if (exact) return answerChoice(exact, ctx, call);
  let failed: string | null = null;
  if (ai) {
    try {
      const sel = parsePick(await ai(intentMessages(ctx, history, text)));
      const answer = sel ? await answerIntent(sel, text, ctx, call, history) : null;
      if (answer) return answer;
    } catch (e) {
      failed = e instanceof Error ? e.message : "";
    }
  }
  const byRules = await answerByRules(text, ctx, call, history);
  if (byRules) return byRules;
  if (failed !== null) return withChoices({ ...say(failed ? `${FIXED.aiFailed} (${failed})` : FIXED.aiFailed), mood: "sorry" });
  // 같은 '답하기 어려워요'를 되풀이하지 않는다(직접 써 보며 찾음, 2026-11-01): 연달아 모르면 단계 대응으로
  const streak = failStreak(history);
  return streak ? unclearStep(streak) : withChoices({ ...say(FIXED.unknown), mood: "sorry" });
}
