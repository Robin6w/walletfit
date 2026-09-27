import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useDebounce } from "@/shared/hooks/useDebounce";

describe("useDebounce Hook", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("초기 렌더링 시 전달된 초기값을 즉시 반환해야 한다", () => {
    const { result } = renderHook(() => useDebounce("hello", 300));
    expect(result.current).toBe("hello");
  });

  it("지연 시간이 지나기 전에는 이전 값을 유지해야 한다", () => {
    const { result, rerender } = renderHook(({ val }) => useDebounce(val, 300), {
      initialProps: { val: "initial" },
    });

    rerender({ val: "changed" });

    // 200ms 경과 (300ms 미만)
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe("initial");

    // 추가 100ms 경과 (총 300ms)
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe("changed");
  });

  it("연속으로 값이 변경되면 마지막 변경 시점부터 딜레이가 리셋되어야 한다", () => {
    const { result, rerender } = renderHook(({ val }) => useDebounce(val, 300), {
      initialProps: { val: "first" },
    });

    rerender({ val: "second" });
    act(() => {
      vi.advanceTimersByTime(150);
    });

    rerender({ val: "third" });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    // 'third'로 바뀐 후 200ms만 지났으므로 여전히 'first'
    expect(result.current).toBe("first");

    act(() => {
      vi.advanceTimersByTime(100);
    });
    // 이제 총 300ms 경과하여 'third'로 변경됨
    expect(result.current).toBe("third");
  });
});
