import type { CardViewBenefit, CardViewEntry, TierAmount } from "@/domain/types/cardView";
import { categories } from "@/domain/engine/loadCatalog";
import { catShort, korWonDetail, pctText } from "@/v2/model/text";

/**
 * 전체 카드 화면·카드 상세 창의 혜택 문구(2026-10-30). 원문 정제 혜택 표(card-view.json)를 읽기 쉬운 글로 바꾼다.
 * 계산은 하지 않는다(내 지출로 얼마인지는 엔진이 계산).
 */

const KIND_WORD: Record<string, string> = { discount: "할인", point: "적립", cashback: "캐시백", mileage: "마일리지", donation: "기부", coupon: "쿠폰" };
const PERIOD_WORD: Record<string, string> = { day: "일", month: "월", year: "연", half_year: "반기", card_year: "카드 연도" };
const COUNT_WORD: Record<string, string> = { per_day: "하루", per_month: "월", per_year: "연", per_half_year: "반기" };

export function kindWord(kind: string): string {
  return KIND_WORD[kind] ?? "혜택";
}

/** 1만원 / 5천원 / 1,500원 */
export function wonShort(v: number): string {
  return v >= 1000 && v % 100 === 0 ? korWonDetail(v) : `${Math.round(v).toLocaleString("ko-KR")}원`;
}

function range<T>(xs: T[], text: (x: T) => string, num: (x: T) => number): string {
  if (!xs.length) return "";
  const sorted = [...xs].sort((a, b) => num(a) - num(b));
  const lo = text(sorted[0]);
  const hi = text(sorted[sorted.length - 1]);
  return lo === hi ? lo : `${lo.replace(/(%|원)$/, "")}~${hi}`;
}

/** 혜택 크기: 1.2% / 0.5~2% / 건당 2천원 / 1,500원당 1마일 / 리터당 60원 / 월 5천원 */
export function valueText(b: CardViewBenefit): string {
  const vs = b.v.filter((x) => x.value > 0);
  if (b.ty === "free_item") return "무료 제공";
  if (!vs.length) return "";
  switch (b.ty) {
    case "percent":
      return range(vs, (x) => pctText(x.value), (x) => x.value);
    case "won_per_txn":
      return `건당 ${range(vs, (x) => wonShort(x.value), (x) => x.value)}`;
    case "won_per_liter":
      return `리터당 ${range(vs, (x) => wonShort(x.value), (x) => x.value)}`;
    case "per_unit_spend": {
      const unit = b.unit ? `${b.unit.toLocaleString("ko-KR")}원당 ` : "";
      const word = b.k === "mileage" ? "마일" : "점";
      return `${unit}${range(vs, (x) => `${Number(x.value.toFixed(2))}${word}`, (x) => x.value)}`;
    }
    case "won_per_period":
      return range(vs, (x) => wonShort(x.value), (x) => x.value);
    default:
      return "";
  }
}

function capAmounts(a: TierAmount[]): string {
  return range(a, (x) => wonShort(x.won), (x) => x.won);
}

/** 월 1만원 한도 / 월 1만~3만원 한도(실적 구간별) */
export function capText(b: CardViewBenefit): string {
  const caps = b.caps.filter((c) => c.amounts.length);
  if (!caps.length) return "";
  return caps.map((c) => `${PERIOD_WORD[c.period] ?? ""} ${capAmounts(c.amounts)} 한도`.trim()).join(" · ");
}

/** 하루 1회 · 월 5회 */
export function countText(b: CardViewBenefit): string {
  return Object.entries(b.cnt ?? {})
    .map(([k, n]) => `${COUNT_WORD[k] ?? ""} ${n}회`.trim())
    .join(" · ");
}

/** 혜택 한 줄: '1.2% 할인' / '건당 2천원 캐시백' / '1,500원당 1마일' */
export function rewardText(b: CardViewBenefit): string {
  const v = valueText(b);
  // 원문에 크기가 없거나(예: '월 5만원까지 할인'처럼 이용 한도만 있음) 읽지 못한 혜택
  if (!v) return `${kindWord(b.k)} · 크기는 원문 참고`;
  if (b.ty === "per_unit_spend" || b.ty === "free_item") return v;
  return `${v} ${kindWord(b.k)}`;
}

/** 조건 글자들(한도·횟수·건당 최소·채널·결제 조건) */
export function conditionTexts(b: CardViewBenefit): string[] {
  const out: string[] = [];
  const cap = capText(b);
  if (cap) out.push(cap);
  if (b.perTxn) out.push(`건당 최대 ${wonShort(b.perTxn)}`);
  const cnt = countText(b);
  if (cnt) out.push(cnt);
  if (b.minTxn) out.push(`${wonShort(b.minTxn)} 이상 결제`);
  if (b.ch === "online") out.push("온라인");
  else if (b.ch === "offline") out.push("오프라인");
  if (b.reg === "overseas") out.push("해외");
  if (b.pc) out.push(b.pc);
  return out;
}

/** 카테고리 이름: 앱 카테고리 / 전 가맹점 / 해외 / 그 밖의 업종(앱 카테고리에 없는 곳) */
export function benefitCatName(b: CardViewBenefit): string {
  if (b.reg === "overseas") return "해외";
  if (b.c) return catShort(b.c);
  return b.all ? "전 가맹점" : "그 밖의 업종";
}

const PER_MONTH: Record<string, number> = { day: 30, month: 1, year: 1 / 12, half_year: 1 / 6, card_year: 1 / 12 };
const COUNT_PER_MONTH: Record<string, number> = { per_day: 30, per_month: 1, per_year: 1 / 12, per_half_year: 1 / 6 };

/** 목록 칩 순서용 어림 크기(원/월): 월 10만원 결제 기준, 한도·횟수가 있으면 그만큼으로 줄인다. 계산이 아니라 줄 세우기용이다 */
export function strength(b: CardViewBenefit): number {
  const top = Math.max(0, ...b.v.map((x) => x.value));
  let raw = 0;
  if (b.ty === "percent") raw = top * 100000;
  else if (b.ty === "won_per_txn") raw = top * Math.min(4, ...Object.entries(b.cnt ?? {}).map(([k, n]) => n * (COUNT_PER_MONTH[k] ?? 1)));
  else if (b.ty === "won_per_period") raw = top;
  else if (b.ty === "won_per_liter") raw = top * 50;
  else if (b.ty === "per_unit_spend" && b.unit) raw = (top / b.unit) * 100000 * 15;
  const caps = b.caps.flatMap((c) => c.amounts.map((a) => a.won * (PER_MONTH[c.period] ?? 1)));
  return caps.length ? Math.min(raw, Math.max(...caps)) : raw;
}

/** '전 가맹점'으로 적혔지만 5% 이상인 혜택: 대부분 특정 결제 수단(바코드·간편결제) 조건이라 칩에 '전 가맹점 20%'로 쓰면 오해를 산다.
 *  상세 창에는 조건과 함께 그대로 보여 준다(2026-10-30 기준 152개) */
function broadSuspect(b: CardViewBenefit): boolean {
  return b.ty === "percent" && Math.max(0, ...b.v.map((x) => x.value)) >= 0.05;
}

/** 목록 카드의 혜택 칩: '카페 30%', '주유 리터당 60원' (카테고리마다 가장 큰 것 하나, 최대 max개, first 카테고리 먼저).
 *  계산 제외 혜택과 앱 카테고리 밖 업종 혜택은 빼서 '전 가맹점 30%' 같은 오해를 막는다 */
export function benefitChips(entry: CardViewEntry | undefined, max = 3, first?: string): string[] {
  if (!entry) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  const order = entry.b
    .filter((b) => b.st !== "no_calc" && valueText(b) && (b.c || (b.all && !broadSuspect(b))) && b.reg !== "overseas")
    .map((b, i) => ({ b, i }))
    // first: '혜택으로 찾기'에서 고른 카테고리는 맨 앞에
    .sort((x, y) => Number(y.b.c === first) - Number(x.b.c === first) || strength(y.b) - strength(x.b) || x.i - y.i);
  for (const { b } of order) {
    const cat = benefitCatName(b);
    if (seen.has(cat)) continue;
    seen.add(cat);
    out.push(`${cat} ${valueText(b)}`);
    if (out.length >= max) break;
  }
  return out;
}

/** 실적 조건 한 줄: '전월 30만원 이상' / '전월 30만~100만원 구간별' / '실적 조건 없음' */
export function perfText(entry: CardViewEntry | undefined): string {
  if (!entry) return "";
  const mins = entry.tiers.map((t) => t.min).filter((m) => m > 0);
  if (entry.basis === "none" || (!mins.length && entry.basis !== "unknown")) return "실적 조건 없음";
  if (entry.basis === "unknown" && !mins.length) return "실적 조건 확인 필요";
  const word = entry.basis === "this_month" ? "당월" : "전월";
  const lo = Math.min(...mins);
  const hi = Math.max(...mins);
  return lo === hi ? `${word} ${wonShort(lo)} 이상` : `${word} ${wonShort(lo).replace(/원$/, "")}~${wonShort(hi)} 구간별`;
}

/** 실적 구간 이름: '30만원 이상' / '30만~50만원' */
export function tierText(t: { min: number; max: number | null }): string {
  if (t.min <= 0 && t.max) return `${wonShort(t.max)} 미만`;
  if (t.min <= 0) return "실적 없음";
  return t.max ? `${wonShort(t.min).replace(/원$/, "")}~${wonShort(t.max)}` : `${wonShort(t.min)} 이상`;
}

export interface BenefitGroup {
  key: string;
  name: string;
  items: CardViewBenefit[];
}

/** 상세 창: 앱 카테고리 순서로 묶는다. 전 가맹점·그 밖의 업종은 뒤, 해외는 맨 뒤 */
export function groupBenefits(entry: CardViewEntry): BenefitGroup[] {
  const order = new Map(categories.map((c, i) => [c.id, i]));
  const groups = new Map<string, BenefitGroup>();
  const seen = new Set<string>();
  for (const b of entry.b) {
    const key = b.reg === "overseas" ? "~overseas" : b.c ?? (b.all ? "~all" : "~other");
    // 혜택 표는 한 혜택을 업종·구간별로 나눠 적기도 한다. 화면에서는 같은 글이면 한 번만 보여 준다
    const sig = `${key}|${b.t}|${rewardText(b)}|${conditionTexts(b).join("·")}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    if (!groups.has(key)) groups.set(key, { key, name: benefitCatName(b), items: [] });
    groups.get(key)!.items.push(b);
  }
  const rank = (k: string) => (k === "~overseas" ? 1e6 + 2 : k === "~other" ? 1e6 + 1 : k === "~all" ? 1e6 : order.get(k) ?? 1e5);
  return [...groups.values()].sort((a, b) => rank(a.key) - rank(b.key));
}

/** 혜택 표 출처 설명 */
export function sourceText(entry: CardViewEntry | undefined): string {
  if (!entry) return "혜택 정보 없음";
  if (entry.st === "auto") return "카드고릴라 혜택 요약 한 줄로 만든 표예요. 원문 전체를 읽지 않아 빠진 혜택이 있을 수 있어요.";
  return "카드사 원문 전체를 읽어 정리한 표예요.";
}

/** 검색: 혜택 제목·가맹점에 검색어가 있는 카드('스타벅스'로 스타벅스 혜택 카드 찾기) */
export function matchesBenefit(entry: CardViewEntry | undefined, q: string): boolean {
  return !!matchedBenefit(entry, q);
}

/** 검색어에 걸린 혜택 중 가장 큰 것 */
export function matchedBenefit(entry: CardViewEntry | undefined, q: string): CardViewBenefit | null {
  if (!entry) return null;
  const query = q.toLowerCase().replace(/\s+/g, "");
  if (query.length < 2) return null;
  const hits = entry.b.filter((b) => `${b.t} ${b.m.join(" ")}`.toLowerCase().replace(/\s+/g, "").includes(query));
  return hits.sort((x, y) => strength(y) - strength(x))[0] ?? null;
}

/** 검색으로 찾은 카드의 첫 칩: 혜택 제목(24자까지)과 크기 */
export function matchedChip(entry: CardViewEntry | undefined, q: string): string | null {
  const b = matchedBenefit(entry, q);
  if (!b) return null;
  const title = b.t.length > 24 ? `${b.t.slice(0, 23)}…` : b.t;
  const v = valueText(b);
  return v && !b.t.includes(v) ? `${title} ${v}` : title;
}

/** 연회비 상세 글: 대괄호를 빼고, 모든 금액이 대표 연회비와 같으면 따로 보여 주지 않는다 */
export function feeDetailText(text: string | undefined, fee: number | undefined): string {
  if (!text) return "";
  const clean = text.replace(/\[([\d,]+)\]/g, "$1").trim();
  const nums = (clean.match(/\d[\d,]*/g) ?? []).map((x) => Number(x.replace(/,/g, "")));
  if (!nums.length || nums.every((x) => x === (fee ?? 0))) return "";
  return clean.length <= 60 ? clean : "";
}
