import { useCallback, useEffect, useMemo, useReducer } from "react";

export { exportSavedCards, parseSavedCardsBackup, downloadSavedCardsBackup } from "./savedCardsBackup";
export type { SavedCardsBackup, BackupValidation } from "./savedCardsBackup";

const STORAGE_KEY = "walletfit:saved-cards";

function readStoredIds(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "number") : [];
  } catch {
    return [];
  }
}

function writeStoredIds(ids: Set<number>) {
  // readStoredIds()는 try/catch로 감싸져 있는데 이 함수만 빠져 있었다. 시크릿 모드 저장
  // 용량 제한이나 프라이버시 설정으로 setItem이 예외를 던지면(특히 사파리) 여기서 잡지
  // 않으면 카드 추가/제거를 누를 때마다 앱이 그대로 죽는다. 저장이 실패해도 화면 상의
  // 상태(idSet)는 이미 반영돼 있으므로, 실패는 조용히 무시하고 다음 시도에 맡긴다.
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // 저장 실패는 무시 — 세션 내 상태는 유지되고, 새로고침 시에만 유실될 수 있다.
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
 * 카탈로그 카드(sourceId)를 "내 카드"로 담아 localStorage에 저장합니다.
 * 브라우저 탭 간 동기화를 위해 storage 이벤트도 반영합니다.
 * 각 액션이 직접 저장하는 대신, idSet이 바뀔 때마다 useEffect 한 곳에서 저장을 담당합니다.
 */
export function useSavedCards() {
  const [idSet, dispatch] = useReducer(savedCardsReducer, undefined, () => new Set(readStoredIds()));

  useEffect(() => {
    writeStoredIds(idSet);
  }, [idSet]);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) dispatch({ kind: "replace", ids: readStoredIds() });
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

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
