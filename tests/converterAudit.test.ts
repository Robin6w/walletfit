import { describe, it, expect } from "vitest";
import { toWalletCard, stripCardNameSuffix } from "@/domain/engine/cardConverter";
import type { CatalogListing } from "@/domain/types/catalog";
import { catalogBySourceId, isRestricted, isUnread, issuableCards } from "@/v1/catalog";

// 2026-10-07 전수검사에서 찾은 자동 변환 오류
const entry = (benefitSummary: string): CatalogListing => ({
  sourceId: 999001,
  sourceUrl: "http://example.com/999001",
  name: "시험 카드",
  issuer: "시험카드사",
  category: "체크",
  annualFee: 0,
  benefitSummary,
  fetchedAt: new Date().toISOString(),
});
const rules = (summary: string) => toWalletCard(entry(summary)).tiers[0].benefits;
const rateOf = (summary: string, category: string) => rules(summary).find((r) => r.category === category)?.rate;

describe("자동 변환 수정", () => {
  it("'캐쉬백' 표기 뒤 쉼표에서도 혜택을 나눈다(15%가 다른 혜택에 붙지 않게)", () => {
    const s = "넥슨캐시/세라 온라인충전 15% 캐쉬백, 대중교통,택시 5% 캐쉬백, 온라인쇼핑, 생활 5% 캐쉬백";
    expect(rateOf(s, "transport")).toBeCloseTo(0.05);
    expect(rateOf(s, "onlineShopping")).toBeCloseTo(0.05);
  });

  it("닫는 괄호 뒤 쉼표에서도 나눈다", () => {
    const s = "버스/지하철/택시 10% 할인(캐시백), 커피전문점 20% 할인(캐시백), 백화점  10% 할인(캐시백)";
    expect(rateOf(s, "cafe")).toBeCloseTo(0.2);
    expect(rateOf(s, "transport")).toBeCloseTo(0.1);
  });

  it("'N원당 M원'은 정률로 읽는다", () => {
    expect(rateOf("대중교통 1,000원당 100원 할인", "transport")).toBeCloseTo(0.1);
    expect(rateOf("CU 1,500원당 200원 할인", "convenience")).toBeCloseTo(200 / 1500);
  });

  it("'1,500원/1마일'도 마일 적립으로 읽는다(1마일 15원)", () => {
    expect(rateOf("대한항공형 1,500원/1마일 적립", "etc")).toBeCloseTo(0.01);
  });

  it("요약 끝의 카드 이름 꼬리표는 혜택으로 읽지 않는다", () => {
    expect(stripCardNameSuffix("놀이공원 30~50% 할인 | 농협올원 엘지유플러스카드")).toBe("놀이공원 30~50% 할인");
    expect(rules("생활편의영역 5% 할인 | SKT 라이프 신한카드").some((r) => r.category === "mobile")).toBe(false);
  });

  it("정액 할인을 요율로 바꿀 때 50%를 넘기지 않고, 한도는 원문 금액 그대로다", () => {
    const r = rules("커피 최대 25,000원 할인").find((x) => x.category === "cafe")!;
    expect(r.rate).toBeCloseTo(0.5);
    expect(r.capPerMonth).toBe(25000);
  });
});

describe("대상 한정 카드 제외", () => {
  it("미성년·학생증·외국인·개인사업자·지역 한정 카드는 새 카드 후보에서 빠진다", () => {
    for (const sid of [2782, 2852, 2060, 2639, 2665, 2419, 1610, 1619, 1451, 2919, 2420, 2421, 546, 2756, 2668]) {
      expect(isRestricted(catalogBySourceId.get(sid)!)).toBe(true);
    }
    const ids = new Set(issuableCards({ includeUnverified: true }).map((c) => c.sourceId));
    expect(ids.has(2782)).toBe(false);
  });
});

describe("혜택 정보 없음 표시", () => {
  it("자동 변환에서 혜택을 못 읽은 카드만 '정보 없음'으로 본다", () => {
    expect(isUnread(14)).toBe(true); // 신한카드 YOLO ⓘ: '6개가맹점 할인율 선택'
    expect(isUnread(2312)).toBe(false); // 럭키 유카드: 정답표
  });
});
