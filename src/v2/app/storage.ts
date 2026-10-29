import { useEffect, useRef, useState } from "react";
import { onStoredKeyChange, writeAndNotify } from "@/shared/lib/sameTabStorage";

/**
 * localStorage 값 하나를 화면 상태로 쓴다(v1/state.ts와 같은 방식).
 * 같은 키를 읽는 다른 화면과 같은 탭 안에서도 값이 맞춰지고, 저장소를 못 써도 화면은 계속 동작한다.
 */
export function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function useStoredValue<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => readStored(key, fallback));
  const current = useRef(value);
  current.current = value;
  useEffect(() => {
    writeAndNotify(key, JSON.stringify(value));
  }, [key, value]);
  useEffect(
    () =>
      onStoredKeyChange(key, () => {
        const next = readStored(key, fallback);
        if (JSON.stringify(next) !== JSON.stringify(current.current)) setValue(next);
      }),
    // fallback은 처음 값만 쓴다
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  return [value, setValue] as const;
}

/** 탭을 닫으면 사라지는 값(상담 창 열림·대화) */
export function readSession<T>(key: string, fallback: T): T {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeSession(key: string, value: unknown) {
  try {
    if (value === null || value === undefined) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 저장 못 해도 화면은 동작 */
  }
}
