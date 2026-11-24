/**
 * 같은 탭 안의 여러 화면이 localStorage 값을 함께 쓰게 해 주는 작은 도구.
 * 브라우저의 storage 이벤트는 다른 탭에서 바꿀 때만 오기 때문에, 같은 탭에서 바꾼 값은
 * 이 이벤트로 다른 화면(같은 키를 읽는 다른 훅)에 알린다.
 * 값이 실제로 바뀔 때만 쓰고 알리므로, 서로 알림을 주고받으며 도는 일이 없다.
 */
export const SAME_TAB_STORAGE_EVENT = "walletfit:storage";

/**
 * local: 브라우저를 껐다 켜도 남는 값
 * session: 이 탭에서만 쓰는 값. 새로고침·화면 이동에는 남고, 탭을 닫으면 지워진다(지출·담은 카드·저장한 지갑, 2026-11-24)
 */
export type StorageArea = "local" | "session";

export function storageOf(area: StorageArea): Storage {
  return area === "session" ? window.sessionStorage : window.localStorage;
}

/** 저장된 문자열과 다를 때만 쓰고 알린다. 저장소를 못 쓰면 조용히 넘어간다. */
export function writeAndNotify(key: string, raw: string, area: StorageArea = "local"): void {
  try {
    const store = storageOf(area);
    if (store.getItem(key) === raw) return;
    store.setItem(key, raw);
  } catch {
    return;
  }
  window.dispatchEvent(new CustomEvent<string>(SAME_TAB_STORAGE_EVENT, { detail: key }));
}

export function removeAndNotify(key: string, area: StorageArea = "local"): void {
  try {
    const store = storageOf(area);
    if (store.getItem(key) === null) return;
    store.removeItem(key);
  } catch {
    return;
  }
  window.dispatchEvent(new CustomEvent<string>(SAME_TAB_STORAGE_EVENT, { detail: key }));
}

/** 이 키가 다른 탭이나 같은 탭의 다른 화면에서 바뀌면 onChange를 부른다. 정리 함수를 돌려준다. */
export function onStoredKeyChange(key: string, onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === key || e.key === null) onChange();
  };
  const onSameTab = (e: Event) => {
    if ((e as CustomEvent<string>).detail === key) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(SAME_TAB_STORAGE_EVENT, onSameTab);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SAME_TAB_STORAGE_EVENT, onSameTab);
  };
}
