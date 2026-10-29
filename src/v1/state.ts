import { useCallback, useEffect, useRef, useState } from "react";
import { onStoredKeyChange, writeAndNotify } from "@/shared/lib/sameTabStorage";
import type { EnginePack } from "@/domain/types/engine";

/**
 * v1 화면이 브라우저에 저장하는 값. 저장소를 못 쓰는 환경(사생활 보호 창 등)에서도 화면은 그대로 동작합니다.
 *  - 자주 가는 곳(브랜드 금액), 실적 여유, 저장한 지갑, 할 일 체크
 */
function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * localStorage 값 하나를 화면 상태로 쓴다. 같은 키를 쓰는 다른 화면(App·지갑 만들기·명세서)과
 * 같은 탭 안에서도 값이 맞춰진다. 저장 못 해도 화면은 계속 동작한다.
 */
function useStored<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => read(key, fallback));
  const current = useRef(value);
  current.current = value;
  useEffect(() => {
    writeAndNotify(key, JSON.stringify(value));
  }, [key, value]);
  useEffect(
    () =>
      onStoredKeyChange(key, () => {
        const next = read(key, fallback);
        if (JSON.stringify(next) !== JSON.stringify(current.current)) setValue(next);
      }),
    // fallback은 처음 값만 쓴다
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  return [value, setValue] as const;
}

/** 카테고리별 브랜드 금액(원). 예: { cafe: { 스타벅스: 72000 } } */
export type BrandSpend = Record<string, Record<string, number>>;

export function useBrandSpend() {
  const [brandSpend, setBrandSpend] = useStored<BrandSpend>("walletfit:v1:brand-spend", {});
  const setBrand = useCallback(
    (cat: string, brand: string, amount: number) =>
      setBrandSpend((prev) => {
        const next = { ...prev, [cat]: { ...(prev[cat] ?? {}) } };
        if (amount > 0) next[cat][brand] = amount;
        else delete next[cat][brand];
        if (Object.keys(next[cat]).length === 0) delete next[cat];
        return next;
      }),
    [setBrandSpend],
  );
  const addBrands = useCallback(
    (items: { cat: string; brand: string; amount: number }[]) =>
      setBrandSpend((prev) => {
        const next: BrandSpend = JSON.parse(JSON.stringify(prev));
        for (const it of items) {
          next[it.cat] = next[it.cat] ?? {};
          next[it.cat][it.brand] = (next[it.cat][it.brand] ?? 0) + it.amount;
        }
        return next;
      }),
    [setBrandSpend],
  );
  return { brandSpend, setBrandSpend, setBrand, addBrands };
}

export const MARGIN_OPTIONS = [0, 20000, 50000];

/**
 * 새 카드 추천·혜택별 추천에 검수 전(자동 변환) 카드를 넣는 선택지를 보여줄지.
 * 2026-10-07: 자동 변환 표를 혜택 요약 해석으로 바꾸자 요약에 없는 전월실적·통합 한도 때문에 상위 30장 중 28장이
 * 자동 변환 카드로 채워졌다. 원문 추출로 검수 카드가 늘 때까지 끈다(이미 가진 카드 계산에는 계속 쓴다).
 */
export const UNVERIFIED_IN_NEW_CARDS = false;

/** 새 카드 추천에 검수 전(자동 변환) 카드까지 넣을지. 기본은 넣지 않는다 */
export function useIncludeUnverified(): [boolean, (v: boolean) => void] {
  const [value, setValue] = useStored<boolean>("walletfit:v1:include-unverified", false);
  return UNVERIFIED_IN_NEW_CARDS ? [value, setValue] : [false, () => {}];
}

export function useMargin() {
  return useStored<number>("walletfit:v1:margin", 20000);
}

export interface SavedWallet {
  savedAt: string;
  scope: "myCards" | "all";
  spending: Record<string, number>;
  brandSpend: BrandSpend;
  margin: number;
  pack: EnginePack;
  /** 같은 지출에서 카드 1장일 때 순혜택(요약 문장용) */
  singleNet: number | null;
  todos: { id: string; text: string; done: boolean }[];
}

export function useSavedWallet() {
  const [wallet, setWallet] = useStored<SavedWallet | null>("walletfit:v1:saved-wallet", null);
  const toggleTodo = useCallback(
    (id: string) =>
      setWallet((w) => (w ? { ...w, todos: w.todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) } : w)),
    [setWallet],
  );
  return { wallet, setWallet, toggleTodo, clear: () => setWallet(null) };
}
