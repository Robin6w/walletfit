import { parseTextLocally } from "@/features/statement/importerParser";
import type { Tickets } from "@/domain/types/engine";
import { BRAND_TABS, aliasesOf, canonicalBrand } from "@/v2/model/brands";
import { CATALOG_BRAND_NAMES, catalogCategory, fuzzyCategory, statementCategory, withBrandNames } from "@/v2/model/merchantDict";

/**
 * 명세서 텍스트 → 월 지출·브랜드 금액(2026-10-28 v2 A2′·B2′).
 * 줄 단위로 읽는다: 날짜·시간을 먼저 지우고(연도·날짜를 금액으로 잘못 읽지 않게),
 * 금액·카테고리는 기존 파서(parseTextLocally), 브랜드는 줄 전체에서 찾는다.
 * 여러 달이 섞여 있으면 달 수로 나눠 월평균으로 쓴다.
 * 명세서 분석 모델링 단계에서 카드사별 양식·엑셀을 더 정교하게 다룰 예정이다.
 */

/** 읽은 결제 한 건(명세서 화면에서 잘 읽었는지 확인용, 2026-10-31) */
export interface StatementItem {
  /** 'MM.DD' (날짜를 못 찾으면 null) */
  date: string | null;
  /** 가맹점 이름(번호·금액·승인 같은 말을 뺀 것) */
  name: string;
  category: string;
  /** 원, 월평균 아님. 환불은 음수 */
  amount: number;
  /** 취소된 결제(명세서 합계·계산에서 뺌). amount는 원래 결제 금액 */
  cancelled?: boolean;
  /** 카드 혜택으로 돌려받은 돈(캐시백 등, 음수). 소비가 아니라 계산에서 뺀다 */
  reward?: boolean;
  /** 자주 가는 곳으로 읽은 브랜드 */
  brand?: string;
  /** 사용자가 카테고리를 직접 바꿈 */
  edited?: boolean;
  /** 'YYYY-MM' (날짜를 못 찾으면 없음). 여러 명세서를 합칠 때 달 수를 센다 */
  month?: string;
  /** 어느 명세서에서 읽었는지(파일 이름). 여러 명세서를 합쳤을 때만 */
  source?: string;
  /** 여러 번 결제를 한 줄로 묶은 것(신한 후불교통 '08월경기버스8건' → 8). 건당 조건 계산에서 금액을 나눈다 */
  count?: number;
}

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
  items: StatementItem[];
  /** 명세서에 적힌 합계와 읽은 합계(검산). 합계 줄이 없는 명세서는 없음 */
  check?: { declared: number; declaredCount?: number; read: number; readCount: number };
}

/** 요약·머리글 줄(금액이 있어도 결제 한 건이 아님) */
const SKIP_LINE = /(합\s*계|총\s*(액|이용|결제|청구|승인)|결제\s*예정|청구\s*(금액|합계)|(이용|조회)\s*기간|카드\s*번호|전월\s*(이월|잔액)|최소\s*결제|이자|수수료\s*합)/;
// '일'은 숫자에 바로 붙은 것만(띄어 쓴 '일시불'의 '일'을 먹지 않게, 2026-11-02)
const FULL_DATE = /(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})일?/g;
const SHORT_DATE = /(^|[^\d])(\d{1,2})[./](\d{1,2})(?=[^\d]|$)/g;
const TIME = /\b\d{1,2}:\d{2}(:\d{2})?\b/g;
const YEAR_MONTH = /(20\d{2})\s*년\s*(\d{1,2})\s*월/;

const YEAR_MONTH_G = /(20\d{2})\s*년(\s*\d{1,2}\s*월)?/g;

/** 가린 숫자(카드번호 '1234-56**-****-7890', 계좌 '11051*****71', 신한 '본인410*')는 금액이 아니다(2026-11-02) */
const MASKED = /\S*\d\S*\*\S*|\S*\*\S*\d\S*/g;
/**
 * 결제에 붙은 혜택 표시(신한 '캐시백 592원', '적립 30P')는 결제 금액이 아니다. 양수만 지운다:
 * 케이뱅크 '★웰페어클럽 캐시백 -336'처럼 음수는 따로 들어온 혜택 입금 줄이라 남긴다(REWARD로 소비에서 뺀다)
 */
const REWARD_NOTE = /(캐시백|캐쉬백|적립|포인트)\s*\+?\s*\d{1,3}(?:,\d{3})*\s*(원|P|점)?/g;

/** 0으로 시작하는 숫자는 금액이 아니다(카드번호 끝자리 '체크0458', 카카오뱅크 가맹점 번호 '000000117261537', 2026-11-02) */
const LEADING_ZERO = /(?<![\d,.])0\d{2,}(?![\d,])/g;

export function cleanLine(line: string): string {
  return line
    .replace(MASKED, " ")
    .replace(LEADING_ZERO, " ")
    .replace(REWARD_NOTE, " ")
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

/**
 * 월평균을 낼 달 수(2026-11-02). 결제 날짜가 걸친 달 수를 세되, 첫 결제부터 마지막 결제까지가 31일 이하면 한 달로 본다.
 * 앱 화면 캡처(8/31~9/25)나 결제일 기준 명세서(8/15~9/14)는 두 달에 걸쳐도 한 달치라, 달 수로 나누면 지출이 절반이 됐다
 */
function monthCount(months: string[], dates: Date[]): number {
  if (dates.length >= 2) {
    const t = dates.map((d) => d.getTime());
    if ((Math.max(...t) - Math.min(...t)) / 86_400_000 <= 31) return 1;
  }
  return Math.max(1, months.length);
}

function datesIn(text: string): Date[] {
  return Array.from(text.matchAll(FULL_DATE), (m) => new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).filter((d) => !Number.isNaN(d.getTime()));
}

/**
 * 명세서에 적힌 합계(검산용, 2026-11-02): 신한 '총 73건 623,270원', NH 앱 '정상 10건 173,500원', 카카오뱅크 '총승인금액 737,750',
 * 그 밖에 '합계 6,500원'. 처음 보는 형식이나 사진(OCR)에서 잘못 읽었을 때 사용자가 알아채게 한다
 */
function declaredTotal(lines: string[]): { total: number; count?: number } | null {
  const num = (s: string) => Number(s.replace(/,/g, ""));
  for (const l of lines) {
    const m = l.match(/(?:총|정상)\s*(\d+)\s*건[^\d\n]*?(\d{1,3}(?:,\d{3})+|\d{3,})\s*원/);
    if (m) return { total: num(m[2]), count: Number(m[1]) };
  }
  for (const l of lines) {
    const m = l.match(/(?:총\s*승인\s*금액|총\s*이용\s*금액|이용\s*금액\s*합계|승인\s*금액\s*합계|합\s*계)\s*:?\s*(\d{1,3}(?:,\d{3})+|\d{3,})/);
    if (m) return { total: num(m[1]) };
  }
  return null;
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

/**
 * 화면에 보일 가맹점 이름. cleanLine으로 날짜를 지운 줄에서 금액·승인번호 같은 숫자,
 * 맨 앞 줄 번호, '승인'·'일시불' 같은 말, CSV 쉼표를 뺀다.
 */
export function merchantName(line: string): string {
  const name = line
    .replace(/[-▲]?\d{1,3}(?:,\d{3})+\s*원?/g, " ")
    .replace(/[-▲]?(?<![A-Za-z가-힣\d])\d{3,}\s*원?/g, " ")
    .replace(/^\s*\d{1,3}\s+/, " ")
    .replace(/[,\t|]/g, " ")
    .split(/\s+/)
    // 글자·숫자가 없는 기호 조각('¢' 등, 사진 글자 인식이 '원'을 잘못 읽은 것)도 뺀다
    .filter((t) => t && !/^(승인|승인취소|무승인|취소|일시불|할부|본인|가족|정상|매출|원)$/.test(t) && !/^[_\-–·.()]+$/.test(t) && /[\p{L}\p{N}]/u.test(t))
    .join(" ")
    .replace(/\(\s+/g, "(")
    .trim();
  return name;
}

const ITEM_DATE = /(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/;

function itemDate(raw: string): string | null {
  const m = raw.match(ITEM_DATE);
  return m ? `${m[2].padStart(2, "0")}.${m[3].padStart(2, "0")}` : null;
}

function itemMonth(raw: string): { month?: string } {
  const m = raw.match(ITEM_DATE);
  return m && Number(m[2]) >= 1 && Number(m[2]) <= 12 ? { month: `${m[1]}-${m[2].padStart(2, "0")}` } : {};
}

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, "");

interface BrandMatcher {
  brand: string;
  test: (line: string) => boolean;
  len: number;
}

/**
 * 브랜드 이름(별칭 포함) 검사기. 영문 3글자 이하(CU 등)는 낱말 경계로만 찾는다.
 * 카드 혜택 데이터의 브랜드 전부로 찾는다(2026-11-01): 명세서 경로는 '명세서에 없는 브랜드 = 0%'로 계산하므로
 * 고른 카드의 브랜드만 찾으면(엔진 목록을 불러오기 전이거나 가진 카드에 없는 브랜드) 놓친 결제가 생긴다
 */
export function brandMatchers(extra: string[] = []): BrandMatcher[] {
  const names = new Set<string>([...BRAND_TABS.flatMap((t) => t.brands), ...CATALOG_BRAND_NAMES, ...extra.map(canonicalBrand)]);
  const out: BrandMatcher[] = [];
  for (const brand of names) {
    for (const alias of aliasesOf(brand)) {
      const a = alias.trim();
      if (!a) continue;
      if (/^[A-Za-z0-9.+&-]{1,3}$/.test(a)) {
        const re = new RegExp(`(^|[^A-Za-z0-9])${a.replace(/[.+&-]/g, "\\$&")}([^A-Za-z0-9]|$)`, "i");
        out.push({ brand, test: (line) => re.test(line), len: a.length });
      } else if (/^[가-힣]{1,2}$/.test(a)) {
        // 한글 2글자 이하는 낱말 맨 앞에서만('설아아이스크림' 속 '크림'(KREAM)이 걸리지 않게, 2026-10-31)
        const re = new RegExp(`(^|[^가-힣A-Za-z0-9])${a}`);
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

const CANCEL = /(승인취소|결제취소|취소완료|취소|환불)/;
/** 결제 취소가 아니라 카드 혜택 입금(캐시백·포인트 적립·청구할인) */
const REWARD = /(캐시백|캐쉬백|포인트|적립|청구\s*할인|리워드)/;
const SIGNED_AMOUNT = /[-▲−]\s*\d/;

interface Row {
  raw: string;
  /** 가맹점 이름이 위아래 줄로 나뉜 칸이면 그 조각을 붙인 줄 */
  text: string;
  amount: number;
  /** 금액 앞에 부호 없이 '승인취소' 등만 적힌 줄 */
  unsignedCancel: boolean;
}

/**
 * @param extraBrands 브랜드로 묶을 이름(담은 카드의 브랜드 한정 혜택에 나오는 가게)
 * @param brandCats 그 브랜드가 담은 카드 혜택에서 속한 카테고리(엔진 brands_json). 카드 데이터 전체 사전보다 먼저 쓴다
 * @param opts.ocr 사진에서 글자 인식으로 읽은 글자(가맹점 이름이 한두 글자 틀릴 수 있어 비슷한 브랜드로 분류한다)
 */
export function summarizeStatement(
  text: string,
  extraBrands: string[] = [],
  brandCats: Record<string, string> = {},
  opts: { ocr?: boolean } = {},
): StatementSummary {
  // 제어 문자는 빈칸으로(신한 PDF의 \u0001 띄어쓰기 등, 2026-11-02)
  // eslint-disable-next-line no-control-regex
  const lines = text.replace(/[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f]/g, " ").split(/\r?\n/);
  const matchers = brandMatchers(extraBrands);
  const parsed = lines.map((raw) => (!raw.trim() || SKIP_LINE.test(raw) ? null : parseTextLocally(withBrandNames(cleanLine(raw)))[0] ?? null));
  // 신한카드처럼 결제 하나가 '가맹점 + 금액' 줄과 '날짜 + 부가 정보' 줄로 나뉜 명세서: 날짜 없는 결제 줄 바로 아래(없으면 위)의
  // 금액 없는 날짜 줄을 붙여 한 건으로 만든다(2026-11-02)
  // 날짜 줄은 짧은 것만('일시불 무승인' 정도). 날짜가 든 안내문('2026년 2월 1일부터 … 발급수수료')을 결제에 붙이지 않게
  // 기간 줄('2026.08.31 ~ 2026.09.30')은 결제 날짜가 아니다(NH 앱 캡처: 맨 위 합계 '173,500원'에 붙어 결제 1건이 됐다)
  const dateOnly = (i: number) =>
    i >= 0 &&
    i < lines.length &&
    !parsed[i] &&
    ITEM_DATE.test(lines[i]) &&
    !SKIP_LINE.test(lines[i]) &&
    !/[~∼]/.test(lines[i]) &&
    (lines[i].match(FULL_DATE) ?? []).length < 2 &&
    cleanLine(lines[i]).split(" ").filter(Boolean).length <= 5;
  parsed.forEach((item, i) => {
    if (!item || ITEM_DATE.test(lines[i])) return;
    const j = dateOnly(i + 1) ? i + 1 : dateOnly(i - 1) ? i - 1 : -1;
    if (j < 0) return;
    lines[i] = `${lines[j]} ${lines[i]}`;
    lines[j] = "";
  });
  // 결제가 아닌 줄(머리글·이름 조각)
  const loose = (i: number) => i >= 0 && i < lines.length && !parsed[i] && !!lines[i].trim() && !SKIP_LINE.test(lines[i]);

  let rows: Row[] = [];
  parsed.forEach((item, i) => {
    if (!item) return;
    const raw = lines[i];
    let joined = raw;
    // 카카오뱅크 확인서처럼 긴 가맹점명이 칸 안에서 두 줄로 나뉘면 결제 줄 위·아래에 이름 조각만 남는다(2026-10-31)
    if (!merchantName(cleanLine(raw))) {
      const before = loose(i - 1) ? lines[i - 1] : "";
      const after = loose(i + 1) ? lines[i + 1] : "";
      joined = `${raw} ${before}${after ? ` ${after}` : ""}`;
    }
    rows.push({ raw, text: joined, amount: item.amount, unsignedCancel: CANCEL.test(raw) && !SIGNED_AMOUNT.test(cleanLine(raw)) });
  });
  // 결제 대부분에 날짜가 있는 명세서에서 날짜 없이 금액만 있는 줄은 결제가 아니라 요약·안내다
  // (신한 맨 위 '623,270원', 업종 요약 '유통업 455,280원', 안내문 '건당 2,000원', 2026-11-02)
  // 결제가 몇 건 안 되는 명세서도 요약 줄 수만큼은 될 수 있어, 비율이 아니라 '날짜 있는 줄이 3건 이상이고 날짜 없는 줄보다 많거나 같을 때'로 본다
  const dated = rows.filter((r) => ITEM_DATE.test(r.raw));
  if (dated.length >= 3 && dated.length * 2 >= rows.length) rows = dated;

  // 모든 결제 줄에 똑같이 있는 낱말은 가맹점이 아니라 고정 칸(케이뱅크의 상품명 'ONE(K-패스)'·가린 카드번호 등)이라 뺀다(2026-10-31).
  // 결제가 5건 이상이고, 빼고 나서도 가맹점 이름이 두 가지 이상 남을 때만(한 가게만 쓴 명세서에서 가게 이름을 지우지 않게)
  const tokensOf = (r: Row) => new Set(cleanLine(r.text).split(" "));
  let fixed = new Set<string>();
  if (rows.length >= 5) {
    fixed = rows.map(tokensOf).reduce((a, b) => new Set([...a].filter((t) => b.has(t))));
    const left = new Set(rows.map((r) => squash(merchantName(cleanLine(r.text).split(" ").filter((t) => !fixed.has(t)).join(" ")))));
    if (left.size < 2) fixed = new Set();
  }
  const body = (r: Row) =>
    cleanLine(r.text)
      .split(" ")
      .filter((t) => !fixed.has(t))
      .join(" ");

  // 부호 없는 '승인취소' 줄: 같은 가맹점·같은 금액 승인이 있으면 서로 지우고(환불), 없으면 취소된 결제 자체라 뺀다.
  // 카카오뱅크 확인서는 취소된 결제의 상태만 '승인취소'로 바꾸고 총승인금액에서 뺀다(2026-10-31 9월 확인서 2장으로 확인)
  const nameOf = (r: Row) => merchantName(body(r));
  const paired = new Set<Row>();
  const cancelled = new Set<Row>();
  for (const r of rows) {
    if (!r.unsignedCancel) continue;
    const match = rows.find((p) => p !== r && !p.unsignedCancel && !paired.has(p) && p.amount === -r.amount && squash(nameOf(p)) === squash(nameOf(r)));
    if (match) paired.add(match);
    else cancelled.add(r);
  }

  // 달 수는 결제로 읽힌 줄의 날짜로만 센다(발급일·조회기간 줄이 달을 늘리지 않게, 2026-10-31)
  const itemLines: string[] = [];
  const items: StatementItem[] = [];
  let refundCount = 0;
  for (const r of rows) {
    const line = withBrandNames(body(r));
    const brand = matchers.find((m) => m.test(line))?.brand;
    // 카테고리: 담은 카드 혜택의 카테고리 → 카드 데이터 전체의 브랜드 사전 → 명세서 전용 사전 → 기존 키워드 분류(2026-10-31)
    let cat = (brand && brandCats[brand]) || catalogCategory(line) || statementCategory(line) || parseTextLocally(line)[0]?.category || "etc";
    const name = nameOf(r) || "이름 없는 가맹점";
    // 사진(OCR)에서 읽은 명세서만: 정확히 맞는 분류가 없으면 '거의 같은' 브랜드 이름으로 카테고리를 정한다(2026-11-02, fuzzyCategory)
    if (cat === "etc" && opts.ocr) cat = fuzzyCategory(name) ?? "etc";
    if (cancelled.has(r)) {
      items.push({ date: itemDate(r.raw), ...itemMonth(r.raw), name, category: cat, amount: Math.abs(r.amount), cancelled: true });
      continue;
    }
    // 카드 혜택으로 돌려받은 돈(케이뱅크 '★웰페어클럽 캐시백 -336')은 소비가 아니라 뺀다(2026-10-31)
    if (r.amount < 0 && REWARD.test(r.raw)) {
      items.push({ date: itemDate(r.raw), ...itemMonth(r.raw), name, category: cat, amount: r.amount, reward: true });
      continue;
    }
    itemLines.push(r.raw);
    if (r.amount < 0) refundCount += 1;
    const count = Number(name.match(/(\d+)\s*건$/)?.[1] ?? 1);
    items.push({ date: itemDate(r.raw), ...itemMonth(r.raw), name, category: cat, amount: r.amount, ...(brand ? { brand } : {}), ...(count > 1 ? { count } : {}) });
  }
  const itemText = itemLines.join("\n");
  const months = monthsIn(itemText);
  const div = monthCount(months, datesIn(itemText));
  const declared = declaredTotal(lines.length ? text.split(/\r?\n/) : []);
  const counted = items.filter((it) => !it.cancelled && !it.reward);
  const check = declared
    ? { declared: declared.total, declaredCount: declared.count, read: counted.reduce((s, it) => s + it.amount, 0), readCount: counted.length }
    : undefined;
  return { ...totalsOf(items, div), period: periodLabel(months, months.length ? itemText : text), months: div, itemCount: rows.length, refundCount, items, ...(check ? { check } : {}) };
}

/** 결제 목록 → 카테고리별 월 지출·브랜드 금액(취소된 결제 제외, months달 평균, 100원 단위) */
function totalsOf(items: StatementItem[], months: number): Pick<StatementSummary, "spending" | "brands"> {
  const spend: Record<string, number> = {};
  const brands: Record<string, Record<string, number>> = {};
  for (const it of items) {
    if (it.cancelled || it.reward) continue;
    spend[it.category] = (spend[it.category] ?? 0) + it.amount;
    if (it.brand) {
      brands[it.category] = brands[it.category] ?? {};
      brands[it.category][it.brand] = (brands[it.category][it.brand] ?? 0) + it.amount;
    }
  }
  const round = (v: number) => Math.max(0, Math.round(v / months / 100) * 100);
  const spending = Object.fromEntries(Object.entries(spend).map(([c, v]) => [c, round(v)]).filter(([, v]) => (v as number) > 0));
  const brandsOut: StatementSummary["brands"] = {};
  for (const [cat, m] of Object.entries(brands)) {
    const kept = Object.entries(m)
      .map(([b, v]) => [b, round(v)] as const)
      .filter(([, v]) => v > 0);
    if (kept.length && spending[cat]) brandsOut[cat] = Object.fromEntries(kept);
  }
  return { spending, brands: brandsOut };
}

/**
 * 여러 카드의 명세서를 하나의 전체 소비로 합친다(2026-10-31). 두 버튼(가진 카드로·새 카드까지) 모두 전체 소비만 쓴다.
 * 승인취소 맞추기·나뉜 이름 붙이기는 명세서마다 따로 끝낸 결과를 받는다(다른 카드의 취소가 이 카드 결제를 지우지 않게).
 * 달 수는 합친 결제의 달을 겹치지 않게 센다: 카카오뱅크 9월 + 신한 9월 = 한 달, 8월 + 9월 = 두 달 평균.
 */
export function mergeStatements(parts: { source: string; summary: StatementSummary }[]): StatementSummary {
  const items = parts.flatMap((p) => p.summary.items.map((it) => (parts.length > 1 ? { ...it, source: p.source } : it)));
  const months = Array.from(new Set(items.filter((it) => !it.cancelled && it.month).map((it) => it.month!))).sort();
  // 날짜 없는 명세서(TXT 등)만 있으면 각 명세서가 센 달 수 중 큰 값. 첫~마지막 결제가 31일 이하면 한 달(monthCount)
  const dates = items
    .filter((it) => !it.cancelled && it.month && it.date)
    .map((it) => new Date(Number(it.month!.slice(0, 4)), Number(it.month!.slice(5, 7)) - 1, Number(it.date!.split(".")[1])));
  const div = months.length ? monthCount(months, dates) : Math.max(1, ...parts.map((p) => p.summary.months));
  return {
    ...(parts.length === 1 && parts[0].summary.check ? { check: parts[0].summary.check } : {}),
    ...totalsOf(items, div),
    period: months.length ? periodLabel(months, "") : (parts.find((p) => p.summary.period)?.summary.period ?? null),
    months: div,
    itemCount: parts.reduce((s, p) => s + p.summary.itemCount, 0),
    refundCount: parts.reduce((s, p) => s + p.summary.refundCount, 0),
    items,
  };
}

/** 카테고리별 결제 금액 목록(취소·환불 제외). 엔진의 건당 조건 계산에 넘긴다(2026-10-31) */
export function ticketsOf(items: StatementItem[]): Tickets {
  const out: Tickets = {};
  for (const it of items) {
    if (it.cancelled || it.reward || it.amount <= 0) continue;
    const n = it.count ?? 1;
    for (let k = 0; k < n; k++) (out[it.category] = out[it.category] ?? []).push(Math.round(it.amount / n));
  }
  return out;
}

/** 카테고리별 요일 결제 금액 [월, …, 일](요일 한정 혜택을 실제 요일 비중으로 계산, 2026-11-01). 키는 '_wd:<카테고리>' */
export function weekdaysOf(items: StatementItem[]): Tickets {
  const out: Tickets = {};
  for (const it of items) {
    if (it.cancelled || it.reward || it.amount <= 0 || !it.month || !it.date) continue;
    const [y, m] = it.month.split("-").map(Number);
    const d = Number(it.date.split(".")[1]);
    const day = (new Date(y, m - 1, d).getDay() + 6) % 7;
    const row = (out[`_wd:${it.category}`] = out[`_wd:${it.category}`] ?? [0, 0, 0, 0, 0, 0, 0]);
    row[day] += it.amount;
  }
  return out;
}

/** 엔진에 넘길 명세서 정보: 결제 금액 목록 + 요일별 금액. 이게 오면 엔진은 명세서 경로로 계산한다(간편결제 비중 가정 0) */
export function statementSignals(items: StatementItem[]): Tickets {
  return { ...ticketsOf(items), ...weekdaysOf(items) };
}

/**
 * 가맹점 하나의 카테고리를 사용자가 바꾼다(2026-10-31). 같은 이름의 결제는 모두 함께 바뀌고,
 * 카테고리별 지출·브랜드 금액을 다시 계산한다.
 */
export function recategorize(summary: StatementSummary, name: string, category: string): StatementSummary {
  const items = summary.items.map((it) => (it.name === name ? { ...it, category, edited: true } : it));
  return { ...summary, ...totalsOf(items, summary.months), items };
}
