import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { splitCategories, splitTarget } from "../scripts/splitCategories";

/** 카테고리 3개 나누기(2026-10-31): OTT/구독·기차/고속버스·의류/패션 */
const b = (app_category: string | null, title: string, merchants: string[] = [], specificity = merchants.length ? "brand" : "category") => ({
  title,
  scope: { app_category, specificity, merchants },
});

describe("카테고리 나누기 규칙", () => {
  it("가맹점이 모두 새 카테고리 것이면 옮긴다", () => {
    expect(splitTarget(b("culture", "OTT 10% 캐시백", ["유튜브 프리미엄", "티빙", "넷플릭스"]))).toBe("subscription");
    expect(splitTarget(b("travel", "교통 3% 청구할인", ["한국철도공사(코레일)", "SRT"]))).toBe("intercity");
    expect(splitTarget(b("department", "SPA 브랜드 10% 결제일 할인", ["H&M", "Zara", "유니클로"]))).toBe("fashion");
  });
  it("가맹점이 없는 업종 혜택은 제목으로 본다", () => {
    expect(splitTarget(b("travel", "KTX, SRT 포함 철도 5,000원 결제일할인(건별 30,000원 이상)"))).toBe("intercity");
    expect(splitTarget(b("culture", "디지털 콘텐츠 정기결제 10% 할인"))).toBe("subscription");
    expect(splitTarget(b("department", "패션 5% 적립"))).toBe("fashion");
  });
  it("원래 카테고리 것과 섞이면 옮기지 않는다", () => {
    expect(splitTarget(b("culture", "영화·OTT 할인", ["CGV", "넷플릭스"]))).toBeNull();
    expect(splitTarget(b("travel", "여가 2% 할인 (항공/면세점/철도/공연)"))).toBeNull();
    expect(splitTarget(b("transport", "버스/지하철/택시/철도 7% 청구할인"))).toBeNull();
    expect(splitTarget(b("department", "주요 패션/요식 거리 이용금액 2% 적립"))).toBeNull();
    expect(splitTarget(b("travel", "호텔 10% 할인", ["신라호텔"]))).toBeNull();
  });
  it("이름이 비슷한 다른 소비는 옮기지 않는다(스타벅스 속 '벅스', 가전 구독료, 쇼핑 멤버십)", () => {
    expect(splitTarget(b(null, "해외 스타벅스 30% 청구할인", ["스타벅스"]))).toBeNull();
    expect(splitTarget(b(null, "LG전자 구독요금 결제일 할인", ["LG전자 구독요금"]))).toBeNull();
    expect(splitTarget(b(null, "멤버십 30% 캐시백", ["네이버플러스 멤버십 구독료", "쿠팡로켓와우 멤버십 구독료"]))).toBeNull();
  });
  it("카테고리가 비어 있던 AI 구독 혜택은 OTT/구독으로(엔진이 계산할 수 있게)", () => {
    expect(splitTarget(b(null, "AI 구독 50% 적립", ["ChatGPT", "Claude", "Perplexity"]))).toBe("subscription");
    // 카테고리가 빈 업종 혜택은 제목만 보고 옮기지 않는다
    expect(splitTarget(b(null, "정기결제 청구할인"))).toBeNull();
  });
  it("실적 제외 카테고리에 원래 카테고리가 있으면 새 카테고리도 뺀다", () => {
    const cards = [{ record: { benefits: [], performance: { excluded_app_categories: ["travel"] } } }];
    splitCategories(cards);
    expect(cards[0].record.performance.excluded_app_categories).toEqual(["travel", "intercity"]);
  });
});

describe("혜택 데이터(cards-benefit.json)에 적용됨", () => {
  const data = JSON.parse(readFileSync(resolve(__dirname, "../data/catalog/cards-benefit.json"), "utf-8")) as {
    cards: { record: { benefits: { title: string; scope?: { app_category?: string | null; merchants?: string[] } }[] } }[];
  };
  const all = data.cards.flatMap((c) => c.record.benefits);
  it("다시 돌려도 더 옮길 혜택이 없다", () => {
    expect(all.filter((x) => splitTarget(x)).length).toBe(0);
  });
  it("새 카테고리 3개에 혜택이 있다", () => {
    const n = (cat: string) => all.filter((x) => x.scope?.app_category === cat).length;
    expect(n("subscription")).toBeGreaterThan(300);
    expect(n("intercity")).toBeGreaterThan(60);
    expect(n("fashion")).toBeGreaterThan(10);
  });
});
