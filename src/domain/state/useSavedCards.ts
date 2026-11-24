import { useCallback, useEffect, useMemo, useReducer } from "react";

export { exportSavedCards, parseSavedCardsBackup, downloadSavedCardsBackup } from "./savedCardsBackup";
export type { SavedCardsBackup, BackupValidation } from "./savedCardsBackup";

/** 담은 카드는 이 탭에서만 둔다(sessionStorage, 2026-11-24): 새로고침해도 남고 탭을 닫으면 지워진다 */
export const SAVED_CARDS_KEY = "walletfit:saved-cards";

function readStoredIds(): number[] {
  try {
    const raw = window.sessionStorage.getItem(SAVED_CARDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "number") : [];
  } catch {
    return [];
  }
}

function writeStoredIds(ids: Set<number>) {
  // 저장소를 못 써도(사생활 보호 창 등) 화면 상태는 그대로 쓴다
  try {
    window.sessionStorage.setItem(SAVED_CARDS_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    /* 무시 */
  }
}

type SavedCardsAction =
  | { kind: "add"; id: number }
  | { kind: "remove"; id: number }
  | { kind: "toggle"; id: number }
  | { kind: "replace"; ids: Iterable<number> }
  | { kind: "clear" };

/**
 * 내부 상태를 배열이 아니라 Set으로 관리한다. 중복 방지와 포함 여부 확인(has)이
 * Set에 자연스럽게 내장되어 있어, 매번 배열을 훑어 includes로 확인하지 않아도 된다.
 */
function savedCardsReducer(state: Set<number>, action: SavedCardsAction): Set<number> {
  switch (action.kind) {
    case "add": {
      if (state.has(action.id)) return state;
      return new Set(state).add(action.id);
    }
    case "remove": {
      if (!state.has(action.id)) return state;
      const next = new Set(state);
      next.delete(action.id);
      return next;
    }
    case "toggle": {
      const next = new Set(state);
      if (next.has(action.id)) {
        next.delete(action.id);
      } else {
        next.add(action.id);
      }
      return next;
    }
    case "replace":
      return new Set(action.ids);
    case "clear":
      return new Set();
    default:
      return state;
  }
}

/**
 * 카탈로그 카드(sourceId)를 "내 카드"로 담습니다.
 * 2026-11-24: 이 탭에서만 둔다(sessionStorage). 새로고침해도 남고(휴대폰에서 당겨 새로고침해도 그대로), 탭을 닫으면 지워진다.
 * 앱 맨 위(AppDataProvider)에서 한 번만 부른다
 */
export function useSavedCards() {
  const [idSet, dispatch] = useReducer(savedCardsReducer, undefined, () => new Set(readStoredIds()));

  useEffect(() => {
    writeStoredIds(idSet);
  }, [idSet]);

  const add = useCallback((sourceId: number) => {
    dispatch({ kind: "add", id: sourceId });
  }, []);

  const remove = useCallback((sourceId: number) => {
    dispatch({ kind: "remove", id: sourceId });
  }, []);

  const toggle = useCallback((sourceId: number) => {
    dispatch({ kind: "toggle", id: sourceId });
  }, []);

  const has = useCallback((sourceId: number) => idSet.has(sourceId), [idSet]);

  const importIds = useCallback(
    (newIds: number[], mode: "merge" | "overwrite" = "merge") => {
      const next = mode === "overwrite" ? new Set(newIds) : new Set(idSet);
      if (mode === "merge") {
        for (const id of newIds) next.add(id);
      }
      const affectedCount = mode === "overwrite" ? next.size : next.size - idSet.size;
      dispatch({ kind: "replace", ids: next });
      return affectedCount;
    },
    [idSet],
  );

  const clear = useCallback(() => {
    dispatch({ kind: "clear" });
  }, []);

  const ids = useMemo(() => Array.from(idSet), [idSet]);

  return { ids, add, remove, toggle, has, importIds, clear };
}
