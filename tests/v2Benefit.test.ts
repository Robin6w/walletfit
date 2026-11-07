import { describe, expect, it } from "vitest";
import catrank from "./fixtures/v2/catrank_conv.json";
import type { CategoryRankRow } from "@/domain/engine/walletEngine";
import { amountText, dedupeRows, heroVM, noteText, perfText, rowsVM } from "@/v2/model/benefitView";

/**
 * 혜택별 추천 문장 테스트(2026-10-29). fixture는 wf_engine.py categoryRank를 CPython으로 돌린 결과.
 * 편의점 25만원으로 계산한 카드 6장. taptap O는 지출 전체 기준 패키지(커피전문점 30% + 소셜커머스 7%)가 아니라
 * 편의점 혜택이 가장 큰 패키지로 계산한다.
 * 2026-11-07부터 혜택별 추천은 독립 기능이라 자주 가는 곳·내 카드·지갑을 쓰지 않는다(브랜드 비중은 늘 '가정').
 */
const ROWS = (catrank as unknown as { rows: CategoryRankRow[] }).rows;

describe("혜택별 추천", () => {
  it("1위: 패키지를 바꿔야 받는 혜택은 패키지 이름을 적는다, 실적은 입력한 금액만으로", () => {
    const h = heroVM(ROWS, "convenience", 250000, false)!;
    expect(h.name).toBe("삼성카드 taptap O");
    expect(h.badge).toBe("1위 · 전체 카드 중 편의점 혜택이 가장 커요");
    expect(h.note).toBe("트렌디숍(편의점) 7% · 쇼핑 업종 한도 5천원에 걸림 · 패키지 ‘스타벅스 50% + 트렌디숍 7%’");
    expect(h.amountNum).toBe("5,000");
    expect(h.approx).toBe(false);
    expect(h.lead).toBe("편의점 25만원을 이 카드로 낼 때 받는 할인이에요. 실적도 이 25만원만으로 계산했어요.");
  });

  it("내 카드 중에서 찾으면 1위 문구가 '내 카드 중'", () => {
    expect(heroVM(ROWS, "convenience", 250000, false, "mine")!.badge).toBe("1위 · 내 카드 중 편의점 혜택이 가장 커요");
  });

  it("실적 채웠다고 가정: 필요한 실적을 설명과 1위 문장에 적는다", () => {
    const top = { ...ROWS[0], perfMin: 400000, perfBasis: "prev_month" };
    expect(perfText(top)).toBe("전월실적 40만원 이상");
    expect(perfText({ ...top, perfBasis: "this_month" })).toBe("당월실적 40만원 이상");
    expect(perfText({ ...top, perfMin: 0 })).toBeNull();
    expect(perfText({ ...top, perfMin: null })).toBeNull();
    const h = heroVM([top, ...ROWS.slice(1)], "convenience", 250000, true)!;
    expect(h.note).toBe("트렌디숍(편의점) 7% · 전월실적 40만원 이상 · 쇼핑 업종 한도 5천원에 걸림 · 패키지 ‘스타벅스 50% + 트렌디숍 7%’");
    expect(h.lead).toBe("편의점 25만원을 이 카드로 낼 때 받는 할인이에요. 전월실적 40만원 이상일 때예요.");
    expect(heroVM([{ ...top, perfMin: 0 }], "convenience", 250000, true)!.lead).toBe("편의점 25만원을 이 카드로 낼 때 받는 할인이에요. 실적 조건 없이 받아요.");
    // 모든 가맹점 혜택(설명 제목 없음)에도 필요한 실적을 붙인다
    expect(noteText({ ...top, detail: undefined }, "convenience")).toBe("모든 가맹점 혜택 중 편의점 몫이에요 · 전월실적 40만원 이상");
  });

  it("나머지 카드: 한도·횟수·브랜드 비중, 혜택이 없으면 0원", () => {
    const rows = rowsVM(ROWS, "convenience");
    expect(rows.map((r) => [r.name, r.note, r.amountText])).toEqual([
      ["삼성카드 taptap O", "트렌디숍(편의점) 7% · 쇼핑 업종 한도 5천원에 걸림 · 패키지 ‘스타벅스 50% + 트렌디숍 7%’", "월 5,000원"],
      ["D4카드의정석Ⅱ", "편의점 11% · 월 한도 3,300원에 걸림", "월 3,300원"],
      ["신한카드 Mr.Life", "TIME 할인서비스 편의점 10% · 1회 1만원까지 · 월 5회", "월 약 2,700원"],
      ["신한카드 Deep Dream 체크", "더해드림 추가 0.4% - Retail Store 편의점(CU·GS25·세븐일레븐) · 대상 가맹점 비중 70% 가정", "월 약 1,600원"],
      ["삼성 iD ON 카드", "편의점 혜택이 없어요", "월 0원"],
      ["LOCA 365 카드", "편의점 혜택이 없어요", "월 0원"],
    ]);
    expect(rows.map((r) => r.pct)).toEqual([100, 66, 53, 31, 0, 0]);
  });

  it("금액 표기: 한도에 걸리면 원 단위, 아니면 백 원 단위", () => {
    expect(amountText({ ...ROWS[2], value: 2661.2 })).toBe("월 약 2,700원");
    expect(amountText({ ...ROWS[2], value: 640 })).toBe("월 640원");
    expect(amountText({ ...ROWS[1], value: 3300 })).toBe("월 3,300원");
  });

  it("같은 이름·같은 금액 카드는 한 번만", () => {
    const dup = [ROWS[1], { ...ROWS[1], sid: 99999 }, ROWS[2]];
    expect(dedupeRows(dup).map((r) => r.sid)).toEqual([ROWS[1].sid, ROWS[2].sid]);
  });
});
