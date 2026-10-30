import { useEffect, useState } from "react";
import cardViewUrl from "@data/catalog/card-view.json?url";
import type { CardViewFile } from "@/domain/types/cardView";

/**
 * 화면용 카드 혜택 요약(card-view.json, 약 4MB · 압축 0.7MB)을 처음 필요할 때 한 번만 받는다.
 * 전체 카드 화면과 카드 상세 창이 같이 쓴다(2026-10-30).
 */
let cache: CardViewFile | null = null;
let pending: Promise<CardViewFile | null> | null = null;

export function loadCardView(): Promise<CardViewFile | null> {
  pending ??= fetch(cardViewUrl)
    .then((r) => (r.ok ? (r.json() as Promise<CardViewFile>) : null))
    .then((v) => (cache = v))
    .catch(() => {
      pending = null; // 실패하면 다음에 다시 받는다
      return null;
    });
  return pending;
}

/** 받기 전에는 null. 받은 뒤에는 모든 화면이 같은 객체를 쓴다 */
export function useCardView(): CardViewFile | null {
  const [v, setV] = useState<CardViewFile | null>(cache);
  useEffect(() => {
    if (v) return;
    let alive = true;
    loadCardView().then((x) => alive && setV(x));
    return () => {
      alive = false;
    };
  }, [v]);
  return v;
}
