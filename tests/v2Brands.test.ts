import { describe, expect, it } from "vitest";
import { brandShareToPicks, picksToBrandShare, type BrandPicks } from "@/v2/model/brands";

/**
 * 2026-11-24: 지출 입력은 이 탭에서만 남아서, 내 지갑에서 결과로 돌아갈 때 저장한 지갑의 브랜드 비중으로 '자주 가는 곳'을 되살린다.
 * 되살린 고른 브랜드로 다시 만든 비중이 저장할 때 비중과 같아야 같은 결과가 나온다
 */
describe("저장한 지갑의 브랜드 비중 → 자주 가는 곳", () => {
  const spending = { cafe: 100000, convenience: 50000, delivery: 30000, dining: 80000 };

  it("고른 브랜드 → 비중 → 고른 브랜드로 돌아와 같은 비중이 된다(별칭·여러 브랜드·'없어요' 포함)", () => {
    const picks: BrandPicks = {
      cafe: { brands: ["스타벅스", "투썸플레이스"] },
      convenience: { brands: ["GS25"] },
      delivery: { brands: [], none: true },
    };
    const share = picksToBrandShare(spending, picks);
    const back = brandShareToPicks(share);
    expect(back.convenience).toEqual({ brands: ["GS25"] });
    expect(back.delivery).toEqual({ brands: [], none: true });
    expect(new Set(back.cafe.brands)).toEqual(new Set(["스타벅스", "투썸플레이스"]));
    expect(picksToBrandShare(spending, back)).toEqual(share);
  });

  it("비어 있는 비중은 빈 결과", () => {
    expect(brandShareToPicks({})).toEqual({});
  });
});
