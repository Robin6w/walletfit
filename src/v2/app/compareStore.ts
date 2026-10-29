import { useSyncExternalStore } from "react";
import { readSession, writeSession } from "@/v2/app/storage";

/** 비교함(전체 카드 → 카드 비교). 최대 3장, 탭을 닫으면 비워진다 */
const KEY = "walletfit:v2:compare";
export const COMPARE_MAX = 3;
let ids: number[] = readSession<number[]>(KEY, []).filter((x) => Number.isFinite(x)).slice(0, COMPARE_MAX);
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const compareStore = {
  get: () => ids,
  set(next: number[]) {
    ids = Array.from(new Set(next)).slice(0, COMPARE_MAX);
    writeSession(KEY, ids);
    emit();
  },
  /** 넣거나 빼기. 이미 3장이면 false */
  toggle(sid: number): boolean {
    if (ids.includes(sid)) {
      compareStore.set(ids.filter((x) => x !== sid));
      return true;
    }
    if (ids.length >= COMPARE_MAX) return false;
    compareStore.set([...ids, sid]);
    return true;
  },
  clear() {
    compareStore.set([]);
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

export function useCompare(): number[] {
  return useSyncExternalStore(compareStore.subscribe, compareStore.get, compareStore.get);
}
