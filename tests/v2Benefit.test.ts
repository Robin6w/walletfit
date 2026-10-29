import { describe, expect, it } from "vitest";
import catrank from "./fixtures/v2/catrank_conv.json";
import type { CategoryRankRow } from "@/domain/engine/walletEngine";
import { amountText, comboText, dedupeRows, heroVM, noteText, rowsVM } from "@/v2/model/benefitView";

/**
 * 혜택별 추천 문장 테스트(2026-10-29). fixture는 wf_engine.py categoryRank를 CPython으로 돌린 결과.
 * 가진 카드 6장, 편의점 25만원(자주 가는 곳 GS25), 지출 입력 전체 월 83만 5천원.
 * taptap O는 지출 전체 기준 패키지(커피전문점 30% + 소셜커머스 7%)가 아니라 편의점 혜택이 가장 큰 패키지로 계산한다.
 */
const ROWS = (catrank as unknown as { rows: CategoryRankRow[] }).rows;

describe("혜택별 추천", () => {
  it("1위: 패키지를 바꿔야 받는 혜택은 패키지 이름을 적는다", () => {
    const h = heroVM(ROWS, "convenience", 250000, 835000, "mine", true)!;
    expect(h.name).toBe("삼성카드 taptap O");
    expect(h.badge).toBe("1위 · 내 카드 중 편의점 혜택이 가장 커요");
    expect(h.note).toBe("트렌디숍(편의점) 7% · 쇼핑 업종 한도 5천원에 걸림 · 패키지 ‘스타벅스 50% + 트렌디숍 7%’");
    expect(h.amountNum).toBe("5,000");
    expect(h.approx).toBe(false);
    expect(h.lead).toBe("편의점 25만원을 이 카드로 낼 때 받는 할인이에요. 실적은 지출 입력의 월 83만 5천원 기준이에요.");
    expect(heroVM(ROWS, "convenience", 250000, 835000, "all", true)!.badge).toBe("1위 · 발급 가능한 카드 중 편의점 혜택이 가장 커요");
  });

  it("나머지 카드: 한도·횟수·브랜드 비중, 혜택이 없으면 0원", () => {
    const rows = rowsVM(ROWS, "convenience", true);
    expect(rows.map((r) => [r.name, r.note, r.amountText])).toEqual([
      ["삼성카드 taptap O", "트렌디숍(편의점) 7% · 쇼핑 업종 한도 5천원에 걸림 · 패키지 ‘스타벅스 50% + 트렌디숍 7%’", "월 5,000원"],
      ["D4카드의정석Ⅱ", "편의점 11% · 월 한도 3,300원에 걸림", "월 3,300원"],
      ["신한카드 Mr.Life", "TIME 할인서비스 편의점 10% · 1회 1만원까지 · 월 5회", "월 약 2,700원"],
      ["신한카드 Deep Dream 체크", "더해드림 추가 0.4% - Retail Store 편의점(CU·GS25·세븐일레븐) · 입력한 브랜드 비중 70%", "월 약 1,600원"],
      ["삼성 iD ON 카드", "편의점 혜택이 없어요", "월 0원"],
      ["LOCA 365 카드", "편의점 혜택이 없어요", "월 0원"],
    ]);
    expect(rows.map((r) => r.pct)).toEqual([100, 66, 53, 31, 0, 0]);
    // 자주 가는 곳을 고르지 않았으면 기본 비중을 '가정'으로 적는다
    expect(noteText(ROWS[3], "convenience", false)).toContain("대상 가맹점 비중 70% 가정");
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

  it("아래 띠: 1위와 지갑 전체 추천 조합", () => {
    const b = comboText("taptap O", "convenience", { names: ["D4카드의정석Ⅱ", "taptap O"], net: 33422 });
    expect(`${b.lead}${b.strong1}${b.mid}${b.strong2}${b.tail}`).toBe("편의점만 보면 taptap O가 가장 많아요. 다른 지출까지 같이 보면 D4카드의정석Ⅱ + taptap O 조합으로 월 약 33,000원이에요.");
    const n = comboText("taptap O", "convenience", null);
    expect(`${n.lead}${n.strong1}${n.mid}${n.tail}`).toBe("편의점만 보면 taptap O가 가장 많아요. 다른 지출까지 같이 보면 어떤 카드를 같이 쓰면 좋은지 지갑 만들기에서 계산해 드려요.");
  });
});
