import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "@/shared/components/ErrorBoundary";
import { isStaleChunkError, reloadOnceForStaleChunk, RELOAD_GUARD_MS } from "@/shared/staleChunk";

describe("배포 직후 옛 탭 오류", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("브라우저별 화면 조각 불러오기 실패만 골라낸다", () => {
    expect(isStaleChunkError(new TypeError("Failed to fetch dynamically imported module: https://x/assets/Cards-Bb4q1VfK.js"))).toBe(true);
    expect(isStaleChunkError(new TypeError("Importing a module script failed."))).toBe(true);
    expect(isStaleChunkError(new TypeError("error loading dynamically imported module: https://x/a.js"))).toBe(true);
    expect(isStaleChunkError({ name: "ChunkLoadError", message: "" })).toBe(true);
    expect(isStaleChunkError(new Error("Cannot read properties of undefined"))).toBe(false);
    expect(isStaleChunkError(null)).toBe(false);
  });

  it("한 번만 새로고침하고, 잠시 뒤에는 다시 할 수 있다", () => {
    const reload = vi.fn();
    expect(reloadOnceForStaleChunk(reload, 1_000_000)).toBe(true);
    expect(reloadOnceForStaleChunk(reload, 1_000_000 + 2_000)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(reloadOnceForStaleChunk(reload, 1_000_000 + RELOAD_GUARD_MS + 1)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });
});

describe("ErrorBoundary와 옛 탭 오류", () => {
  const originalError = console.error;
  beforeEach(() => {
    console.error = vi.fn();
    window.sessionStorage.clear();
  });
  afterEach(() => {
    console.error = originalError;
  });

  function Stale(): never {
    throw new TypeError("Failed to fetch dynamically imported module: https://x/assets/Cards-old.js");
  }

  it("이미 방금 새로고침했으면 반복하지 않고 평소 오류 화면을 보여 준다", () => {
    window.sessionStorage.setItem("walletfit:stale-chunk-reload-at", String(Date.now()));
    render(
      <ErrorBoundary fallbackTitle="오류 제목">
        <Stale />
      </ErrorBoundary>,
    );
    expect(screen.getByText("오류 제목")).toBeInTheDocument();
  });
});
