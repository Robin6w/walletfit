import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { brandMatchers, cleanLine, summarizeStatement } from "@/v2/model/statement";

const sample = readFileSync(resolve(__dirname, "../public/samples/walletfit-sample-statement.csv"), "utf-8");

describe("명세서 요약(v2)", () => {
  it("예시 명세서: 카테고리 금액이 디자인 시나리오(월 83만 5천원)와 같다", () => {
    const s = summarizeStatement(sample);
    // 10-30부터 배달의민족 3만 5천원은 외식이 아니라 배달(디자인 시나리오의 외식 7만 = 외식 3만 5천 + 배달 3만 5천)
    expect(s.spending).toEqual({ convenience: 250000, cafe: 180000, transport: 80000, mobile: 140000, onlineShopping: 65000, dining: 35000, delivery: 35000, gas: 50000 });
    expect(s.period).toBe("2026년 9월");
    expect(s.months).toBe(1);
    expect(s.itemCount).toBe(79);
  });
  it("예시 명세서: 브랜드 금액", () => {
    const s = summarizeStatement(sample);
    expect(s.brands.cafe).toEqual({ 스타벅스: 72000, 투썸플레이스: 27000, 메가MGC커피: 21000 });
    expect(s.brands.convenience).toEqual({ GS25: 160000, CU: 50000, 세븐일레븐: 40000 });
    expect(s.brands.onlineShopping).toEqual({ 쿠팡: 45000 });
    expect(s.brands.delivery).toEqual({ 배달의민족: 35000 });
    expect(s.brands.gas).toEqual({ SK에너지: 50000 });
  });
  it("날짜·연도·시간을 금액으로 읽지 않는다", () => {
    expect(cleanLine("2026.09.03 14:22 스타벅스 강남점 6,500원")).toBe("스타벅스 강남점 6,500원");
    expect(cleanLine("09/03 GS25 역삼점 4,800")).toBe("GS25 역삼점 4,800");
    const s = summarizeStatement("2026년 9월 이용내역\n이용기간 2026.09.01 ~ 2026.09.30\n2026-09-03 스타벅스 역삼점 6,500원\n합계 6,500원");
    expect(s.spending).toEqual({ cafe: 6500 });
    expect(s.itemCount).toBe(1);
  });
  it("환불은 빼고, 두 달이면 월평균", () => {
    const s = summarizeStatement("2026.08.02 쿠팡 30,000원\n2026.09.05 쿠팡 50,000원\n2026.09.06 쿠팡 결제취소 -10,000원");
    expect(s.months).toBe(2);
    expect(s.period).toBe("2026년 8월~9월");
    expect(s.spending).toEqual({ onlineShopping: 35000 });
    expect(s.brands.onlineShopping).toEqual({ 쿠팡: 35000 });
    expect(s.refundCount).toBe(1);
  });
  it("짧은 영문 브랜드(CU)는 낱말 경계로만 찾는다", () => {
    const m = brandMatchers();
    const cu = (line: string) => m.find((x) => x.test(line))?.brand;
    expect(cu("CU 역삼점 3,000")).toBe("CU");
    expect(cu("CUCUMBER 샐러드 9,000")).toBeUndefined();
  });
});
