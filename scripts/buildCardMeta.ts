/**
 * 카드 비교 화면의 '출시일'·'혜택 유지 약속'에 쓰는 값을 카드고릴라 상세 원문(cards-detail-raw.json)에서 뽑는다.
 *   npx tsx scripts/buildCardMeta.ts
 * 결과: data/catalog/card-meta.json  { fetchedAt, cards: { [sourceId]: { launch?: "YYYY-MM(-DD)", keepYears?: number } } }
 *
 * 원문 표현 예
 *   - 상품 출시일 : 2024년 2월 29일
 *   - 카드 신규출시(2014.05.08) 이후 1년 이상 축소·폐지 없이 유지
 *   - B ALL 카드(2022.12.26 출시)를 이용하는 경우
 *   - 상품출시일(2023.12월)로부터 3년이상 축소,폐지 없이 유지
 * 날짜를 못 찾으면 비워 둔다(화면에서 '원문에서 찾지 못했어요').
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

interface RawCard {
  sourceId: number;
  keyBenefit: { title?: string; comment?: string; info?: string }[];
  fetchedAt?: string;
}

const ROOT = resolve(import.meta.dirname, "..");
const raw = JSON.parse(readFileSync(resolve(ROOT, "data/catalog/cards-detail-raw.json"), "utf8")) as RawCard[];

const ENTITIES: Record<string, string> = { "&nbsp;": " ", "&middot;": "·", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };

export function plainText(card: RawCard): string {
  const s = card.keyBenefit.map((b) => `${b.title ?? ""} ${b.comment ?? ""} ${b.info ?? ""}`).join(" ");
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m] ?? " ")
    .replace(/\s+/g, " ");
}

// 2024년 2월 29일 / 2024.02.29 / 2024. 2. 29. / 2023.12월 / 2018.12
const DATE = String.raw`(\d{4})\s*(?:년|\.|-|\s)\s*(\d{1,2})\s*(?:월|\.|-)?\s*(?:(\d{1,2})\s*일?)?`;
const AFTER = new RegExp(String.raw`출\s*시\s*(?:일자?|일)?\s*[:：]?\s*\(?\s*` + DATE);
const BEFORE = new RegExp(DATE + String.raw`\.?\s*출\s*시`);
const KEEP = /출\s*시.{0,45}?(\d{1,2})\s*년\s*이상.{0,12}?(?:축소|폐지|유지)/;

function validDate(y: number, m: number, d?: number): boolean {
  if (y < 1980 || y > 2030 || m < 1 || m > 12) return false;
  if (d !== undefined && (d < 1 || d > 31)) return false;
  return true;
}

export function launchOf(text: string): string | undefined {
  for (const re of [AFTER, BEFORE]) {
    const m = text.match(re);
    if (!m) continue;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = m[3] ? Number(m[3]) : undefined;
    if (!validDate(y, mo, d)) continue;
    const mm = String(mo).padStart(2, "0");
    return d ? `${y}-${mm}-${String(d).padStart(2, "0")}` : `${y}-${mm}`;
  }
  return undefined;
}

export function keepYearsOf(text: string): number | undefined {
  const m = text.match(KEEP);
  if (!m) return undefined;
  const n = Number(m[1]);
  return n >= 1 && n <= 10 ? n : undefined;
}

const cards: Record<string, { launch?: string; keepYears?: number }> = {};
let launch = 0;
let keep = 0;
let fetchedAt = "";
for (const c of raw) {
  const t = plainText(c);
  const l = launchOf(t);
  const k = keepYearsOf(t);
  if (c.fetchedAt && c.fetchedAt > fetchedAt) fetchedAt = c.fetchedAt;
  if (!l && !k) continue;
  cards[String(c.sourceId)] = { ...(l ? { launch: l } : {}), ...(k ? { keepYears: k } : {}) };
  if (l) launch++;
  if (k) keep++;
}

writeFileSync(resolve(ROOT, "data/catalog/card-meta.json"), JSON.stringify({ fetchedAt, cards }) + "\n");
console.log(`card-meta: ${raw.length}장 중 출시일 ${launch}장, 혜택 유지 기간 ${keep}장 (원문 수집 ${fetchedAt})`);
