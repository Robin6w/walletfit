/**
 * 카드고릴라 내부 API(api.card-gorilla.com:8080)에서 카드 상세 데이터를 수집합니다.
 *
 * fetchCardCatalog.ts가 가져오는 정적 SEO 요약(benefitSummary 한 줄)에는 전월실적
 * 구간별 요율이 없습니다. 이 내부 API 응답의 key_benefit[].info 필드(카테고리별 상세
 * 설명, HTML) 안에는 "전월 신판 이용금액" 구간표가 <table>로 박혀 있는 카드들이 있어서,
 * 이 스크립트로 원본 그대로 받아둔 다음 buildTieredCatalog.ts에서 표를 파싱합니다.
 * 카드 상세 페이지도 카드 내용은 이 API 하나에서만 받습니다(2026-10-29 확인).
 *
 * 2026-10-29 바뀐 점
 * - 예전에는 받고도 버리던 필드를 같이 저장합니다: 전월실적 기준(preMonthMoney, 0은 모름), 연회비, 출시일,
 *   단종 예정, 카드고릴라 '신청하기' 링크(issuerUrlPc/Mobile, 신청 연결이 있는 카드만), 심의필 문구, 혜택 태그,
 *   혜택 요약 한 줄(seoDescription), 카드 그림, 표시 여부, c_type, 혜택 본문 속 그림 주소와 글자 수.
 *   저장 모양은 scripts/cardDetailRecord.ts에 있고, 예전 필드는 그대로라 다른 스크립트는 고치지 않아도 됩니다.
 *   카탈로그(cards-catalog.json)는 이 파일로 만들 수 있습니다(scripts/buildCatalogFromDetail.ts).
 * - 한 번에 하나씩, 요청 사이 1.5초(기본)를 쉽니다. 전체 1,554장은 약 40분 걸립니다.
 * - 받은 카드만 기존 파일에 덮어 씁니다(--limit으로 몇 장만 받아도 나머지 카드는 그대로 남음).
 * - 사이트맵의 카드별 lastmod를 저장합니다. --updated로 마지막으로 받은 뒤 lastmod가 바뀐 카드, 새 카드, 아직 예전 형식인 줄만
 *   받습니다(API는 ETag·Last-Modified를 주지 않음). lastmod는 이벤트·태그 수정에도 바뀌어서 혜택이 그대로일 수 있습니다.
 * - 사이트맵에 있는 카드만 받습니다. 카드고릴라가 숨긴 카드(is_visible=false)는 API에 번호로 남아 있어도 모으지 않습니다
 *   (정보가 관리되지 않을 수 있고, 번호를 하나씩 찔러 모으는 것은 사이트맵을 따르는 것보다 공격적이라서. 2026-10-29 결정).
 * - 다시 받은 카드의 내용이 바뀌었는지 해시로 비교해 changedAt을 남기고, 이번 수집 결과를
 *   cards-detail-changes.json에 적습니다. 사이트맵에서 빠진 카드는 지우지 않고 inSitemap=false로 둡니다.
 * - 50장마다 중간 저장하고, 연속 5번 실패하면 멈춥니다.
 *
 * 주의: 이 API는 우리(Anthropic 클라우드 샌드박스)가 있는 데이터센터 IP 대역에서는
 * 접속이 막혀 있는 것으로 확인됐습니다(TLS handshake 단계에서 서버가 연결을 끊음).
 * 그래서 이 스크립트는 반드시 실제 사용자 컴퓨터(가정용/학교 네트워크)에서 직접
 * 실행해야 합니다. robots.txt는 www(/card/detail 포함)와 api 모두 허용입니다(2026-10-29 확인).
 *
 * 실행: npx tsx scripts/fetchCardTierDetail.ts [옵션]
 *   --updated              사이트맵 lastmod가 바뀐 카드, 새 카드, 예전 형식 줄만(평소에 쓰는 옵션)
 *   --only-new             파일에 없는 카드만
 *   --older-than-days=N    마지막 수집이 N일보다 오래된 카드(와 새 카드)만
 *   --ids=1,2,3            이 카드만
 *   --limit=N              고른 카드 중 앞에서 N장만
 *   --interval-ms=1500     요청 사이 쉬는 시간(최소 1000)
 *   --out=경로             저장 파일(기본 data/catalog/cards-detail-raw.json). 시험할 때는 다른 파일로
 * (먼저 --limit=5 --out=… 으로 소량만 받아 보고, 그다음 전체를 돌리는 걸 추천합니다.)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { isImageDependent, mergeEntry, pickIds, toDetailEntry, type ChangeKind, type DetailEntry, type SitemapCard } from "./cardDetailRecord";

const SITEMAP_URL = "https://www.card-gorilla.com/sitemap-cards.xml";
const API_DETAIL_URL = (id: number) => `https://api.card-gorilla.com:8080/v1/cards/${id}`;
const USER_AGENT =
  "walletfit-catalog-bot/1.0 (+academic project: Ajou University Industrial Engineering capstone, walletfit team; contact: robin24@ajou.ac.kr)";
const DEFAULT_OUT = join(process.cwd(), "data", "catalog", "cards-detail-raw.json");
const DEFAULT_INTERVAL_MS = 1500;
const MIN_INTERVAL_MS = 1000;
const SAVE_EVERY = 50;
const MAX_CONSECUTIVE_FAILURES = 5;

function parseArgs() {
  const args = process.argv.slice(2);
  const val = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
  const num = (name: string) => (val(name) !== undefined ? Number(val(name)) : undefined);
  if (args.some((a) => a.startsWith("--concurrency"))) {
    console.warn("--concurrency는 더 이상 쓰지 않습니다. 한 번에 하나씩 받습니다.");
  }
  return {
    limit: num("limit"),
    ids: val("ids")?.split(",").map(Number).filter(Number.isFinite),
    onlyNew: args.includes("--only-new"),
    updated: args.includes("--updated"),
    olderThanDays: num("older-than-days"),
    intervalMs: Math.max(MIN_INTERVAL_MS, num("interval-ms") ?? DEFAULT_INTERVAL_MS),
    out: val("out") ? resolve(val("out")!) : DEFAULT_OUT,
  };
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    throw Object.assign(new Error(`HTTP ${res.status} for ${url}`), { status: res.status });
  }
  return res.text();
}

/** 사이트맵의 카드 번호와 lastmod */
async function fetchSitemap(): Promise<SitemapCard[]> {
  const xml = await fetchText(SITEMAP_URL);
  const cards: SitemapCard[] = [];
  for (const block of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const id = block[1].match(/\/card\/detail\/(\d+)</);
    if (!id) continue;
    const lastmod = block[1].match(/<lastmod>([^<]+)<\/lastmod>/)?.[1];
    cards.push({ id: Number(id[1]), ...(lastmod ? { lastmod } : {}) });
  }
  return cards;
}

/** 한 장 받기. 429·5xx면 30초 쉬고 한 번 더 시도합니다 */
async function fetchOne(id: number): Promise<DetailEntry> {
  try {
    return toDetailEntry(id, JSON.parse(await fetchText(API_DETAIL_URL(id))), new Date().toISOString());
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status !== 429 && !(status && status >= 500)) throw err;
    console.warn(`[대기] id=${id}: HTTP ${status}, 30초 뒤 다시 시도`);
    await sleep(30_000);
    return toDetailEntry(id, JSON.parse(await fetchText(API_DETAIL_URL(id))), new Date().toISOString());
  }
}

function loadExisting(path: string): Map<number, DetailEntry> {
  if (!existsSync(path)) return new Map();
  const list = JSON.parse(readFileSync(path, "utf-8")) as DetailEntry[];
  return new Map(list.map((e) => [e.sourceId, e]));
}

function save(path: string, entries: Map<number, DetailEntry>) {
  mkdirSync(dirname(path), { recursive: true });
  const list = [...entries.values()].sort((a, b) => a.sourceId - b.sourceId);
  writeFileSync(path, JSON.stringify(list, null, 2) + "\n", "utf-8");
}

async function main() {
  const opts = parseArgs();
  const entries = loadExisting(opts.out);
  console.log(`기존 파일: ${entries.size}장 (${opts.out})`);

  console.log("사이트맵에서 카드 목록을 가져오는 중...");
  const sitemap = await fetchSitemap();
  const lastmodOf = new Map(sitemap.map((c) => [c.id, c.lastmod]));
  console.log(`사이트맵: ${sitemap.length}장`);

  const ids = pickIds(sitemap, entries, opts);
  const minutes = Math.ceil((ids.length * (opts.intervalMs + 300)) / 60_000);
  console.log(`이번에 받을 카드: ${ids.length}장, 요청 간격 ${opts.intervalMs}ms, 예상 약 ${minutes}분`);

  const runAt = new Date().toISOString();
  const kinds: Record<ChangeKind, number[]> = { new: [], changed: [], unchanged: [], upgraded: [] };
  const failed: { id: number; error: string }[] = [];
  let streak = 0;

  for (const [i, id] of ids.entries()) {
    try {
      const { entry, kind } = mergeEntry(entries.get(id), await fetchOne(id));
      const lastmod = lastmodOf.get(id);
      entries.set(id, lastmod ? { ...entry, sitemapLastmod: lastmod } : entry);
      kinds[kind].push(id);
      streak = 0;
    } catch (err) {
      failed.push({ id, error: (err as Error).message });
      console.error(`[실패] id=${id}: ${(err as Error).message}`);
      if (++streak >= MAX_CONSECUTIVE_FAILURES) {
        console.error(`연속 ${streak}번 실패해서 멈춥니다. 받은 것까지만 저장합니다.`);
        break;
      }
    }
    if ((i + 1) % SAVE_EVERY === 0) {
      save(opts.out, entries);
      console.log(`진행: ${i + 1}/${ids.length} (중간 저장)`);
    }
    if (i < ids.length - 1) await sleep(opts.intervalMs);
  }

  // 사이트맵은 매번 통째로 받으므로, 이번에 받지 않은 카드도 사이트맵에 있는지 표시합니다(빠진 카드는 지우지 않음)
  const goneFromSitemap: number[] = [];
  for (const e of entries.values()) {
    const inMap = lastmodOf.has(e.sourceId);
    if (!inMap && e.inSitemap !== false) goneFromSitemap.push(e.sourceId);
    e.inSitemap = inMap;
  }

  save(opts.out, entries);
  const fetched = [...kinds.new, ...kinds.changed, ...kinds.unchanged, ...kinds.upgraded].map((id) => entries.get(id)!);
  const imageDependent = fetched.filter(isImageDependent).map((e) => e.sourceId);
  const changesPath = join(dirname(opts.out), "cards-detail-changes.json");
  writeFileSync(
    changesPath,
    JSON.stringify({ runAt, out: opts.out, requested: ids.length, ...kinds, goneFromSitemap, imageDependent, failed }, null, 2) + "\n",
    "utf-8",
  );

  const all = [...entries.values()];
  const withTable = all.filter((e) => e.keyBenefit.some((k) => k.info?.includes("<table"))).length;
  console.log(
    `완료: 새 카드 ${kinds.new.length}, 바뀜 ${kinds.changed.length}, 그대로 ${kinds.unchanged.length}, ` +
      `필드만 보강 ${kinds.upgraded.length}, 실패 ${failed.length}, 이번에 사이트맵에서 빠짐 ${goneFromSitemap.length}`,
  );
  console.log(`이번에 받은 카드 중 그림 확인이 필요한 카드(본문에 그림 + 글자 적음): ${imageDependent.length}장`);
  console.log(
    `파일: ${entries.size}장(사이트맵에 없음 ${all.filter((e) => !e.inSitemap).length}, 새 형식 ${all.filter((e) => e.contentHash).length}) -> ${opts.out}` +
      ` (실적구간표 <table> 있는 카드 ${withTable}장)`,
  );
  console.log(`이번 수집 기록: ${changesPath}`);
}

main().catch((err) => {
  console.error("상세 데이터 수집 실패:", err);
  process.exit(1);
});
