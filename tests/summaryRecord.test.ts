import { describe, it, expect } from "vitest";
import benefit from "@data/catalog/cards-benefit.json";

// 2026-10-07: 자동 변환 카드의 혜택 표를 혜택 요약 해석(1_혜택정보구조화/요약해석)으로 만든다
type Rec = {
  sid: number;
  status: string;
  from: string;
  record: {
    source: { extracted_by: string };
    shared_caps?: { amount_won?: number; by_tier: { amount_won: number }[] }[];
    extraction_notes?: string[];
    benefits: { title: string; scope: { app_category: string | null; specificity: string; merchants: string[]; region?: string }; reward: { type: string }; caps: unknown[] }[];
  };
};
const cards = (benefit as unknown as { cards: Rec[] }).cards;
const bySid = new Map(cards.map((c) => [c.sid, c]));

describe("요약 해석으로 만든 혜택 표", () => {
  it("요약이 있는 자동 변환 카드는 모두 요약 해석을 쓴다", () => {
    const auto = cards.filter((c) => c.status === "auto");
    const fromLabels = auto.filter((c) => c.record.source.extracted_by === "summary:labels");
    // 10-30부터 발급 중 1,180장은 원문 정제 표를 써서 자동 변환은 372장. 요약이 없는 카드 2장만 예전 변환기
    expect(fromLabels.length).toBeGreaterThanOrEqual(auto.length - 2);
  });

  it("'간편결제Pay 10%'처럼 장소를 정하지 않은 혜택은 그 외 지출이 아니라 모든 가맹점에 붙는다", () => {
    const b = bySid.get(129)!.record.benefits.find((x) => x.title.includes("간편결제"))!;
    expect(b.scope).toMatchObject({ app_category: null, specificity: "all_merchants" });
  });

  it("요약에 적힌 통합 한도는 카드 전체 한도로 들어간다", () => {
    const caps = bySid.get(2821)!.record.shared_caps!;
    expect(caps[0].by_tier[0].amount_won).toBe(50000);
  });

  it("'한도 없이'라고 적힌 혜택에는 추정 한도를 걸지 않는다", () => {
    const b = bySid.get(2950)!.record.benefits.find((x) => x.title.includes("국내"))!;
    expect(b.caps).toEqual([]);
  });

  it("해외 혜택은 국내 지출에 붙이지 않는다(해외 지역 표시 → 계산기가 뺌)", () => {
    // 10-30부터 2950은 원문 정제 표: 해외 혜택을 지우지 않고 region overseas로 남긴다
    const r = bySid.get(2950)!.record;
    const overseas = r.benefits.filter((x) => x.title.includes("해외"));
    expect(overseas.length).toBeGreaterThan(0);
    expect(overseas.every((x) => x.scope.region === "overseas")).toBe(true);
  });
});
