import { describe, it, expect } from "vitest";
import { toWalletCard } from "@/domain/engine/cardConverter";
import type { CatalogListing } from "@/domain/types/catalog";

describe("toWalletCard", () => {
  it("혜택 요약에서 편의점 및 카페 할인율을 올바르게 추출한다", () => {
    const entry: CatalogListing = {
      sourceId: 101,
      sourceUrl: "http://example.com/101",
      name: "테스트 신용카드",
      issuer: "테스트카드사",
      category: "신용",
      annualFee: 10000,
      benefitSummary: "GS25 편의점 10% 할인, 스타벅스 20% 적립",
      fetchedAt: new Date().toISOString(),
    };

    const card = toWalletCard(entry);
    expect(card.id).toBe("catalog-101");
    expect(card.name).toBe("테스트 신용카드");
    expect(card.cardType).toBe("credit");
    expect(card.annualFee).toBe(10000);
    expect(card.tiers).toHaveLength(1);
    expect(card.tiers[0].minSpend).toBe(0);

    const benefits = card.tiers[0].benefits;
    // Should have convenience (10%) and cafe (20%)
    const convenienceBenefit = benefits.find((b) => b.category === "convenience");
    expect(convenienceBenefit).toBeDefined();
    expect(convenienceBenefit?.rate).toBeCloseTo(0.1);
    expect(convenienceBenefit?.type).toBe("discount");

    const cafeBenefit = benefits.find((b) => b.category === "cafe");
    expect(cafeBenefit).toBeDefined();
    expect(cafeBenefit?.rate).toBeCloseTo(0.2);
    expect(cafeBenefit?.type).toBe("point");
  });

  it("주유 L당 할인 정보를 약 4% 할인율로 변환한다", () => {
    const entry: CatalogListing = {
      sourceId: 102,
      sourceUrl: "http://example.com/102",
      name: "테스트 주유카드",
      issuer: "테스트카드사",
      category: "체크",
      annualFee: 0,
      benefitSummary: "S-OIL 60원/L 할인, 모든 가맹점 0.5% 캐시백",
      fetchedAt: new Date().toISOString(),
    };

    const card = toWalletCard(entry);
    expect(card.cardType).toBe("check");
    
    const benefits = card.tiers[0].benefits;
    const gasBenefit = benefits.find((b) => b.category === "gas");
    expect(gasBenefit).toBeDefined();
    expect(gasBenefit?.rate).toBeCloseTo(0.04);
    expect(gasBenefit?.type).toBe("discount");

    const etcBenefit = benefits.find((b) => b.category === "etc");
    expect(etcBenefit).toBeDefined();
    expect(etcBenefit?.rate).toBeCloseTo(0.005);
    expect(etcBenefit?.type).toBe("cashback");
  });

  it("혜택 정보가 없거나 해석할 수 없는 경우 기본 etc 혜택을 부여한다", () => {
    const entry: CatalogListing = {
      sourceId: 103,
      sourceUrl: "http://example.com/103",
      name: "정보부족 카드",
      issuer: "테스트카드사",
      category: "신용",
      fetchedAt: new Date().toISOString(),
    };

    const card = toWalletCard(entry);
    const benefits = card.tiers[0].benefits;
    expect(benefits).toHaveLength(1);
    expect(benefits[0].category).toBe("etc");
    expect(benefits[0].rate).toBeCloseTo(0.007);
    expect(benefits[0].type).toBe("discount");
  });

  it("한 구절에 여러 카테고리 키워드가 포함된 경우 모든 카테고리에 혜택을 부여한다", () => {
    const entry: CatalogListing = {
      sourceId: 104,
      sourceUrl: "http://example.com/104",
      name: "다중 카테고리 카드",
      issuer: "테스트카드사",
      category: "신용",
      benefitSummary: "이마트 및 GS25 10% 할인",
      fetchedAt: new Date().toISOString(),
    };

    const card = toWalletCard(entry);
    const benefits = card.tiers[0].benefits;
    
    // mart (이마트)와 convenience (GS25) 혜택이 모두 포함되어야 함
    const martBenefit = benefits.find((b) => b.category === "mart");
    expect(martBenefit).toBeDefined();
    expect(martBenefit?.rate).toBeCloseTo(0.1);

    const convenienceBenefit = benefits.find((b) => b.category === "convenience");
    expect(convenienceBenefit).toBeDefined();
    expect(convenienceBenefit?.rate).toBeCloseTo(0.1);
  });

  it("명사가 나열된 쉼표와 혜택 구분자 쉼표를 올바르게 구분하여 분할한다", () => {
    const entry: CatalogListing = {
      sourceId: 105,
      sourceUrl: "http://example.com/105",
      name: "나열 카드",
      issuer: "테스트카드사",
      category: "신용",
      benefitSummary: "마트,편의점 10% 할인, 스타벅스 20% 적립",
      fetchedAt: new Date().toISOString(),
    };

    const card = toWalletCard(entry);
    const benefits = card.tiers[0].benefits;

    // mart (이마트/마트) 10%, convenience (편의점) 10%, cafe (스타벅스) 20%
    const martBenefit = benefits.find((b) => b.category === "mart");
    expect(martBenefit).toBeDefined();
    expect(martBenefit?.rate).toBeCloseTo(0.1);

    const convenienceBenefit = benefits.find((b) => b.category === "convenience");
    expect(convenienceBenefit).toBeDefined();
    expect(convenienceBenefit?.rate).toBeCloseTo(0.1);

    const cafeBenefit = benefits.find((b) => b.category === "cafe");
    expect(cafeBenefit).toBeDefined();
    expect(cafeBenefit?.rate).toBeCloseTo(0.2);
  });

  it("다양한 주유 리터당 할인금액(예: 150원/L)을 1,500원 기준으로 정확한 비율(10%)로 파싱한다", () => {
    const entry: CatalogListing = {
      sourceId: 106,
      sourceUrl: "http://example.com/106",
      name: "고주유 할인카드",
      issuer: "테스트카드사",
      category: "신용",
      benefitSummary: "S-OIL 리터당 150원 할인",
      fetchedAt: new Date().toISOString(),
    };

    const card = toWalletCard(entry);
    const benefits = card.tiers[0].benefits;

    const gasBenefit = benefits.find((b) => b.category === "gas");
    expect(gasBenefit).toBeDefined();
    expect(gasBenefit?.rate).toBeCloseTo(0.1);
  });

  it("마일리지 적립 카드(예: 1,500원당 1마일 적립, 1,000원당 2마일 적립)를 etc 카테고리와 정확한 할인율로 파싱한다", () => {
    const entry1: CatalogListing = {
      sourceId: 107,
      sourceUrl: "http://example.com/107",
      name: "대한항공 마일리지 카드",
      issuer: "테스트카드사",
      category: "신용",
      benefitSummary: "대한항공 1,500원당 1마일 적립",
      fetchedAt: new Date().toISOString(),
    };

    const card1 = toWalletCard(entry1);
    const benefits1 = card1.tiers[0].benefits;
    const mileBenefit1 = benefits1.find((b) => b.category === "etc");
    expect(mileBenefit1).toBeDefined();
    expect(mileBenefit1?.rate).toBeCloseTo(0.01); // (1 * 15) / 1500 = 1%
    expect(mileBenefit1?.type).toBe("point");

    const entry2: CatalogListing = {
      sourceId: 108,
      sourceUrl: "http://example.com/108",
      name: "아시아나 마일리지 카드",
      issuer: "테스트카드사",
      category: "신용",
      benefitSummary: "아시아나 1,000원당 2마일 적립",
      fetchedAt: new Date().toISOString(),
    };

    const card2 = toWalletCard(entry2);
    const benefits2 = card2.tiers[0].benefits;
    const mileBenefit2 = benefits2.find((b) => b.category === "etc");
    expect(mileBenefit2).toBeDefined();
    expect(mileBenefit2?.rate).toBeCloseTo(0.03); // (2 * 15) / 1000 = 3%
    expect(mileBenefit2?.type).toBe("point");
  });

  it("대중교통의 정액 할인 범위(예: 200~600원 할인) 및 이동통신 정액 할인(예: 5,000원 할인)을 동적으로 올바른 할인율로 파싱한다", () => {
    const entry1: CatalogListing = {
      sourceId: 109,
      sourceUrl: "http://example.com/109",
      name: "교통 할인카드",
      issuer: "테스트카드사",
      category: "신용",
      benefitSummary: "대중교통 200~600원 할인",
      fetchedAt: new Date().toISOString(),
    };

    const card1 = toWalletCard(entry1);
    const benefits1 = card1.tiers[0].benefits;
    const transportBenefit = benefits1.find((b) => b.category === "transport");
    expect(transportBenefit).toBeDefined();
    // 평균 400원 / 기준 1,500원 = 26.67% 할인
    expect(transportBenefit?.rate).toBeCloseTo(0.2667);

    const entry2: CatalogListing = {
      sourceId: 110,
      sourceUrl: "http://example.com/110",
      name: "통신 할인카드",
      issuer: "테스트카드사",
      category: "신용",
      benefitSummary: "이동통신요금 5,000원 할인",
      fetchedAt: new Date().toISOString(),
    };

    const card2 = toWalletCard(entry2);
    const benefits2 = card2.tiers[0].benefits;
    const mobileBenefit = benefits2.find((b) => b.category === "mobile");
    expect(mobileBenefit).toBeDefined();
    // 5,000원 / 기준 50,000원 = 10% 할인
    expect(mobileBenefit?.rate).toBeCloseTo(0.1);
  });

  it("KTX/SRT처럼 통신비 키워드 'KT'를 통째로 포함하는 교통 혜택을 통신비로 잘못 분류하지 않는다", () => {
    const entry: CatalogListing = {
      sourceId: 111,
      sourceUrl: "http://example.com/111",
      name: "SOCAR 제휴 SOCAR 신한카드",
      issuer: "신한카드",
      category: "신용",
      benefitSummary: "SOCAR 30% 할인, KTX/SRT 10% 할인, 커피전문점 20% 할인",
      fetchedAt: new Date().toISOString(),
    };

    const card = toWalletCard(entry);
    const benefits = card.tiers[0].benefits;

    const transportBenefit = benefits.find((b) => b.category === "transport");
    expect(transportBenefit).toBeDefined();
    expect(transportBenefit?.rate).toBeCloseTo(0.1);

    // "KTX"에 "KT"가 통째로 들어있다고 해서 통신비 혜택이 잘못 생기면 안 된다.
    expect(benefits.find((b) => b.category === "mobile")).toBeUndefined();

    const cafeBenefit = benefits.find((b) => b.category === "cafe");
    expect(cafeBenefit).toBeDefined();
    expect(cafeBenefit?.rate).toBeCloseTo(0.2);
  });

  it("쿠팡이츠처럼 온라인쇼핑 키워드 '쿠팡'을 통째로 포함하는 외식 혜택을 온라인쇼핑으로 잘못 분류하지 않는다", () => {
    const entry: CatalogListing = {
      sourceId: 112,
      sourceUrl: "http://example.com/112",
      name: "테스트 배달카드",
      issuer: "테스트카드사",
      category: "신용",
      benefitSummary: "쿠팡이츠 10% 할인",
      fetchedAt: new Date().toISOString(),
    };

    const card = toWalletCard(entry);
    const benefits = card.tiers[0].benefits;

    expect(benefits.find((b) => b.category === "dining")).toBeDefined();
    expect(benefits.find((b) => b.category === "onlineShopping")).toBeUndefined();
  });

  it("'슈퍼적립'이나 '제주지니'처럼 우연히 다른 카테고리 키워드를 포함한 마케팅 문구는 그 카테고리로 분류하지 않는다", () => {
    const superEntry: CatalogListing = {
      sourceId: 113,
      sourceUrl: "http://example.com/113",
      name: "플러스마일카드",
      issuer: "테스트카드사",
      category: "신용",
      benefitSummary: "슈퍼적립 1,000원당 3마일 적립",
      fetchedAt: new Date().toISOString(),
    };
    const superCard = toWalletCard(superEntry);
    expect(superCard.tiers[0].benefits.find((b) => b.category === "mart")).toBeUndefined();

    const jejuEntry: CatalogListing = {
      sourceId: 114,
      sourceUrl: "http://example.com/114",
      name: "JEJUJINI Air Money카드",
      issuer: "테스트카드사",
      category: "신용",
      benefitSummary: "제주지니 가맹점 3% 청구할인",
      fetchedAt: new Date().toISOString(),
    };
    const jejuCard = toWalletCard(jejuEntry);
    expect(jejuCard.tiers[0].benefits.find((b) => b.category === "culture")).toBeUndefined();
  });
});
