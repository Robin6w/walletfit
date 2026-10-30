import { describe, it, expect } from "vitest";
import {
  hashContent,
  isImageDependent,
  isUpdatedSince,
  mergeEntry,
  parseAnnualFee,
  pickIds,
  toCatalogEntry,
  toDetailEntry,
  type DetailEntry,
} from "../scripts/cardDetailRecord";

// 2026-10-29: 카드고릴라 상세 API 응답에서 예전에 버리던 필드까지 저장하고, 다시 받을 때 바뀐 카드를 가려낸다
const api = {
  idx: 2686,
  cate: "CRD",
  c_type: "D",
  corp: { idx: 5, name: "우리카드" },
  name: "D4카드의정석Ⅱ",
  brand: [{ name: "Mastercard" }, { name: "Local" }],
  pre_month_money: 300000,
  only_online: false,
  annual_fee_basic: "국내전용 [12,000]원 / 해외겸용 [12,000]원",
  annual_fee_detail: "국내전용(Local) 12,000원<br>해외겸용(Mastercard) 12,000원",
  request_pc: "https://pc.wooricard.com/dcpc/yh1/crd/crd01/H1CRD101S02.do?cdPrdCd=103305&canvasser=1",
  request_m: "https://m.wooricard.com/dcmw/yh1/crd/crd01/M1CRD101S02.do?cdPrdCd=103305",
  request_yn: true,
  card_img: { name: "2686card.png", url: "https://d1c5n4ri2guedi.cloudfront.net/card/2686/card_img/33272/2686card.png" },
  top_benefit: [{ idx: 127, tags: ["커피 4대 브랜드", "55%", "청구할인"], title: "카페" }],
  search_benefit: [{ title: "기타", value: 7, options: [{ label: "연회비 최대 100% 지원", value: 176 }] }],
  key_benefit: [
    { title: "카페", comment: "커피 55% 청구할인", info: "<p>스타벅스</p>", cate: { idx: 127 } },
    { title: "유의사항", comment: "", info: "<p>아주 긴 유의사항 문구</p>" },
  ],
  censorship_info: "<p>상품설명서 및 약관 확인</p>",
  seo_meta: [
    { name: "keywords", content: "우리카드" },
    { name: "description", content: "커피 4대 브랜드 55% 청구할인" },
  ],
  is_visible: true,
  is_discon: false,
  is_impend: false,
  release_dt: "2024-02-29",
  pr_detail: "<div>광고</div>",
};

describe("toDetailEntry", () => {
  it("예전 필드를 그대로 두고 버리던 필드를 더한다", () => {
    const e = toDetailEntry(2686, api, "2026-10-29T00:00:00.000Z");
    expect(e).toMatchObject({
      sourceId: 2686,
      name: "D4카드의정석Ⅱ",
      isDiscontinued: false,
      keyBenefit: [{ title: "카페", comment: "커피 55% 청구할인", info: "<p>스타벅스</p>", cate_idx: 127 }, { title: "유의사항" }],
      issuer: "우리카드",
      cardCategory: "CRD",
      preMonthMoney: 300000,
      releaseDate: "2024-02-29",
      isImpending: false,
      brands: ["Mastercard", "Local"],
      issuerUrlPc: api.request_pc,
      applyLinked: true,
      topBenefit: [{ title: "카페", tags: ["커피 4대 브랜드", "55%", "청구할인"] }],
      searchBenefit: [{ title: "기타", options: ["연회비 최대 100% 지원"] }],
      seoDescription: "커피 4대 브랜드 55% 청구할인",
      imageUrl: api.card_img.url,
      isVisible: true,
      cType: "D",
      benefitImages: [],
    });
    // 광고·관련글 같은 큰 필드는 저장하지 않는다
    expect(JSON.stringify(e)).not.toContain("광고");
  });

  it("전월실적 0·빈 값은 '모름'(null)으로 둔다", () => {
    expect(toDetailEntry(1, { ...api, pre_month_money: 0 }, "t").preMonthMoney).toBeNull();
    expect(toDetailEntry(1, { ...api, pre_month_money: null }, "t").preMonthMoney).toBeNull();
  });

  it("빈 응답이나 형식이 다른 값에도 깨지지 않는다", () => {
    const e = toDetailEntry(1, { brand: "x", key_benefit: null, seo_meta: "x" }, "t");
    expect(e.keyBenefit).toEqual([]);
    expect(e.preMonthMoney).toBeNull();
    expect(e.brands).toBeUndefined();
    expect(e.seoDescription).toBeUndefined();
    expect(e.benefitTextChars).toBe(0);
  });

  it("혜택 본문 속 그림 주소를 모으고, 유의사항을 뺀 글자 수를 센다", () => {
    const e = toDetailEntry(
      49,
      {
        key_benefit: [
          { title: "할인", comment: "편의점 10%", info: '<p>안내</p><img src="https://api.card-gorilla.com:8080/storage/a.png"><img src="data:image/png;base64,AAAA">' },
          { title: "유의사항", comment: "", info: "<p>" + "가".repeat(2000) + "</p>" },
        ],
      },
      "t",
    );
    expect(e.benefitImages).toEqual(["https://api.card-gorilla.com:8080/storage/a.png", "data:image/png(inline)"]);
    expect(e.benefitTextChars).toBe("편의점 10% 안내".length);
    expect(isImageDependent(e)).toBe(true);
    expect(isImageDependent(toDetailEntry(2686, api, "t"))).toBe(false);
  });
});

describe("mergeEntry", () => {
  const first = toDetailEntry(2686, api, "2026-10-01T00:00:00.000Z");

  it("처음 받은 카드는 new, changedAt은 받은 시각", () => {
    const { entry, kind } = mergeEntry(undefined, first);
    expect(kind).toBe("new");
    expect(entry.changedAt).toBe("2026-10-01T00:00:00.000Z");
    expect(entry.contentHash).toBe(hashContent(first));
    expect(entry.inSitemap).toBe(true);
  });

  it("내용이 같으면 unchanged, changedAt을 유지한다(수집 시각·사이트맵 수정일은 해시에 넣지 않음)", () => {
    const prev = { ...mergeEntry(undefined, first).entry, sitemapLastmod: "2026-09-01T00:00:00+09:00" };
    const again = toDetailEntry(2686, api, "2026-10-29T00:00:00.000Z");
    const { entry, kind } = mergeEntry(prev, again);
    expect(kind).toBe("unchanged");
    expect(entry.changedAt).toBe("2026-10-01T00:00:00.000Z");
    expect(entry.fetchedAt).toBe("2026-10-29T00:00:00.000Z");
  });

  it("전월실적 기준이 바뀌면 changed", () => {
    const prev = mergeEntry(undefined, first).entry;
    const next = toDetailEntry(2686, { ...api, pre_month_money: 400000 }, "2026-10-29T00:00:00.000Z");
    const { entry, kind } = mergeEntry(prev, next);
    expect(kind).toBe("changed");
    expect(entry.changedAt).toBe("2026-10-29T00:00:00.000Z");
  });

  it("해시가 없는 예전 줄은 예전 칸이 같으면 upgraded, 다르면 changed", () => {
    const legacy: DetailEntry = {
      sourceId: 2686,
      name: first.name,
      keyBenefit: first.keyBenefit,
      isDiscontinued: false,
      fetchedAt: "2026-09-28T02:12:40.466Z",
    };
    const again = toDetailEntry(2686, api, "2026-10-29T00:00:00.000Z");
    expect(mergeEntry(legacy, again)).toMatchObject({ kind: "upgraded", entry: { changedAt: "2026-09-28T02:12:40.466Z" } });

    const edited = toDetailEntry(2686, { ...api, key_benefit: [{ title: "카페", comment: "커피 50% 청구할인", info: "<p>스타벅스</p>" }] }, "t2");
    expect(mergeEntry(legacy, edited).kind).toBe("changed");
  });
});

describe("pickIds / isUpdatedSince", () => {
  const now = new Date("2026-10-29T00:00:00.000Z");
  // 1: 새 형식, 수정일 그대로 / 2: 새 형식, 받은 뒤 수정됨 / 3: 처음 보는 카드 / 4: 예전 형식(수정일은 예전 수집보다 앞섬)
  const existing = new Map<number, DetailEntry>([
    [1, { sourceId: 1, keyBenefit: [], fetchedAt: "2026-10-28T00:00:00.000Z", contentHash: "h1", sitemapLastmod: "2026-10-20T10:00:00+09:00" }],
    [2, { sourceId: 2, keyBenefit: [], fetchedAt: "2026-09-28T02:12:00.000Z", contentHash: "h2" }],
    [4, { sourceId: 4, keyBenefit: [], fetchedAt: "2026-09-28T02:12:00.000Z" }],
  ]);
  const sitemap = [
    { id: 1, lastmod: "2026-10-20T10:00:00+09:00" },
    { id: 2, lastmod: "2026-10-05T09:00:00+09:00" },
    { id: 3, lastmod: "2026-10-01T09:00:00+09:00" },
    { id: 4, lastmod: "2026-06-01T09:00:00+09:00" },
  ];

  it("옵션이 없으면 사이트맵 전부", () => {
    expect(pickIds(sitemap, existing, {})).toEqual([1, 2, 3, 4]);
  });

  it("--only-new는 파일에 없는 카드만", () => {
    expect(pickIds(sitemap, existing, { onlyNew: true })).toEqual([3]);
  });

  it("--updated는 lastmod가 바뀐 카드, 새 카드, 예전 형식 줄만(저장한 lastmod가 없으면 수집 시각과 비교)", () => {
    expect(pickIds(sitemap, existing, { updated: true })).toEqual([2, 3, 4]);
    expect(isUpdatedSince({ id: 1, lastmod: "2026-10-21T00:00:00+09:00" }, existing.get(1))).toBe(true);
    expect(isUpdatedSince({ id: 1 }, existing.get(1))).toBe(false);
    // 예전 형식 줄은 수정일과 상관없이 받는다(새 필드를 채우려고)
    expect(isUpdatedSince({ id: 4 }, existing.get(4))).toBe(true);
  });

  it("--older-than-days는 오래된 카드와 새 카드만", () => {
    expect(pickIds(sitemap, existing, { olderThanDays: 7, now })).toEqual([2, 3, 4]);
  });

  it("--ids와 --limit", () => {
    expect(pickIds(sitemap, existing, { ids: [3, 1] })).toEqual([3, 1]);
    expect(pickIds(sitemap, existing, { ids: [99] })).toEqual([99]);
    expect(pickIds(sitemap, existing, { limit: 2 })).toEqual([1, 2]);
  });
});

describe("카탈로그 만들기", () => {
  it("연회비 문구를 숫자로 바꾼다", () => {
    expect(parseAnnualFee("해외겸용 [8,000]원")).toEqual({ fee: 8000 });
    expect(parseAnnualFee("국내전용 [12,000]원 / 해외겸용 [12,000]원")).toEqual({ fee: 12000 });
    expect(parseAnnualFee("국내전용 [47,000]원 / 해외겸용 [49,000]원")).toEqual({ fee: 47000, approx: true });
    expect(parseAnnualFee("국내전용 [없음] / 해외겸용 [3,000]원")).toEqual({ fee: 3000 });
    expect(parseAnnualFee("국내전용 [없음] / 해외겸용 [없음]")).toEqual({ fee: 0 });
    expect(parseAnnualFee("면제")).toEqual({ fee: 0 });
    expect(parseAnnualFee(undefined)).toEqual({});
  });

  it("새 형식 원문 줄로 카탈로그 줄을 만든다", () => {
    expect(toCatalogEntry(toDetailEntry(2686, api, "2026-10-29T00:00:00.000Z"))).toEqual({
      sourceId: 2686,
      sourceUrl: "https://www.card-gorilla.com/card/detail/2686",
      name: "D4카드의정석Ⅱ",
      issuer: "우리카드",
      category: "신용",
      annualFeeText: "국내전용 [12,000]원 / 해외겸용 [12,000]원",
      annualFee: 12000,
      imageUrl: api.card_img.url,
      benefitSummary: "커피 4대 브랜드 55% 청구할인",
      fetchedAt: "2026-10-29T00:00:00.000Z",
      isDiscontinued: false,
    });
    expect(toCatalogEntry(toDetailEntry(342, { ...api, cate: "CHK" }, "t"))?.category).toBe("체크");
  });

  it("예전 형식 줄(카드사·분류 없음)은 만들지 않는다", () => {
    expect(toCatalogEntry({ sourceId: 1, name: "x", keyBenefit: [], fetchedAt: "t" })).toBeNull();
  });
});
