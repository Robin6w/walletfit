import type { EnginePack, RecommendResponse } from "@/domain/types/engine";

/**
 * 엔진 결과 보호 장치(2026-10-28).
 * 조합 찾기(MILP + 후보 추리기)는 휴리스틱이 섞여 있어서 드물게 서로 맞지 않는 숫자가 나온다.
 *  - 실적 여유 0으로 다시 푼 결과가 여유 2만원 결과의 '여유 0 대안(alt)'보다 작음
 *  - 새 카드까지 넣은 결과가 가진 카드만 쓴 결과보다 작음(후보 12장 추리기에서 가진 카드가 빠짐)
 * 화면은 항상 성립하는 관계(조건을 푼 쪽 ≥ 원래 쪽, 카드 수 상한이 커지면 최적값은 줄지 않음)로
 * 후보 중 가장 큰 쪽을 쓴다. 엔진 고도화 단계에서 원인을 고칠 항목이다(README '알려진 엔진 문제').
 */

export type BarItem = RecommendResponse["bar"][number];

/** 순혜택이 가장 큰 조합. 같으면(1원 이내) 카드 수가 적은 쪽, 그다음 먼저 들어온 쪽 */
export function bestPack(cands: (EnginePack | null | undefined)[]): EnginePack | null {
  let best: EnginePack | null = null;
  for (const p of cands) {
    if (!p || !Array.isArray(p.cards) || p.cards.length === 0) continue;
    if (!best || p.net > best.net + 1 || (Math.abs(p.net - best.net) <= 1 && p.cards.length < best.cards.length)) best = p;
  }
  return best;
}

function usedSids(p: EnginePack): number[] {
  return p.cards.filter((c) => c.pay > 0.5 || c.total > 0.5).map((c) => c.sid);
}

/**
 * 카드 수별 순혜택을 '최대 k장' 기준으로 맞춘다: k가 커지면 값은 줄지 않는다.
 * pick(화면에 보여 줄 조합)이 같은 장수의 막대보다 크면 그 값으로 바꾼다.
 */
export function monotoneBar(bar: BarItem[] | undefined, pick?: EnginePack | null): BarItem[] {
  const items = [...(bar ?? [])].sort((a, b) => a.k - b.k).map((b) => ({ ...b }));
  if (pick && pick.cards.length) {
    const k = usedSids(pick).length || pick.cards.length;
    const at = items.find((b) => b.k === k);
    if (!at) items.push({ k, net: pick.net, cards: k, same: false, sids: usedSids(pick) });
    else if (pick.net > at.net + 1) Object.assign(at, { net: pick.net, cards: k, same: false, sids: usedSids(pick) });
    items.sort((a, b) => a.k - b.k);
  }
  let prev: BarItem | null = null;
  for (const b of items) {
    if (prev && b.net < prev.net + 1) {
      // 한 장 더 허용해도 늘지 않으면 앞 장수의 조합을 그대로 쓴다
      Object.assign(b, { net: prev.net, cards: prev.cards, same: true, sids: prev.sids });
    }
    prev = b;
  }
  return items;
}

export interface NoMarginPick {
  pack: EnginePack;
  bar: BarItem[];
  /** 어떤 계산에서 골랐는지(테스트·진단용) */
  from: "recommend" | "alt" | "base";
}

/**
 * 실적 여유 없이 다시 계산한 결과.
 * 후보: 여유 0 추천(recommend), 기본 추천의 여유 0 대안 조합을 여유 0으로 설명(explain), 기본 추천 조합을 여유 0으로 설명
 */
export function pickNoMargin(
  rec0: RecommendResponse | null | undefined,
  altExplain: EnginePack | null | undefined,
  baseExplain: EnginePack | null | undefined,
): NoMarginPick | null {
  const cands: [NoMarginPick["from"], EnginePack | null | undefined][] = [
    ["recommend", rec0?.result],
    ["alt", altExplain],
    ["base", baseExplain],
  ];
  const pack = bestPack(cands.map(([, p]) => p));
  if (!pack) return null;
  const from = cands.find(([, p]) => p === pack)?.[0] ?? "recommend";
  return { pack, bar: monotoneBar(rec0?.bar, pack), from };
}

export interface NewFlowPick {
  pack: EnginePack;
  bar: BarItem[];
  /** 이 조합에서 새로 발급할 카드 */
  newSids: number[];
  /** 가진 카드만 쓸 때 조합(가진 카드가 없으면 null) */
  ownedOnly: EnginePack | null;
  /** 새 카드를 더해도 가진 카드 조합보다 낫지 않아서 가진 카드 조합을 보여 주는지 */
  keptOwned: boolean;
}

/** 새 카드까지 포함한 결과와 가진 카드만 쓴 결과를 맞춘다 */
export function pickNewFlow(
  recNew: RecommendResponse | null | undefined,
  recOwned: RecommendResponse | null | undefined,
  ownedIds: number[],
  /** 꼭 넣을 카드(카드 비교에서 고른 카드). 있으면 가진 카드 조합이 더 나아도 새 조합을 그대로 보여 준다 */
  pinned: number[] = [],
): NewFlowPick | null {
  const owned = new Set(ownedIds);
  const ownedOnly = recOwned?.result?.cards?.length ? recOwned.result : null;
  const fresh = recNew?.result?.cards?.length ? recNew.result : null;
  if (!fresh && !ownedOnly) return null;
  const freshNew = fresh ? usedSids(fresh).filter((s) => !owned.has(s)) : [];
  const pinnedIn = pinned.length > 0 && !!fresh && pinned.every((s) => fresh.sids.includes(s));
  // 새 카드 조합이 가진 카드 조합보다 100원 이상 크지 않으면 가진 카드 조합을 그대로 쓴다(꼭 넣을 카드가 있으면 그대로 보여 줌)
  if (!pinnedIn && ownedOnly && (!fresh || freshNew.length === 0 || fresh.net < ownedOnly.net + 100)) {
    return { pack: ownedOnly, bar: monotoneBar(recOwned?.bar, ownedOnly), newSids: [], ownedOnly, keptOwned: true };
  }
  const pack = fresh!;
  return { pack, bar: monotoneBar(recNew?.bar, pack), newSids: freshNew, ownedOnly, keptOwned: false };
}
