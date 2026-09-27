import { useCallback, useEffect, useReducer } from "react";
import type { SpendCategory, MonthlySpend } from "@/domain/types/card";
import type { ParsedSpendingItem } from "@/features/statement/importerParser";

export const SPENDING_STORAGE_KEY = "walletfit:monthly-spend";

export function createEmptyMonthlySpend(categories: SpendCategory[]): MonthlySpend {
  const empty: MonthlySpend = {};
  for (const category of categories) {
    empty[category.id] = 0;
  }
  return empty;
}

export function getSliderMax(value: number): number {
  if (value > 5000000) return Math.ceil(value / 1000000) * 1000000;
  if (value > 3000000) return 5000000;
  if (value > 1000000) return 3000000;
  return 1000000;
}

function sanitizeSpendingRecord(raw: unknown, categories: SpendCategory[]): MonthlySpend {
  const sanitized = createEmptyMonthlySpend(categories);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return sanitized;
  }

  const record = raw as Record<string, unknown>;
  for (const category of categories) {
    const value = record[category.id];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      sanitized[category.id] = Math.floor(value);
    }
  }
  return sanitized;
}

export function loadStoredMonthlySpend(categories: SpendCategory[]): MonthlySpend {
  if (typeof window === "undefined" || !window.localStorage) {
    return createEmptyMonthlySpend(categories);
  }

  try {
    const raw = localStorage.getItem(SPENDING_STORAGE_KEY);
    if (!raw) return createEmptyMonthlySpend(categories);
    return sanitizeSpendingRecord(JSON.parse(raw), categories);
  } catch {
    return createEmptyMonthlySpend(categories);
  }
}

export function saveMonthlySpend(spending: MonthlySpend): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    localStorage.setItem(SPENDING_STORAGE_KEY, JSON.stringify(spending));
  } catch {
    // QuotaExceededError나 시크릿 모드 등에서는 조용히 무시
  }
}

export function clearMonthlySpend(): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    localStorage.removeItem(SPENDING_STORAGE_KEY);
  } catch {
    // ignore storage remove errors
  }
}

type SpendingUpdater = MonthlySpend | ((prev: MonthlySpend) => MonthlySpend);

type SpendingAction =
  | { kind: "setCategory"; categoryId: string; value: number }
  | { kind: "replace"; updater: SpendingUpdater }
  | { kind: "reset"; categories: SpendCategory[] }
  | { kind: "import"; items: ParsedSpendingItem[]; mode: "merge" | "overwrite"; categories: SpendCategory[] };

/**
 * 지출 상태 전이를 하나의 순수 함수로 모아둔 리듀서입니다.
 * 각 액션 핸들러가 직접 localStorage에 쓰던 기존 방식 대신, 상태 전이 로직과
 * "상태가 바뀌면 저장한다"는 영속화 책임을 분리했습니다(영속화는 훅의 useEffect 한 곳에서 담당).
 */
function spendingReducer(state: MonthlySpend, action: SpendingAction): MonthlySpend {
  switch (action.kind) {
    case "setCategory": {
      const sanitizedValue = Math.max(0, Math.floor(action.value || 0));
      return { ...state, [action.categoryId]: sanitizedValue };
    }
    case "replace":
      return typeof action.updater === "function" ? action.updater(state) : action.updater;
    case "reset":
      return createEmptyMonthlySpend(action.categories);
    case "import": {
      const next = action.mode === "overwrite" ? createEmptyMonthlySpend(action.categories) : { ...state };
      for (const item of action.items) {
        const key = next[item.category] !== undefined ? item.category : "etc";
        next[key] = (next[key] || 0) + item.amount;
      }
      // 환불/취소 내역으로 인해 음수가 되지 않도록 최소 0원 하한 보정
      for (const key of Object.keys(next)) {
        next[key] = Math.max(0, Math.floor(next[key]));
      }
      return next;
    }
    default:
      return state;
  }
}

/**
 * 월 지출 프로필 상태를 관리하고 localStorage에 동기화하는 커스텀 훅입니다.
 */
export function useMonthlySpend(categories: SpendCategory[]) {
  const [spending, dispatch] = useReducer(spendingReducer, categories, loadStoredMonthlySpend);

  // spending이 바뀔 때마다 한 곳에서만 저장한다 — 각 액션이 저장까지 책임지지 않는다.
  useEffect(() => {
    saveMonthlySpend(spending);
  }, [spending]);

  // 다중 탭 및 외부 스토리지 변경 동기화
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === SPENDING_STORAGE_KEY) {
        dispatch({ kind: "replace", updater: loadStoredMonthlySpend(categories) });
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [categories]);

  const updateCategory = useCallback((categoryId: string, value: number) => {
    dispatch({ kind: "setCategory", categoryId, value });
  }, []);

  const setSpending = useCallback((updater: SpendingUpdater) => {
    dispatch({ kind: "replace", updater });
  }, []);

  const resetSpending = useCallback(() => {
    dispatch({ kind: "reset", categories });
  }, [categories]);

  const applyImportedItems = useCallback(
    (items: ParsedSpendingItem[], mode: "merge" | "overwrite") => {
      dispatch({ kind: "import", items, mode, categories });
    },
    [categories],
  );

  return {
    spending,
    updateCategory,
    setSpending,
    resetSpending,
    applyImportedItems,
  };
}
