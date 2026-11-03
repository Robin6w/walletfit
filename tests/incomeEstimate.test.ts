import { describe, expect, it } from "vitest";
import spendModel from "@data/catalog/spend-model.json";
import categoriesJson from "@data/categories.json";
import type { SpendCategory } from "@/domain/types/card";
import {
  MAX_CARD_SPEND_RATIO,
  MIN_CARD_SPEND_RATIO,
  categoryShares,
  defaultCardSpendRatio,
  estimateSpendingFromIncome,
} from "@/domain/engine/incomeEstimate";

const categories = categoriesJson as unknown as SpendCategory[];
const ids = categories.map((c) => c.id);

// 2026-11-03 소득 → 지출 추정을 통계청 가계동향조사 모델(data/catalog/spend-model.json)로 바꿈
describe("소득으로 지출 채우기(가계동향조사 모델)", () => {
  it("소득이 오르면 카드 지출 비율은 내려가고, 허용 범위 안에 있다", () => {
    const rs = [1_000_000, 3_000_000, 5_000_000, 10_000_000].map(defaultCardSpendRatio);
    for (let i = 1; i < rs.length; i++) expect(rs[i]).toBeLessThan(rs[i - 1]);
    for (const r of rs) {
      expect(r).toBeGreaterThanOrEqual(MIN_CARD_SPEND_RATIO);
      expect(r).toBeLessThanOrEqual(MAX_CARD_SPEND_RATIO);
    }
  });

  it("모든 카테고리를 0 이상으로 채우고, 합이 소득 × 비율과 같다", () => {
    const income = 4_000_000;
    const s = estimateSpendingFromIncome(income, categories);
    expect(Object.keys(s).sort()).toEqual([...ids].sort());
    for (const v of Object.values(s)) expect(v).toBeGreaterThanOrEqual(0);
    const total = Object.values(s).reduce((a, b) => a + b, 0);
    expect(Math.abs(total - income * defaultCardSpendRatio(income))).toBeLessThan(ids.length); // 반올림 오차만
  });

  it("지출이 클수록 교육·여행 비중이 커지고 병원·생활요금 비중은 작아진다(엥겔 곡선)", () => {
    const lo = categoryShares(1_200_000, ids);
    const hi = categoryShares(4_400_000, ids);
    expect(hi.education).toBeGreaterThan(lo.education);
    expect(hi.travel).toBeGreaterThan(lo.travel);
    expect(hi.medical).toBeLessThan(lo.medical);
    expect(hi.bills).toBeLessThan(lo.bills);
  });

  it("2025 3분위 소득을 넣으면 통계청 3분위 카드 지출과 10% 안에서 맞는다", () => {
    const q3 = spendModel.profiles2025["3분위"];
    const s = estimateSpendingFromIncome(q3.income, categories);
    const total = Object.values(s).reduce((a, b) => a + b, 0);
    expect(Math.abs(total - q3.cardable) / q3.cardable).toBeLessThan(0.1);
  });

  it("사용자가 고른 비율을 그대로 쓴다", () => {
    const s = estimateSpendingFromIncome(5_000_000, categories, 0.3);
    const total = Object.values(s).reduce((a, b) => a + b, 0);
    expect(Math.abs(total - 1_500_000)).toBeLessThan(ids.length);
  });
});
