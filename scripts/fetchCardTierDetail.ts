/**
 * 카드고릴라 내부 API(api.card-gorilla.com:8080)에서 카드 상세 데이터를 그대로 수집합니다.
 *
 * fetchCardCatalog.ts가 가져오는 정적 SEO 요약(benefitSummary 한 줄)에는 전월실적
 * 구간별 요율이 없습니다. 이 내부 API 응답의 key_benefit[].info 필드(카테고리별 상세
 * 설명, HTML) 안에는 "전월 신판 이용금액" 구간표가 <table>로 박혀 있는 카드들이 있어서,
 * 이 스크립트로 원본 그대로 받아둔 다음 buildTieredCatalog.ts에서 표를 파싱합니다.
 *
 * 주의: 이 API는 우리(Anthropic 클라우드 샌드박스)가 있는 데이터센터 IP 대역에서는
 * 접속이 막혀 있는 것으로 확인됐습니다(TLS handshake 단계에서 서버가 연결을 끊음).
 * 그래서 이 스크립트는 반드시 실제 사용자 컴퓨터(가정용/학교 네트워크)에서 직접
 * 실행해야 합니다.
 *
 * 실행: npx tsx scripts/fetchCardTierDetail.ts [--limit=30] [--concurrency=4]
 * (먼저 --limit=30 정도로 소량만 받아서 표 파싱이 잘 맞는지 확인한 다음,
 *  --limit 없이 전체를 돌리는 걸 추천합니다.)
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const SITEMAP_URL = "https://www.card-gorilla.com/sitemap-cards.xml";
const API_DETAIL_URL = (id: number) => `https://api.card-gorilla.com:8080/v1/cards/${id}`;
// TODO: contact 이메일은 우리 팀 연락처로 바꿔서 사용하세요.
const USER_AGENT =
  "walletfit-catalog-bot/1.0 (+academic project: Ajou University Industrial Engineering capstone, walletfit team; contact: robin24@ajou.ac.kr)";
const OUTPUT_DIR = join(process.cwd(), "data", "catalog");
const OUTPUT_FILE = join(OUTPUT_DIR, "cards-detail-raw.json");
const REQUEST_INTERVAL_MS = 300;

/** key_benefit 항목 하나. cate_idx가 카테고리 식별자(카드고릴라 내부 분류)입니다. */
interface KeyBenefitEntry {
  title?: string;
  comment?: string;
  info?: string;
  cate_idx?: number;
}

interface DetailEntry {
  sourceId: number;
  name?: string;
  keyBenefit: KeyBenefitEntry[];
  isDiscontinued?: boolean;
  fetchedAt: string;
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

/**
 * 응답 전체(수십 KB, 이미지/광고/관련글 등 포함)를 다 저장하면 너무 커지므로,
 * tiers 파싱에 필요한 key_benefit과 최소 식별 정보만 골라서 저장합니다.
 */
function toDetailEntry(id: number, data: any): DetailEntry {
  const keyBenefit: KeyBenefitEntry[] = Array.isArray(data.key_benefit)
    ? data.key_benefit.map((k: any) => ({
        title: k.title,
        comment: k.comment,
        info: k.info,
        cate_idx: k.cate?.idx ?? k.cate_idx,
      }))
    : [];

  return {
    sourceId: id,
    name: data.name,
    keyBenefit,
    isDiscontinued: typeof data.is_discon === "boolean" ? data.is_discon : undefined,
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchOne(id: number): Promise<DetailEntry | null> {
  try {
    const text = await fetchText(API_DETAIL_URL(id));
    const data = JSON.parse(text);
    return toDetailEntry(id, data);
  } catch (err) {
    console.error(`[skip] id=${id}: ${(err as Error).message}`);
    return null;
  }
}

async function runPool(ids: number[], concurrency: number): Promise<DetailEntry[]> {
  const results: DetailEntry[] = [];
  let cursor = 0;
  let done = 0;

  async function worker() {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      const entry = await fetchOne(id);
      if (entry) results.push(entry);
      done++;
      if (done % 50 === 0) console.log(`진행: ${done}/${ids.length}`);
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

  const withTable = entries.filter((e) => e.keyBenefit.some((k) => k.info?.includes("<table"))).length;
  console.log(`완료: ${entries.length}/${ids.length}건 수집 -> ${OUTPUT_FILE}`);
  console.log(`이 중 실적구간표(<table>)가 있는 카드: ${withTable}건`);
}

main().catch((err) => {
  console.error("상세 데이터 수집 실패:", err);
  process.exit(1);
});
