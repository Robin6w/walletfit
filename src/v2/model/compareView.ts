import type { BrandShare, EngineCard, TraceBenefit } from "@/domain/types/engine";
import type { CatalogListing } from "@/domain/types/catalog";
import { catLabel } from "@/v1/catalog";
import { korWon, num, won } from "@/v1/format";
import { canonicalBrand } from "@/v2/model/brands";
import { cardNick, catShort, countWord, josa, joinDot, korAmount, korWonDetail } from "@/v2/model/text";

/**
 * 카드 비교 화면(2026-10-29 v2)에 보이는 값과 문장.
 * 금액은 엔진 rank(detail) 결과 — 카드 한 장으로 지출 전부를 냈을 때의 calc.py 과정 기록 — 에서 가져온다.
 * 카드사·연회비는 카드 목록(cards-catalog.json), 출시일·혜택 유지 기간은 card-meta.json(scripts/buildCardMeta.ts)에서 온다.
 */

export interface CardMeta {
  /** YYYY-MM-DD 또는 YYYY-MM */
  launch?: string;
  keepYears?: number;
}

export interface CmpCardInput {
  sid: number;
  entry: CatalogListing | undefined;
  /** 엔진 계산 결과(지출이 없으면 null) */
  view: EngineCard | null;
  meta: CardMeta | undefined;
}

export interface CmpCtx {
  spending: Record<string, number>;
  brandShare: BrandShare;
  ownedIds: number[];
  /** 저장한 지갑의 카드와 카드별로 맡은 지출 */
  wallet: { sids: number[]; alloc: Record<number, Record<string, number>>; names: string[]; net: number } | null;
  today: Date;
}

const VERIFIED = (c: EngineCard | null) => !!c && c.status !== "auto";
const sumOf = (xs: number[]) => xs.reduce((s, v) => s + v, 0);

export function nameOf(x: CmpCardInput): string {
  return x.entry?.name ?? x.view?.name ?? `카드 ${x.sid}`;
}
export function nickOfInput(x: CmpCardInput): string {
  return cardNick(nameOf(x));
}

/* ---------------- 위: 비교하는 카드 ---------------- */

export interface CmpHeadVM {
  sid: number;
  name: string;
  nick: string;
  badge: { text: string; mine: boolean };
  meta: string;
  chips: string[];
  owned: boolean;
  inWallet: boolean;
  /** 지갑에서 맡은 일(지갑에 든 카드만) */
  roleText: string | null;
}

/** 혜택 요약 칩: '커피 4대 브랜드 55% 청구할인' → '커피 4대 브랜드 55%' */
export function chipText(s: string): string {
  return s
    .replace(/\s*(청구\s*할인|결제일\s*할인|즉시\s*할인|할인)$/, "")
    .replace(/\s*・\s*/g, "·")
    .trim();
}

/** 카드 목록의 혜택 요약을 칩으로(끝의 '할인'을 빼고, 길면 22자에서 줄임) */
export function chipsOf(entry: CatalogListing | undefined, max = 4): string[] {
  if (!entry?.benefitSummary) return [];
  return entry.benefitSummary
    .split(/,\s+|\s*\|\s*/)
    .map((s) => chipText(s.trim()))
    .filter(Boolean)
    .slice(0, max)
    .map((s) => (s.length > 22 ? `${s.slice(0, 21)}…` : s));
}

function kindText(entry: CatalogListing | undefined, view: EngineCard | null): string {
  if (entry?.category) return entry.category;
  if (view?.cardType === "check") return "체크";
  return "신용";
}

function feeText(fee: number): string {
  return fee > 0 ? `연회비 ${won(fee)}` : "연회비 없음";
}

export function headVM(x: CmpCardInput, ctx: CmpCtx): CmpHeadVM {
  const owned = ctx.ownedIds.includes(x.sid);
  const inWallet = !!ctx.wallet?.sids.includes(x.sid);
  const issuer = x.entry?.issuer ?? x.view?.issuer ?? "";
  const fee = x.entry?.annualFee ?? x.view?.annualFee ?? 0;
  const alloc = ctx.wallet?.alloc[x.sid] ?? {};
  const cats = Object.entries(alloc)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([c]) => catShort(c));
  const roleWord = joinDot(cats.slice(0, 3));
  return {
    sid: x.sid,
    name: nameOf(x),
    nick: nickOfInput(x),
    badge: inWallet ? { text: "내 카드 · 추천 지갑에 들어 있어요", mine: true } : owned ? { text: "내 카드", mine: true } : { text: "아직 담지 않은 카드", mine: false },
    meta: joinMeta([issuer, kindText(x.entry, x.view), feeText(fee)]),
    chips: chipsOf(x.entry, 4),
    owned,
    inWallet,
    roleText: inWallet && cats.length ? `${josa(roleWord + (cats.length > 3 ? " 등" : ""), "을/를")} 맡는 카드예요` : inWallet ? "지갑에서 실적을 채우는 카드예요" : null,
  };
}

function joinMeta(parts: string[]): string {
  return parts.filter(Boolean).join(" · ");
}

/* ---------------- 내 지출로 계산하면 ---------------- */

export interface CmpSumVM {
  sid: number;
  name: string;
  total: number;
  net: number;
  /** 막대 길이(%) */
  pct: number;
  winner: boolean;
  /** '월 900원 더 받아요'(가장 많이 받는 카드만) */
  more: string | null;
  feeLine: { lead: string; value: string };
}

export function sumVM(xs: CmpCardInput[]): CmpSumVM[] {
  const totals = xs.map((x) => Math.round(x.view?.total ?? 0));
  const max = Math.max(0, ...totals);
  const sorted = [...totals].sort((a, b) => b - a);
  const lead = sorted.length > 1 ? sorted[0] - sorted[1] : 0;
  return xs.map((x, i) => {
    const total = totals[i];
    const winner = max > 0 && total === max && lead >= 1;
    const feeM = x.view?.feeMonthly ?? (x.entry?.annualFee ?? 0) / 12;
    const net = Math.round(total - feeM);
    return {
      sid: x.sid,
      name: nameOf(x),
      total,
      net,
      pct: max > 0 ? Math.max(2, Math.round((total / max) * 100)) : 0,
      winner,
      more: winner ? `월 ${num(lead)}원 더 받아요` : null,
      feeLine: feeM > 0 ? { lead: `연회비(월 ${won(feeM)})를 빼면 `, value: `월 ${won(net)}` } : { lead: "연회비가 없어서 그대로 ", value: `월 ${won(total)}` },
    };
  });
}

/** 요약 아래 설명: 계산 방식과 혜택 표 상태 */
export function sumNote(xs: CmpCardInput[], total: number): string {
  const kinds = new Set(xs.flatMap((x) => (x.view?.benefits ?? []).filter((b) => b.final >= 1).map((b) => b.kind)));
  const word = kinds.size === 0 || (kinds.size === 1 && kinds.has("discount")) ? "할인" : "혜택";
  const head = `한 카드로 월 ${korAmount(total)}원을 모두 결제했을 때 받는 ${word}이에요`;
  const auto = xs.filter((x) => x.view && !VERIFIED(x.view));
  if (!auto.length) return `${head} · 카드사 원문 규칙으로 계산한 추정값`;
  if (auto.length === xs.length) return `${head} · 카드고릴라 혜택 요약을 해석해 계산한 추정값`;
  const names = joinDot(auto.map(nickOfInput));
  return `${head} · ${josa(names, "은/는")} 카드고릴라 혜택 요약으로, 나머지는 카드사 원문 규칙으로 계산한 추정값`;
}

/* ---------------- 표 ---------------- */

export interface CellVM {
  main: string;
  /** 굵은 파란 글씨(내 지출로 더 많이 받는 카드) */
  strong?: boolean;
  muted?: boolean;
  sub?: string | null;
  chip?: { text: string; tone: "win" | "plain" | "zero" } | null;
}

export interface RowVM {
  id: string;
  label: string;
  sub?: string | null;
  /** 혜택 줄의 카테고리(아이콘) */
  cat?: string;
  cells: CellVM[];
  same: boolean;
}

export interface SectionVM {
  id: string;
  title: string;
  rows: RowVM[];
}

function sameCells(cells: CellVM[]): boolean {
  if (cells.length < 2) return false;
  const key = (c: CellVM) => `${c.main}|${c.sub ?? ""}|${c.chip?.text ?? ""}`;
  return cells.every((c) => key(c) === key(cells[0]));
}

function row(id: string, label: string, cells: CellVM[], extra: Partial<RowVM> = {}): RowVM {
  return { id, label, cells, same: sameCells(cells), ...extra };
}

/** '2024년 2월 29일' / '2018년 12월' */
export function launchText(launch: string): string {
  const [y, m, d] = launch.split("-").map(Number);
  return d ? `${y}년 ${m}월 ${d}일` : `${y}년 ${m}월`;
}

/** 혜택 유지 약속 칸 */
export function keepCell(meta: CardMeta | undefined, today: Date, showYears: boolean): CellVM {
  if (!meta?.keepYears) return { main: "원문에서 찾지 못했어요", muted: true };
  const years = `출시 후 ${meta.keepYears}년간`;
  if (!meta.launch) return { main: years, sub: "출시일이 원문에 없어요" };
  const [y, m] = meta.launch.split("-").map(Number);
  const endY = y + meta.keepYears;
  const ended = endY * 12 + m < today.getFullYear() * 12 + (today.getMonth() + 1);
  if (ended) return { main: `${endY}년 ${m}월에 끝났어요`, sub: `${showYears ? `${years} · ` : ""}지금은 카드사가 혜택을 바꿀 수 있어요` };
  return { main: `${endY}년 ${m}월까지`, sub: showYears ? years : null };
}

/** '국내전용 [12,000]원 / 해외겸용 [12,000]원' → '국내전용·해외겸용 같음' */
export function feeSub(text: string | undefined): string | null {
  if (!text) return null;
  const parts = Array.from(text.matchAll(/(국내전용|해외겸용|국내|해외|[가-힣A-Za-z]+)\s*\[([\d,]+)\]\s*원/g)).map((m) => ({ label: m[1], v: Number(m[2].replace(/,/g, "")) }));
  if (parts.length < 2) return null;
  if (parts.every((p) => p.v === parts[0].v)) return `${parts.map((p) => p.label).join("·")} 같음`;
  return parts.map((p) => `${p.label} ${won(p.v)}`).join(" · ");
}

function basicSection(xs: CmpCardInput[], ctx: CmpCtx): SectionVM {
  const issuer = xs.map((x) => ({ main: joinMeta([x.entry?.issuer ?? x.view?.issuer ?? "", kindText(x.entry, x.view)]) }));
  const fee = xs.map((x) => {
    const f = x.entry?.annualFee ?? x.view?.annualFee ?? 0;
    return { main: f > 0 ? won(f) : "없음", sub: feeSub(x.entry?.annualFeeText) };
  });
  const launch = xs.map((x): CellVM => (x.meta?.launch ? { main: launchText(x.meta.launch) } : { main: "원문에서 찾지 못했어요", muted: true }));
  const years = Array.from(new Set(xs.map((x) => x.meta?.keepYears ?? 0)));
  const sameYears = years.length === 1 && years[0] > 0;
  const keep = xs.map((x) => keepCell(x.meta, ctx.today, !sameYears));
  return {
    id: "basic",
    title: "기본 정보",
    rows: [
      row("issuer", "카드사 · 종류", issuer),
      row("fee", "연회비", fee),
      row("launch", "출시일", launch),
      row("keep", "혜택 유지 약속", keep, { sub: sameYears ? `출시 후 ${years[0]}년간 축소·폐지 없음` : null }),
    ],
  };
}

/* ----- 전월실적 ----- */

const EXCLUDE_WORDS: [RegExp, string][] = [
  [/국세|지방세|세금|제세/, "세금"],
  [/공과금|전기|수도|도시가스/, "공과금"],
  [/관리비/, "관리비"],
  [/4대|사회보험|건강보험|국민연금/, "4대보험"],
  [/등록금|학교납입금|교육비/, "등록금"],
  [/상품권|기프트|선불/, "상품권"],
  [/임대료/, "임대료"],
  [/무이자/, "무이자할부"],
  [/해외/, "해외 결제"],
  [/통행/, "통행료"],
  [/대중교통|교통요금|교통이용|후불교통/, "교통"],
  [/택시/, "택시"],
  [/현금서비스|카드론|대출/, "카드대출"],
];

/** 자주 보는 순서(앞의 다섯 개만 보여 준다) */
const EXCLUDE_ORDER = ["세금", "공과금", "관리비", "상품권", "해외 결제", "무이자할부", "4대보험", "등록금", "교통", "택시", "통행료", "임대료", "카드대출"];

/** 실적 제외 항목을 짧은 낱말로(연회비·수수료·이자·취소 같은 당연한 항목은 뺀다) */
export function excludeWords(items: string[]): string[] {
  const out: string[] = [];
  for (const it of items) {
    if (/할인 서비스|할인받은|할인 적용/.test(it)) continue;
    const hit = EXCLUDE_WORDS.find(([re]) => re.test(it));
    if (hit && !out.includes(hit[1])) out.push(hit[1]);
  }
  return out.sort((a, b) => EXCLUDE_ORDER.indexOf(a) - EXCLUDE_ORDER.indexOf(b));
}

function tierMins(c: EngineCard): number[] {
  return c.perf.tiers.map((t) => t.min).filter((m) => m > 0).sort((a, b) => a - b);
}

function tierMinOf(c: EngineCard, id: string | null | undefined): number | null {
  if (!id) return null;
  return c.perf.tiers.find((t) => t.id === id)?.min ?? null;
}

const UNKNOWN: CellVM = { main: "확인 전", muted: true, sub: "혜택 요약만 읽어서 원문 조건을 아직 몰라요" };

function perfSection(xs: CmpCardInput[], ctx: CmpCtx): SectionVM | null {
  if (!xs.some((x) => x.view)) return null;
  const total = sumOf(Object.values(ctx.spending));
  const basis = xs.map((x): CellVM => {
    const c = x.view;
    if (!c) return { main: "—", muted: true };
    if (!VERIFIED(c)) return UNKNOWN;
    const mins = tierMins(c);
    const domesticOnly = excludeWords(c.perf.excludedItems ?? []).includes("해외 결제");
    const subs = [domesticOnly ? "국내 가맹점 결제만 실적으로 쳐요" : "", mins.length > 1 ? "구간마다 혜택이 달라요" : ""];
    if (!mins.length) return { main: "조건 없음", sub: joinSubs(subs) };
    if (mins.length === 1) return { main: `${korWon(mins[0])} 이상`, sub: joinSubs(subs) };
    return { main: `${mins.map((m) => `${korWon(m)} 이상`).join(" · ")} ${countWord(mins.length)} 구간`, sub: joinSubs(subs) };
  });
  const excluded = xs.map((x): CellVM => {
    const c = x.view;
    if (!c) return { main: "—", muted: true };
    if (!VERIFIED(c)) return UNKNOWN;
    const words = excludeWords(c.perf.excludedItems ?? []).slice(0, 5);
    const removed = c.perf.qRaw - c.perf.q;
    const tail = (w: string[], p: "도" | "은/는") => (w.length ? `${p === "도" ? `${joinDot(w)}도` : josa(joinDot(w), "은/는")} 빠져요` : null);
    if (c.perf.excludesDiscounted) return { main: "할인받은 결제 전액", sub: tail(words, "도") };
    if (removed > 1) return { main: "할인받은 결제 일부", sub: tail(words, "도") };
    return { main: "할인받은 결제도 실적에 들어가요", sub: tail(words, "은/는") };
  });
  const mine = xs.map((x): CellVM => {
    const c = x.view;
    if (!c) return { main: "—", muted: true };
    if (!VERIFIED(c)) return { main: "실적 조건 없이 계산했어요", muted: true, sub: "원문 조건이 있으면 금액이 줄 수 있어요" };
    const mins = tierMins(c);
    const q = c.perf.q;
    if (!mins.length) return { main: "조건 없이 받아요" };
    const cur = tierMinOf(c, c.perf.tier);
    if (cur === null || cur <= 0) {
      const need = mins[0];
      return { main: "기준에 못 미쳐요", sub: `실적으로 치는 결제가 ${korWonDetail(q)}라 ${korWon(need)}까지 ${korWonDetail(need - q)} 모자라요` };
    }
    if (mins.length === 1) {
      return {
        main: "기준을 넘어요",
        sub: c.perf.excludesDiscounted ? `할인받은 결제를 모두 빼도 ${korWon(cur)} 이상이에요` : `실적으로 치는 결제가 ${korWonDetail(q)}이에요`,
      };
    }
    const lower = mins.filter((m) => m < cur).pop();
    return {
      main: `${korWon(cur)} 구간 · 여유 ${korWonDetail(Math.max(0, q - cur))}`,
      sub: `실적이 ${korWon(cur)} 아래로 내려가면 ${lower ? `${korWon(lower)} 구간 혜택으로 바뀌어요` : "혜택을 못 받아요"}`,
    };
  });
  const grace = xs.map((x): CellVM => {
    const c = x.view;
    if (!c) return { main: "—", muted: true };
    if (!VERIFIED(c)) return UNKNOWN;
    const g = c.perf.grace;
    const mins = tierMins(c);
    if (!g) return mins.length ? { main: "원문에 안내가 없어요", muted: true } : { main: "실적 조건이 없어 첫 달부터 받아요" };
    const when = (g.months_after_issue ?? 1) <= 1 ? "다음 달 말일까지" : `발급 후 ${countWord(g.months_after_issue ?? 2)} 달 동안`;
    if (!g.assumed_tier) return { main: `${when} 일부 혜택을 실적 없이 받아요` };
    const tm = tierMinOf(c, g.assumed_tier);
    if (mins.length > 1 && tm) return { main: `${when} 실적과 상관없이 ${korWon(tm)} 구간 혜택` };
    return { main: `${when} 실적과 상관없이 혜택 그대로` };
  });
  return {
    id: "perf",
    title: "전월실적",
    rows: [
      row("basis", "실적 기준", basis),
      row("excluded", "실적에서 빠지는 결제", excluded),
      row("mine", "내 지출로 보면", mine, { sub: total ? `월 ${korAmount(total)}원` : null }),
      row("grace", "새로 발급하면", grace),
    ],
  };
}

function joinSubs(xs: (string | null | undefined)[]): string | null {
  const s = xs.filter(Boolean).join(" · ");
  return s || null;
}

/* ----- 혜택 ----- */

/** 혜택 이름을 칸에 맞게: 끝의 '청구할인'을 빼고, 괄호 속 브랜드 목록이 있으면 그 목록을 앞으로 */
export function benefitTitle(b: Pick<TraceBenefit, "title" | "specificity" | "merchants">): string {
  let t = b.title.trim().replace(/\s*(청구\s*할인|결제일\s*할인|즉시\s*할인|할인)$/, "");
  // 괄호 속 목록의 쉼표는 가운뎃점으로
  t = t.replace(/\(([^)]*)\)/g, (_, x: string) => `(${x.replace(/\s*,\s*/g, "·")})`);
  if (b.specificity === "brand" || b.specificity === "merchant_group") {
    const m = t.match(/^[^(]+\(([^)]+)\)\s*(.*)$/);
    // 괄호 뒤에 요율·금액이 있을 때만 브랜드 목록을 앞으로('커피 4대 브랜드(…) 55%' → '스타벅스·… 55%')
    if (m && /\d/.test(m[2]) && b.merchants.some((name) => m[1].includes(name.slice(0, 2)))) t = `${m[1]} ${m[2]}`.trim();
  }
  return t.replace(/\s*\/\s*/g, "·").replace(/\s*・\s*/g, "·");
}

function capWord(period: string): string {
  return period === "year" ? "연" : period === "day" ? "하루" : period === "week" ? "주" : "월";
}

function sharedWord(label: string): string {
  if (/자동\s*맞춤/.test(label)) return "자동맞춤 한도";
  if (/통합/.test(label)) return "통합 한도";
  return "묶음 한도";
}

/** 묶음 한도 이름을 짧게: '교통·이동통신·스트리밍 10% 할인 통합 월 할인한도' → '교통·이동통신·스트리밍' */
export function sharedShort(label: string): string {
  if (/자동\s*맞춤/.test(label)) return "자동맞춤 영역";
  const t = label
    .replace(/월\s*(통합\s*)?할인\s*한도|할인\s*한도|한도/g, "")
    .replace(/\d+(\.\d+)?\s*%\s*(할인|적립|캐시백)?/g, "")
    .replace(/통합|할인/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return t || "묶인";
}

const SKIP_WORD: [RegExp, string | null][] = [
  [/해외 혜택/, null],
  [/실적 구간 미달/, "실적 기준에 못 미쳐 0원"],
  [/프로모션 종료/, "프로모션이 끝났어요"],
];

/** 혜택 칸 아래 설명: 최소 결제 · 월 한도 · 건당 한도 · 횟수 · 결제 조건 · 묶음 한도 */
export function benefitSub(b: TraceBenefit, card: EngineCard): string | null {
  const parts: string[] = [];
  if (b.minTxn) parts.push(`${won(b.minTxn)} 이상 결제`);
  const est = card.status === "auto" ? "(추정)" : "";
  const mins = tierMins(card);
  const curMin = tierMinOf(card, card.perf.tier);
  const tierVaries = (b.capTiers ?? []).some((c) => new Set(c.tiers.map((t) => t.amount)).size > 1);
  if (b.caps.length) {
    const c = [...b.caps].sort((x, y) => x.monthly - y.monthly)[0];
    const head = tierVaries && mins.length > 1 && curMin ? `${korWon(curMin)} 구간 ` : "";
    parts.push(`${head}${capWord(c.period)} ${won(c.amount)}${est}`);
  } else if (!b.skip && b.type === "percent" && !(b.sharedIds ?? []).length) {
    parts.push("한도 없음");
  }
  if (b.perTxnCap) parts.push(`건당 ${won(b.perTxnCap)}`);
  const cl = b.countLimits;
  if (cl?.per_day) parts.push(`하루 ${cl.per_day}회`);
  if (cl?.per_month) parts.push(`월 ${cl.per_month}회`);
  if (cl?.per_year) parts.push(`연 ${cl.per_year}회`);
  if (b.channel === "offline") parts.push("오프라인 결제만");
  if (b.channel === "online") parts.push("온라인 결제만");
  if (b.condition) parts.push(b.condition.replace(/\s*\([^)]*\)\s*$/, "").trim());
  const sh = (b.sharedIds ?? []).map((id) => card.shared.find((s) => s.id === id)).find(Boolean);
  if (sh) parts.push(`${sharedWord(sh.label)} ${korWon(sh.cap)}`);
  if (b.skip) {
    const tierOnly = b.skip.match(/이 혜택은 (.+) 구간에서만/);
    if (tierOnly) {
      const ms = tierOnly[1]
        .split(/,\s*/)
        .map((id) => tierMinOf(card, id))
        .filter((m): m is number => !!m);
      if (ms.length) parts.push(`${korWon(Math.min(...ms))} 구간부터`);
    } else {
      const w = SKIP_WORD.find(([re]) => re.test(b.skip ?? ""));
      if (w && w[1]) parts.push(w[1]);
    }
  }
  return parts.length ? parts.slice(0, 5).join(" · ") : null;
}

/** 혜택이 들어가는 표 줄: 해외 / 카테고리 / 모든 가맹점 / 그 밖의 혜택 */
export function rowKeyOf(b: Pick<TraceBenefit, "region" | "category" | "specificity">): string {
  if (b.region === "overseas") return "overseas";
  if (b.category) return b.category;
  return b.specificity === "all_merchants" ? "all" : "misc";
}

const ROW_LABEL: Record<string, string> = { overseas: "해외", all: "모든 가맹점", misc: "그 밖의 혜택" };

function rowLabel(key: string): string {
  return ROW_LABEL[key] ?? catLabel(key);
}

/** 자주 가는 곳에서 고른 브랜드(별칭은 하나로) */
function brandsOfCat(cat: string, share: BrandShare): string[] {
  return Array.from(
    new Set(
      Object.entries(share[cat] ?? {})
        .filter(([, v]) => v > 0)
        .map(([k]) => canonicalBrand(k)),
    ),
  );
}

function benefitSection(xs: CmpCardInput[], ctx: CmpCtx): SectionVM | null {
  if (!xs.some((x) => x.view)) return null;
  const spend = ctx.spending;
  const total = sumOf(Object.values(spend));
  const byCard = xs.map((x) => {
    const m = new Map<string, TraceBenefit[]>();
    for (const b of x.view?.benefits ?? []) {
      const k = rowKeyOf(b);
      m.set(k, [...(m.get(k) ?? []), b]);
    }
    return m;
  });
  const keys = new Set<string>();
  byCard.forEach((m) => m.forEach((_, k) => keys.add(k)));
  // 지출이 있는 항목: 내 지출로 가장 많이 받는 금액 순, 같으면 지출이 큰 순
  const bestOf = (k: string) => Math.max(0, ...byCard.map((m) => sumOf((m.get(k) ?? []).map((b) => b.final))));
  const spendCats = Object.entries(spend)
    .filter(([, v]) => v > 0)
    .sort((a, b) => bestOf(b[0]) - bestOf(a[0]) || b[1] - a[1])
    .map(([c]) => c);
  const restCats = Array.from(keys).filter((k) => !spendCats.includes(k) && !ROW_LABEL[k]);
  const order = [...spendCats, ...(keys.has("all") ? ["all"] : []), ...restCats, ...(keys.has("overseas") ? ["overseas"] : []), ...(keys.has("misc") ? ["misc"] : [])];

  const rows = order.map((key): RowVM => {
    const counted = key === "all" ? total > 0 : (spend[key] ?? 0) > 0;
    const amounts = byCard.map((m) => sumOf((m.get(key) ?? []).map((b) => b.final)));
    const max = Math.max(...amounts);
    const lead = [...amounts].sort((a, b) => b - a);
    const winAt = counted && max >= 1 && (lead.length < 2 || lead[0] - lead[1] >= 1) ? amounts.indexOf(max) : -1;
    const cells = xs.map((x, i): CellVM => {
      const list = (byCard[i].get(key) ?? []).slice().sort((a, b) => b.final - a.final);
      const card = x.view;
      if (!card) return { main: "—", muted: true };
      const amount = amounts[i];
      const chip = counted ? { text: `내 지출로 ${won(amount)}`, tone: i === winAt ? ("win" as const) : amount >= 1 ? ("plain" as const) : ("zero" as const) } : null;
      if (!list.length) {
        const noOverseasPerf = key === "overseas" && VERIFIED(card) && excludeWords(card.perf.excludedItems ?? []).includes("해외 결제");
        return { main: "혜택 없음", sub: noOverseasPerf ? "해외 결제는 실적에서도 빠져요" : null, chip };
      }
      if (key === "misc") {
        const titles = list.map((b) => benefitTitle(b));
        return { main: titles.slice(0, 2).join(" · "), sub: `${titles.length > 2 ? `외 ${titles.length - 2}개 · ` : ""}지출 입력에 없는 항목이라 계산에 넣지 않았어요` };
      }
      const top = list[0];
      const more = list.length > 1 ? `같은 항목 혜택 ${list.length - 1}개 더 · 합쳐서 계산했어요` : null;
      return { main: benefitTitle(top), sub: joinSubs([benefitSub(top, card), more]), chip };
    });
    let sub: string | null;
    if (key === "all") sub = total ? `지출 전체 월 ${korAmount(total)}원` : "지출 입력 없음";
    else if (key === "overseas" || key === "misc") sub = key === "overseas" ? "지출 입력에 없는 항목" : null;
    else if ((spend[key] ?? 0) > 0) sub = joinSubs([`월 ${korAmount(spend[key])}원`, joinDot(brandsOfCat(key, ctx.brandShare))]);
    else sub = "지출 입력 없음";
    return row(`b-${key}`, rowLabel(key), cells, { sub, cat: key });
  });
  return { id: "benefit", title: "혜택 · 내 지출로 받는 금액", rows };
}

/* ----- 한도와 합계 ----- */

function totalSection(xs: CmpCardInput[]): SectionVM | null {
  if (!xs.some((x) => x.view)) return null;
  const totals = xs.map((x) => Math.round(x.view?.total ?? 0));
  const nets = xs.map((x) => Math.round(x.view?.net ?? 0));
  const winner = (vals: number[]) => {
    const s = [...vals].sort((a, b) => b - a);
    return s.length > 1 && s[0] - s[1] >= 1 && s[0] > 0 ? vals.indexOf(s[0]) : -1;
  };
  const wT = winner(totals);
  const wN = winner(nets);

  const limit = xs.map((x): CellVM => {
    const c = x.view;
    if (!c) return { main: "—", muted: true };
    const est = c.status === "auto" ? " · 한도는 혜택 요약을 보고 추정했어요" : "";
    if (c.shared.length === 1) {
      const sh = c.shared[0];
      return { main: `${sharedWord(sh.label)} 월 ${korWon(sh.cap)}`, sub: `${sharedShort(sh.label)} 혜택을 합쳐 이 한도까지 받아요${est}` };
    }
    if (c.shared.length > 1) {
      return { main: `묶음 한도 ${c.shared.length}개`, sub: `${c.shared.map((sh) => `${sharedShort(sh.label)} 월 ${korWon(sh.cap)}`).join(" · ")}${est}` };
    }
    const live = c.benefits.filter((b) => b.region !== "overseas" && !/프로모션 종료|실적 구간 미달|구간에서만/.test(b.skip ?? ""));
    const capped = live.filter((b) => b.caps.length);
    const capSum = sumOf(capped.map((b) => Math.min(...b.caps.map((k) => k.monthly))));
    const open = live.some((b) => !b.caps.length && b.type === "percent");
    if (!capped.length) return { main: open ? "한도가 없어요" : "—", muted: !open };
    return { main: "항목별 한도만 있어요", sub: `${open ? "한도 없는 혜택도 있어요 · " : ""}모두 채우면 월 ${won(capSum)}${est}` };
  });

  const sum = xs.map((x, i): CellVM => {
    const c = x.view;
    if (!c) return { main: "—", muted: true };
    const by = new Map<string, number>();
    for (const b of c.benefits) if (b.final >= 1) by.set(rowKeyOf(b), (by.get(rowKeyOf(b)) ?? 0) + b.final);
    const items = Array.from(by.entries()).sort((a, b) => b[1] - a[1]);
    const shown = items.slice(0, 4).map(([k, v]) => `${k === "all" ? "모든 가맹점" : catShort(k)} ${num(v)}`);
    const sub = items.length ? `${shown.join(" + ")}${items.length > 4 ? ` 외 ${items.length - 4}개` : ""}` : "받는 혜택이 없어요";
    return { main: `월 ${won(totals[i])}`, strong: i === wT, sub };
  });

  const fees = xs.map((x) => x.view?.annualFee ?? 0);
  const sameFee = fees.every((f) => f === fees[0]);
  const net = xs.map((x, i): CellVM => {
    const c = x.view;
    if (!c) return { main: "—", muted: true };
    return { main: `월 ${won(nets[i])}`, strong: i === wN, sub: sameFee ? null : c.annualFee > 0 ? `연 ${won(c.annualFee)} = 월 ${won(c.feeMonthly)}` : "연회비 없음" };
  });

  return {
    id: "total",
    title: "한도와 합계",
    rows: [
      row("limit", "월 할인 한도", limit),
      row("sum", "내 지출로 합계", sum),
      row("net", "연회비를 빼면", net, { sub: sameFee ? (fees[0] > 0 ? `연 ${won(fees[0])} = 월 ${won(fees[0] / 12)}` : "두 카드 모두 연회비 없음") : null }),
    ],
  };
}

export function tableVM(xs: CmpCardInput[], ctx: CmpCtx): SectionVM[] {
  return [basicSection(xs, ctx), perfSection(xs, ctx), benefitSection(xs, ctx), totalSection(xs)].filter((s): s is SectionVM => !!s);
}

/** '두 카드 같음' / '세 카드 같음' */
export function sameText(n: number): string {
  return `${countWord(n)} 카드 같음`;
}

/* ---------------- 알아 둘 점 ---------------- */

export interface InsightVM {
  id: string;
  tone: "info" | "warn" | "calendar";
  title: string;
  text: string;
}

export interface TightInfo {
  sid: number;
  /** 실적 기준 아래로 내려갔을 때 월 혜택(엔진 계산). 계산 전이면 null */
  lowTotal: number | null;
}

/** 실적 구간 경계에 걸린 카드(여유 10만원 미만). 혜택 요약만 읽은 카드는 실적 조건을 몰라서 뺀다 */
export function tightCard(xs: CmpCardInput[]): { sid: number; threshold: number; room: number; scale: number } | null {
  let best: { sid: number; threshold: number; room: number; scale: number } | null = null;
  for (const x of xs) {
    const c = x.view;
    if (!c || !VERIFIED(c)) continue;
    const cur = tierMinOf(c, c.perf.tier);
    if (!cur || cur <= 0) continue;
    const room = c.perf.q - cur;
    if (room < 0 || room >= 100000) continue;
    // 실적으로 치는 결제(원금 기준)가 기준보다 5천원 낮아지도록 지출 전체를 줄인 배율
    const scale = c.perf.qRaw > 0 ? Math.max(0, (cur - 5000) / c.perf.qRaw) : 0;
    if (!best || room < best.room) best = { sid: x.sid, threshold: cur, room, scale };
  }
  return best;
}

function rowWins(xs: CmpCardInput[], i: number, j: number): { cat: string; diff: number }[] {
  const at = (x: CmpCardInput) => {
    const m = new Map<string, number>();
    for (const b of x.view?.benefits ?? []) if (b.final >= 1) m.set(rowKeyOf(b), (m.get(rowKeyOf(b)) ?? 0) + b.final);
    return m;
  };
  const a = at(xs[i]);
  const b = at(xs[j]);
  const keys = new Set([...a.keys(), ...b.keys()]);
  return Array.from(keys)
    .map((k) => ({ cat: k, diff: (a.get(k) ?? 0) - (b.get(k) ?? 0) }))
    .filter((r) => r.diff >= 1)
    .sort((p, q) => q.diff - p.diff);
}

const catWord = (k: string) => (k === "all" ? "모든 가맹점" : k === "overseas" ? "해외" : catShort(k));

export function insightsVM(xs: CmpCardInput[], tight: TightInfo | null): InsightVM[] {
  const out: InsightVM[] = [];
  const withView = xs.filter((x) => x.view);
  if (withView.length >= 2) {
    const totals = withView.map((x) => Math.round(x.view?.total ?? 0));
    const max = Math.max(...totals);
    const min = Math.min(...totals);
    const wi = totals.indexOf(max);
    const li = totals.indexOf(min);
    const diff = max - min;
    const W = nickOfInput(withView[wi]);
    const L = nickOfInput(withView[li]);
    const nets = withView.map((x) => Math.round(x.view?.net ?? 0));
    const netW = nets.indexOf(Math.max(...nets));
    const flip = netW !== wi && Math.max(...nets) - nets[wi] >= 1 ? ` 다만 연회비를 빼면 ${josa(nickOfInput(withView[netW]), "이/가")} 더 받아요.` : "";
    if (diff < 1) {
      out.push({ id: "diff", tone: "info", title: `${countWord(withView.length)} 카드가 받는 금액이 같아요`, text: `한 장만 쓴다면 어느 카드를 골라도 받는 금액이 같아요. 실적 조건과 한도를 같이 보세요.${flip}` });
    } else if (withView.length === 2 && diff < 3000) {
      out.push({ id: "diff", tone: "info", title: `차이는 월 ${num(diff)}원이에요`, text: `한 장만 쓴다면 어느 카드를 골라도 받는 금액은 비슷해요. 실적 조건과 한도를 같이 보세요.${flip}` });
    } else {
      const wins = rowWins(withView, wi, li).slice(0, 2).map((r) => catWord(r.cat));
      const loses = rowWins(withView, li, wi).slice(0, 2).map((r) => catWord(r.cat));
      const title = withView.length === 2 ? `차이는 월 ${num(diff)}원이에요` : `가장 큰 차이는 월 ${num(diff)}원이에요`;
      let text = wins.length ? `${josa(W, "은/는")} ${joinDot(wins)}에서 더 받아요.` : `${josa(W, "이/가")} 더 받아요.`;
      if (loses.length) text = `${josa(W, "은/는")} ${joinDot(wins)}에서, ${josa(L, "은/는")} ${joinDot(loses)}에서 더 받아요.`;
      if (withView.length > 2) text = `${josa(W, "이/가")} 가장 많이 받고 ${josa(L, "이/가")} 가장 적게 받아요. ${text}`;
      out.push({ id: "diff", tone: "info", title, text: `${text}${flip}` });
    }
  }

  const t = tightCard(xs);
  if (t) {
    const x = xs.find((v) => v.sid === t.sid);
    const c = x?.view;
    if (x && c) {
      const mins = tierMins(c);
      const lower = mins.filter((m) => m < t.threshold).pop();
      const nick = nickOfInput(x);
      const fall = lower ? `${korWon(lower)} 구간으로 내려가요` : "혜택이 끊겨요";
      const low = tight && tight.sid === t.sid && tight.lowTotal !== null ? ` 그러면 월 약 ${num(Math.round(tight.lowTotal / 100) * 100)}원이에요.` : "";
      out.push({
        id: `tight-${t.sid}`,
        tone: "warn",
        title: `${josa(nick, "은/는")} ${korWon(t.threshold)} 구간에 걸려 있어요`,
        text: `실적으로 치는 결제가 기준보다 ${korWonDetail(t.room)} 많아요. 이보다 더 줄면 ${fall}.${low}`,
      });
    }
  }

  for (const x of xs) {
    if (x.view && !VERIFIED(x.view)) {
      out.push({
        id: `auto-${x.sid}`,
        tone: "warn",
        title: `${josa(nickOfInput(x), "은/는")} 혜택 요약만 읽은 카드예요`,
        text: "카드고릴라 혜택 요약을 해석해 계산해서 전월실적 조건과 통합 한도가 빠져 있어요. 실제로 받는 금액은 더 작을 수 있어요.",
      });
    }
  }

  for (const x of xs) {
    const b = (x.view?.benefits ?? []).filter((v) => v.final >= 1 && v.condition).sort((p, q) => q.final - p.final)[0];
    if (!b || !b.condition) continue;
    const cond = b.condition.replace(/\s*\([^)]*\)\s*$/, "").trim();
    out.push({
      id: `cond-${x.sid}`,
      tone: "info",
      title: `${nickOfInput(x)} ${catWord(rowKeyOf(b))} 혜택은 결제 조건이 있어요`,
      text: `${cond}에만 받아요. 조건을 지킨다고 보고 계산했어요.`,
    });
  }
  return out.slice(0, 3);
}

/* ---------------- 다시 짜기 ---------------- */

export interface ActionVM {
  /** 아직 담지 않은 카드(첫 장). 없으면 null */
  target: { sid: number; nick: string } | null;
  label: string;
  text: string;
}

export function actionVM(xs: CmpCardInput[], ctx: CmpCtx): ActionVM {
  const notOwned = xs.find((x) => !ctx.ownedIds.includes(x.sid));
  const target = notOwned ? { sid: notOwned.sid, nick: nickOfInput(notOwned) } : null;
  const w = ctx.wallet;
  if (!target) {
    return {
      target: null,
      label: "내 카드로 지갑 다시 짜기",
      text: `${countWord(xs.length)} 카드 모두 내 카드예요. 지갑을 다시 짜면 지출을 카드마다 나눠 맡겨요.`,
    };
  }
  const label = `${target.nick}까지 넣어서 지갑 다시 짜기`;
  if (w && w.names.length) {
    return {
      target,
      label,
      text: `지금 추천 지갑은 ${w.names.join(" + ")}, 월 약 ${num(Math.round(w.net / 1000) * 1000)}원이에요. ${josa(target.nick, "을/를")} 함께 넣었을 때 얼마나 달라지는지는 새로 계산해야 알 수 있어요.`,
    };
  }
  return { target, label, text: `아직 저장한 지갑이 없어요. ${josa(target.nick, "을/를")} 넣고 계산하면 어떤 카드와 함께 쓰면 좋은지 알려 드려요.` };
}

/** '계산 기준' 문장 */
export function basisText(ctx: CmpCtx): string {
  const total = sumOf(Object.values(ctx.spending));
  const brands = Array.from(new Set(Object.keys(ctx.brandShare).flatMap((cat) => brandsOfCat(cat, ctx.brandShare))));
  return joinSubs([
    total ? `지출 입력 월 ${korAmount(total)}원` : "지출 입력 없음",
    brands.length ? `자주 가는 곳 ${joinDot(brands)}` : "",
    "카드 한 장으로 지출 전부를 결제했다고 보고 계산해요",
    "결제 조건(후불 교통 등)은 지킨다고 봐요",
    "할인은 한도까지만 넣어요",
  ]) as string;
}
