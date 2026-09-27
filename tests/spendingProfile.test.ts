import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  SPENDING_STORAGE_KEY,
  createEmptyMonthlySpend,
  loadStoredMonthlySpend,
  saveMonthlySpend,
  clearMonthlySpend,
  useMonthlySpend,
} from "@/domain/state/useMonthlySpend";
import type { SpendCategory } from "@/domain/types/card";
import type { ParsedSpendingItem } from "@/features/statement/importerParser";

describe("spendingProfile logic and useMonthlySpend hook", () => {
  const mockCategories: SpendCategory[] = [
    { id: "transport", label: "대중교통" },
    { id: "mart", label: "마트" },
    { id: "dining", label: "외식" },
  ];

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe("스토리지 입출력 및 데이터 보정 단위 테스트", () => {
    it("getInitialSpending은 모든 카테고리를 0원으로 초기화해야 한다", () => {
      const initial = createEmptyMonthlySpend(mockCategories);
      expect(initial).toEqual({
        transport: 0,
        mart: 0,
        dining: 0,
      });
    });

    it("localStorage가 비어있을 때 readStoredSpending은 기본 0원 프로필을 반환해야 한다", () => {
      const profile = loadStoredMonthlySpend(mockCategories);
      expect(profile).toEqual({
        transport: 0,
        mart: 0,
        dining: 0,
      });
    });

    it("localStorage에 저장된 유효한 지출 데이터를 정상 복원해야 한다", () => {
      localStorage.setItem(
        SPENDING_STORAGE_KEY,
        JSON.stringify({ transport: 150000, mart: 250000, dining: 80000 }),
      );

      const profile = loadStoredMonthlySpend(mockCategories);
      expect(profile).toEqual({
        transport: 150000,
        mart: 250000,
        dining: 80000,
      });
    });

    it("localStorage에 잘못된 JSON이나 음수/NaN 등 비정상 값이 있으면 0원으로 보정해야 한다", () => {
      localStorage.setItem(
        SPENDING_STORAGE_KEY,
        JSON.stringify({ transport: -50000, mart: "invalid", dining: 100000.8 }),
      );

      const profile = loadStoredMonthlySpend(mockCategories);
      expect(profile).toEqual({
        transport: 0,
        mart: 0,
        dining: 100000,
      });
    });

    it("writeStoredSpending과 clearStoredSpending이 스토리지에 정상 반영되어야 한다", () => {
      saveMonthlySpend({ transport: 50000, mart: 30000, dining: 20000 });
      expect(localStorage.getItem(SPENDING_STORAGE_KEY)).toBe(
        JSON.stringify({ transport: 50000, mart: 30000, dining: 20000 }),
      );

      clearMonthlySpend();
      expect(localStorage.getItem(SPENDING_STORAGE_KEY)).toBeNull();
    });
  });

  describe("useMonthlySpend 커스텀 훅 테스트", () => {
    it("기존 로컬스토리지에 저장된 값이 있으면 초기 렌더 시 복원되어야 한다", () => {
      localStorage.setItem(
        SPENDING_STORAGE_KEY,
        JSON.stringify({ transport: 120000, mart: 300000, dining: 0 }),
      );

      const { result } = renderHook(() => useMonthlySpend(mockCategories));
      expect(result.current.spending.transport).toBe(120000);
      expect(result.current.spending.mart).toBe(300000);
    });

    it("updateCategory 호출 시 상태가 갱신되고 localStorage에 동기화되어야 한다", () => {
      const { result } = renderHook(() => useMonthlySpend(mockCategories));

      act(() => {
        result.current.updateCategory("mart", 450000);
      });

      expect(result.current.spending.mart).toBe(450000);
      const stored = JSON.parse(localStorage.getItem(SPENDING_STORAGE_KEY) || "{}");
      expect(stored.mart).toBe(450000);
    });

    it("resetSpending 호출 시 모든 카테고리가 0원으로 초기화되고 localStorage에 반영되어야 한다", () => {
      localStorage.setItem(
        SPENDING_STORAGE_KEY,
        JSON.stringify({ transport: 200000, mart: 500000, dining: 300000 }),
      );

      const { result } = renderHook(() => useMonthlySpend(mockCategories));
      expect(result.current.spending.transport).toBe(200000);

      act(() => {
        result.current.resetSpending();
      });

      expect(result.current.spending).toEqual({
        transport: 0,
        mart: 0,
        dining: 0,
      });

      const stored = JSON.parse(localStorage.getItem(SPENDING_STORAGE_KEY) || "{}");
      expect(stored).toEqual({
        transport: 0,
        mart: 0,
        dining: 0,
      });
    });

    it("applyImportedItems가 merge 모드로 파싱된 지출 항목을 기존 지출에 누적하고 음수를 하한 보정해야 한다", () => {
      const { result } = renderHook(() => useMonthlySpend(mockCategories));

      act(() => {
        result.current.updateCategory("transport", 50000);
      });

      const items: ParsedSpendingItem[] = [
        {
          id: "1",
          date: "2026-03-01",
          merchant: "지하철",
          category: "transport",
          amount: 25000,
          rawText: "지하철 25000",
        },
        {
          id: "2",
          date: "2026-03-02",
          merchant: "이마트 환불",
          category: "mart",
          amount: -30000, // 기존 0원에서 음수 반영 시 0원 하한 보정
          rawText: "이마트 환불 -30000",
        },
      ];

      act(() => {
        result.current.applyImportedItems(items, "merge");
      });

      expect(result.current.spending.transport).toBe(75000);
      expect(result.current.spending.mart).toBe(0);
    });

    it("다른 탭의 storage 이벤트 발생 시 변경된 프로필로 상태를 동기화해야 한다", () => {
      const { result } = renderHook(() => useMonthlySpend(mockCategories));

      localStorage.setItem(
        SPENDING_STORAGE_KEY,
        JSON.stringify({ transport: 99000, mart: 88000, dining: 77000 }),
      );

      act(() => {
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: SPENDING_STORAGE_KEY,
            newValue: JSON.stringify({ transport: 99000, mart: 88000, dining: 77000 }),
          }),
        );
      });

      expect(result.current.spending.transport).toBe(99000);
      expect(result.current.spending.mart).toBe(88000);
    });
  });
});
