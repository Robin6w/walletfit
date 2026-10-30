import { describe, it, expect } from "vitest";
import { inferBrandScope } from "@/domain/engine/brandScope";
import { parseTextLocally } from "@/features/statement/importerParser";
import benefit from "@data/catalog/cards-benefit.json";

// 자동 변환 카드의 브랜드 한정 표시(2026-10-07). 정답표와 같은 규칙: 1~3곳 brand, 4곳 이상 merchant_group
describe("브랜드 한정 판단", () => {
  it("브랜드 이름만 있으면 그 브랜드로 한정한다", () => {
    expect(inferBrandScope("cafe", ["1만원이상 결제시 럭키권 1장 발급, 커피빈 15% 할인"])).toEqual({ specificity: "brand", merchants: ["커피빈"] });
    expect(inferBrandScope("cafe", ["스타벅스, 폴바셋 10% 할인"])).toEqual({ specificity: "brand", merchants: ["스타벅스", "폴바셋"] });
    expect(inferBrandScope("convenience", ["CU편의점 최대 7% 청구할인"])).toEqual({ specificity: "brand", merchants: ["CU"] });
  });

  it("다른 표기는 대표 이름으로 묶는다", () => {
    expect(inferBrandScope("cafe", ["EDIYA 30% 할인"]).merchants).toEqual(["이디야"]);
    expect(inferBrandScope("mobile", ["SK텔레콤 요금 최대 15,000원 청구할인"]).merchants).toEqual(["SKT"]);
  });

  it("업종 이름만 있거나 '등'으로 넓히면 업종 전체로 둔다", () => {
    expect(inferBrandScope("cafe", ["커피전문점/제과점 10% 할인"]).specificity).toBe("category");
    expect(inferBrandScope("cafe", ["스타벅스 등 커피전문점 10% 할인"]).specificity).toBe("category");
  });

  it("통신 3사를 모두 적으면 업종 전체, 'KTX'의 KT는 통신사로 읽지 않는다", () => {
    expect(inferBrandScope("mobile", ["SKT, KT, LG U+ 통신요금 5% 할인"]).specificity).toBe("category");
    expect(inferBrandScope("mobile", ["KTX 10% 할인"]).specificity).toBe("category");
  });

  it("브랜드가 4곳 이상이면 가맹점 묶음으로 본다", () => {
    expect(inferBrandScope("cafe", ["스타벅스, 투썸, 이디야, 할리스 10% 할인"]).specificity).toBe("merchant_group");
  });
});

describe("자동 변환 혜택 표", () => {
  const cards = (benefit as { cards: { sid: number; status: string; record: { benefits: { scope: { app_category: string; specificity: string; merchants: string[] } }[] } }[] }).cards;
  const bySid = new Map(cards.map((c) => [c.sid, c]));

  it("청춘대로 톡톡카드의 스타벅스 50%는 카페 전체가 아니라 스타벅스 한정이다", () => {
    const c = bySid.get(129)!;
    expect(c.status).toBe("extracted"); // 10-30부터 원문 전체 정제 표(예전엔 자동 변환)
    const cafe = c.record.benefits.find((b) => b.scope.app_category === "cafe")!;
    expect(cafe.scope).toMatchObject({ specificity: "brand", merchants: ["스타벅스"] });
  });

  it("'SK텔레콤' 표기만 쓴 카드도 통신 혜택을 읽는다", () => {
    const c = bySid.get(227)!;
    expect(c.record.benefits.some((b) => b.scope.app_category === "mobile" && b.scope.merchants.includes("SKT"))).toBe(true);
  });

  it("검수한 카드(정답표·AI 추출)는 자동 변환 규칙의 영향을 받지 않는다", () => {
    const lucky = bySid.get(2312)!; // 럭키 유카드: 정답표
    expect(lucky.status).not.toBe("auto");
  });
});

describe("명세서 가맹점 분류에 추가한 이름", () => {
  it("영문 EDIYA, SK텔레콤, AK플라자를 분류한다", () => {
    const text = [
      "[신한체크승인] 홍길동 08/23 14:15 EDIYA강남점 4,500원",
      "[신한체크승인] 홍길동 08/24 09:00 SK텔레콤 55,000원",
      "[신한체크승인] 홍길동 08/25 18:30 AK플라자수원 32,000원",
    ].join("\n");
    expect(parseTextLocally(text).map((r) => r.category)).toEqual(["cafe", "mobile", "department"]);
  });
});
