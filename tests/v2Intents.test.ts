import { describe, expect, it } from "vitest";
import recOwn from "./fixtures/v2/rec_own_m20000.json";
import args from "./fixtures/v2/args_own.json";
import type { RecommendResponse } from "@/domain/types/engine";
import { answerChoice, answerIntent, similarExamples, type ChatContext, type EngineCall } from "@/v2/chat/chatModel";
import { GUARD, QUICK_TALK, SAFETY, TOPIC_REPLIES } from "@/v2/chat/chatRules";
import { DIALOGS, INTENT_BY_ID, INTENTS } from "@/v2/chat/intents";

/** 의도 정의서(intents.ts)가 규칙 표·버튼과 어긋나지 않는지(2026-11-01) */
const REC = recOwn as unknown as RecommendResponse;
const call: EngineCall = async () => REC as never;
const base: ChatContext = { rec: REC, pack: REC.result, basis: "result", flow: "own", at: 0, spending: args.spending, margin: 20000, brandShare: args.brandShare, ownedIds: args.ids, page: { kind: "result" }, pageSpending: args.spending, pageBrandShare: args.brandShare, cardMeta: {} };
const RULES = [...SAFETY, ...GUARD, ...QUICK_TALK, ...TOPIC_REPLIES];

describe("핏핏 의도 정의서", () => {
  it("의도 id는 겹치지 않는다", () => {
    expect(new Set(INTENTS.map((x) => x.id)).size).toBe(INTENTS.length);
  });

  it("정해 둔 답 의도는 chatRules.ts에 같은 id의 답이 있고, 규칙 표의 모든 답은 의도 정의서에 있다", () => {
    const ruleIds = new Set(RULES.map((r) => r.id));
    expect(new Set(RULES.map((r) => r.id)).size).toBe(RULES.length);
    for (const x of INTENTS.filter((i) => i.answer.kind === "fixed")) expect(ruleIds.has(x.id), x.id).toBe(true);
    for (const r of RULES) expect(INTENT_BY_ID.get(r.id)?.answer.kind, r.id).toBe("fixed");
  });

  it("버튼답 의도의 버튼 id는 실제로 답이 있다(맨 끝 '무엇을 도와드릴까요?'로 빠지지 않음)", async () => {
    for (const x of INTENTS) {
      if (x.answer.kind !== "choice") continue;
      const a = await answerChoice(x.answer.id, base, call);
      expect(a.text, x.id).not.toBe("무엇을 도와드릴까요?");
    }
  });

  it("의도마다 예시 말이 3개 이상(코드가 처리하는 의도와 욕설은 제외), 같은 예시가 두 의도에 들어 있지 않다", () => {
    for (const x of INTENTS.filter((i) => i.answer.kind !== "code" && i.id !== "abuse.swear")) expect(x.examples.length, x.id).toBeGreaterThanOrEqual(3);
    const seen = new Map<string, string>();
    for (const x of INTENTS)
      for (const e of x.examples) {
        expect(seen.get(e), `${e}: ${seen.get(e)} / ${x.id}`).toBeUndefined();
        seen.set(e, x.id);
      }
  });

  it("AI가 고를 수 있는 모든 의도는 답을 만든다(지갑이 있을 때)", async () => {
    for (const x of INTENTS.filter((i) => i.answer.kind !== "code")) {
      const a = await answerIntent({ intent: x.id, q: x.examples[0], text: "네!" }, x.examples[0], base, call);
      expect(a?.text, x.id).toBeTruthy();
    }
  });

  it("비슷한 예시 고르기: 질문과 같은 의도의 예시가 맨 앞에 온다", () => {
    expect(similarExamples("연회비 다 합치면 얼마임?", 3)[0]).toMatch(/→ wallet\.total_fee$/);
    expect(similarExamples("편의점은 어떤 카드로 결제해", 3)[0]).toMatch(/→ wallet\.category_card$/);
  });

  it("여러 턴 대화 예시의 기대 의도는 정의서에 있다", () => {
    for (const d of DIALOGS) expect(INTENT_BY_ID.has(d.expect), d.title).toBe(true);
  });
});
