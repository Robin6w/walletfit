/**
 * 카드고릴라(card-gorilla.com) 상세 페이지에 SEO용으로 정적 렌더링되는
 * application/ld+json(schema.org Product)을 수집해 카드 기본정보 카탈로그를 생성합니다.
 *
 * 수집 항목: 카드명, 카드사, 카드 유형(신용/체크), 연회비, 이미지 URL, 혜택 요약 텍스트,
 * 신규 발급 중단 여부(isDiscontinued)
 * 전월실적 구간별 상세 혜택(tiers)은 SPA 내부에서만 렌더링되어 이 스크립트로는 수집하지 않습니다.
 * data/cards/*.json에 실제 tiers를 채울 때 참고 자료로만 사용하세요.
 *
 * 신규 발급 중단 여부는 카드 상세페이지 HTML 어디에도 안 나오고(화면에 뜨는 "신규발급이
 * 중단된 카드입니다" 배너는 페이지 로딩 후 자바스크립트가 그려 넣는 것), 그 화면이 내부적으로
 * 불러오는 카드고릴라 API(api.card-gorilla.com/v1/cards/{id})의 응답에만 is_discon 필드로
 * 들어있습니다. 그래서 카드 한 장당 기존 HTML 요청에 이어 이 API도 한 번 더 호출합니다.
 *
 * 실행: npx tsx scripts/fetchCardCatalog.ts [--limit=50] [--concurrency=4]
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const SITEMAP_URL = "https://www.card-gorilla.com/sitemap-cards.xml";
const DETAIL_URL = (id: number) => `https://www.card-gorilla.com/card/detail/${id}`;
const API_DETAIL_URL = (id: number) => `https://api.card-gorilla.com:8080/v1/cards/${id}`;
// TODO: contact 이메일은 우리 팀 연락처로 바꿔서 사용하세요.
// 주의: HTTP 헤더 값은 ASCII만 허용됩니다(한글 등을 넣으면 Node fetch가
// "Cannot convert argument to a ByteString" 에러를 던지며 곧바로 실패합니다).
const USER_AGENT = "walletfit-catalog-bot/1.0 (+academic project: Ajou University Industrial Engineering capstone, walletfit team; contact: robin24@ajou.ac.kr)";
const OUTPUT_DIR = join(process.cwd(), "data", "catalog");
const OUTPUT_FILE = join(OUTPUT_DIR, "cards-catalog.json");
const REQUEST_INTERVAL_MS = 300;

interface CatalogEntry {
  sourceId: number;
  sourceUrl: string;
  name: string;
  issuer: string;
  category: string;
  annualFeeText?: string;
  annualFee?: number;
  /** annualFee가 "국내전용/해외겸용" 등 여러 값 중 첫 번째 값으로 근사됐는지 여부 */
  annualFeeApprox?: boolean;
  imageUrl?: string;
  benefitSummary?: string;
  fetchedAt: string;
  /** 카드고릴라 내부 API의 is_discon 값. API 호출이 실패하면 undefined로 남습니다. */
  isDiscontinued?: boolean;
}

/**
 * schema.org offers.price가 숫자로 안 떨어지는 경우(국내전용/해외겸용 등 연회비가
 * 여러 종류로 병기된 카드)를 위해, 사람이 읽는 연회비 텍스트(annualFeeText)에서
 * 첫 번째로 등장하는 금액을 근사치로 추출합니다.
 * (walletfit 데이터 품질 보정: 이 경우를 그냥 비워두지 않고 텍스트에서 근사치를 추출해 채움)
 */
const ANNUAL_FEE_TEXT_NUMBER_RE = /(\d{1,3}(?:[.,]\d{3})+|\d+)\s*원/;

function parseAnnualFeeFromText(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const cleaned = text.replace(/[[\]]/g, "");
  const match = cleaned.match(ANNUAL_FEE_TEXT_NUMBER_RE);
  if (!match) return undefined;
  const digits = match[1].replace(/[.,]/g, "");
  const value = Number.parseInt(digits, 10);
  return Number.isFinite(value) ? value : undefined;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const concurrencyArg = args.find((a) => a.startsWith("--concurrency="));
  return {
    limit: limitArg ? Number(limitArg.split("=")[1]) : undefined,
    concurrency: concurrencyArg ? Number(concurrencyArg.split("=")[1]) : 4,
  };
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.text();
}

async function fetchCardIds(): Promise<number[]> {
  const xml = await fetchText(SITEMAP_URL);
  const ids: number[] = [];
  const regex = /\/card\/detail\/(\d+)</g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    ids.push(Number(match[1]));
  }
  return ids;
}

function extractLdJsonProduct(html: string): any | null {
  const scriptMatches = html.matchAll(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
  );
  for (const m of scriptMatches) {
    try {
      const parsed = JSON.parse(m[1]);
      const graph = parsed["@graph"];
      if (Array.isArray(graph)) {
        const product = graph.find((node: any) => node["@type"] === "Product");
        if (product) return product;
      }
    } catch {
      // 다음 script 태그 시도
    }
  }
  return null;
}

function toCatalogEntry(id: number, product: any): CatalogEntry {
  const rawName: string = product.name ?? "";
  const name = rawName.replace(/\s*\|\s*카드고릴라\s*$/, "").trim();
  const priceText: string | undefined = product.offers?.description;
  const directPrice: number | undefined =
    typeof product.offers?.price === "number" ? product.offers.price : undefined;

  const fallbackPrice = directPrice === undefined ? parseAnnualFeeFromText(priceText) : undefined;

  return {
    sourceId: id,
    sourceUrl: DETAIL_URL(id),
    name,
    issuer: product.brand?.name ?? "",
    category: product.category ?? "",
    annualFeeText: priceText,
    annualFee: directPrice ?? fallbackPrice,
    annualFeeApprox: fallbackPrice !== undefined ? true : undefined,
    imageUrl: product.image,
    benefitSummary: product.description,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * 카드고릴라 내부 API에서 신규 발급 중단 여부(is_discon)만 뽑아옵니다.
 * 이 API 호출이 실패해도(레이트리밋, 일시적 네트워크 오류 등) 카드 자체를 카탈로그에서
 * 빼버리지는 않고, 그냥 isDiscontinued를 비워둔 채로 넘어갑니다.
 */
async function fetchDiscontinuedFlag(id: number): Promise<boolean | undefined> {
  try {
    const text = await fetchText(API_DETAIL_URL(id));
    const data = JSON.parse(text);
    return typeof data.is_discon === "boolean" ? data.is_discon : undefined;
  } catch (err) {
    console.error(`[discon-check skip] id=${id}: ${(err as Error).message}`);
    return undefined;
  }
}

async function fetchOne(id: number): Promise<CatalogEntry | null> {
  try {
    const html = await fetchText(DETAIL_URL(id));
    const product = extractLdJsonProduct(html);
    if (!product) return null;
    const entry = toCatalogEntry(id, product);
    const isDiscontinued = await fetchDiscontinuedFlag(id);
    return isDiscontinued === undefined ? entry : { ...entry, isDiscontinued };
  } catch (err) {
    console.error(`[skip] id=${id}: ${(err as Error).message}`);
    return null;
  }
}

async function runPool(ids: number[], concurrency: number): Promise<CatalogEntry[]> {
  const results: CatalogEntry[] = [];
  let cursor = 0;

  async function worker() {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      const entry = await fetchOne(id);
      if (entry) results.push(entry);
      await sleep(REQUEST_INTERVAL_MS);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

async function main() {
  const { limit, concurrency } = parseArgs();

  console.log("사이트맵에서 카드 ID 목록을 가져오는 중...");
  let ids = await fetchCardIds();
  console.log(`전체 ${ids.length}개 카드 ID 확인.`);

  if (limit) {
    ids = ids.slice(0, limit);
    console.log(`--limit 옵션에 따라 ${ids.length}개만 수집합니다.`);
  }

  const entries = await runPool(ids, concurrency);
  entries.sort((a, b) => a.sourceId - b.sourceId);

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(entries, null, 2) + "\n", "utf-8");

  console.log(`완료: ${entries.length}/${ids.length}건 수집 -> ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error("카탈로그 수집 실패:", err);
  process.exit(1);
});
