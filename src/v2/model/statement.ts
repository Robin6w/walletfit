import { parseTextLocally } from "@/features/statement/importerParser";
import { BRAND_TABS, aliasesOf, canonicalBrand } from "@/v2/model/brands";

/**
 * 명세서 텍스트 → 월 지출·브랜드 금액(2026-10-28 v2 A2′·B2′).
 * 줄 단위로 읽는다: 날짜·시간을 먼저 지우고(연도·날짜를 금액으로 잘못 읽지 않게),
 * 금액·카테고리는 기존 파서(parseTextLocally), 브랜드는 줄 전체에서 찾는다.
 * 여러 달이 섞여 있으면 달 수로 나눠 월평균으로 쓴다.
 * 명세서 분석 모델링 단계에서 카드사별 양식·엑셀을 더 정교하게 다룰 예정이다.
 */

export interface StatementSummary {
  /** 카테고리별 월 지출(원, 100원 단위) */
  spending: Record<string, number>;
  /** 카테고리별 브랜드 금액(원/월) */
  brands: Record<string, Record<string, number>>;
  /** '2026년 9월' / '2026년 8월~9월' (날짜를 못 찾으면 null) */
  period: string | null;
  months: number;
  /** 읽은 결제 건수(환불 포함) */
  itemCount: number;
  refundCount: number;
}

/** 요약·머리글 줄(금액이 있어도 결제 한 건이 아님) */
const SKIP_LINE = /(합\s*계|총\s*(액|이용|결제|청구)|결제\s*예정|청구\s*(금액|합계)|이용\s*기간|카드\s*번호|전월\s*(이월|잔액)|최소\s*결제|이자|수수료\s*합)/;
const FULL_DATE = /(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*일?/g;
const SHORT_DATE = /(^|[^\d])(\d{1,2})[./](\d{1,2})(?=[^\d]|$)/g;
const TIME = /\b\d{1,2}:\d{2}(:\d{2})?\b/g;
const YEAR_MONTH = /(20\d{2})\s*년\s*(\d{1,2})\s*월/;

const YEAR_MONTH_G = /(20\d{2})\s*년(\s*\d{1,2}\s*월)?/g;

export function cleanLine(line: string): string {
  return line
    .replace(FULL_DATE, " ")
    .replace(YEAR_MONTH_G, " ")
    .replace(TIME, " ")
    .replace(SHORT_DATE, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
}

function monthsIn(text: string): string[] {
  const set = new Set<string>();
  for (const m of text.matchAll(FULL_DATE)) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    if (mo >= 1 && mo <= 12) set.add(`${y}-${String(mo).padStart(2, "0")}`);
  }
  return Array.from(set).sort();
}

function periodLabel(months: string[], text: string): string | null {
  if (months.length) {
    const [y1, m1] = months[0].split("-").map(Number);
    const [y2, m2] = months[months.length - 1].split("-").map(Number);
    if (months.length === 1) return `${y1}년 ${m1}월`;
    return y1 === y2 ? `${y1}년 ${m1}월~${m2}월` : `${y1}년 ${m1}월~${y2}년 ${m2}월`;
  }
  const ym = text.match(YEAR_MONTH);
  return ym ? `${Number(ym[1])}년 ${Number(ym[2])}월` : null;
}

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, "");

interface BrandMatcher {
  brand: string;
  test: (line: string) => boolean;
  len: number;
}

/** 브랜드 이름(별칭 포함) 검사기. 영문 3글자 이하(CU 등)는 낱말 경계로만 찾는다 */
export function brandMatchers(extra: string[] = []): BrandMatcher[] {
  const names = new Set<string>([...BRAND_TABS.flatMap((t) => t.brands), ...extra.map(canonicalBrand)]);
  const out: BrandMatcher[] = [];
  for (const brand of names) {
    for (const alias of aliasesOf(brand)) {
      const a = alias.trim();
      if (!a) continue;
      if (/^[A-Za-z0-9.+&-]{1,3}$/.test(a)) {
        const re = new RegExp(`(^|[^A-Za-z0-9])${a.replace(/[.+&-]/g, "\\$&")}([^A-Za-z0-9]|$)`, "i");
        out.push({ brand, test: (line) => re.test(line), len: a.length });
      } else {
        const s = squash(a);
        out.push({ brand, test: (line) => squash(line).includes(s), len: a.length });
      }
    }
  }
  // 긴 이름부터(‘GS칼텍스’가 ‘GS25’보다 먼저가 아니라, 더 구체적인 이름이 먼저 걸리게)
  return out.sort((a, b) => b.len - a.len);
}

export function summarizeStatement(text: string, extraBrands: string[] = []): StatementSummary {
  const lines = text.split(/\r?\n/);
  const months = monthsIn(text);
  const div = Math.max(1, months.length);
  const matchers = brandMatchers(extraBrands);
  const spend: Record<string, number> = {};
  const brands: Record<string, Record<string, number>> = {};
  let itemCount = 0;
  let refundCount = 0;
  for (const raw of lines) {
    if (!raw.trim() || SKIP_LINE.test(raw)) continue;
    const line = cleanLine(raw);
    const item = parseTextLocally(line)[0];
    if (!item) continue;
    itemCount += 1;
    if (item.amount < 0) refundCount += 1;
    spend[item.category] = (spend[item.category] ?? 0) + item.amount;
    const hit = matchers.find((m) => m.test(line));
    if (hit) {
      const cat = item.category;
      brands[cat] = brands[cat] ?? {};
      brands[cat][hit.brand] = (brands[cat][hit.brand] ?? 0) + item.amount;
    }
  }
  const round = (v: number) => Math.max(0, Math.round(v / div / 100) * 100);
  const spending = Object.fromEntries(Object.entries(spend).map(([c, v]) => [c, round(v)]).filter(([, v]) => (v as number) > 0));
  const brandsOut: StatementSummary["brands"] = {};
  for (const [cat, m] of Object.entries(brands)) {
    const kept = Object.entries(m)
      .map(([b, v]) => [b, round(v)] as const)
      .filter(([, v]) => v > 0);
    if (kept.length && spending[cat]) brandsOut[cat] = Object.fromEntries(kept);
  }
  return { spending, brands: brandsOut, period: periodLabel(months, text), months: div, itemCount, refundCount };
}
