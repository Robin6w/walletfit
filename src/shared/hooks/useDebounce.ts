import { useState, useEffect } from "react";

/**
 * 지정된 딜레이(ms) 동안 값이 변경되지 않으면 최종 값을 반환하는 디바운스 훅
 * @param value 디바운스할 원본 값
 * @param delay 디바운스 지연 시간 (기본값: 250ms)
 */
export function useDebounce<T>(value: T, delay = 250): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
