import { describe, expect, it } from "vitest";
import recOwn from "./fixtures/v2/rec_own_m20000.json";
import recOwn0 from "./fixtures/v2/rec_own_m0.json";
import explainAlt0 from "./fixtures/v2/explain_alt_m0.json";
import explainBase0 from "./fixtures/v2/explain_base_m0.json";
import recNewCredit from "./fixtures/v2/rec_new_credit.json";
import recNewNoOwned from "./fixtures/v2/rec_new_noowned.json";
import args from "./fixtures/v2/args_own.json";
import type { EnginePack, RecommendResponse } from "@/domain/types/engine";
import { bestPack, monotoneBar, pickNewFlow, pickNoMargin } from "@/v2/model/guards";
import { cardNick, cardShort, deltaText, josa, korAmount, korWonDetail, pctText } from "@/v2/model/text";
import {
  barVM,
  guideRows,
  heroVM,
  noMarginVM,
  perfVM,
  roleCard,
  todoList,
  unusedOwned,
  usedValuesVM,
  walletCard,
  type ViewCtx,
} from "@/v2/model/resultView";

/**
 * v2 결과·지갑 화면 문장 테스트. fixture는 wf_engine.py를 CPython으로 돌린 결과(2026-10-28, log·quote 제거).
 * 시나리오: 가진 카드 6장, 월 지출 83만 5천원, 자주 가는 곳(카페 스타벅스·메가MGC커피, 편의점 GS25, 온라인쇼핑 쿠팡)
 */
const REC = recOwn as unknown as RecommendResponse;
const REC0 = recOwn0 as unknown as RecommendResponse;
const ALT0 = (explainAlt0 as unknown as { result: EnginePack }).result;
const BASE0 = (explainBase0 as unknown as { result: EnginePack }).result;
const owned = args.ids;
const ctx: ViewCtx = {
  spending: args.spending,
  brandShare: args.brandShare,
  margin: 20000,
  ownedIds: owned,
  source: "manual",
  picks: { cafe: { brands: ["스타벅스", "메가MGC커피"] }, convenience: { brands: ["GS25"] }, onlineShopping: { brands: ["쿠팡"] } },
};
const card = (p: EnginePack, sid: number) => p.cards.find((c) => c.sid === sid)!;

describe("text 도우미", () => {
  it("영문·숫자로 끝나는 카드 이름도 읽는 소리대로 조사를 붙인다", () => {
    expect(josa("D4", "을/를")).toBe("D4를");
    expect(josa("taptap O", "으로/로")).toBe("taptap O로");
    expect(josa("iD ON", "으로/로")).toBe("iD ON으로");
    expect(josa("TEN", "은/는")).toBe("TEN은");
    expect(josa("LOCA 365", "으로/로")).toBe("LOCA 365로");
    expect(josa("Mr.Life", "을/를")).toBe("Mr.Life를");
    expect(josa("통신비", "은/는")).toBe("통신비는");
    expect(josa("14만원", "이/가")).toBe("14만원이");
    expect(josa("편의점", "으로/로")).toBe("편의점으로");
    expect(josa("1만 7천원", "으로/로")).toBe("1만 7천원으로");
    expect(josa("서울", "으로/로")).toBe("서울로");
    expect(josa("D4카드의정석Ⅱ + taptap O", "이에요/예요")).toBe("D4카드의정석Ⅱ + taptap O예요");
    expect(josa("‘스타벅스 50% + 트렌디숍 7%’", "으로/로")).toBe("‘스타벅스 50% + 트렌디숍 7%’로");
  });
  it("금액 표기", () => {
    expect(korWonDetail(49500)).toBe("4만 9천 5백원");
    expect(korWonDetail(80000)).toBe("8만원");
    expect(korWonDetail(3300)).toBe("3천 3백원");
    expect(korWonDetail(390)).toBe("390원");
    expect(korAmount(72000)).toBe("7만 2천");
    expect(pctText(0.55)).toBe("55%");
    expect(pctText(0.033)).toBe("3.3%");
    expect(deltaText(10)).toBe("+10원");
    expect(deltaText(-1300)).toBe("−1천 3백원");
    expect(deltaText(2)).toBe("차이 없음");
  });
  it("카드 이름 줄이기", () => {
    expect(cardNick("D4카드의정석Ⅱ")).toBe("D4");
    expect(cardNick("카드의정석 TEN")).toBe("TEN");
    expect(cardNick("삼성카드 taptap O")).toBe("taptap O");
    expect(cardNick("삼성 iD ON 카드")).toBe("iD ON");
    expect(cardShort("LOCA 365 카드")).toBe("LOCA 365");
    expect(cardShort("럭키 유카드")).toBe("럭키 유카드");
    expect(cardShort("모빌카드")).toBe("모빌");
  });
});

describe("guards: 엔진 숫자 보호 장치", () => {
  it("실적 여유 0 결과는 세 후보 중 가장 큰 쪽(기본 추천의 여유 0 대안)을 쓴다", () => {
    expect(REC0.result.net).toBeLessThan(REC.alt!.net); // 엔진 문제 재현: 31,674 < 35,533
    const nm = pickNoMargin(REC0, ALT0, BASE0)!;
    expect(nm.from).toBe("alt");
    expect(Math.round(nm.pack.net)).toBe(35533);
    expect(nm.pack.sids.slice().sort()).toEqual([2235, 2686]);
    // 카드 수별 막대도 같은 값으로 맞춘다(2장 이상은 줄지 않음)
    const k2 = nm.bar.find((b) => b.k === 2)!;
    expect(Math.round(k2.net)).toBe(35533);
    for (let i = 1; i < nm.bar.length; i++) expect(nm.bar[i].net).toBeGreaterThanOrEqual(nm.bar[i - 1].net);
  });
  it("새 카드까지 넣은 결과가 가진 카드 조합보다 작으면 가진 카드 조합을 보여 준다", () => {
    const r = recNewCredit as unknown as RecommendResponse;
    expect(r.result.net).toBeLessThan(REC.result.net); // 엔진 문제 재현: 32,681 < 33,422
    const pick = pickNewFlow(r, REC, owned)!;
    expect(pick.keptOwned).toBe(true);
    expect(pick.newSids).toEqual([]);
    expect(pick.pack).toBe(REC.result);
  });
  it("가진 카드가 없으면 새 카드 결과를 그대로 쓴다", () => {
    const pick = pickNewFlow(recNewNoOwned as unknown as RecommendResponse, null, [])!;
    expect(pick.keptOwned).toBe(false);
    expect(pick.newSids.slice().sort()).toEqual([2312, 2321, 2686]);
  });
  it("bestPack: 같은 값이면 카드 수가 적은 쪽", () => {
    const a = { ...REC.result, net: 100, cards: REC.result.cards.slice(0, 2) };
    const b = { ...REC.result, net: 100.5, cards: REC.result.cards.slice(0, 1) };
    expect(bestPack([a, b, null])).toBe(b);
  });
  it("monotoneBar: 줄어드는 막대를 앞 장수 값으로 맞춘다", () => {
    const bar = monotoneBar([
      { k: 1, net: 100, cards: 1, same: false, sids: [1] },
      { k: 2, net: 300, cards: 2, same: false, sids: [1, 2] },
      { k: 3, net: 250, cards: 3, same: false, sids: [1, 2, 3] },
    ]);
    expect(bar[2]).toMatchObject({ net: 300, cards: 2, same: true, sids: [1, 2] });
  });
});

describe("추천 결과(보유한 카드로, 여유 2만원)", () => {
  const pack = REC.result;
  const bar = monotoneBar(REC.bar, pack);
  it("히어로", () => {
    const h = heroVM({ pack, bar, flow: "own", ownedCount: 6, newSids: [], ownedOnly: null });
    expect(h.eyebrow).toBe("추천 조합 · 가진 카드 6장 중 2장");
    expect(h.title).toBe("카드 2장으로 매달 받는 혜택");
    expect(h.amount).toBe(33000);
    // 차액은 타일에 보이는 값(25,000원·33,000원)끼리 뺀다. 실제 차이 8,570원을 반올림한 9천원이 아니다(2026-10-29)
    expect(h.lead).toBe("연회비를 뺀 순혜택이에요. 1년이면 약 40만원, 1장만 쓸 때보다 월 약 8천원 더 받아요.");
    expect(h.tiles?.map((t) => [t.label, t.value, t.names])).toEqual([
      ["1장만 쓸 때", "월 약 25,000원", "taptap O 한 장"],
      ["2장을 같이 쓰면", "월 약 33,000원", "D4카드의정석Ⅱ + taptap O"],
    ]);
  });
  it("카드가 맡는 일", () => {
    const d4 = roleCard(card(pack, 2686), ctx);
    expect(d4.meta).toBe("우리카드 · 연회비 12,000원 · 실적 30만원 이상");
    expect(d4.amountText).toBe("19,800원");
    expect(d4.rows.map((r) => [r.label, r.sub, r.amountText])).toEqual([
      ["카페 · 스타벅스", "3만 5천원 × 55% · 한도까지", "11,000원"],
      ["대중교통", "8만원 × 33% · 한도까지", "5,500원"],
      ["편의점", "4만원 × 11% · 한도까지", "3,300원"],
    ]);
    expect(d4.note).toBe("세 혜택 모두 월 한도까지 받아요");
    const tt = roleCard(card(pack, 51), ctx);
    expect(tt.amountText).toBe("약 15,500원");
    expect(tt.rows[0].sub).toBe("2만 8천원 × 50% · 묶음 한도 1만원");
    expect(tt.rows[2]).toMatchObject({ label: "온라인쇼핑 · 쿠팡", sub: "4만 5천 5백원 × 1% 적립", amountText: "455원" });
    expect(tt.note).toBe("카드사 앱에서 패키지를 ‘스타벅스 50% + 트렌디숍 7%’로 바꿔야 받아요");
  });
  it("이렇게 쓰세요", () => {
    const rows = guideRows(pack, ctx.spending, ctx.brandShare);
    expect(rows.map((r) => [r.title, r.text, r.badge.label])).toEqual([
      ["편의점", "taptap O로 21만원, 나머지 4만원은 D4로", "taptap O"],
      ["카페·디저트", "스타벅스 2만원까지 taptap O, 나머지 스타벅스는 D4로", "D4"],
      ["대중교통", "D4를 후불교통 카드로 등록해 두세요", "D4"],
      ["그 밖의 지출", "통신비는 D4 자동납부, 외식·온라인쇼핑은 taptap O, 주유는 D4", "나눠서"],
    ]);
    expect(rows[3].spend).toBe(325000);
  });
  it("그 밖의 지출을 모두 한 카드로 내면 카드 이름을 되풀이하지 않는다(2026-10-29)", () => {
    const d4 = card(pack, 2686);
    const one = { ...pack, sids: [2686], cards: [{ ...d4, alloc: { ...ctx.spending } }] } as EnginePack;
    const rows = guideRows(one, ctx.spending, ctx.brandShare);
    expect(rows.at(-1)).toMatchObject({ title: "그 밖의 지출", text: "모두 D4로 결제하고, 통신비는 자동납부로 걸어 두세요", badge: { label: "D4" } });
  });
  it("할 일", () => {
    expect(todoList(pack).map((t) => t.text)).toEqual(["taptap O 패키지를 ‘스타벅스 50% + 트렌디숍 7%’로 바꾸기", "D4를 후불교통 카드로 등록하기"]);
  });
  it("더 자세히", () => {
    const p = perfVM(pack);
    expect(p.summary).toBe("두 카드 모두 실적 30만원을 넘겨요");
    expect(p.lines[0]).toBe("D4카드의정석Ⅱ 실적 32만 9천원 (여유 2만 9천원) · taptap O 실적 32만 4천원 (여유 2만 4천원).");
    expect(p.lines[1]).toBe("할인받은 결제는 실적에서 빠져요. 그래서 통신비 14만원은 할인 대신 D4 실적용으로 걸었어요.");
    const b = barVM(bar, pack);
    expect(b.summary).toBe("2장이 가장 효율적이에요");
    expect(b.parts.map((x) => x.text)).toEqual(["1장(taptap O만) 월 약 2만 5천원", "2장 월 약 3만 3천원", "3장 이상은 같은 조합"]);
    expect(b.note).toBe("3장부터는 카드를 더 넣어도 혜택이 늘지 않아요.");
    const u = usedValuesVM(pack, ctx);
    expect(u.user).toBe(
      "카페 18만원 중 스타벅스·메가MGC커피(고른 곳 합쳐 70%) · 편의점 25만원 중 GS25(고른 곳 합쳐 70%) · 온라인쇼핑 6만 5천원 중 쿠팡(고른 곳 합쳐 70%) · 실적 여유 2만원.",
    );
    expect(u.assumed).toContain("결제 1회 평균 카페·편의점 7천원, 교통 1,500원");
    expect(u.assumed).toContain("포인트 1점 = 1원");
    expect(u.assumed).toContain("혜택 정보는 카드고릴라 원문(9월 17일 수집) 기준");
  });
  it("고르지 않은 카테고리는 계산기 가정값(브랜드 35%, 묶음 70%)으로 추정했다고 적는다", () => {
    const u = usedValuesVM(pack, { ...ctx, brandShare: {}, picks: {} });
    expect(u.assumed).toContain("카페·온라인쇼핑은 자주 가는 곳을 고르지 않아 브랜드 한 곳 혜택 35%, 여러 브랜드 묶음 혜택 70%로 추정");
    const onlyCafe = usedValuesVM(pack, { ...ctx, brandShare: { onlineShopping: { 쿠팡: 0.7 } }, picks: {} });
    expect(onlyCafe.assumed).toContain("카페는 자주 가는 곳을 고르지 않아");
  });
});

describe("실적 여유 없이 다시 계산", () => {
  const nm = pickNoMargin(REC0, ALT0, BASE0)!;
  it("비교 섹션", () => {
    const v = noMarginVM(REC.result, nm.pack, 20000);
    expect(v.title).toBe("월 약 2천원 더 받지만 실적 여유가 없어요");
    expect(v.lines[0]).toBe(
      "iD ON 실적이 기준 30만원에 딱 맞아요. 지출이 조금만 줄어도 다음 달 iD ON 혜택 1만 8천원이 끊기고, 그 달은 월 약 1만 7천원으로 내려가요.",
    );
    expect(v.lines[1]).toBe("그래서 기본 추천은 실적 여유 2만원을 둔 D4카드의정석Ⅱ + taptap O예요.");
    expect(v.base.rows).toEqual([
      ["월 순혜택", "약 33,000원"],
      ["가장 작은 실적 여유", "2만 4천원"],
      ["연회비 합계", "연 22,000원"],
    ]);
    expect(v.pick.rows[1]).toEqual(["가장 작은 실적 여유", "0원"]);
    expect(v.pick.rows[2]).toEqual(["연회비 합계", "연 32,000원"]);
  });
  it("실적 확인은 할인받아 빠진 통신비를 짚는다(혜택별 '실적 제외' 규칙)", () => {
    const p = perfVM(nm.pack);
    expect(p.summary).toBe("두 카드 모두 실적 30만원을 겨우 채워요");
    expect(p.lines[1]).toBe("iD ON은 할인받은 통신비 14만원이 실적에서 빠져서 기준에 딱 맞아요. 한 달만 덜 써도 다음 달 iD ON 혜택이 끊길 수 있어요.");
  });
  it("자동맞춤 혜택은 패키지 바꾸기 할 일을 만들지 않는다", () => {
    const idon = card(nm.pack, 2235);
    expect(roleCard(idon, ctx).note).toContain("자동으로 붙어요");
    expect(todoList(nm.pack).map((t) => t.text)).toEqual(["D4를 후불교통 카드로 등록하기", "iD ON으로 통신비 자동납부 걸기"]);
    expect(guideRows(nm.pack, ctx.spending, ctx.brandShare)[0].text).toBe("D4로 4만원, 나머지 21만원은 iD ON 실적용으로");
  });
});

describe("내 지갑", () => {
  const pack = REC.result;
  it("카드별 맡는 일·안내, 쓰지 않는 카드", () => {
    const d4 = walletCard(card(pack, 2686), pack, ctx);
    expect(d4.chips).toEqual(["카페 · 스타벅스", "대중교통", "편의점 나머지"]);
    expect(d4.walletNote).toBeNull();
    const tt = walletCard(card(pack, 51), pack, ctx);
    expect(tt.walletNote).toBe("카드사 앱에서 패키지를 ‘스타벅스 50% + 트렌디숍 7%’로 바꿔야 이 혜택을 받아요.");
    expect(unusedOwned(owned, pack).map((c) => [c.short, c.fee])).toEqual([
      ["Mr.Life", "연 15,000원"],
      ["iD ON", "연 20,000원"],
      ["LOCA 365", "연 20,000원"],
      ["Deep Dream 체크", "연회비 없음"],
    ]);
  });
  it("히어로 문장은 '연회비를 뺀 금액이에요'", () => {
    const h = heroVM({ pack, bar: monotoneBar(REC.bar, pack), flow: "own", ownedCount: 6, newSids: [], ownedOnly: null, place: "wallet" });
    expect(h.eyebrow).toBe("저장한 조합 · 카드 2장");
    expect(h.lead.startsWith("연회비를 뺀 금액이에요. 1년이면 약 40만원")).toBe(true);
  });
});

describe("새 카드까지 포함(가진 카드 없음)", () => {
  const pick = pickNewFlow(recNewNoOwned as unknown as RecommendResponse, null, [])!;
  it("히어로·할 일", () => {
    const h = heroVM({ pack: pick.pack, bar: pick.bar, flow: "new", ownedCount: 0, newSids: pick.newSids, ownedOnly: null });
    expect(h.eyebrow).toBe("추천 조합 · 새 카드 3장");
    expect(h.title).toBe("카드 3장으로 매달 받는 혜택");
    const todos = todoList(pick.pack, pick.newSids).map((t) => t.text);
    expect(todos.filter((t) => t.endsWith("발급 신청하기"))).toHaveLength(3);
    expect(todos).toContain("럭키 유카드 발급 신청하기");
  });
});
