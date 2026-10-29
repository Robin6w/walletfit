import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMonthlySpend } from "@/domain/state/useMonthlySpend";
import { useBrandSpend, useMargin } from "@/v1/state";
import type { SpendCategory } from "@/domain/types/card";

const cats = [
  { id: "cafe", label: "카페" },
  { id: "dining", label: "외식" },
] as unknown as SpendCategory[];

// 2026-10-06 점검: App과 각 화면이 같은 값을 따로 들고 있어서, 지갑 만들기에서 넣은 지출이
// 새로고침 전까지 전체 카드·혜택별 추천에 반영되지 않았다
describe("같은 탭 안의 화면끼리 저장 값 공유", () => {
  beforeEach(() => localStorage.clear());

  it("한 화면에서 넣은 지출이 다른 화면에 바로 보인다", () => {
    const app = renderHook(() => useMonthlySpend(cats));
    const wizard = renderHook(() => useMonthlySpend(cats));
    act(() => wizard.result.current.updateCategory("cafe", 50000));
    expect(app.result.current.spending.cafe).toBe(50000);
  });

  it("상담에서 실적 여유를 0으로 바꾸면 지갑 만들기 쪽 값도 0이 된다", () => {
    const app = renderHook(() => useMargin());
    const wizard = renderHook(() => useMargin());
    expect(wizard.result.current[0]).toBe(20000);
    act(() => app.result.current[1](0));
    expect(wizard.result.current[0]).toBe(0);
  });

  it("명세서에서 브랜드 금액을 더해도 지갑 만들기에서 넣은 값이 지워지지 않는다", () => {
    const app = renderHook(() => useBrandSpend());
    const wizard = renderHook(() => useBrandSpend());
    act(() => wizard.result.current.setBrand("cafe", "스타벅스", 30000));
    act(() => app.result.current.addBrands([{ cat: "dining", brand: "배달의민족", amount: 20000 }]));
    expect(wizard.result.current.brandSpend).toEqual({ cafe: { 스타벅스: 30000 }, dining: { 배달의민족: 20000 } });
    expect(JSON.parse(localStorage.getItem("walletfit:v1:brand-spend") ?? "{}")).toEqual({ cafe: { 스타벅스: 30000 }, dining: { 배달의민족: 20000 } });
  });
});
