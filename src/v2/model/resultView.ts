import type { BrandShare, EngineCard, EnginePack, TraceBenefit } from "@/domain/types/engine";
import { catalogBySourceId, catalogCards, isUnread } from "@/v1/catalog";
import { annualMan, approxKor, approxWon, korWon, num, won } from "@/v1/format";
import { benefitByCategory, isExact, statusLine } from "@/v1/wallet/model";
import { aliasesOf, canonicalBrand, type BrandPicks } from "@/v2/model/brands";
import type { BarItem } from "@/v2/model/guards";
import { cardNick, cardShort, catShort, countWord, deltaText, josa, joinDot, korAmount, korWonDetail, pctText } from "@/v2/model/text";
import assumptions from "@data/catalog/assumptions.json";

/**
 * 추천 결과·내 지갑 화면에 보이는 값과 문장(2026-10-28 v2).
 * 숫자는 모두 엔진 결과(calc.py 과정 기록)에서 가져오고, 여기서는 고르고 문장으로 만들기만 한다.
 * 화면 컴포넌트는 이 결과를 그대로 그린다(단위 테스트: tests/v2ResultView.test.ts).
 */

export interface ViewCtx {
  spending: Record<string, number>;
  brandShare: BrandShare;
  /** 실적 여유(원) */
  margin: number;
  /** 가진 카드 */
  ownedIds: number[];
  /** 이 조합에서 새로 발급할 카드 */
  newSids?: number[];
  source: "manual" | "statement";
  /** 자주 가는 곳에서 고른 브랜드(직접 입력 경로) */
  picks?: BrandPicks;
  /** 명세서에서 읽은 브랜드 금액(명세서 경로) */
  statementBrands?: Record<string, Record<string, number>>;
}

const TIGHT_ROOM = 5000;
const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();

/* ---------------- 카드 한 장 ---------------- */

/** 문장 속 카드 이름 */
export function nickOf(card: Pick<EngineCard, "sid" | "name">): string {
  return cardNick(catalogBySourceId.get(card.sid)?.name ?? card.name);
}

/** 카드 제목에 쓰는 짧은 이름 */
export function shortOf(card: Pick<EngineCard, "sid" | "name">): string {
  return cardShort(catalogBySourceId.get(card.sid)?.name ?? card.name);
}

function gotBenefits(card: EngineCard): TraceBenefit[] {
  return card.benefits.filter((b) => b.final >= 1).sort((a, b) => b.final - a.final);
}

function bindingShared(b: TraceBenefit, card: EngineCard) {
  const ids = b.sharedIds;
  if (ids && ids.length) return card.shared.find((s) => ids.includes(s.id) && s.factor < 0.999) ?? null;
  // sharedIds가 없는 이전 결과: 묶음 한도가 걸려 이 혜택이 줄었으면 그 한도로 본다
  if (!ids && b.final < b.afterOwn - 1) return card.shared.find((s) => s.factor < 0.999) ?? null;
  return null;
}

function isCapped(b: TraceBenefit, card: EngineCard): boolean {
  return b.caps.some((c) => c.hit) || !!bindingShared(b, card);
}

function sharedName(label: string): string {
  if (/자동\s*맞춤/.test(label)) return "자동맞춤 한도";
  if (/통합/.test(label)) return "통합 한도";
  return "묶음 한도";
}

/** 혜택이 붙는 브랜드 이름. 고른 브랜드(또는 명세서 브랜드)와 겹치는 것만, 추정이면 앞의 두 곳 */
export function benefitBrands(b: TraceBenefit, share: BrandShare): string[] {
  if (b.specificity !== "brand" && b.specificity !== "merchant_group") return [];
  const names = Array.from(new Set(b.merchants.map(canonicalBrand)));
  const s = b.category ? share[b.category] : undefined;
  if (s && Object.keys(s).length) {
    const picked = new Set(Object.entries(s).filter(([, v]) => v > 0).map(([k]) => norm(k)));
    const hit = names.filter((nm) => aliasesOf(nm).some((a) => picked.has(norm(a))) || picked.has(norm(nm)));
    if (hit.length) return hit;
  }
  return names;
}

function brandText(list: string[], max = 2): string {
  if (!list.length) return "";
  const two = joinDot(list.slice(0, max));
  // 브랜드 이름이 길면(외식 체인 묶음 등) 첫 곳만 쓰고 '등'
  if (two.length > 12 && list.length > 1) return `${list[0]} 등`;
  return list.length <= max ? two : `${two} 등`;
}

const KIND_SUFFIX: Record<string, string> = { point: " 적립", cashback: " 캐시백", mileage: " 마일리지" };

function rateText(b: TraceBenefit): string {
  const v = b.value ?? 0;
  const suffix = KIND_SUFFIX[b.kind] ?? "";
  switch (b.type) {
    case "percent":
      return `${pctText(v)}${suffix}`;
    case "won_per_liter":
      return `리터당 ${num(v)}원${suffix}`;
    case "won_per_txn":
      return `건당 ${num(v)}원${suffix}`;
    case "free_item":
      return "무료 제공";
    case "won_per_period":
      return "정액 혜택";
    default:
      return suffix.trim() || "적립";
  }
}

export interface BenefitRowVM {
  id: string;
  cat: string;
  label: string;
  sub: string;
  amount: number;
  amountText: string;
}

/** 혜택 한 줄: '카페 · 스타벅스' / '2만 4천원 × 50% · 묶음 한도 1만원' / '10,000원' */
export function benefitRow(b: TraceBenefit, card: EngineCard, share: BrandShare): BenefitRowVM {
  const cat = b.category ?? "etc";
  const brands = brandText(benefitBrands(b, share));
  const label = b.category ? `${catShort(b.category)}${brands ? ` · ${brands}` : ""}` : "모든 가맹점";
  const target = b.cats.reduce((s, c) => s + c.target, 0);
  const rate = rateText(b);
  const head = b.type === "percent" ? `${korWonDetail(target)} × ${rate}` : `${korWonDetail(target)} · ${rate}`;
  const sh = bindingShared(b, card);
  const cap = b.caps.some((c) => c.hit) ? "한도까지" : sh ? `${sharedName(sh.label)} ${korWon(sh.cap)}` : null;
  // 한도에 걸린 혜택은 원 단위 확정, 아니면 '약' + 백 원 단위(1천원 미만은 그대로)
  const exact = !!cap || b.final < 1000;
  return { id: b.id, cat, label, sub: cap ? `${head} · ${cap}` : head, amount: b.final, amountText: exact ? won(b.final) : `약 ${num(Math.round(b.final / 100) * 100)}원` };
}

/** 카드사 앱에서 골라야 하는 패키지(자동 적용이면 null) */
export function packageChoice(card: EngineCard): string | null {
  if (!card.options.length || card.choiceAll.length <= 1) return null;
  const groups = card.choiceGroups;
  if (groups && groups.length && groups.every((g) => g.auto)) return null;
  return card.options.map((o) => o.label).join(" + ");
}

function withRo(label: string): string {
  return josa(label, "으로/로").slice(label.length);
}

/** 카드사가 자동으로 정하는 선택형 혜택 설명 */
function autoChoiceNote(card: EngineCard): string | null {
  const g = card.choiceGroups?.find((x) => x.auto);
  if (!g || !card.options.length) return null;
  const m = g.label.match(/^(.*?)\s*\((.+)\)\s*$/);
  if (m) return `${josa(m[1], "은/는")} ${m[2]}에 자동으로 붙어요`;
  return `${josa(g.label, "은/는")} 카드사가 이용금액을 보고 매달 자동으로 정해요`;
}

/** 카드 금액: 모두 한도에 걸려 확정이면 원 단위, 아니면 '약' + 백 원 단위 */
export function cardAmountText(card: EngineCard): string {
  if (isUnread(card.sid)) return "혜택 정보 없음";
  return isExact(card) ? won(card.total) : `약 ${num(Math.round(card.total / 100) * 100)}원`;
}

export function cardMeta(card: EngineCard): string {
  const fee = card.annualFee > 0 ? `연회비 ${won(card.annualFee)}` : "연회비 없음";
  const t = card.perf.threshold;
  // 혜택 요약만 읽은 카드(auto)는 실적 조건을 모른다(요약에 없음)
  const perf = t && t > 0 ? `실적 ${korWon(t)} 이상` : card.status === "auto" ? "실적 조건 확인 전" : "실적 조건 없음";
  return [card.issuer, fee, perf].filter(Boolean).join(" · ");
}

export interface RoleCardVM {
  sid: number;
  short: string;
  nick: string;
  isNew: boolean;
  meta: string;
  amountText: string;
  rows: BenefitRowVM[];
  note: string | null;
  status: string | null;
  url: string | undefined;
}

/** '카드 N장이 맡는 일'의 카드 한 장 */
export function roleCard(card: EngineCard, ctx: ViewCtx, maxRows = 4): RoleCardVM {
  const got = gotBenefits(card);
  let rows = got.map((b) => benefitRow(b, card, ctx.brandShare));
  if (rows.length > maxRows) {
    const rest = rows.slice(maxRows - 1);
    const sum = rest.reduce((s, r) => s + r.amount, 0);
    const restCats = Array.from(new Set(rest.map((r) => r.label.split(" · ")[0])));
    rows = [
      ...rows.slice(0, maxRows - 1),
      { id: "rest", cat: "other", label: `그 밖의 혜택 ${rest.length}개`, sub: `${joinDot(restCats.slice(0, 3))} 혜택을 합친 금액`, amount: sum, amountText: `약 ${num(Math.round(sum / 100) * 100)}원` },
    ];
  }
  const pkg = packageChoice(card);
  let note: string | null = null;
  if (pkg) note = `카드사 앱에서 패키지를 ‘${pkg}’${withRo(pkg)} 바꿔야 받아요`;
  else note = autoChoiceNote(card);
  if (!note && got.length && got.every((b) => isCapped(b, card)))
    note = got.length === 1 ? "이 혜택은 월 한도까지 받아요" : `${countWord(got.length)} 혜택 모두 월 한도까지 받아요`;
  if (!note && !got.length) note = "이 조합에서는 혜택보다 실적을 채우는 데 쓰여요";
  return {
    sid: card.sid,
    short: shortOf(card),
    nick: nickOf(card),
    isNew: !!ctx.newSids?.includes(card.sid),
    meta: cardMeta(card),
    amountText: cardAmountText(card),
    rows,
    note,
    status: statusLine(card),
    url: card.url,
  };
}

/* ---------------- 이렇게 쓰세요 ---------------- */

interface Part {
  card: EngineCard;
  nick: string;
  amount: number;
  benefit: number;
}

export interface GuideRowVM {
  key: string;
  /** 아이콘 카테고리('other'면 그 밖의 지출) */
  cat: string;
  title: string;
  spend: number;
  text: string;
  /** 오른쪽 카드 표시 */
  badge: { sids: number[]; label: string };
}

function partsOf(pack: EnginePack, cat: string, byCard: Map<number, Record<string, number>>): Part[] {
  return pack.cards
    .filter((c) => (c.alloc[cat] ?? 0) > 0)
    .map((c) => ({ card: c, nick: nickOf(c), amount: c.alloc[cat], benefit: byCard.get(c.sid)?.[cat] ?? 0 }))
    .sort((a, b) => b.benefit - a.benefit || b.amount - a.amount);
}

interface BrandSeg {
  sid: number;
  nick: string;
  brands: string[];
  /** 한도까지 채우는 데 필요한 결제액(한도가 없거나 계산할 수 없으면 null) */
  capSpend: number | null;
  final: number;
}

function capSpendOf(b: TraceBenefit, card: EngineCard): number | null {
  if (!isCapped(b, card) || b.type !== "percent" || !b.value || b.kind === "mileage") return null;
  const target = b.cats.reduce((s, c) => s + c.target, 0);
  const need = b.final / b.value;
  return need < target - 1 ? Math.round(need / 1000) * 1000 || Math.round(need) : null;
}

function brandSegs(parts: Part[], cat: string, share: BrandShare): BrandSeg[] {
  const segs: BrandSeg[] = [];
  for (const p of parts) {
    const bs = p.card.benefits.filter((b) => b.final >= 1 && b.category === cat && (b.specificity === "brand" || b.specificity === "merchant_group"));
    if (!bs.length) continue;
    const brands = Array.from(new Set(bs.flatMap((b) => benefitBrands(b, share))));
    const caps = bs.map((b) => capSpendOf(b, p.card));
    const capSpend = caps.every((c) => c !== null) ? caps.reduce<number>((s, c) => s + (c ?? 0), 0) : null;
    segs.push({ sid: p.card.sid, nick: p.nick, brands, capSpend, final: bs.reduce((s, b) => s + b.final, 0) });
  }
  // 한도가 먼저 차는 카드부터, 한도 없는 카드는 마지막
  return segs.sort((a, b) => (a.capSpend === null ? 1 : 0) - (b.capSpend === null ? 1 : 0) || (a.capSpend ?? 0) - (b.capSpend ?? 0) || a.final - b.final);
}

function rowText(cat: string, parts: Part[], share: BrandShare): string {
  const top = parts[0];
  const segs = brandSegs(parts, cat, share);
  const hasCatLevel = parts.some((p) =>
    p.card.benefits.some((b) => b.final >= 1 && b.category === cat && b.specificity !== "brand" && b.specificity !== "merchant_group"),
  );
  if (parts.length === 1) {
    if (cat === "transport") return `${josa(top.nick, "을/를")} 후불교통 카드로 등록해 두세요`;
    if (cat === "mobile") return `${josa(top.nick, "으로/로")} 통신비 자동납부를 걸어 두세요`;
    if (segs.length && !hasCatLevel) return `${josa(brandText(segs[0].brands), "은/는")} ${josa(top.nick, "으로/로")} 결제해요`;
    return `모두 ${josa(top.nick, "으로/로")} 결제해요`;
  }
  if (segs.length && !hasCatLevel) {
    const head = (s: BrandSeg) => (s.capSpend ? `${brandText(s.brands)} ${korWonDetail(s.capSpend)}까지 ${s.nick}` : `${josa(brandText(s.brands), "은/는")} ${s.nick}`);
    if (segs.length === 1) {
      const s = segs[0];
      const rest = parts.filter((p) => p.card.sid !== s.sid).sort((a, b) => b.amount - a.amount)[0];
      return `${head(s)}, 나머지 ${catShort(cat)} 결제는 ${josa(rest.nick, "으로/로")}`;
    }
    const out = segs.slice(0, -1).map(head);
    const last = segs[segs.length - 1];
    const seen = new Set(segs.slice(0, -1).flatMap((s) => s.brands));
    const overlap = last.brands.some((b) => seen.has(b));
    out.push(`${overlap ? "나머지 " : ""}${josa(brandText(last.brands), "은/는")} ${josa(last.nick, "으로/로")}`);
    return out.join(", ");
  }
  if (parts.length === 2) {
    const [a, b] = parts;
    const tail = b.benefit < 50 ? `${b.nick} 실적용으로` : josa(b.nick, "으로/로");
    return `${josa(a.nick, "으로/로")} ${korWon(a.amount)}, 나머지 ${josa(korWon(b.amount), "은/는")} ${tail}`;
  }
  return `${parts.map((p) => `${p.nick} ${korWon(p.amount)}`).join(", ")}${withRo(korWon(parts[parts.length - 1].amount))} 나눠 결제해요`;
}

function otherText(cats: string[], pack: EnginePack, byCard: Map<number, Record<string, number>>, spending: Record<string, number>): { text: string; sids: number[] } {
  const groups = new Map<number, { nick: string; labels: string[] }>();
  const head: string[] = [];
  const tail: string[] = [];
  const sids = new Set<number>();
  let mobileNick: string | null = null;
  for (const cat of cats) {
    const parts = partsOf(pack, cat, byCard).sort((a, b) => b.amount - a.amount);
    if (!parts.length) continue;
    const spend = spending[cat] ?? parts.reduce((s, p) => s + p.amount, 0);
    const second = parts[1];
    // 오른쪽 표시는 문장에 나오는 카드만(작은 몫은 문장에서 빠지므로 표시도 뺀다)
    sids.add(parts[0].card.sid);
    if (second && second.amount / spend >= 0.35) {
      sids.add(second.card.sid);
      tail.push(`${josa(catShort(cat), "은/는")} ${second.amount / spend >= 0.4 ? "반씩" : "나눠서"}`);
    } else if (cat === "mobile") {
      head.push(`통신비는 ${parts[0].nick} 자동납부`);
      mobileNick = parts[0].nick;
    } else {
      const g = groups.get(parts[0].card.sid) ?? { nick: parts[0].nick, labels: [] };
      g.labels.push(catShort(cat));
      groups.set(parts[0].card.sid, g);
    }
  }
  // 모두 한 카드로 내면 카드 이름을 되풀이하지 않는다: '모두 TEN으로 결제하고, 통신비는 자동납부로 걸어 두세요'(2026-10-29)
  const nLabels = Array.from(groups.values()).reduce((n, g) => n + g.labels.length, 0) + (mobileNick ? 1 : 0);
  if (sids.size === 1 && !tail.length && nLabels > 1) {
    const nick = Array.from(groups.values())[0]?.nick ?? mobileNick!;
    return { text: mobileNick ? `모두 ${josa(nick, "으로/로")} 결제하고, 통신비는 자동납부로 걸어 두세요` : `모두 ${josa(nick, "으로/로")} 결제해요`, sids: Array.from(sids) };
  }
  const mid = Array.from(groups.values()).map((g) => `${josa(joinDot(g.labels), "은/는")} ${g.nick}`);
  return { text: [...head, ...mid, ...tail].join(", "), sids: Array.from(sids) };
}

/** '이렇게 쓰세요': 혜택이 1천원 이상 붙는 카테고리는 한 줄씩, 나머지는 '그 밖의 지출'로 */
export function guideRows(pack: EnginePack, spending: Record<string, number>, share: BrandShare, maxRows = 5): GuideRowVM[] {
  const byCard = new Map(pack.cards.map((c) => [c.sid, benefitByCategory(c)]));
  const cats = Object.entries(spending)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([c]) => c);
  const own: GuideRowVM[] = [];
  const rest: string[] = [];
  for (const cat of cats) {
    const parts = partsOf(pack, cat, byCard);
    const benefit = parts.reduce((s, p) => s + p.benefit, 0);
    if (!parts.length) continue;
    if (benefit < 1000 || own.length >= maxRows) {
      rest.push(cat);
      continue;
    }
    own.push({
      key: cat,
      cat,
      title: catShort(cat) === "카페" ? "카페·디저트" : catShort(cat),
      spend: spending[cat],
      text: rowText(cat, parts, share),
      badge: { sids: [parts[0].card.sid], label: parts[0].nick },
    });
  }
  if (rest.length) {
    const o = otherText(rest, pack, byCard, spending);
    const spend = rest.reduce((s, c) => s + (spending[c] ?? 0), 0);
    const one = o.sids.length === 1 ? pack.cards.find((c) => c.sid === o.sids[0]) : null;
    own.push({
      key: "other",
      cat: "other",
      title: own.length ? "그 밖의 지출" : "모든 지출",
      spend,
      text: o.text,
      badge: { sids: o.sids, label: one ? nickOf(one) : "나눠서" },
    });
  }
  return own;
}

/* ---------------- 할 일 ---------------- */

export interface TodoVM {
  id: string;
  text: string;
}

/** 카드사 앱에서 할 일: 새 카드 발급, 패키지 바꾸기, 후불교통 등록, 통신비 자동납부(혜택이 붙을 때) */
export function todoList(pack: EnginePack, newSids: number[] = []): TodoVM[] {
  const out: TodoVM[] = [];
  for (const sid of newSids) {
    const c = pack.cards.find((x) => x.sid === sid);
    if (c) out.push({ id: `issue-${sid}`, text: `${shortOf(c)} 발급 신청하기` });
  }
  for (const c of pack.cards) {
    const pkg = packageChoice(c);
    if (pkg) out.push({ id: `pkg-${c.sid}`, text: `${nickOf(c)} 패키지를 ‘${pkg}’${withRo(pkg)} 바꾸기` });
  }
  const byCard = new Map(pack.cards.map((c) => [c.sid, benefitByCategory(c)]));
  const topFor = (cat: string) =>
    pack.cards
      .filter((c) => (byCard.get(c.sid)?.[cat] ?? 0) >= 1 && (c.alloc[cat] ?? 0) > 0)
      .sort((a, b) => (byCard.get(b.sid)?.[cat] ?? 0) - (byCard.get(a.sid)?.[cat] ?? 0))[0];
  const bus = topFor("transport");
  if (bus) out.push({ id: `bus-${bus.sid}`, text: `${josa(nickOf(bus), "을/를")} 후불교통 카드로 등록하기` });
  const tel = topFor("mobile");
  if (tel) out.push({ id: `tel-${tel.sid}`, text: `${josa(nickOf(tel), "으로/로")} 통신비 자동납부 걸기` });
  return out;
}

/* ---------------- 히어로 ---------------- */

export interface TileVM {
  label: string;
  value: string;
  names: string;
  sids: number[];
  highlight: boolean;
}

export interface HeroVM {
  eyebrow: string;
  title: string;
  /** 천 원 단위로 반올림한 순혜택 */
  amount: number;
  lead: string;
  sids: number[];
  tiles: TileVM[] | null;
  /** 새 카드를 더해도 가진 카드 조합이 낫다는 안내 */
  notice: string | null;
}

function namesOf(pack: EnginePack, sids: number[]): string {
  return sids.map((s) => pack.cards.find((c) => c.sid === s) ?? { sid: s, name: catalogBySourceId.get(s)?.name ?? String(s) }).map((c) => shortOf(c)).join(" + ");
}

function nameOfSid(sid: number): Pick<EngineCard, "sid" | "name"> {
  return { sid, name: catalogBySourceId.get(sid)?.name ?? String(sid) };
}

export interface HeroInput {
  pack: EnginePack;
  bar: BarItem[];
  flow: "own" | "new";
  noMargin?: boolean;
  ownedCount: number;
  newSids: number[];
  /** 새 카드 흐름: 가진 카드만 쓸 때 조합 */
  ownedOnly: EnginePack | null;
  keptOwned?: boolean;
  /** 새 카드 흐름: 꼭 넣을 카드(카드 비교에서 고른 카드) */
  pinned?: number[];
  /** 지갑 화면은 '연회비를 뺀 금액이에요' */
  place?: "result" | "wallet";
}

export function heroVM(h: HeroInput): HeroVM {
  const { pack } = h;
  const k = pack.cards.length;
  const nNew = h.newSids.length;
  const net = pack.net;
  const single = h.bar.find((b) => b.k === 1) ?? null;
  const vsOwned = h.flow === "new" && !h.keptOwned && nNew > 0 && h.ownedOnly && h.ownedOnly.cards.length > 0 ? h.ownedOnly : null;

  let eyebrow: string;
  let title: string;
  if (h.place === "wallet") {
    eyebrow = `저장한 조합 · 카드 ${k}장`;
    title = "이번 달 예상 순혜택";
  } else {
    const pre = h.noMargin ? "실적 여유 없이 다시 계산" : "추천 조합";
    if (nNew > 0) {
      const ownedIn = k - nNew;
      eyebrow = ownedIn > 0 ? `${pre} · 새 카드 ${nNew}장 + 가진 카드 ${ownedIn}장` : `${pre} · 새 카드 ${nNew}장`;
      title = ownedIn > 0 ? `새 카드 ${nNew}장을 더하면 매달 받는 혜택` : `카드 ${k}장으로 매달 받는 혜택`;
    } else {
      eyebrow = h.ownedCount > 0 ? `${pre} · 가진 카드 ${h.ownedCount}장 중 ${k}장` : `${pre} · 카드 ${k}장`;
      title = `카드 ${k}장으로 매달 받는 혜택`;
    }
  }

  const base = h.place === "wallet" ? "연회비를 뺀 금액이에요" : "연회비를 뺀 순혜택이에요";
  let lead = `${base}. 1년이면 ${annualMan(net)}`;
  // 차액은 화면에 보이는 천 원 단위 값끼리 뺀다(타일 25,000원·33,000원이면 '8천원', 2026-10-29)
  const k1 = (n: number) => Math.round(n / 1000) * 1000;
  const dOwned = vsOwned ? k1(net) - k1(vsOwned.net) : 0;
  const dSingle = single ? k1(net) - k1(single.net) : 0;
  if (vsOwned && dOwned >= 1000) lead += `, 가진 카드만 쓸 때보다 월 ${approxKor(dOwned)} 더 받아요.`;
  else if (!vsOwned && k > 1 && single && dSingle >= 1000) lead += `, 1장만 쓸 때보다 월 ${approxKor(dSingle)} 더 받아요.`;
  else lead += "이에요.";

  let tiles: TileVM[] | null = null;
  if (h.place !== "wallet") {
    if (vsOwned) {
      tiles = [
        { label: "가진 카드만 쓸 때", value: `월 ${approxWon(vsOwned.net)}`, names: namesOf(vsOwned, vsOwned.sids), sids: vsOwned.sids, highlight: false },
        { label: "새 카드를 더하면", value: `월 ${approxWon(net)}`, names: namesOf(pack, pack.sids), sids: pack.sids, highlight: true },
      ];
    } else if (k > 1 && single?.sids?.length) {
      const sNick = nickOf(nameOfSid(single.sids[0]));
      tiles = [
        { label: "1장만 쓸 때", value: `월 ${approxWon(single.net)}`, names: `${sNick} 한 장`, sids: single.sids, highlight: false },
        { label: `${k}장을 같이 쓰면`, value: `월 ${approxWon(net)}`, names: namesOf(pack, pack.sids), sids: pack.sids, highlight: true },
      ];
    }
  }
  const notice = h.flow === "new" ? pinnedNotice(h) ?? (h.keptOwned ? "새 카드를 더해도 지금 가진 카드 조합이 가장 유리해요" : null) : null;
  return { eyebrow, title, amount: Math.max(0, Math.round(net / 1000) * 1000), lead, sids: pack.sids, tiles, notice };
}

/** 꼭 넣을 카드 안내: 'TEN을 꼭 넣고 계산했어요. 가진 카드만 쓸 때보다 월 약 2천원 적어요' */
function pinnedNotice(h: HeroInput): string | null {
  const pinned = h.pinned ?? [];
  if (!pinned.length) return null;
  const nick = joinDot(pinned.map((s) => nickOf(nameOfSid(s))));
  const inPack = pinned.filter((s) => h.pack.sids.includes(s));
  if (inPack.length < pinned.length) return `${josa(nick, "을/를")} 넣어도 맡길 지출이 없어서 빼고 계산했어요`;
  const own = h.ownedOnly;
  const gap = own && own.cards.length ? own.net - h.pack.net : 0;
  if (gap >= 500) return `${josa(nick, "을/를")} 꼭 넣고 계산했어요. 가진 카드만 쓸 때보다 월 ${approxKor(gap)} 적어요`;
  return `${josa(nick, "을/를")} 꼭 넣고 계산했어요`;
}

/* ---------------- 더 자세히 ---------------- */

export interface PerfCardVM {
  sid: number;
  nick: string;
  short: string;
  q: number;
  threshold: number | null;
  room: number | null;
  tight: boolean;
  /** 혜택 요약만 읽은 카드: 실적 조건을 모른다 */
  unknown?: boolean;
}

export function perfCards(pack: EnginePack): PerfCardVM[] {
  return pack.cards.map((c) => {
    const t = c.perf.threshold && c.perf.threshold > 0 ? c.perf.threshold : null;
    const room = t === null ? null : c.perf.q - t;
    return { sid: c.sid, nick: nickOf(c), short: shortOf(c), q: c.perf.q, threshold: t, room, tight: room !== null && room < TIGHT_ROOM, unknown: t === null && c.status === "auto" };
  });
}

/** 할인받아 실적에서 빠진 금액(카드 전체 규칙이든 혜택별 '실적 제외'든 계산 결과로 본다) */
function removedFromPerf(card: EngineCard): number {
  return Math.max(0, (card.perf.qRaw ?? 0) - card.perf.q);
}

/**
 * 할인받아 실적에서 빠진 결제의 대표 카테고리.
 * 빠진 금액과 가장 가까운(넘지 않는) 혜택 카테고리를 고른다. 예: iD ON 통신비 14만원
 */
function discountedCat(card: EngineCard): { cat: string; amount: number } | null {
  const removed = removedFromPerf(card);
  if (removed < 1) return null;
  const by = benefitByCategory(card);
  const cats = Object.entries(card.alloc)
    .filter(([c]) => (by[c] ?? 0) >= 1 && !card.perf.excluded.includes(c))
    .sort((a, b) => b[1] - a[1]);
  if (!cats.length) return null;
  const fit = cats.filter(([, v]) => v <= removed + 1)[0] ?? cats[cats.length - 1];
  return { cat: fit[0], amount: Math.min(fit[1], removed) };
}

export interface PerfVM {
  summary: string;
  lines: string[];
  cards: PerfCardVM[];
}

/** 전월실적 충족 확인 */
export function perfVM(pack: EnginePack): PerfVM {
  const cards = perfCards(pack);
  const withT = cards.filter((c) => c.threshold !== null);
  const sameT = withT.length > 0 && withT.every((c) => c.threshold === withT[0].threshold);
  const who = withT.length === 1 ? josa(withT[0].nick, "은/는") : `${countWord(withT.length)} 카드 모두`;
  const short = withT.filter((c) => (c.room ?? 0) < -1);
  const tight = withT.filter((c) => c.tight);
  let summary: string;
  if (!withT.length) summary = cards.some((c) => c.unknown) ? "실적 조건을 아직 모르는 카드예요" : "실적 조건이 없는 카드예요";
  else if (short.length) summary = `${josa(short[0].nick, "은/는")} 실적이 모자라요`;
  else if (tight.length === withT.length)
    summary = sameT ? `${who} 실적 ${josa(korWon(withT[0].threshold!), "을/를")} 겨우 채워요` : `${who} 실적 기준을 겨우 채워요`;
  else if (tight.length) summary = `${josa(tight[0].nick, "은/는")} 실적 기준에 딱 맞아요`;
  else summary = sameT ? `${who} 실적 ${josa(korWon(withT[0].threshold!), "을/를")} 넘겨요` : `${who} 실적 기준을 넘겨요`;

  const lines: string[] = [];
  lines.push(
    `${cards.map((c) => (c.threshold === null ? `${c.short} 실적 조건 ${c.unknown ? "확인 전" : "없음"}` : `${c.short} 실적 ${korWon(c.q)} (여유 ${korWon(Math.max(0, c.room ?? 0))})`)).join(" · ")}.`,
  );
  const tightCard = [...tight].sort((a, b) => (a.room ?? 0) - (b.room ?? 0))[0];
  const tc = tightCard ? pack.cards.find((c) => c.sid === tightCard.sid) : undefined;
  const dc = tc ? discountedCat(tc) : null;
  if (tc && dc) {
    lines.push(
      `${josa(tightCard.nick, "은/는")} 할인받은 ${catShort(dc.cat)} ${josa(korWon(dc.amount), "이/가")} 실적에서 빠져서 기준에 딱 맞아요. 한 달만 덜 써도 다음 달 ${tightCard.nick} 혜택이 끊길 수 있어요.`,
    );
  } else if (pack.cards.some((c) => removedFromPerf(c) >= 1)) {
    const byCard = new Map(pack.cards.map((c) => [c.sid, benefitByCategory(c)]));
    let best: { nick: string; cat: string; amount: number } | null = null;
    for (const c of pack.cards)
      for (const [cat, v] of Object.entries(c.alloc))
        if (v >= 30000 && (byCard.get(c.sid)?.[cat] ?? 0) < 50 && !c.perf.excluded.includes(cat) && (!best || v > best.amount))
          best = { nick: nickOf(c), cat, amount: v };
    lines.push(
      `할인받은 결제는 실적에서 빠져요.${best ? ` 그래서 ${catShort(best.cat)} ${josa(korWon(best.amount), "은/는")} 할인 대신 ${best.nick} 실적용으로 걸었어요.` : ""}`,
    );
  }
  return { summary, lines, cards };
}

export interface BarVM {
  summary: string;
  parts: { k: number; text: string; strong: boolean }[];
  note: string | null;
}

/** 카드를 몇 장 쓸까요? (막대는 monotoneBar로 맞춘 값) */
export function barVM(bar: BarItem[], pack: EnginePack): BarVM {
  const k = pack.cards.length;
  const parts: BarVM["parts"] = [];
  let sameFrom: number | null = null;
  for (const b of bar) {
    if (b.k < k) {
      const nicks = (b.sids ?? []).map((s) => nickOf(nameOfSid(s)));
      const who = nicks.length ? `(${joinDot(nicks)}${nicks.length === 1 ? "만" : ""})` : "";
      parts.push({ k: b.k, text: `${b.k}장${who} 월 ${approxKor(b.net)}`, strong: false });
    } else if (b.k === k) {
      parts.push({ k: b.k, text: `${b.k}장 월 ${approxKor(pack.net)}`, strong: true });
    } else if (b.same && Math.abs(b.net - pack.net) < 5) {
      sameFrom = sameFrom ?? b.k;
    } else {
      parts.push({ k: b.k, text: `${b.k}장 ${deltaText(b.net - pack.net)}`, strong: false });
    }
  }
  if (sameFrom !== null) parts.push({ k: sameFrom, text: `${sameFrom}장 이상은 같은 조합`, strong: false });
  const note = sameFrom !== null ? `${sameFrom}장부터는 카드를 더 넣어도 혜택이 늘지 않아요.` : null;
  return { summary: `${k}장이 가장 효율적이에요`, parts, note };
}

const ASSUME = assumptions as { avg_ticket_won: Record<string, number | string>; eligible_share_by_specificity: Record<string, number | string> };
const AVG = ASSUME.avg_ticket_won;

/** 카드고릴라에서 혜택 정보를 모은 날(가장 많은 카드의 수집일): '9월 17일' */
export const CATALOG_DATE_TEXT: string = (() => {
  const count = new Map<string, number>();
  for (const c of catalogCards) {
    const d = (c.fetchedAt ?? "").slice(0, 10);
    if (d) count.set(d, (count.get(d) ?? 0) + 1);
  }
  const top = Array.from(count.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!top) return "";
  const [, m, d] = top.split("-").map(Number);
  return `${m}월 ${d}일`;
})();
/** 자주 가는 곳을 고르지 않았을 때 계산기 가정값: 브랜드 한 곳 혜택 35%, 여러 브랜드 묶음 혜택 70% */
const DEFAULT_SHARE = { brand: Number(ASSUME.eligible_share_by_specificity.brand), group: Number(ASSUME.eligible_share_by_specificity.merchant_group) };

function ticketText(v: number): string {
  return v % 1000 === 0 ? korWon(v) : won(v);
}

export interface UsedVM {
  user: string;
  assumed: string;
}

/** 계산에 쓴 값: 내가 넣은 값과 가정한 값 */
export function usedValuesVM(pack: EnginePack, ctx: ViewCtx): UsedVM {
  const user: string[] = [];
  if (ctx.source === "statement" && ctx.statementBrands) {
    let count = 0;
    for (const [cat, brands] of Object.entries(ctx.statementBrands)) {
      const list = Object.entries(brands).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
      count += list.length;
      if (!list.length || !(ctx.spending[cat] > 0) || user.length >= 3) continue;
      user.push(`${catShort(cat)} ${korWon(ctx.spending[cat])} 중 ${list.slice(0, 2).map(([b, v]) => `${b} ${korAmount(v)}`).join(" · ")}`);
    }
    if (count) user.push(`브랜드 ${count}곳`);
  } else if (ctx.picks) {
    for (const [cat, p] of Object.entries(ctx.picks)) {
      if (!(ctx.spending[cat] > 0)) continue;
      if (p.none) user.push(`${josa(catShort(cat), "은/는")} 자주 가는 곳 없음`);
      else if (p.brands.length) user.push(`${catShort(cat)} ${korWon(ctx.spending[cat])} 중 ${joinDot(p.brands)}(고른 곳 합쳐 70%)`);
    }
  }
  user.push(ctx.margin > 0 ? `실적 여유 ${korWon(ctx.margin)}` : "실적 여유 없음");

  const assumed: string[] = [];
  const estBrand = new Set<string>();
  const estGroup = new Set<string>();
  const benefitCats = new Set<string>();
  let usesPoint = false;
  let payCond = false;
  for (const c of pack.cards) {
    for (const b of c.benefits) {
      if (b.final < 1) continue;
      if (b.category) benefitCats.add(b.category);
      if (b.kind === "point") usesPoint = true;
      if (b.category && !(b.category in ctx.brandShare)) {
        if (b.specificity === "brand") estBrand.add(b.category);
        if (b.specificity === "merchant_group") estGroup.add(b.category);
      }
    }
    if (c.flags.some((f) => f.includes("결제 조건"))) payCond = true;
  }
  const est = Array.from(new Set([...estBrand, ...estGroup]));
  if (est.length) {
    const who = josa(joinDot(est.map(catShort)), "은/는");
    const b = pctText(DEFAULT_SHARE.brand);
    const g = pctText(DEFAULT_SHARE.group);
    if (estBrand.size && estGroup.size) assumed.push(`${who} 자주 가는 곳을 고르지 않아 브랜드 한 곳 혜택 ${b}, 여러 브랜드 묶음 혜택 ${g}로 추정`);
    else if (estBrand.size) assumed.push(`${who} 자주 가는 곳을 고르지 않아 브랜드 혜택 대상 비중 ${b}로 추정`);
    else assumed.push(`${who} 자주 가는 곳을 고르지 않아 브랜드 묶음 혜택 대상 비중 ${g}로 추정`);
  }
  const tickets = new Map<number, string[]>();
  for (const cat of ["cafe", "convenience", "dining", "transport"]) {
    const v = AVG[cat];
    if (typeof v !== "number" || !benefitCats.has(cat)) continue;
    tickets.set(v, [...(tickets.get(v) ?? []), cat === "transport" ? "교통" : catShort(cat)]);
  }
  if (tickets.size)
    assumed.push(
      `결제 1회 평균 ${Array.from(tickets.entries())
        .map(([v, cats]) => `${joinDot(cats)} ${ticketText(v)}`)
        .join(", ")}`,
    );
  if (payCond) assumed.push("후불교통·자동납부 같은 결제 조건은 지킨다고 봄");
  if (usesPoint) assumed.push("포인트 1점 = 1원");
  assumed.push(CATALOG_DATE_TEXT ? `혜택 정보는 카드고릴라 원문(${CATALOG_DATE_TEXT} 수집) 기준` : "혜택 정보는 카드고릴라 원문 기준");
  return { user: `${user.join(" · ")}.`, assumed: `가정: ${assumed.join(" · ")}.` };
}

/* ---------------- 실적 여유 없음 비교 ---------------- */

export interface CompareTileVM {
  label: string;
  names: string;
  sids: number[];
  rows: [string, string][];
}

export interface NoMarginVM {
  title: string;
  lines: string[];
  base: CompareTileVM;
  pick: CompareTileVM;
  /** '여유 2만원 추천 보기' */
  backLabel: string;
}

function minRoom(pack: EnginePack): number | null {
  const rooms = perfCards(pack).map((c) => c.room).filter((r): r is number => r !== null);
  return rooms.length ? Math.max(0, Math.min(...rooms)) : null;
}

function feeText(pack: EnginePack): string {
  const fee = pack.cards.reduce((s, c) => s + c.annualFee, 0);
  return fee > 0 ? `연 ${won(fee)}` : "없음";
}

function tile(label: string, pack: EnginePack): CompareTileVM {
  const room = minRoom(pack);
  return {
    label,
    names: pack.cards.map((c) => nickOf(c)).join(" + "),
    sids: pack.cards.map((c) => c.sid),
    rows: [
      ["월 순혜택", approxWon(pack.net)],
      ["가장 작은 실적 여유", room === null ? "실적 조건 없음" : korWon(room)],
      ["연회비 합계", feeText(pack)],
    ],
  };
}

export function noMarginVM(base: EnginePack, pick: EnginePack, margin: number): NoMarginVM {
  const diff = pick.net - base.net;
  const title = diff >= 500 ? `월 ${approxKor(diff)} 더 받지만 실적 여유가 없어요` : "실적 여유 없이 계산해도 혜택이 거의 같아요";
  const lines: string[] = [];
  const tight = perfCards(pick)
    .filter((c) => c.tight)
    .sort((a, b) => (a.room ?? 0) - (b.room ?? 0))[0];
  if (tight) {
    const card = pick.cards.find((c) => c.sid === tight.sid)!;
    lines.push(
      `${tight.nick} 실적이 기준 ${korWon(tight.threshold!)}에 딱 맞아요. 지출이 조금만 줄어도 다음 달 ${tight.nick} 혜택 ${josa(korWon(card.total), "이/가")} 끊기고, 그 달은 월 ${josa(approxKor(pick.net - card.total), "으로/로")} 내려가요.`,
    );
  } else {
    const r = minRoom(pick);
    if (r !== null) lines.push(`가장 작은 실적 여유가 ${josa(korWon(r), "이에요/예요")}.`);
  }
  const marginText = korWon(margin);
  lines.push(`그래서 기본 추천은 실적 여유 ${josa(marginText, "을/를")} 둔 ${josa(base.cards.map((c) => shortOf(c)).join(" + "), "이에요/예요")}.`);
  return {
    title,
    lines,
    base: tile(`기본 추천 · 실적 여유 ${marginText}`, base),
    pick: tile("이 결과 · 실적 여유 없음", pick),
    backLabel: `여유 ${marginText} 추천 보기`,
  };
}

/* ---------------- 내 지갑 ---------------- */

export interface WalletCardVM extends RoleCardVM {
  chips: string[];
  perf: PerfCardVM;
  walletNote: string | null;
}

/** 내 지갑의 카드 한 장: 맡는 일 칩, 실적 막대, 안내 */
export function walletCard(card: EngineCard, pack: EnginePack, ctx: ViewCtx): WalletCardVM {
  const role = roleCard(card, ctx);
  const byCard = new Map(pack.cards.map((c) => [c.sid, benefitByCategory(c)]));
  const topOf = (cat: string) => partsOf(pack, cat, byCard)[0]?.card.sid;
  const chips: string[] = [];
  for (const b of gotBenefits(card)) {
    const cat = b.category;
    if (!cat) {
      chips.push("모든 가맹점");
      continue;
    }
    const brands = brandText(benefitBrands(b, ctx.brandShare));
    if (cat === "mobile") chips.push("통신비 자동납부");
    else if (brands) chips.push(`${catShort(cat)} · ${brands}`);
    else chips.push(topOf(cat) === card.sid ? catShort(cat) : `${catShort(cat)} 나머지`);
  }
  const perf = perfCards(pack).find((p) => p.sid === card.sid)!;
  const pkg = packageChoice(card);
  let walletNote: string | null = null;
  if (pkg) walletNote = `카드사 앱에서 패키지를 ‘${pkg}’${withRo(pkg)} 바꿔야 이 혜택을 받아요.`;
  else if (perf.tight && removedFromPerf(card) >= 1) {
    const dc = discountedCat(card);
    const others = Object.keys(card.alloc).filter((c) => c !== dc?.cat && !card.perf.excluded.includes(c)).map(catShort);
    if (dc)
      walletNote = `할인받은 ${catShort(dc.cat)} ${josa(korWon(dc.amount), "은/는")} 실적에서 빠져요.${others.length ? ` 이 카드로 내는 ${josa(joinDot(others), "이/가")} 매달 ${korWon(perf.threshold!)} 이상이어야 다음 달 할인이 이어져요.` : ""}`;
  } else {
    const auto = autoChoiceNote(card);
    if (auto) walletNote = `${auto}.`;
  }
  return { ...role, chips: Array.from(new Set(chips)).slice(0, 5), perf, walletNote };
}

export interface UnusedCardVM {
  sid: number;
  short: string;
  name: string;
  fee: string;
}

/** 이 조합에서 쓰지 않는 가진 카드 */
export function unusedOwned(ownedIds: number[], pack: EnginePack): UnusedCardVM[] {
  const used = new Set(pack.cards.map((c) => c.sid));
  return ownedIds
    .filter((s) => !used.has(s))
    .map((s) => {
      const e = catalogBySourceId.get(s);
      const name = e?.name ?? String(s);
      const fee = e?.annualFee ?? 0;
      return { sid: s, short: cardNick(name), name, fee: fee > 0 ? `연 ${won(fee)}` : "연회비 없음" };
    });
}
