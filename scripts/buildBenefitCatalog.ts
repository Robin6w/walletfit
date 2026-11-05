/**
 * 혜택 표 카탈로그(data/catalog/cards-benefit.json)를 만듭니다.
 *
 * 앱의 모든 카드는 이 파일의 혜택 표(양식 v0.2.1)로 새 계산기(calc.py)와 추천 엔진 v2(milp.py)를 거칩니다.
 * 카드마다 혜택 표를 가져오는 곳은 아래 순서로 고릅니다.
 *
 *   1. extracted : 원문 전체 정제 결과(발급 중 1,180장 + 단종 372장) 1_혜택정보구조화/정제/out_full/records
 *   2. gold_ai   : 원문 대조로 만든 정답표(2장)  1_혜택정보구조화/cards_eval (사람 확인 전)
 *   3. auto      : 둘 다 없는 새 카드. 혜택 없이 넣어 화면이 '혜택 정보 없음'으로 보여 준다(원문 정제를 돌리면 채워짐)
 *
 * 2026-11-04 정리: 예전 출처(cards·cards_test·extracted_scn·extracted_eval)와 요약 한 줄 변환(autoRecord·summaryRecord)은
 * 단종 카드까지 원문 정제가 끝나 쓰이지 않아 뺐다(빌드 결과가 같은 것을 확인)
 *
 * 실행: npm run build:benefit
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { toWalletCard } from "../src/domain/engine/cardConverter";
import type { CatalogListing } from "../src/domain/types/catalog";
import { buildCardView } from "./buildCardView";
import { splitCategories } from "./splitCategories";

const ROOT = path.resolve(import.meta.dirname, "..");
const DS = path.join(ROOT, "1_혜택정보구조화");
const OUT = path.join(ROOT, "data/catalog/cards-benefit.json");

type Status = "reviewed" | "gold_ai" | "extracted" | "auto";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BenefitRecord = Record<string, any>;

const SOURCES: { dir: string; status: Status }[] = [
  // 원문 전체 정제(2026-10-30, 발급 중 1,180장, 양식 v0.3): 예전 표보다 먼저 쓴다(사용자 결정: 다 이번 것으로)
  { dir: "정제/out_full/records", status: "extracted" },
  { dir: "cards_eval", status: "gold_ai" },
];

/**
 * 앱(계산기·화면)이 읽지 않는 칸을 지운다. 정제 레코드는 메모·근거 위치·업종 id까지 담아 그대로 넣으면
 * 혜택 표가 3MB → 15MB가 된다(브라우저 워커가 통째로 읽음). 원본은 1_혜택정보구조화에 그대로 남는다.
 * 남기는 것: 계산기 입력 전부, 화면이 쓰는 source_quote(400자까지)·performance.excluded_items·scope.merchants
 */
function slim(record: BenefitRecord) {
  delete record.perks;
  delete record.notes;
  delete record.performance?.quote;
  for (const c of record.shared_caps ?? []) delete c.source_quote;
  for (const b of record.benefits ?? []) {
    for (const k of ["notes", "source_ref", "unknowns", "confidence"]) delete b[k];
    for (const k of ["excluded", "excluded_types", "merchant_types", "brands", "payment_methods", "issuer_type"]) delete b.scope?.[k];
    if (typeof b.source_quote === "string" && b.source_quote.length > 400) b.source_quote = b.source_quote.slice(0, 400);
  }
}

/**
 * 의심 혜택 표시(2026-11-05, 문제 지도 개선 13 '확인 안 된 혜택은 깎아서 고르기').
 * 확실한 신호만 본다. 엔진은 조합을 고를 때만 이 혜택 금액에 assumptions.json suspect_discount.factor를 곱한다(화면 값은 calc 그대로).
 *   multi_value_tier : 같은 구간에 값이 둘 이상(결제 수단별 값이 남아 계산기가 큰 값을 고름, checks.py '3 같은 구간 값 둘')
 *   cond_text_only   : 원문 인용에 '건당 ○원 이상'이 있는데 건당 최소 결제 칸이 빔(checks.py '3 조건 글만 있음')
 *   high_rate_no_cap : 30% 이상인데 한도·횟수 제한이 없음(checks.py '3 한도 없는 고율')
 *   ai_category      : 비어 있던 카테고리를 AI 이름 분류로 채움(레코드 메모 'AI 이름 분류')
 * 레코드 메모(extraction_notes)와 긴 원문 인용은 slim 전에 지우므로 그 전에 본다.
 * 혜택 표의 benefit은 스키마상 다른 칸을 못 넣어(checks.py 1층이 깨짐) 카드 항목의 suspect {혜택 id: [이유]}에 둔다.
 */
const MIN_TXN_TEXT = /(건당|1회)\s*[\d,]+\s*(만\s*)?원\s*이상|[\d,]+\s*(만\s*)?원\s*이상\s*(결제|이용)\s*시/;

function suspectOf(record: BenefitRecord): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const add = (bid: string, why: string) => {
    if (!(out[bid] ??= []).includes(why)) out[bid].push(why);
  };
  for (const b of record.benefits ?? []) {
    const vt: BenefitRecord[] = b.reward?.value_by_tier ?? [];
    const seen = new Map<unknown, unknown>();
    for (const v of vt) {
      if (seen.has(v.tier) && seen.get(v.tier) !== v.value) add(b.id, "multi_value_tier");
      seen.set(v.tier, v.value);
    }
    const cond = b.conditions ?? {};
    if (MIN_TXN_TEXT.test(b.source_quote ?? "") && !cond.min_txn_won) add(b.id, "cond_text_only");
    if (b.reward?.type === "percent" && vt.some((v) => (v.value ?? 0) >= 0.3)
      && !(b.caps ?? []).length && !(b.shared_cap_ids ?? []).length && !cond.count_limits) add(b.id, "high_rate_no_cap");
  }
  const ids = new Set((record.benefits ?? []).map((b: BenefitRecord) => b.id));
  for (const note of [record.extraction_notes ?? []].flat()) {
    const m = /^\[([^\]]+)\]/.exec(String(note));
    if (m && ids.has(m[1]) && String(note).includes("AI 이름 분류")) add(m[1], "ai_category");
  }
  return out;
}

/**
 * 코드 검사 의심 목록(2026-11-05, 문제 지도 1·4·6·7): `1_혜택정보구조화/코드검사/*_check.json`의 suspect {sid: {혜택 id: [이유]}}.
 * 표 대조·숫자 대조·유의사항 조건·같은 문장 다른 판단. 확정하기 어려운 것은 `코드검사/보류.json` {sid: [혜택 id]}로 뺀다
 */
function codeCheckSuspects(): Map<number, Record<string, string[]>> {
  const dir = path.join(DS, "코드검사");
  const out = new Map<number, Record<string, string[]>>();
  if (!existsSync(dir)) return out;
  const holdPath = path.join(dir, "보류.json");
  const hold: Record<string, string[]> = existsSync(holdPath) ? JSON.parse(readFileSync(holdPath, "utf-8")).items ?? {} : {};
  for (const name of readdirSync(dir).filter((n) => n.endsWith("_check.json")).sort()) {
    const sus: Record<string, Record<string, string[]>> = JSON.parse(readFileSync(path.join(dir, name), "utf-8")).suspect ?? {};
    for (const [sid, byB] of Object.entries(sus)) {
      for (const [bid, whys] of Object.entries(byB)) {
        if ((hold[sid] ?? []).includes(bid)) continue;
        const m = out.get(Number(sid)) ?? {};
        for (const w of whys) if (!(m[bid] ??= []).includes(w)) m[bid].push(w);
        out.set(Number(sid), m);
      }
    }
  }
  return out;
}

/** 원문 정제가 없는 새 카드: 카드 정보만 있고 혜택은 비운 레코드 */
function emptyRecord(entry: CatalogListing): BenefitRecord {
  const card = toWalletCard(entry);
  return {
    schema_version: "0.3",
    card: { source_id: entry.sourceId, name: entry.name, issuer: entry.issuer, card_type: card.cardType, annual_fee: { domestic: card.annualFee, overseas: null }, discontinued: !!entry.isDiscontinued },
    performance: { basis: "unknown", tiers: [], excluded_app_categories: [] },
    shared_caps: [],
    choice_groups: [],
    benefits: [],
  };
}

type Table = { status: Status; record: BenefitRecord; file: string; suspect: Record<string, string[]> };

function readTables(): Map<number, Table> {
  const found = new Map<number, Table>();
  const extra = codeCheckSuspects();
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
      const suspect = suspectOf(record);
      const ids = new Set((record.benefits ?? []).map((b: BenefitRecord) => b.id));
      for (const [bid, whys] of Object.entries(extra.get(sid) ?? {})) {
        if (ids.has(bid)) for (const w of whys) if (!(suspect[bid] ??= []).includes(w)) suspect[bid].push(w);
      }
      delete record.extraction_notes;
      slim(record);
      found.set(sid, { status, record, file: `${dir}/${name}`, suspect });
    }
  }
  return found;
}

function main() {
  const catalog = JSON.parse(readFileSync(path.join(ROOT, "data/catalog/cards-catalog.json"), "utf-8")) as CatalogListing[];
  const tables = readTables();
  const counts: Record<Status, number> = { reviewed: 0, gold_ai: 0, extracted: 0, auto: 0 };
  const cards: { sid: number; status: Status; from: string; record: BenefitRecord; suspect?: Record<string, string[]> }[] = [];

  // 앱 화면(loadCatalog.isDiscontinued)과 같은 기준: 카드고릴라 is_discon 값 + discontinued-cards.json 이름 목록
  const discNamesPath = path.join(ROOT, "data/catalog/discontinued-cards.json");
  const discNames = new Set<string>(existsSync(discNamesPath) ? (JSON.parse(readFileSync(discNamesPath, "utf-8")) as string[]).map((n) => n.trim()) : []);

  for (const raw of catalog) {
    const entry: CatalogListing = { ...raw, isDiscontinued: raw.isDiscontinued === true || discNames.has(raw.name.trim()) };
    const t = tables.get(entry.sourceId);
    if (t) {
      // 카탈로그 쪽 정보(발급 중단 여부, 이미지)는 최신 수집값을 따른다
      t.record.card.discontinued = !!entry.isDiscontinued;
      const hasSuspect = Object.keys(t.suspect).length > 0;
      cards.push({ sid: entry.sourceId, status: t.status, from: t.file, record: t.record, ...(hasSuspect ? { suspect: t.suspect } : {}) });
      counts[t.status] += 1;
    } else {
      cards.push({ sid: entry.sourceId, status: "auto", from: "cards-catalog.json", record: emptyRecord(entry) });
      counts.auto += 1;
    }
  }

  // 성격이 다른 소비가 섞인 카테고리 나누기(OTT/구독·기차/고속버스·의류/패션, 2026-10-31 scripts/splitCategories.ts)
  console.log("카테고리 나누기:", splitCategories(cards));

  const out = {
    version: 1,
    schemaVersion: "0.2.1",
    generatedAt: new Date().toISOString(),
    counts,
    cards,
  };
  writeFileSync(OUT, JSON.stringify(out));
  // 전체 카드 화면·카드 상세 창용 요약(혜택 표를 화면에서 통째로 읽지 않으려고 따로 둔다)
  writeFileSync(path.join(ROOT, "data/catalog/card-view.json"), JSON.stringify(buildCardView(cards, out.generatedAt)));
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
  console.log(`카드 ${cards.length}장 → ${path.relative(ROOT, OUT)}`, counts);
  const why: Record<string, number> = {};
  let nSus = 0;
  for (const c of cards) for (const rs of Object.values(c.suspect ?? {})) { nSus += 1; for (const r of rs) why[r] = (why[r] ?? 0) + 1; }
  console.log(`의심 혜택 ${nSus}개(조합 고를 때만 깎음)`, why);
  if (counts.auto) console.warn(`원문 정제가 없는 카드 ${counts.auto}장은 혜택 없이 넣었어요(정제/extract.py로 채우기)`);
}

main();
