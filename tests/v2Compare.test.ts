import { describe, expect, it } from "vitest";
import rankA from "./fixtures/v2/rank_cmp_a.json";
import rankB from "./fixtures/v2/rank_cmp_b.json";
import args from "./fixtures/v2/args_own.json";
import cardMeta from "@data/catalog/card-meta.json";
import type { EngineCard, RankRow } from "@/domain/types/engine";
import { catalogBySourceId } from "@/v1/catalog";
import {
  actionVM,
  basisText,
  benefitTitle,
  chipsOf,
  excludeWords,
  feeSub,
  headVM,
  insightsVM,
  keepCell,
  launchText,
  rowKeyOf,
  sharedShort,
  sumNote,
  sumVM,
  tableVM,
  tightCard,
  type CardMeta,
  type CmpCardInput,
  type CmpCtx,
  type SectionVM,
} from "@/v2/model/compareView";
import { pickNewFlow } from "@/v2/model/guards";
import { josa } from "@/v2/model/text";
import { heroVM } from "@/v2/model/resultView";
import recOwn from "./fixtures/v2/rec_own_m20000.json";
import recNew from "./fixtures/v2/rec_new_credit.json";
import type { RecommendResponse } from "@/domain/types/engine";

/**
 * 카드 비교 화면 문장 테스트(2026-10-29). fixture는 wf_engine.py rank(detail)를 CPython으로 돌린 결과(log 제거).
 *  A: D4카드의정석Ⅱ(원문 추출) vs 카드의정석 TEN(혜택 요약 자동 변환)
 *  B: D4카드의정석Ⅱ vs 올바른 BAZIC(40만·80만 두 구간, 사람 검수) vs 삼성 iD ON(묶음 한도 3개)
 * 지출은 월 83만 5천원, 자주 가는 곳은 카페 스타벅스·메가MGC커피, 편의점 GS25, 온라인쇼핑 쿠팡.
 */
const META = (cardMeta as { cards: Record<string, CardMeta> }).cards;

function inputsOf(rank: unknown): CmpCardInput[] {
  const rows = (rank as { rows: RankRow[] }).rows;
  return rows.map((r) => ({ sid: r.sid, entry: catalogBySourceId.get(r.sid), view: r.view as EngineCard, meta: META[String(r.sid)] }));
}

const A = inputsOf(rankA);
const B = inputsOf(rankB);
const ctx: CmpCtx = { spending: args.spending, brandShare: args.brandShare, ownedIds: args.ids, wallet: null, today: new Date("2026-10-29T09:00:00+09:00") };

const sec = (s: SectionVM[], id: string) => s.find((x) => x.id === id)!;
const rowOf = (s: SectionVM[], secId: string, rowId: string) => sec(s, secId).rows.find((r) => r.id === rowId)!;

describe("카드 비교: 위쪽 카드", () => {
  it("배지·카드사·칩", () => {
    const [d4, ten] = A.map((x) => headVM(x, ctx));
    expect(d4.badge).toEqual({ text: "내 카드", mine: true });
    expect(ten.badge).toEqual({ text: "아직 담지 않은 카드", mine: false });
    expect(d4.meta).toBe("우리카드 · 신용 · 연회비 12,000원");
    expect(d4.chips).toEqual(["커피 4대 브랜드 55%", "시내버스·지하철·택시 33%", "편의점 11%"]);
    expect(chipsOf(catalogBySourceId.get(2699))).toEqual(["커피 10%", "편의점 10%", "음식점/주점 1%"]);
  });

  it("지갑에 든 카드는 맡은 지출을 적는다", () => {
    const w = { ...ctx, wallet: { sids: [2686], alloc: { 2686: { cafe: 180000, transport: 80000, convenience: 250000 } }, names: ["D4카드의정석Ⅱ"], net: 33000 } };
    const d4 = headVM(A[0], w);
    expect(d4.badge.text).toBe("내 카드 · 추천 지갑에 들어 있어요");
    expect(d4.roleText).toBe("편의점·카페·대중교통을 맡는 카드예요");
  });
});

describe("카드 비교: 내 지출로 계산하면", () => {
  it("금액·막대·차이", () => {
    const [d4, ten] = sumVM(A);
    expect([d4.total, ten.total]).toEqual([19800, 20700]);
    expect(ten.winner).toBe(true);
    expect(d4.winner).toBe(false);
    expect(ten.more).toBe("월 900원 더 받아요");
    expect(ten.pct).toBe(100);
    expect(d4.pct).toBe(96);
    expect(d4.feeLine).toEqual({ lead: "연회비(월 1,000원)를 빼면 ", value: "월 18,800원" });
  });

  it("혜택 요약만 읽은 카드는 계산 근거를 나눠 적는다", () => {
    expect(sumNote(A, 835000)).toBe("한 카드로 월 83만 5천원을 모두 결제했을 때 받는 할인이에요 · TEN은 카드고릴라 혜택 요약으로, 나머지는 카드사 원문 규칙으로 계산한 추정값");
  });

  it("알아 둘 점: 차이, 요약 카드, 결제 조건", () => {
    const ins = insightsVM(A, null);
    expect(ins.map((x) => x.title)).toEqual(["차이는 월 900원이에요", "TEN은 혜택 요약만 읽은 카드예요", "D4 대중교통 혜택은 결제 조건이 있어요"]);
    expect(ins[0].text).toBe("한 장만 쓴다면 어느 카드를 골라도 받는 금액은 비슷해요. 실적 조건과 한도를 같이 보세요.");
    expect(ins[2].text).toBe("후불 교통기능 선택 시에만 받아요. 조건을 지킨다고 보고 계산했어요.");
  });

  it("실적 구간 경계에 걸린 카드: 여유가 가장 작은 카드 한 장", () => {
    // iD ON(60만원 구간, 여유 1만 5천원)이 BAZIC(80만원 구간, 여유 3만 5천원)보다 먼저
    expect(tightCard(B)).toMatchObject({ sid: 2235, threshold: 600000, room: 15000 });
    const idon = insightsVM(B, { sid: 2235, lowTotal: 20000 }).find((x) => x.id === "tight-2235")!;
    expect(idon.title).toBe("iD ON은 60만원 구간에 걸려 있어요");
    expect(idon.text).toBe("실적으로 치는 결제가 기준보다 1만 5천원 많아요. 이보다 더 줄면 30만원 구간으로 내려가요. 그러면 월 약 20,000원이에요.");
  });

  it("실적 구간 경계에 걸린 카드(여유 3만 5천원)", () => {
    const B2 = [B[0], B[1]];
    const t = tightCard(B2);
    expect(t).toMatchObject({ sid: 514, threshold: 800000, room: 35000 });
    const ins = insightsVM(B2, { sid: 514, lowTotal: 5905.7 });
    const tight = ins.find((x) => x.id === "tight-514")!;
    expect(tight.title).toBe("올바른 BAZIC은 80만원 구간에 걸려 있어요");
    expect(tight.text).toBe("실적으로 치는 결제가 기준보다 3만 5천원 많아요. 이보다 더 줄면 40만원 구간으로 내려가요. 그러면 월 약 5,900원이에요.");
    // 계산 전에는 금액 문장을 빼고 보여 준다
    expect(insightsVM(B2, null).find((x) => x.id === "tight-514")!.text).toBe("실적으로 치는 결제가 기준보다 3만 5천원 많아요. 이보다 더 줄면 40만원 구간으로 내려가요.");
  });
});

describe("카드 비교: 항목별 표", () => {
  const t = tableVM(A, ctx);

  it("기본 정보", () => {
    expect(rowOf(t, "basic", "issuer").same).toBe(true);
    expect(rowOf(t, "basic", "fee").cells[0]).toEqual({ main: "12,000원", sub: "국내전용·해외겸용 같음" });
    expect(rowOf(t, "basic", "launch").cells.map((c) => c.main)).toEqual(["2024년 2월 29일", "2024년 5월 30일"]);
    const keep = rowOf(t, "basic", "keep");
    expect(keep.sub).toBe("출시 후 3년간 축소·폐지 없음");
    expect(keep.cells.map((c) => c.main)).toEqual(["2027년 2월까지", "2027년 5월까지"]);
  });

  it("전월실적: 원문 카드와 요약 카드", () => {
    const [d4, ten] = rowOf(t, "perf", "basis").cells;
    expect(d4).toEqual({ main: "30만원 이상", sub: "국내 가맹점 결제만 실적으로 쳐요" });
    expect(ten.main).toBe("확인 전");
    expect(rowOf(t, "perf", "excluded").cells[0]).toEqual({ main: "할인받은 결제 전액", sub: "세금·공과금·관리비·상품권·해외 결제도 빠져요" });
    expect(rowOf(t, "perf", "mine").cells[0]).toEqual({ main: "기준을 넘어요", sub: "할인받은 결제를 모두 빼도 30만원 이상이에요" });
    expect(rowOf(t, "perf", "mine").sub).toBe("월 83만 5천원");
    expect(rowOf(t, "perf", "grace").cells[0].main).toBe("다음 달 말일까지 실적과 상관없이 혜택 그대로");
  });

  it("혜택: 받는 금액이 큰 항목부터, 더 받는 카드에 파란 표시", () => {
    const rows = sec(t, "benefit").rows;
    expect(rows.slice(0, 3).map((r) => r.id)).toEqual(["b-cafe", "b-convenience", "b-transport"]);
    const cafe = rows[0];
    expect(cafe.sub).toBe("월 18만원 · 스타벅스·메가MGC커피");
    expect(cafe.cells[0]).toEqual({ main: "스타벅스·투썸플레이스·커피빈·폴바셋 55%", sub: "월 11,000원 · 건당 3,300원", chip: { text: "내 지출로 11,000원", tone: "win" } });
    expect(cafe.cells[1]).toEqual({ main: "커피 10%", sub: "월 10,000원(추정)", chip: { text: "내 지출로 10,000원", tone: "plain" } });
    const conv = rows[1];
    expect(conv.cells[1].chip?.tone).toBe("win");
    const transport = rows[2];
    expect(transport.cells[0].sub).toBe("월 5,500원 · 건당 2,200원 · 후불 교통기능 선택 시");
    expect(transport.cells[1]).toEqual({ main: "혜택 없음", sub: null, chip: { text: "내 지출로 0원", tone: "zero" } });
    const gas = rows.find((r) => r.id === "b-gas")!;
    expect(gas.same).toBe(true);
    const movie = rows.find((r) => r.id === "b-culture")!;
    expect(movie.sub).toBe("지출 입력 없음");
    expect(movie.cells[0]).toEqual({ main: "영화관 건당 5,500원", sub: "9,900원 이상 결제 · 월 5,500원 · 연 12회", chip: null });
  });

  it("한도와 합계", () => {
    expect(rowOf(t, "total", "limit").cells[0]).toEqual({ main: "항목별 한도만 있어요", sub: "모두 채우면 월 25,300원" });
    const sum = rowOf(t, "total", "sum").cells;
    expect(sum[0]).toEqual({ main: "월 19,800원", strong: false, sub: "카페 11,000 + 대중교통 5,500 + 편의점 3,300" });
    expect(sum[1].strong).toBe(true);
    const net = rowOf(t, "total", "net");
    expect(net.sub).toBe("연 12,000원 = 월 1,000원");
    expect(net.cells.map((c) => c.main)).toEqual(["월 18,800원", "월 19,700원"]);
  });

  it("세 장 비교: 구간 카드·묶음 한도 카드·모든 가맹점 혜택", () => {
    const tb = tableVM(B, ctx);
    expect(rowOf(tb, "perf", "basis").cells[1].main).toBe("40만원 이상 · 80만원 이상 두 구간");
    expect(rowOf(tb, "perf", "mine").cells[1]).toEqual({ main: "80만원 구간 · 여유 3만 5천원", sub: "실적이 80만원 아래로 내려가면 40만원 구간 혜택으로 바뀌어요" });
    const all = sec(tb, "benefit").rows.find((r) => r.id === "b-all")!;
    expect(all.label).toBe("모든 가맹점");
    expect(all.cells[1].main).toBe("국내 가맹점 0.7%");
    expect(all.cells[1].sub).toContain("같은 항목 혜택 1개 더");
    const limit = rowOf(tb, "total", "limit").cells[2];
    expect(limit.main).toBe("묶음 한도 3개");
    expect(limit.sub).toBe("자동맞춤 영역 월 1만원 · 온라인 간편결제·해외 월 1만원 · 교통·이동통신·스트리밍 월 2만원");
    const overseas = sec(tb, "benefit").rows.find((r) => r.id === "b-overseas")!;
    expect(overseas.cells[0]).toEqual({ main: "혜택 없음", sub: "해외 결제는 실적에서도 빠져요", chip: null });
  });
});

describe("카드 비교: 도우미", () => {
  it("혜택 이름 줄이기", () => {
    expect(benefitTitle({ title: "커피 4대 브랜드(스타벅스·투썸플레이스·커피빈·폴바셋) 55% 청구할인", specificity: "merchant_group", merchants: ["스타벅스", "투썸플레이스"] })).toBe("스타벅스·투썸플레이스·커피빈·폴바셋 55%");
    expect(benefitTitle({ title: "음식점/주점 1% 할인", specificity: "category", merchants: [] })).toBe("음식점·주점 1%");
    expect(benefitTitle({ title: "전국가맹점 0.2~2.0% 적립", specificity: "all_merchants", merchants: [] })).toBe("전국가맹점 0.2~2.0% 적립");
  });

  it("영문 카드 이름 조사: 약어는 글자 이름, 낱말은 소리대로", () => {
    expect(josa("올바른 BAZIC", "은/는")).toBe("올바른 BAZIC은");
    expect(josa("TEN", "을/를")).toBe("TEN을");
    expect(josa("SSG", "은/는")).toBe("SSG는");
    expect(josa("KB", "이/가")).toBe("KB가");
    expect(josa("Deep Dream", "을/를")).toBe("Deep Dream을");
    expect(josa("Mr.Life", "이/가")).toBe("Mr.Life가");
    expect(josa("Point", "은/는")).toBe("Point는");
    expect(josa("Black", "이/가")).toBe("Black이");
    expect(josa("Prime", "으로/로")).toBe("Prime으로");
    expect(josa("Mall", "으로/로")).toBe("Mall로");
    expect(josa("taptap O", "을/를")).toBe("taptap O를");
    expect(josa("iD ON", "으로/로")).toBe("iD ON으로");
  });

  it("표 줄 나누기", () => {
    expect(rowKeyOf({ region: "overseas", category: null, specificity: "all_merchants" })).toBe("overseas");
    expect(rowKeyOf({ region: "domestic", category: null, specificity: "all_merchants" })).toBe("all");
    expect(rowKeyOf({ region: "domestic", category: null, specificity: "brand" })).toBe("misc");
    expect(rowKeyOf({ region: "domestic", category: "cafe", specificity: "brand" })).toBe("cafe");
  });

  it("연회비·출시일·혜택 유지", () => {
    expect(feeSub("국내전용 [12,000]원 / 해외겸용 [12,000]원")).toBe("국내전용·해외겸용 같음");
    expect(feeSub("국내전용 [10,000]원 / 해외겸용 [12,000]원")).toBe("국내전용 10,000원 · 해외겸용 12,000원");
    expect(feeSub("[없음]")).toBeNull();
    expect(launchText("2018-12")).toBe("2018년 12월");
    const today = new Date("2026-10-29T09:00:00+09:00");
    expect(keepCell({ launch: "2020-05-19", keepYears: 3 }, today, true)).toEqual({ main: "2023년 5월에 끝났어요", sub: "출시 후 3년간 · 지금은 카드사가 혜택을 바꿀 수 있어요" });
    expect(keepCell({ keepYears: 5 }, today, true)).toEqual({ main: "출시 후 5년간", sub: "출시일이 원문에 없어요" });
    expect(keepCell(undefined, today, true).main).toBe("원문에서 찾지 못했어요");
  });

  it("실적 제외 항목 낱말", () => {
    expect(excludeWords(["할인 서비스가 적용된 이용금액", "국세", "지방세", "해외 가맹점 이용금액", "아파트 관리비", "상품권 구매", "연회비"])).toEqual(["세금", "관리비", "상품권", "해외 결제"]);
  });

  it("묶음 한도 이름", () => {
    expect(sharedShort("교통·이동통신·스트리밍 10% 할인 통합 월 할인한도")).toBe("교통·이동통신·스트리밍");
    expect(sharedShort("많이 쓰는 영역 30% 자동 맞춤 할인 월 할인한도")).toBe("자동맞춤 영역");
  });

  it("다시 짜기와 계산 기준", () => {
    expect(actionVM(A, ctx)).toMatchObject({ target: { sid: 2699, nick: "TEN" }, label: "TEN까지 넣어서 지갑 다시 짜기" });
    const w = { ...ctx, wallet: { sids: [2686, 51], alloc: {}, names: ["D4카드의정석Ⅱ", "taptap O"], net: 33422 } };
    expect(actionVM(A, w).text).toBe("지금 추천 지갑은 D4카드의정석Ⅱ + taptap O, 월 약 33,000원이에요. TEN을 함께 넣었을 때 얼마나 달라지는지는 새로 계산해야 알 수 있어요.");
    expect(actionVM(A, { ...ctx, ownedIds: [2686, 2699] }).label).toBe("내 카드로 지갑 다시 짜기");
    expect(basisText(ctx)).toBe("지출 입력 월 83만 5천원 · 자주 가는 곳 스타벅스·메가MGC커피·GS25·쿠팡 · 카드 한 장으로 지출 전부를 결제했다고 보고 계산해요 · 결제 조건(후불 교통 등)은 지킨다고 봐요 · 할인은 한도까지만 넣어요");
  });
});

describe("새 카드 흐름: 꼭 넣을 카드", () => {
  const own = recOwn as unknown as RecommendResponse;
  const fresh = recNew as unknown as RecommendResponse;

  it("꼭 넣을 카드가 조합에 있으면 가진 카드 조합이 더 나아도 새 조합을 보여 준다", () => {
    const pinnedSid = fresh.result.sids.find((s) => !args.ids.includes(s))!;
    const worse = { ...fresh, result: { ...fresh.result, net: own.result.net - 2000 } };
    expect(pickNewFlow(worse, own, args.ids)?.keptOwned).toBe(true);
    const pick = pickNewFlow(worse, own, args.ids, [pinnedSid])!;
    expect(pick.keptOwned).toBe(false);
    const hero = heroVM({ pack: pick.pack, bar: pick.bar, flow: "new", ownedCount: args.ids.length, newSids: pick.newSids, ownedOnly: pick.ownedOnly, keptOwned: false, pinned: [pinnedSid] });
    expect(hero.notice).toMatch(/꼭 넣고 계산했어요\. 가진 카드만 쓸 때보다 월 약 2천원 적어요$/);
  });

  it("꼭 넣을 카드가 조합에서 빠지면 그 이유를 적는다", () => {
    const pick = pickNewFlow(fresh, own, args.ids, [999999])!;
    const hero = heroVM({ pack: pick.pack, bar: pick.bar, flow: "new", ownedCount: args.ids.length, newSids: pick.newSids, ownedOnly: pick.ownedOnly, keptOwned: pick.keptOwned, pinned: [999999] });
    expect(hero.notice).toMatch(/넣어도 맡길 지출이 없어서 빼고 계산했어요$/);
  });
});
