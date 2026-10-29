import type { EngineCard, EnginePack, TraceBenefit } from "@/domain/types/engine";
import { catLabel, isUnread } from "@/v1/catalog";
import { cardColor, cardMonthly, korWon, pct } from "@/v1/format";

/** 추천 결과·내 지갑·상담이 같이 쓰는 화면용 값. 모든 숫자는 calc.py 과정 기록(trace)에서 나옵니다. */

export function colorOf(pack: EnginePack, sid: number): string {
  const i = pack.cards.findIndex((c) => c.sid === sid);
  return cardColor(i < 0 ? 0 : i);
}

/** 카드 한 장의 월 혜택 문구. 혜택 요약을 못 읽은 카드는 0원 대신 '혜택 정보 없음' */
export function cardMonthlyLabel(card: EngineCard): string {
  return isUnread(card.sid) ? "혜택 정보 없음" : cardMonthly(card.total, isExact(card));
}

/** 금액 글자색: 혜택 정보가 없는 카드는 흐리게 */
export function monthlyTone(card: EngineCard): string {
  return isUnread(card.sid) ? "text-ink-3" : "text-positive";
}

/** 혜택이 전부 한도에 걸렸으면 원 단위 확정 값 */
export function isExact(card: EngineCard): boolean {
  const got = card.benefits.filter((b) => b.final > 0.5);
  if (got.length === 0) return true;
  const sharedHit = card.shared.some((s) => s.factor < 0.999);
  return got.every((b) => b.caps.some((c) => c.hit)) || (sharedHit && got.length <= 2);
}

/** 혜택 행: '카페 · 스타벅스·투썸 6만 6천원 × 55%' */
export function benefitLine(b: TraceBenefit): string {
  const c = b.cats[0];
  const cat = b.category ? catLabel(b.category) : "모든 가맹점";
  const brands = b.specificity === "brand" || b.specificity === "merchant_group" ? b.merchants.slice(0, 2).join("·") : "";
  const target = c ? korWon(c.target) : "";
  const rate =
    b.type === "percent" && b.value ? pct(b.value) : b.type === "won_per_txn" && b.value ? `건당 ${Math.round(b.value).toLocaleString("ko-KR")}원` : "";
  return [cat, brands && `${brands} ${target}`, !brands && target, rate && `× ${rate}`].filter(Boolean).join(" · ").replace(" · ×", " ×");
}

export function capCaption(b: TraceBenefit, card: EngineCard): string {
  const hit = b.caps.find((c) => c.hit);
  if (hit) return `${hit.period === "month" ? "월" : hit.period === "year" ? "연" : ""} 한도 ${Math.round(hit.amount).toLocaleString("ko-KR")}원 다 씀`;
  const shared = card.shared.find((s) => s.factor < 0.999);
  if (shared && b.final < b.afterOwn - 1) return `계산값 ${korWon(b.afterOwn)} → ${shared.label} 한도로 줄어듦`;
  if (b.caps[0]) return `한도 ${Math.round(b.caps[0].monthly).toLocaleString("ko-KR")}원 중 ${Math.round(b.final).toLocaleString("ko-KR")}원`;
  return "한도 없음";
}

/** 이 카드에서 카테고리별로 받는 혜택 */
export function benefitByCategory(card: EngineCard): Record<string, number> {
  const out: Record<string, number> = {};
  const payable = Object.entries(card.alloc).filter(([c]) => !card.perf.excluded.includes(c));
  const payTotal = payable.reduce((s, [, v]) => s + v, 0) || 1;
  for (const b of card.benefits) {
    if (b.final <= 0.5) continue;
    if (b.category) out[b.category] = (out[b.category] ?? 0) + b.final;
    else for (const [c, v] of payable) out[c] = (out[c] ?? 0) + (b.final * v) / payTotal;
  }
  return out;
}

export interface GuideRow {
  cat: string;
  spend: number;
  parts: { sid: number; name: string; amount: number; color: string; benefit: number }[];
  benefit: number;
}

/** 결제 가이드: 카테고리마다 어느 카드로 얼마. 혜택이 붙는 카드부터 순서대로 */
export function paymentGuide(pack: EnginePack, spending: Record<string, number>): { withBenefit: GuideRow[]; without: GuideRow[] } {
  const byCard = new Map(pack.cards.map((c) => [c.sid, benefitByCategory(c)]));
  const rows: GuideRow[] = Object.entries(spending)
    .filter(([, v]) => v > 0)
    .map(([cat, spend]) => {
      const parts = pack.cards
        .filter((c) => (c.alloc[cat] ?? 0) > 0)
        .map((c) => ({ sid: c.sid, name: shortCard(c.name), amount: c.alloc[cat], color: colorOf(pack, c.sid), benefit: byCard.get(c.sid)?.[cat] ?? 0 }))
        .sort((a, b) => b.benefit - a.benefit || b.amount - a.amount);
      return { cat, spend, parts, benefit: parts.reduce((s, p) => s + p.benefit, 0) };
    })
    .sort((a, b) => b.spend - a.spend);
  return { withBenefit: rows.filter((r) => r.benefit >= 50), without: rows.filter((r) => r.benefit < 50) };
}

export function shortCard(name: string): string {
  return name.replace(/^(삼성카드|신한카드|삼성)\s+/, "").replace(/\s*카드$/, "");
}

export interface Todo {
  id: string;
  text: string;
}

/** 카드사 앱에서 할 일: 패키지 고르기, 후불교통 등록, 통신비 자동납부 */
export function todosOf(pack: EnginePack): Todo[] {
  const out: Todo[] = [];
  for (const c of pack.cards) {
    if (c.choiceAll.length > 1 && c.options.length) {
      out.push({ id: `pkg-${c.sid}`, text: `${shortCard(c.name)} 패키지를 ${c.options.map((o) => o.label).join(" + ")}(으)로 바꾸기` });
    }
    if ((c.alloc.transport ?? 0) > 0) out.push({ id: `bus-${c.sid}`, text: `${shortCard(c.name)}를 후불교통 카드로 등록하기` });
    if ((c.alloc.mobile ?? 0) > 0) out.push({ id: `tel-${c.sid}`, text: `${shortCard(c.name)}로 통신비 자동납부 걸기` });
  }
  return out;
}

/** 계산에 쓴 값: 내가 넣은 값 / 가정한 값 */
export function usedValues(pack: EnginePack): { user: string[]; assumed: string[] } {
  const user = new Set<string>();
  const assumed = new Set<string>();
  for (const c of pack.cards) {
    for (const f of c.flags) {
      const text = f.replace(/^[^:]+:\s*/, "");
      if (/입력한/.test(text)) user.add(text.replace("입력한 브랜드 비중", "입력한 브랜드"));
      else if (!/두 달 평균/.test(text)) assumed.add(text);
      else assumed.add(text);
    }
  }
  return { user: Array.from(user).slice(0, 6), assumed: Array.from(assumed).slice(0, 6) };
}

export function statusLine(card: EngineCard): string | null {
  if (card.status === "reviewed") return null;
  if (isUnread(card.sid))
    return "카드 혜택 요약에서 계산할 수 있는 혜택을 찾지 못해 0원으로 계산했어요. 실제로는 혜택이 있을 수 있어요(원문 대조 전).";
  if (card.status === "auto")
    return "카드고릴라 혜택 요약을 해석해서 계산했어요(원문 대조 전). 요약에 없는 전월실적 조건과 통합 한도는 반영하지 못해 실제보다 크게 나올 수 있어요.";
  return "원문 대조 통과, 사람 검수 전인 혜택 표예요. 숫자가 이상하면 알려 주세요.";
}
