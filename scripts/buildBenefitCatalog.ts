/**
 * 혜택 표 카탈로그(data/catalog/cards-benefit.json)를 만듭니다.
 *
 * 앱의 모든 카드는 이 파일의 혜택 표(양식 v0.2.1)로 새 계산기(calc.py)와 추천 엔진 v2(milp.py)를 거칩니다.
 * 카드마다 혜택 표를 가져오는 곳은 아래 순서로 고릅니다.
 *
 *   1. reviewed  : 사람이 검수한 정답표        1_혜택정보구조화/cards, cards_test
 *   2. gold_ai   : 원문 대조로 만든 정답표      1_혜택정보구조화/cards_eval (사람 확인 전)
 *   3. extracted : AI 추출 + 원문 대조 통과     1_혜택정보구조화/extracted_scn, extracted_eval
 *   4. auto      : 위에 없는 카드. 카드고릴라 혜택 요약 한 줄로 만든 표(원문 대조 전)
 *                  - 요약 해석(1_혜택정보구조화/요약해석/summary-labels.json)이 있으면 그 해석으로(summaryRecord.ts)
 *                  - 없으면 예전 변환기(cardConverter.ts + autoRecord.ts)로
 *
 * 실행: npm run build:benefit
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { toWalletCard } from "../src/domain/engine/cardConverter";
import type { CatalogListing } from "../src/domain/types/catalog";
import { autoRecord } from "./autoRecord";
import { summaryRecord, type SummaryLabel } from "./summaryRecord";

const ROOT = path.resolve(import.meta.dirname, "..");
const DS = path.join(ROOT, "1_혜택정보구조화");
const OUT = path.join(ROOT, "data/catalog/cards-benefit.json");

type Status = "reviewed" | "gold_ai" | "extracted" | "auto";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BenefitRecord = Record<string, any>;

const SOURCES: { dir: string; status: Status }[] = [
  { dir: "cards", status: "reviewed" },
  { dir: "cards_test", status: "reviewed" },
  { dir: "cards_eval", status: "gold_ai" },
  { dir: "extracted_scn", status: "extracted" },
  { dir: "extracted_eval", status: "extracted" },
];

function readTables(): Map<number, { status: Status; record: BenefitRecord; file: string }> {
  const found = new Map<number, { status: Status; record: BenefitRecord; file: string }>();
  for (const { dir, status } of SOURCES) {
    const full = path.join(DS, dir);
    if (!existsSync(full)) {
      console.warn(`[건너뜀] ${path.relative(ROOT, full)} 폴더가 없습니다`);
      continue;
    }
    for (const name of readdirSync(full).filter((n) => n.endsWith(".json")).sort()) {
      const record = JSON.parse(readFileSync(path.join(full, name), "utf-8")) as BenefitRecord;
      const sid = Number(record?.card?.source_id ?? name.replace(".json", ""));
      if (!Number.isFinite(sid) || found.has(sid)) continue; // 앞 순서(검수 수준이 높은 쪽)가 이긴다
      delete record.extraction_notes;
      found.set(sid, { status, record, file: `${dir}/${name}` });
    }
  }
  return found;
}

function main() {
  const catalog = JSON.parse(readFileSync(path.join(ROOT, "data/catalog/cards-catalog.json"), "utf-8")) as CatalogListing[];
  const tables = readTables();
  const labelPath = path.join(DS, "요약해석", "summary-labels.json");
  const labels = new Map<number, SummaryLabel>(
    existsSync(labelPath) ? (JSON.parse(readFileSync(labelPath, "utf-8")) as SummaryLabel[]).map((l) => [l.sid, l]) : [],
  );
  let fromLabels = 0;
  const counts: Record<Status, number> = { reviewed: 0, gold_ai: 0, extracted: 0, auto: 0 };
  const cards: { sid: number; status: Status; from: string; record: BenefitRecord }[] = [];

  // 앱 화면(loadCatalog.isDiscontinued)과 같은 기준: 카드고릴라 is_discon 값 + discontinued-cards.json 이름 목록
  const discNamesPath = path.join(ROOT, "data/catalog/discontinued-cards.json");
  const discNames = new Set<string>(existsSync(discNamesPath) ? (JSON.parse(readFileSync(discNamesPath, "utf-8")) as string[]).map((n) => n.trim()) : []);

  for (const raw of catalog) {
    const entry: CatalogListing = { ...raw, isDiscontinued: raw.isDiscontinued === true || discNames.has(raw.name.trim()) };
    const t = tables.get(entry.sourceId);
    if (t) {
      // 카탈로그 쪽 정보(발급 중단 여부, 이미지)는 최신 수집값을 따른다
      t.record.card.discontinued = !!entry.isDiscontinued;
      cards.push({ sid: entry.sourceId, status: t.status, from: t.file, record: t.record });
      counts[t.status] += 1;
    } else {
      const card = toWalletCard(entry);
      const fromSummary = summaryRecord(entry, card, labels.get(entry.sourceId));
      if (fromSummary) fromLabels += 1;
      cards.push({
        sid: entry.sourceId,
        status: "auto",
        from: fromSummary ? "요약해석/summary-labels.json" : "cards-catalog.json",
        record: fromSummary ?? autoRecord(entry, card),
      });
      counts.auto += 1;
    }
  }

  const out = {
    version: 1,
    schemaVersion: "0.2.1",
    generatedAt: new Date().toISOString(),
    counts,
    cards,
  };
  writeFileSync(OUT, JSON.stringify(out));
  // 화면이 '검수한 카드'를 가려낼 때 쓰는 작은 목록(혜택 표 3MB를 화면에서 읽지 않으려고 따로 둔다)
  const verified = Object.fromEntries(cards.filter((c) => c.status !== "auto").map((c) => [String(c.sid), c.status]));
  // 자동 변환에서 혜택을 하나도 못 읽은 카드: 화면이 0원 대신 '혜택 정보 없음'으로 보여준다
  const unread = cards.filter((c) => c.status === "auto" && !(c.record.benefits ?? []).length).map((c) => c.sid);
  writeFileSync(
    path.join(ROOT, "data/catalog/benefit-status.json"),
    JSON.stringify({ generatedAt: out.generatedAt, verified, unread }, null, 2) + "\n",
  );
  // 계산기(calc.py)는 1번 작업 폴더가 원본이다. 앱 워커가 쓰는 사본을 같이 맞춘다
  writeFileSync(path.join(ROOT, "src/domain/engine/py/calc.py"), readFileSync(path.join(DS, "calc.py"), "utf-8"));
  // 계산기 가정값(브랜드 비중 35%, 시간대 25% 등)도 앱이 같이 읽는다
  writeFileSync(
    path.join(ROOT, "data/catalog/assumptions.json"),
    readFileSync(path.join(DS, "assumptions.json"), "utf-8"),
  );
  console.log(`카드 ${cards.length}장 → ${path.relative(ROOT, OUT)}`, counts, `(자동 중 요약 해석 ${fromLabels}장)`);
}

main();
