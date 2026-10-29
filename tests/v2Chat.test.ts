import { describe, expect, it } from "vitest";
import recOwn from "./fixtures/v2/rec_own_m20000.json";
import explainAlt0 from "./fixtures/v2/explain_alt_m0.json";
import rankA from "./fixtures/v2/rank_cmp_a.json";
import args from "./fixtures/v2/args_own.json";
import cardMeta from "@data/catalog/card-meta.json";
import type { RecommendResponse } from "@/domain/types/engine";
import { answerLocal, buildMessages, classify, contextLine, introText, suggestions, type ChatContext, type EngineCall } from "@/v2/chat/chatModel";

/**
 * 카드 상담 답 테스트(2026-10-29). 엔진 호출은 fixture로 바꾼다(wf_engine.py를 CPython으로 돌린 결과).
 * 가진 카드 6장, 월 지출 83만 5천원, 추천 조합 D4카드의정석Ⅱ + taptap O(실적 여유 2만원).
 */
const REC = recOwn as unknown as RecommendResponse;
const calls: string[] = [];
const call: EngineCall = async (fn) => {
  calls.push(fn);
  return (fn === "explain" ? explainAlt0 : fn === "rank" ? rankA : REC) as never;
};
const base: ChatContext = {
  rec: REC,
  pack: REC.result,
  basis: "result",
  flow: "own",
  at: Date.parse("2026-10-29T10:00:00+09:00"),
  spending: args.spending,
  margin: 20000,
  brandShare: args.brandShare,
  ownedIds: args.ids,
  page: { kind: "result" },
  pageSpending: args.spending,
  pageBrandShare: args.brandShare,
  cardMeta: (cardMeta as { cards: Record<string, never> }).cards,
};

describe("카드 상담", () => {
  it("상담 기준과 첫 인사", () => {
    expect(contextLine(base)).toBe("10월 29일 추천 결과 · 카드 2장 · 월 지출 83만 5천원");
    expect(contextLine({ ...base, basis: "wallet" })).toBe("10월 29일 저장한 지갑 · 카드 2장 · 월 지출 83만 5천원");
    expect(contextLine({ ...base, rec: null, pack: null, basis: null })).toBe("아직 계산한 추천 결과가 없어요");
    expect(introText(base)).toBe("방금 계산한 추천 결과와 카드별 계산 근거를 바탕으로 답할게요. 화면을 보면서 궁금한 걸 물어보세요.");
    expect(suggestions(base)).toEqual(["통신비는 왜 할인 카드에 안 걸었어요?", "실적이 모자라면 어떻게 돼요?", "새 카드까지 넣으면 얼마나 늘어요?"]);
  });

  it("질문 나누기", () => {
    expect(classify("왜 D4카드의정석Ⅱ가 들어갔어요?", base)).toBe("card");
    expect(classify("taptap O 계산 근거를 설명해 줘", base)).toBe("card");
    expect(classify("iD ON을 쓰면 더 받는다던데요?", base)).toBe("noMargin");
    expect(classify("실적 여유 없이 계산한 이 결과와 기본 추천의 차이를 설명해 줘", base)).toBe("noMargin");
    expect(classify("통신비는 왜 할인 카드에 안 걸었어요?", base)).toBe("mobile");
    expect(classify("내 지갑에 저장한 조합을 설명해 줘", base)).toBe("summary");
    expect(classify("D4와 TEN 중 내 지출에는 어떤 카드가 더 나아?", { ...base, page: { kind: "compare", ids: [2686, 2699] } })).toBe("compare");
  });

  it("카드 한 장: 맡은 혜택 표와 금액", async () => {
    const a = await answerLocal("왜 D4카드의정석Ⅱ가 들어갔어요?", base, call);
    expect(a.text).toBe("**D4카드의정석Ⅱ**는 카페·대중교통·편의점에서 원문에 적힌 한도까지 받아, 이 조합 혜택의 절반이 넘는 **월 19,800원**을 맡아요. 연회비 12,000원은 월 1,000원꼴이에요.");
    expect(a.blocks?.[0]).toMatchObject({ kind: "benefits", sid: 2686, total: "월 19,800원" });
  });

  it("실적 여유: 지금 조합과 여유 없이 계산한 조합을 나란히", async () => {
    const a = await answerLocal("iD ON을 쓰면 더 받는다던데요?", base, call);
    expect(a.text).toMatch(/^실적 여유를 두지 않으면 \*\*D4 \+ iD ON\*\*이 월 약 3만 6천원으로 2천원 더 받아요\. 다만 iD ON 실적이 기준 30만원에 딱 맞아요\./);
    const tiles = a.blocks?.find((b) => b.kind === "tiles");
    expect(tiles).toMatchObject({ tiles: [{ label: "지금", names: "D4 + taptap O" }, { label: "여유 없이", names: "D4 + iD ON" }] });
    expect(JSON.stringify(tiles)).toContain('"v":"0원","warn":true');
    expect(a.blocks?.find((b) => b.kind === "actions")).toMatchObject({ actions: [{ label: "여유 없이 다시 계산", to: "/make/own/result?margin=0" }, { id: "keep" }] });
  });

  it("실적 여유: 결과에 대안 조합이 없으면 엔진에 따로 물어본다(2026-10-29)", async () => {
    const noAlt = { ...REC, alt: null } as RecommendResponse;
    const asked: { fn: string; args: unknown }[] = [];
    const lazy: EngineCall = async (fn, a) => {
      asked.push({ fn, args: a });
      return (fn === "alt" ? { ok: true, alt: REC.alt } : fn === "explain" ? explainAlt0 : REC) as never;
    };
    const a = await answerLocal("iD ON을 쓰면 더 받는다던데요?", { ...base, rec: noAlt }, lazy);
    expect(asked[0]).toMatchObject({ fn: "alt", args: { ids: REC.pool, k: REC.k } });
    expect(a.text).toMatch(/^실적 여유를 두지 않으면 \*\*D4 \+ iD ON\*\*이 월 약 3만 6천원으로 2천원 더 받아요\./);
  });

  it("자유 질문: 정해진 유형이 아니면 아주LLM이 계산 기록으로 답한다(2026-10-29)", async () => {
    expect(classify("연회비 면제 조건이 있어요?", base)).toBe("free");
    expect(classify("카페를 더 쓰면 어떻게 돼요?", base)).toBe("free");
    expect(classify("이 조합 정리해 줘", base)).toBe("summary");
    expect(classify("연회비 면제 조건이 있어요?", { ...base, rec: null, pack: null })).toBe("summary");
    // 키가 없을 때: 맞는 기록을 못 찾았다고 먼저 말하고 요약
    const a = await answerLocal("연회비 면제 조건이 있어요?", base, call);
    expect(a.text).toMatch(/^이 질문에 딱 맞는 계산 기록을 찾지 못해서 지금 조합 요약으로 답할게요\. 지금 조합은 /);
    // 아주LLM에 넘기는 메시지: 계산 기록(받지 못한 혜택·가정 포함) + 규칙, 엔진 답은 넘기지 않음
    const msgs = buildMessages(base, [], "연회비 면제 조건이 있어요?", a);
    expect(msgs[0].content).toContain("기록에 없는 카드 조건(연회비 면제, 이벤트, 발급 조건 등)은 만들지 마");
    expect(msgs[0].content).toContain("[계산 기록]");
    expect(msgs[0].content).toContain("이번 지출로 받지 못한 혜택:");
    expect(msgs[0].content).toContain("계산 가정:");
    expect(msgs[0].content).not.toContain("[계산 엔진 답]");
    expect(msgs.at(-1)).toEqual({ role: "user", content: "연회비 면제 조건이 있어요?" });
    // 정해진 유형은 지금처럼 엔진 답을 다듬는다
    expect(buildMessages(base, [], "통신비는 왜 할인 카드에 안 걸었어요?", a)[0].content).toContain("[계산 엔진 답]");
  });

  it("통신비·실적·새 카드·요약", async () => {
    expect((await answerLocal("통신비는 왜 할인 카드에 안 걸었어요?", base, call)).text).toBe("통신비 14만원은 **D4**로 내도록 배정했어요. 할인받은 결제는 실적에서 빠져요. 그래서 통신비 14만원은 할인 대신 D4 실적용으로 걸었어요.");
    expect((await answerLocal("실적이 모자라면 어떻게 돼요?", base, call)).text).toMatch(/^두 카드 모두 실적 30만원을 넘겨요\./);
    expect((await answerLocal("새 카드까지 넣으면 얼마나 늘어요?", base, call)).blocks).toEqual([{ kind: "actions", actions: [{ label: "새 카드까지 넣어서 계산", to: "/make/new/type", primary: true }] }]);
    const s = await answerLocal("내 지갑에 저장한 조합을 설명해 줘", { ...base, basis: "wallet" }, call);
    expect(s.text).toBe("저장한 지갑은 D4카드의정석Ⅱ(월 19,800원), taptap O(월 15,455원)이고, 연회비를 빼면 월 약 3만 3천원이에요. 카드 이름을 넣어 물어보시면 그 카드의 계산 근거로 답할게요.");
  });

  it("카드 비교 화면: 비교함 카드를 내 지출로 계산해서 답한다", async () => {
    const cmp: ChatContext = { ...base, page: { kind: "compare", ids: [2686, 2699] } };
    expect(contextLine(cmp)).toBe("카드 비교 · D4·TEN · 월 지출 83만 5천원");
    calls.length = 0;
    const a = await answerLocal("D4와 TEN 중 내 지출에는 어떤 카드가 더 나아?", cmp, call);
    expect(calls).toEqual(["rank"]);
    expect(a.text.split("\n")[0]).toBe("한 장으로 지출 전부(월 83만 5천원)를 결제하면 **TEN**이 월 20,700원으로 가장 많이 받아요. D4는 월 19,800원이라 차이는 월 900원이에요.");
    expect(a.text).toContain("TEN은 혜택 요약만 읽은 카드예요.");
    expect(a.blocks?.[1]).toMatchObject({ kind: "actions", actions: [{ label: "TEN까지 넣어서 지갑 다시 짜기", id: "pin", sid: 2699 }, { to: "/compare?ids=2686%2C2699" }] });
  });

  it("계산 결과가 없으면 계산 방법을 설명하고 지갑 만들기로", async () => {
    const none: ChatContext = { ...base, rec: null, pack: null, basis: null };
    const a = await answerLocal("카드 조합 추천은 어떻게 계산해요?", none, call);
    expect(a.blocks).toEqual([{ kind: "actions", actions: [{ label: "지갑 만들기", to: "/make/own/cards", primary: true }] }]);
  });

  it("아주LLM에는 계산 기록과 엔진 답을 같이 넘긴다", () => {
    const msgs = buildMessages(base, [{ role: "user", text: "안녕" }, { role: "model", text: "…", pending: true }], "왜 D4가 들어갔어요?", { role: "model", text: "엔진 답" });
    expect(msgs[0].role).toBe("system");
    expect(msgs[0].content).toContain("[추천 조합] D4카드의정석Ⅱ + 삼성카드 taptap O");
    expect(msgs[0].content).toContain("[계산 엔진 답] 이 내용을 바탕으로 질문에 맞게 다듬어 답해.\n엔진 답");
    expect(msgs.slice(1)).toEqual([
      { role: "user", content: "안녕" },
      { role: "user", content: "왜 D4가 들어갔어요?" },
    ]);
  });
});
