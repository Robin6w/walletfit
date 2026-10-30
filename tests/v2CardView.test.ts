import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { CardViewBenefit, CardViewEntry, CardViewFile } from "@/domain/types/cardView";
import { benefitChips, capText, conditionTexts, feeDetailText, groupBenefits, matchedChip, matchesBenefit, perfText, rewardText, tierText, valueText } from "@/v2/model/cardView";

/**
 * 전체 카드 화면·카드 상세 창 문구(2026-10-30). 혜택 표를 줄인 card-view.json을 읽기 쉬운 글로 바꾼다.
 */
const b = (over: Partial<CardViewBenefit>): CardViewBenefit => ({
  id: "x", t: "", c: null, k: "discount", ty: "percent", v: [{ tier: null, value: 0.01 }], caps: [], st: "auto", q: "", m: [], ch: "any", reg: "any", ...over,
});
const entry = (over: Partial<CardViewEntry>): CardViewEntry => ({
  st: "extracted", basis: "prev_month", tiers: [], exItems: [], exCats: [], disc: false, grace: null, shared: [], choice: [], b: [], ...over,
});

describe("카드 혜택 문구", () => {
  it("혜택 크기: 비율·건당·리터당·적립 단위, 실적 구간별이면 범위", () => {
    expect(valueText(b({ v: [{ tier: null, value: 0.012 }] }))).toBe("1.2%");
    expect(valueText(b({ v: [{ tier: "t1", value: 0.02 }, { tier: "t0", value: 0.005 }] }))).toBe("0.5~2%");
    expect(valueText(b({ ty: "won_per_txn", v: [{ tier: null, value: 2000 }] }))).toBe("건당 2천원");
    expect(valueText(b({ ty: "won_per_liter", v: [{ tier: "t0", value: 60 }, { tier: "t1", value: 100 }] }))).toBe("리터당 60~100원");
    expect(rewardText(b({ ty: "per_unit_spend", k: "mileage", unit: 1500, v: [{ tier: null, value: 1 }] }))).toBe("1,500원당 1마일");
    expect(rewardText(b({ k: "point", v: [{ tier: null, value: 0.3 }] }))).toBe("30% 적립");
  });

  it("크기를 못 읽은 혜택, 소수 적립 단위", () => {
    expect(rewardText(b({ v: [{ tier: null, value: 0 }] }))).toBe("할인 · 크기는 원문 참고");
    expect(valueText(b({ ty: "per_unit_spend", unit: 10000, v: [{ tier: null, value: 1 / 3 }] }))).toBe("10,000원당 0.33점");
  });

  it("검색어로 혜택 찾기, 연회비 상세 글", () => {
    const e = entry({ b: [b({ t: "커피 30% 할인", m: ["스타벅스", "커피빈"], v: [{ tier: null, value: 0.3 }] })] });
    expect(matchesBenefit(e, "스타벅스")).toBe(true);
    expect(matchesBenefit(e, "이디야")).toBe(false);
    expect(matchedChip(e, "스타벅스")).toBe("커피 30% 할인");
    expect(feeDetailText("국내전용 [19,900]원 / 해외겸용 [19,900]원", 19900)).toBe("");
    expect(feeDetailText("국내전용 [10,000]원 / 해외겸용 [12,000]원", 10000)).toBe("국내전용 10,000원 / 해외겸용 12,000원");
  });

  it("조건: 실적 구간별 한도, 건당 최대, 횟수, 채널", () => {
    const x = b({
      caps: [{ period: "month", amounts: [{ tier: "t1", won: 30000 }, { tier: "t0", won: 10000 }] }],
      perTxn: 5000, cnt: { per_day: 1, per_month: 5 }, minTxn: 10000, ch: "online", pc: "KB Pay 결제 시",
    });
    expect(capText(x)).toBe("월 1만~3만원 한도");
    expect(conditionTexts(x)).toEqual(["월 1만~3만원 한도", "건당 최대 5천원", "하루 1회 · 월 5회", "1만원 이상 결제", "온라인", "KB Pay 결제 시"]);
  });

  it("목록 칩: 카테고리마다 가장 큰 혜택 하나, 계산 제외·앱 카테고리 밖 업종 혜택은 빼고", () => {
    const e = entry({
      b: [
        b({ c: null, all: true, v: [{ tier: null, value: 0.01 }] }),
        b({ c: null, v: [{ tier: null, value: 0.3 }] }),
        b({ c: "cafe", v: [{ tier: null, value: 0.3 }] }),
        b({ c: "cafe", v: [{ tier: null, value: 0.1 }] }),
        b({ c: "gas", ty: "won_per_liter", v: [{ tier: null, value: 60 }] }),
        b({ c: "mart", st: "no_calc", v: [{ tier: null, value: 0.5 }] }),
      ],
    });
    expect(benefitChips(e)).toEqual(["카페 30%", "주유 리터당 60원", "전 가맹점 1%"]);
    expect(benefitChips(e, 3, "gas")[0]).toBe("주유 리터당 60원");
    // '전 가맹점'인데 5% 이상이면 결제 수단 조건인 경우가 많아 칩에서 뺀다
    expect(benefitChips(entry({ b: [b({ c: null, all: true, v: [{ tier: null, value: 0.2 }] })] }))).toEqual([]);
  });

  it("실적 조건 한 줄과 구간 이름", () => {
    expect(perfText(entry({ basis: "none" }))).toBe("실적 조건 없음");
    expect(perfText(entry({ tiers: [{ id: "t1", min: 300000, max: null }] }))).toBe("전월 30만원 이상");
    expect(perfText(entry({ tiers: [{ id: "t0", min: 300000, max: 500000 }, { id: "t1", min: 1000000, max: null }] }))).toBe("전월 30만~100만원 구간별");
    expect(perfText(entry({ basis: "unknown" }))).toBe("실적 조건 확인 필요");
    expect(tierText({ min: 300000, max: 500000 })).toBe("30만~50만원");
    expect(tierText({ min: 1000000, max: null })).toBe("100만원 이상");
  });

  it("상세 묶음: 앱 카테고리 순서, 전 가맹점·그 밖의 업종·해외는 뒤, 같은 글은 한 번만", () => {
    const g = groupBenefits(entry({ b: [b({ c: null }), b({ c: null, all: true }), b({ reg: "overseas" }), b({ c: "onlineShopping" }), b({ c: "cafe", t: "A" }), b({ c: "cafe", t: "A" })] }));
    expect(g.map((x) => x.name)).toEqual(["카페", "온라인쇼핑", "전 가맹점", "그 밖의 업종", "해외"]);
    expect(g[0].items).toHaveLength(1);
  });

  it("칩 순서: 한도·횟수로 줄인 크기(건당 1만원이라도 연 2만원 한도면 월 약 1,700원 < 3%)", () => {
    const coupon = b({ c: "travel", ty: "won_per_txn", v: [{ tier: null, value: 10000 }], caps: [{ period: "year", amounts: [{ tier: null, won: 20000 }] }] });
    const pct = b({ c: "cafe", v: [{ tier: null, value: 0.03 }] });
    expect(benefitChips(entry({ b: [coupon, pct] }))).toEqual(["카페 3%", "여행 건당 1만원"]);
  });

  it("실제 혜택 표(HERITAGE Classic 할인형): 실적 50만원, 실적 제외 항목, 유예 1개월", () => {
    const file = JSON.parse(readFileSync(path.resolve(__dirname, "../data/catalog/card-view.json"), "utf-8")) as CardViewFile;
    const e = file.cards["2780"];
    expect(perfText(e)).toBe("전월 50만원 이상");
    expect(e.exItems.length).toBeGreaterThan(10);
    expect(e.grace).toBe(1);
    expect(benefitChips(e).length).toBeGreaterThan(0);
    // 혜택 표가 있는 카드는 모두 들어 있다
    expect(Object.keys(file.cards).length).toBeGreaterThanOrEqual(1500);
  });
});
