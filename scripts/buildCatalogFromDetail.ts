/**
 * cards-detail-raw.json(카드고릴라 API 원문)으로 카탈로그(cards-catalog.json)를 만듭니다(2026-10-29).
 *
 * 예전에는 fetchCardCatalog.ts가 카드 상세 HTML의 ld+json을 따로 받아 카탈로그를 만들었습니다.
 * 그 값(이름, 카드사, 신용/체크, 연회비 문구, 카드 그림, 혜택 요약 한 줄, 단종 여부)은 API 응답에 모두 있어서
 * 원문을 받을 때 함께 저장하고(fetchCardTierDetail.ts), 여기서는 네트워크 없이 파일만 바꿉니다.
 * 이렇게 하면 카드당 요청이 3번(HTML 1 + API 2)에서 1번으로 줄고, 두 파일의 수집일이 어긋나 카드가 빠지는 일이 없습니다.
 *
 * - 새 형식(필드가 다 있는) 원문 줄은 원문으로 만듭니다.
 * - 아직 예전 형식인 줄은 기존 카탈로그 줄을 그대로 씁니다(전체를 다시 받기 전까지의 과도기).
 * - 사이트맵에서 빠진 카드(inSitemap=false)는 넣지 않습니다.
 * - categoryTiers(구간별 요율)는 넣지 않으니, 이어서 npm run build:catalog를 돌립니다.
 *
 * 실행: npx tsx scripts/buildCatalogFromDetail.ts [--raw=경로] [--out=경로]
 *   기본: data/catalog/cards-detail-raw.json → data/catalog/cards-catalog.json(기존 파일을 읽고 덮어씀)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { toCatalogEntry, type CatalogEntry, type DetailEntry } from "./cardDetailRecord";

const CATALOG_DIR = join(process.cwd(), "data", "catalog");

function arg(name: string): string | undefined {
  return process.argv.slice(2).find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
}

function main() {
  const rawPath = resolve(arg("raw") ?? join(CATALOG_DIR, "cards-detail-raw.json"));
  const outPath = resolve(arg("out") ?? join(CATALOG_DIR, "cards-catalog.json"));
  const basePath = join(CATALOG_DIR, "cards-catalog.json");

  const raw = JSON.parse(readFileSync(rawPath, "utf-8")) as DetailEntry[];
  const prevList = existsSync(basePath) ? (JSON.parse(readFileSync(basePath, "utf-8")) as CatalogEntry[]) : [];
  const prev = new Map(prevList.map((c) => [c.sourceId, c]));

  const out: CatalogEntry[] = [];
  let fromDetail = 0;
  let carried = 0;
  const missing: number[] = [];
  const dropped: number[] = [];
  for (const e of raw) {
    if (e.inSitemap === false) {
      dropped.push(e.sourceId);
      continue;
    }
    const built = toCatalogEntry(e);
    if (built) {
      out.push(built);
      fromDetail++;
    } else if (prev.has(e.sourceId)) {
      out.push(prev.get(e.sourceId)!);
      carried++;
    } else {
      missing.push(e.sourceId);
    }
  }
  out.sort((a, b) => a.sourceId - b.sourceId);
  writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf-8");

  const inPrevOnly = prevList.filter((c) => !raw.some((e) => e.sourceId === c.sourceId)).map((c) => c.sourceId);
  console.log(`카탈로그 ${out.length}장 -> ${outPath}`);
  console.log(`  원문으로 만듦 ${fromDetail}, 기존 카탈로그 그대로 ${carried}(예전 형식 원문), 사이트맵에서 빠져 뺌 ${dropped.length}`);
  if (missing.length) console.log(`  만들 수 없음(예전 형식인데 기존 카탈로그에도 없음) ${missing.length}: ${missing.join(", ")} → --ids로 다시 받으세요`);
  if (inPrevOnly.length) console.log(`  기존 카탈로그에만 있던 카드(원문 없음, 뺌) ${inPrevOnly.length}: ${inPrevOnly.join(", ")}`);
  console.log("다음: npm run build:catalog(구간별 요율) → npm run build:benefit(혜택 표)");
}

main();
