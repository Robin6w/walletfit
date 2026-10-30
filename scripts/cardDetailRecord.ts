/**
 * 카드고릴라 상세 API 응답 → cards-detail-raw.json 한 줄로 바꾸는 순수 함수들(2026-10-29).
 * fetchCardTierDetail.ts와 buildCatalogFromDetail.ts가 쓰고, tests/cardDetailRecord.test.ts가 검사합니다.
 *
 * 예전 형식(sourceId, name, keyBenefit, isDiscontinued, fetchedAt)은 그대로 두고 필드만 더합니다.
 * 그래서 buildTieredCatalog.ts, buildCardMeta.ts, 1_혜택정보구조화의 파이썬 스크립트는 고치지 않아도 됩니다.
 */
import { createHash } from "node:crypto";

/** key_benefit 항목 하나. cate_idx가 카테고리 식별자(카드고릴라 내부 분류)입니다. */
export interface KeyBenefitEntry {
  title?: string;
  comment?: string;
  info?: string;
  cate_idx?: number;
}

export interface DetailEntry {
  sourceId: number;
  name?: string;
  keyBenefit: KeyBenefitEntry[];
  isDiscontinued?: boolean;
  fetchedAt: string;
  // ---- 2026-10-29 추가: 예전에는 받고도 버리던 필드 ----
  /** 카드사 이름(corp.name) */
  issuer?: string;
  /** 카드고릴라 분류(cate). CRD=신용, CHK=체크 */
  cardCategory?: string;
  /**
   * 전월실적 기준 금액(원). 0이 아닌 값만 넣고, 0이나 빈 값은 null(모름)로 둡니다.
   * API의 0은 "조건 없음"이 아닙니다: 2026-10-29 표본에서 0인 4장 중 3장이 원문에 "30만원"이라고 적혀 있었습니다.
   * 값이 있어도 가장 낮은 구간 하나일 수 있어 대조용으로만 씁니다
   */
  preMonthMoney?: number | null;
  annualFeeBasic?: string;
  /** 연회비 상세(HTML) */
  annualFeeDetail?: string;
  /** 출시일 YYYY-MM-DD */
  releaseDate?: string;
  /** 단종 예정 */
  isImpending?: boolean;
  onlyOnline?: boolean;
  brands?: string[];
  /**
   * 카드고릴라 '신청하기' 링크(request_pc·request_m). 카드사의 상품·신청 페이지로 가며 제휴 파라미터(utm, canvasser 등)가 붙은 값 그대로.
   * 카드고릴라가 신청 연결을 하는 카드에만 있다. 2026-10-29 표본 60장 중 11장(발급 중 44장 중 10장)에만 있었음
   */
  issuerUrlPc?: string;
  issuerUrlMobile?: string;
  /** 카드고릴라에서 신청 연결을 하는지(request_yn) */
  applyLinked?: boolean;
  /** 심의필 문구·상품설명서 안내(HTML) */
  censorshipInfo?: string;
  topBenefit?: { title?: string; tags: string[] }[];
  searchBenefit?: { title?: string; options: string[] }[];
  /** 검색용 설명(seo_meta description). 카탈로그의 혜택 요약 한 줄(benefitSummary)과 같은 문장 */
  seoDescription?: string;
  /** 카드 그림(card_img.url) */
  imageUrl?: string;
  /** 카드고릴라 화면 표시 여부(is_visible) */
  isVisible?: boolean;
  /**
   * 카드고릴라 혜택 유형(c_type). D=할인형(목록 API의 c_type_txt로 확인), P·M은 포인트형·마일리지형으로 보임.
   * 카드고릴라가 붙인 대표 유형이라 적립 혜택이 있는 카드도 D일 수 있습니다
   */
  cType?: string;
  /** 혜택 본문(key_benefit.info) 속 그림 주소. 그림 안의 혜택은 글자 추출에서 빠지므로 따로 봐야 합니다 */
  benefitImages?: string[];
  /** 혜택 본문 글자 수('유의사항' 단락 제외, 태그·공백 정리 후). 그림 의존 카드를 찾는 데 씁니다 */
  benefitTextChars?: number;
  // ---- 수집 기록 ----
  /** 위 내용(fetchedAt·수집 기록 제외)의 SHA-1. 다시 받았을 때 바뀌었는지 보는 데 씁니다 */
  contentHash?: string;
  /** 내용이 마지막으로 바뀐 시각(처음 받은 시각 포함) */
  changedAt?: string;
  /** 마지막 수집 때 사이트맵에 있었는지 */
  inSitemap?: boolean;
  /** 이 카드를 받을 때 사이트맵의 lastmod. 다음 수집에서 lastmod가 이보다 새로우면 다시 받습니다 */
  sitemapLastmod?: string;
}

export type ChangeKind = "new" | "changed" | "unchanged" | "upgraded";

/** 그림 의존 카드 기준: 혜택 본문에 그림이 있고 글자가 이보다 적은 카드 */
export const IMAGE_DEPENDENT_MAX_CHARS = 800;

const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const bool = (v: unknown) => (typeof v === "boolean" ? v : undefined);

const plainText = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function benefitImagesOf(keyBenefit: KeyBenefitEntry[]): string[] {
  const out: string[] = [];
  for (const k of keyBenefit) {
    for (const m of (k.info ?? "").matchAll(/<img\b[^>]*?\bsrc="([^"]+)"/gi)) {
      const src = m[1].startsWith("data:") ? `${m[1].slice(0, m[1].indexOf(";") > 0 ? m[1].indexOf(";") : 20)}(inline)` : m[1];
      if (!out.includes(src)) out.push(src);
    }
  }
  return out;
}

function benefitTextCharsOf(keyBenefit: KeyBenefitEntry[]): number {
  return plainText(
    keyBenefit
      .filter((k) => k.title !== "유의사항")
      .map((k) => `${k.comment ?? ""} ${k.info ?? ""}`)
      .join(" "),
  ).length;
}

/** API 응답 하나를 저장할 모양으로 바꿉니다(수집 기록 필드는 비워 둠) */
export function toDetailEntry(id: number, data: any, fetchedAt: string): DetailEntry {
  const keyBenefit: KeyBenefitEntry[] = Array.isArray(data?.key_benefit)
    ? data.key_benefit.map((k: any) => ({
        title: k.title,
        comment: k.comment,
        info: k.info,
        cate_idx: k.cate?.idx ?? k.cate_idx,
      }))
    : [];
  const money = data?.pre_month_money;
  const seo = Array.isArray(data?.seo_meta)
    ? data.seo_meta.find((m: any) => m?.name === "description" || m?.property === "og:description")
    : undefined;
  return {
    sourceId: id,
    name: data?.name,
    keyBenefit,
    isDiscontinued: bool(data?.is_discon),
    fetchedAt,
    issuer: str(data?.corp?.name),
    cardCategory: str(data?.cate),
    preMonthMoney: typeof money === "number" && money > 0 ? money : null,
    annualFeeBasic: str(data?.annual_fee_basic),
    annualFeeDetail: str(data?.annual_fee_detail),
    releaseDate: str(data?.release_dt),
    isImpending: bool(data?.is_impend),
    onlyOnline: bool(data?.only_online),
    brands: Array.isArray(data?.brand) ? data.brand.map((b: any) => b?.name).filter((n: unknown) => typeof n === "string") : undefined,
    issuerUrlPc: str(data?.request_pc),
    issuerUrlMobile: str(data?.request_m),
    applyLinked: bool(data?.request_yn),
    censorshipInfo: str(data?.censorship_info),
    topBenefit: Array.isArray(data?.top_benefit)
      ? data.top_benefit.map((t: any) => ({ title: str(t?.title), tags: Array.isArray(t?.tags) ? t.tags.filter((x: unknown) => typeof x === "string") : [] }))
      : undefined,
    searchBenefit: Array.isArray(data?.search_benefit)
      ? data.search_benefit.map((s: any) => ({
          title: str(s?.title),
          options: Array.isArray(s?.options) ? s.options.map((o: any) => o?.label).filter((x: unknown) => typeof x === "string") : [],
        }))
      : undefined,
    seoDescription: str(seo?.content),
    imageUrl: str(data?.card_img?.url),
    isVisible: bool(data?.is_visible),
    cType: str(data?.c_type),
    benefitImages: benefitImagesOf(keyBenefit),
    benefitTextChars: benefitTextCharsOf(keyBenefit),
  };
}

/** 혜택 본문에 그림이 있고 글자가 적어, 그림 안에 혜택이 있을 가능성이 큰 카드 */
export function isImageDependent(entry: DetailEntry): boolean {
  return (entry.benefitImages?.length ?? 0) > 0 && (entry.benefitTextChars ?? Infinity) < IMAGE_DEPENDENT_MAX_CHARS;
}

const RECORD_KEYS = new Set(["fetchedAt", "contentHash", "changedAt", "inSitemap", "sitemapLastmod"]);

function sha1(value: unknown): string {
  return createHash("sha1").update(JSON.stringify(value)).digest("hex");
}

/** 내용 해시: 수집 기록 필드를 뺀 나머지. 키 순서는 toDetailEntry가 정한 순서로 고정됩니다 */
export function hashContent(entry: DetailEntry): string {
  return sha1(Object.fromEntries(Object.entries(entry).filter(([k, v]) => !RECORD_KEYS.has(k) && v !== undefined)));
}

/** 예전 형식에도 있는 칸만으로 만든 해시. 해시가 없는 예전 줄과 비교할 때 씁니다 */
function hashLegacy(entry: DetailEntry): string {
  return sha1({ name: entry.name, keyBenefit: entry.keyBenefit, isDiscontinued: entry.isDiscontinued });
}

/**
 * 새로 받은 줄을 예전 줄과 맞춰 봅니다.
 * - new: 처음 받은 카드
 * - changed: 내용이 바뀜(changedAt을 이번 수집 시각으로)
 * - unchanged: 그대로(changedAt 유지)
 * - upgraded: 예전 형식 줄에 새 필드만 더해짐(예전에도 있던 칸은 그대로)
 */
export function mergeEntry(prev: DetailEntry | undefined, next: DetailEntry): { entry: DetailEntry; kind: ChangeKind } {
  const contentHash = hashContent(next);
  const base = { ...next, contentHash, inSitemap: true };
  if (!prev) return { entry: { ...base, changedAt: next.fetchedAt }, kind: "new" };
  if (prev.contentHash) {
    if (prev.contentHash === contentHash) return { entry: { ...base, changedAt: prev.changedAt ?? prev.fetchedAt }, kind: "unchanged" };
    return { entry: { ...base, changedAt: next.fetchedAt }, kind: "changed" };
  }
  if (hashLegacy(prev) === hashLegacy(next)) return { entry: { ...base, changedAt: prev.fetchedAt }, kind: "upgraded" };
  return { entry: { ...base, changedAt: next.fetchedAt }, kind: "changed" };
}

export interface SitemapCard {
  id: number;
  /** 사이트맵 lastmod(예: 2026-06-15T17:31:44+09:00). 없을 수도 있음 */
  lastmod?: string;
}

/**
 * 다시 받아야 하는지: 받은 적 없는 카드, 아직 예전 형식인 줄(새 필드가 없음), 사이트맵 수정일이 마지막으로 받은 뒤로 바뀐 카드.
 * 예전 형식 줄을 넣지 않으면 수정일이 예전 수집(9/28)보다 앞선 카드는 영영 새 필드를 못 받는다(2026-10-29 2차 점검)
 */
export function isUpdatedSince(card: SitemapCard, prev: DetailEntry | undefined): boolean {
  if (!prev || !prev.contentHash) return true;
  if (!card.lastmod) return false;
  const seen = Date.parse(prev.sitemapLastmod ?? prev.fetchedAt);
  return Date.parse(card.lastmod) > seen;
}

/** 어떤 카드를 받을지 고릅니다. 사이트맵 순서를 지킵니다 */
export function pickIds(
  sitemap: SitemapCard[],
  existing: Map<number, DetailEntry>,
  opts: { ids?: number[]; onlyNew?: boolean; updated?: boolean; olderThanDays?: number; limit?: number; now?: Date },
): number[] {
  let cards = opts.ids?.length ? opts.ids.map((id) => sitemap.find((c) => c.id === id) ?? { id }) : sitemap;
  if (opts.onlyNew) cards = cards.filter((c) => !existing.has(c.id));
  if (opts.updated) cards = cards.filter((c) => isUpdatedSince(c, existing.get(c.id)));
  if (opts.olderThanDays !== undefined) {
    const cutoff = (opts.now ?? new Date()).getTime() - opts.olderThanDays * 86_400_000;
    cards = cards.filter((c) => {
      const prev = existing.get(c.id);
      return !prev || Date.parse(prev.fetchedAt) < cutoff;
    });
  }
  const ids = cards.map((c) => c.id);
  return opts.limit ? ids.slice(0, opts.limit) : ids;
}

// ---------- 카탈로그(cards-catalog.json) 만들기 ----------

/** cards-catalog.json 한 줄. fetchCardCatalog.ts가 HTML에서 만들던 것과 같은 모양(categoryTiers는 build:catalog가 더함) */
export interface CatalogEntry {
  sourceId: number;
  sourceUrl: string;
  name: string;
  issuer: string;
  category: string;
  annualFeeText?: string;
  annualFee?: number;
  /** 0이 아닌 연회비가 서로 다르게 여러 개 있어(국내전용/해외겸용 등) 첫 번째 값으로 근사했는지 */
  annualFeeApprox?: boolean;
  imageUrl?: string;
  benefitSummary?: string;
  fetchedAt: string;
  isDiscontinued?: boolean;
  categoryTiers?: unknown;
}

const CATEGORY_LABEL: Record<string, string> = { CRD: "신용", CHK: "체크" };

/**
 * 연회비 문구 → 숫자. "국내전용 [12,000]원 / 해외겸용 [15,000]원"이면 12,000(근사), "[없음]"·"없음"·"면제"는 0.
 * "[없음]"은 '그 종류가 없음'일 때도 있어서(예: 국내전용 [없음] / 해외겸용 [3,000]원) 0이 아닌 첫 금액을 씁니다.
 */
export function parseAnnualFee(text: string | undefined): { fee?: number; approx?: boolean } {
  if (!text) return {};
  const parts = [...text.matchAll(/\[([^\]]*)\]/g)].map((m) => m[1]);
  const pieces = parts.length ? parts : [text];
  const amounts = pieces.map((p) => {
    const m = p.match(/\d{1,3}(?:,\d{3})+|\d+/);
    return m ? Number(m[0].replace(/,/g, "")) : /없음|면제/.test(p) ? 0 : undefined;
  });
  const known = amounts.filter((a): a is number => a !== undefined);
  if (!known.length) return {};
  const nonzero = [...new Set(known.filter((a) => a > 0))];
  if (!nonzero.length) return { fee: 0 };
  return nonzero.length > 1 ? { fee: nonzero[0], approx: true } : { fee: nonzero[0] };
}

/** 새 형식(필드가 다 있는) 원문 줄로 카탈로그 줄을 만듭니다. 예전 형식 줄이면 null */
export function toCatalogEntry(entry: DetailEntry): CatalogEntry | null {
  if (entry.cardCategory === undefined || entry.issuer === undefined) return null;
  const { fee, approx } = parseAnnualFee(entry.annualFeeBasic);
  return {
    sourceId: entry.sourceId,
    sourceUrl: `https://www.card-gorilla.com/card/detail/${entry.sourceId}`,
    name: entry.name ?? "",
    issuer: entry.issuer,
    category: CATEGORY_LABEL[entry.cardCategory] ?? "",
    annualFeeText: entry.annualFeeBasic,
    annualFee: fee,
    ...(approx ? { annualFeeApprox: true } : {}),
    imageUrl: entry.imageUrl,
    benefitSummary: entry.seoDescription,
    fetchedAt: entry.fetchedAt,
    isDiscontinued: entry.isDiscontinued,
  };
}
