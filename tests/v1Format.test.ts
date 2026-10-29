import { describe, it, expect } from "vitest";
import { korWon, approxKor, approxWon, cardMonthly, annualMan } from "@/v1/format";
import { toBrandShare } from "@/domain/engine/walletEngine";

// v1_최종디자인/구현명세.md '숫자·문구 규칙'
describe("v1 숫자 표기", () => {
  it("헤드라인·지출은 천 원 단위 한글", () => {
    expect(korWon(323935)).toBe("32만 4천원");
    expect(approxKor(33357)).toBe("약 3만 3천원");
    expect(korWon(2000)).toBe("2천원");
    expect(korWon(1000000)).toBe("100만원");
  });
  it("요약 줄은 쉼표 + 약", () => {
    expect(approxWon(33357)).toBe("약 33,000원");
  });
  it("카드별 월 혜택: 확정이면 원 단위, 아니면 백 원 단위 + 약", () => {
    expect(cardMonthly(19800, true)).toBe("월 19,800원");
    expect(cardMonthly(15390, false)).toBe("월 약 15,400원");
  });
  it("연간은 만 원 단위", () => {
    expect(annualMan(33357)).toBe("약 40만원");
  });
});

describe("자주 가는 곳 → 브랜드 비중", () => {
  it("입력한 카테고리만 비중으로 바꾸고, 비운 카테고리는 넣지 않는다(35% 추정)", () => {
    const share = toBrandShare({ cafe: 180000, convenience: 250000 }, { cafe: { 스타벅스: 72000, 투썸플레이스: 27000 } });
    expect(share.cafe["스타벅스"]).toBeCloseTo(0.4);
    expect(share.cafe["투썸플레이스"]).toBeCloseTo(0.15);
    expect(share.convenience).toBeUndefined();
  });
});
