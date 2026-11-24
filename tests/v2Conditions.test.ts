import { describe, expect, it } from "vitest";
import { conditionsSummary, feeCapText, kindsText } from "@/v2/model/conditionsView";

/** 결과 화면 '계산 조건' 띠의 한 줄 요약(2026-10-29) */
describe("계산 조건 요약", () => {
  const base = { maxCards: 5, kinds: ["credit", "check"] as ("credit" | "check")[], margin: 20000, noMargin: false, feeCap: null, pinned: 0 };
  it("기본값(계산 방식 선택은 2026-11-23에 빼서 요약에도 없다)", () => {
    expect(conditionsSummary(base).join(" · ")).toBe("최대 5장 · 신용·체크 · 실적 여유 2만원 · 연회비 제한 없음");
  });
  it("바꾼 조건(카드사 제외는 2026-11-24에 뺐다)", () => {
    expect(conditionsSummary({ ...base, maxCards: 3, kinds: ["credit"], noMargin: true, feeCap: 30000, pinned: 1 })).toEqual([
      "최대 3장",
      "신용카드만",
      "실적 여유 없음",
      "연회비 합계 연 3만원까지",
      "꼭 넣을 카드 1장",
    ]);
  });
  it("낱말", () => {
    expect(kindsText(["check"])).toBe("체크카드만");
    expect(kindsText([])).toBe("카드 종류 없음");
    expect(feeCapText(100000)).toBe("연회비 합계 연 10만원까지");
  });
});
