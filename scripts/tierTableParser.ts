/**
 * 카드고릴라 내부 API의 key_benefit[].info(카테고리별 상세 설명, HTML) 안에 박혀 있는
 * "전월 신판 이용금액" 구간표를 파싱합니다. buildTieredCatalog.ts에서 사용합니다.
 *
 * 표가 있는 카드는 실적 구간별로 실제 다른 요율이 적용되는 카드고, 표가 없는 카드는
 * (지금 대부분처럼) 실적 조건 없이 동일 요율이 적용되는 카드로 봅니다.
 *
 * 실제로 30장을 받아서 검증해보니 표의 모양이 크게 두 갈래로 나뉩니다.
 *
 * (A) "직속" 표 — key_benefit 항목 하나(카테고리 하나)에 표가 하나 딸려 있고, 표 안에도
 *     데이터 행이 하나뿐인 경우 (예: GS칼텍스 Shine의 "교통" 항목 — 할인율 3%/5%/7%).
 *     이 경우 행 이름이 "1~5% 적립처"처럼 %범위를 담고 있지 않아도(그냥 "할인율"), 이
 *     표가 속한 항목이 이미 카테고리를 특정하고 있으므로 라벨 매칭 없이 그대로 그 카테고리에
 *     붙이면 됩니다.
 *
 * (B) "공용" 표 — 신한카드 Hi-Point의 "적립" 항목처럼, 특정 카테고리에 속하지 않는
 *     별도 요약 섹션에 여러 카테고리의 요율이 한 표에 같이 들어있는 경우 (표 안에 데이터
 *     행이 여러 개, 각 행 이름에 "1~5% 적립처"처럼 %범위가 박혀 있음). 이 경우는 행 이름의
 *     %범위와, 각 카테고리 항목 자체의 comment/설명 텍스트에 적힌 %범위("1.0~5.0% 적립"
 *     같은 문구)를 매칭해서 어느 행이 어느 카테고리 것인지 알아냅니다.
 *
 * 카드마다 사람이 손으로 입력한 리치텍스트라 구간 개수/문구가 조금씩 다를 수 있어서,
 * 정규식으로 "숫자+만원" 패턴과 "이상/미만/~" 조합만 보고 파싱합니다(표 자체의 셀
 * 개수나 순서에는 의존하지 않음).
 *
 * 표에 적힌 값이 %가 아니라 "원"(리터당 할인액, 통합할인한도 등)인 구간표는 이번
 * 버전에서는 다루지 않습니다 — 실제 데이터를 보면 이런 경우 대부분 요율(%) 자체는
 * 구간과 무관하게 고정이고 한도만 구간별로 달라지는데, MILP 쪽에서 어차피 "구간에 따라
 * 배정된 실적을 스스로 판정"하는 메커니즘이 있어야 하는 건 %구간표와 동일해서 별도로
 * 다룬다고 작업량이 줄지 않습니다. 나중에 %구간표(진짜 다구간 요율) 지원을 넣을 때
 * 같이 처리하는 편이 낫다고 보고 지금은 보류합니다.
 *
 * 1528장 전체를 받아보니 표 방향이 하나 더 있었습니다.
 *
 * (C) "행 방향" 표 — 위 (A)/(B)는 전부 "열이 구간, 행이 요율 그룹"인 신한카드류 표인데,
 *     다른 카드사(삼성/우리/유안타 등)는 반대로 "행 하나가 구간 하나"인 표를 씁니다.
 *
 *       전월실적   | 할인율 | 월 통합할인한도
 *       30만원 이상 | 5%    | 5,000원
 *       50만원 이상 | 10%   | 10,000원
 *       70만원 이상 | 15%   | 15,000원
 *
 *     이 경우 헤더 행 자체에는 구간이 없고(칸 이름만 있음), 데이터 행마다 구간+요율이
 *     같이 들어있습니다. 그래서 헤더에 "실적"이나 "이용" 같은 단어가 있는지로 먼저
 *     "구간표로 보이는 표"인지 거르고, 그 다음 어느 칸이 구간 칸인지(각 칸별로 구간이
 *     파싱되는 행 개수를 세서 가장 많은 칸)를 찾은 뒤, 나머지 칸 중 %값이 있는 칸을
 *     요율 칸으로 본다.
 *
 *     주의: 이 표 형식은 "요율은 고정, 한도만 구간별로 다름" 패턴도 자주 같이 씀 (첫
 *     행에만 "5%"를 적고 나머지 행은 칸을 비워두는 식). 빈 칸은 이전 값을 이어붙이지
 *     않고 그냥 버리므로, 이런 카드는 자동으로 구간이 1개만 남아서(=사실상 고정 요율)
 *     기존 규칙(구간 2개 미만이면 버림)에 걸려 제외된다 — (A)/(B)와 동일한 방침.
 */

export interface TierBreakpoint {
  /** 이 구간이 시작되는 최소 실적 금액(원). 표의 첫 구간은 항상 0으로 취급합니다. */
  minSpend: number;
  /** 이 구간에서의 요율 (0.05 = 5%) */
  rate: number;
}

interface ParsedRow {
  /** 원문 행 이름 그대로 (디버깅/로그용) */
  label: string;
  /** 행 이름에서 "N~M%" 형태를 못 찾으면 null (예: "할인율"처럼 카테고리가 이미 특정된 단독 표) */
  loPercent: number | null;
  hiPercent: number | null;
  tiers: TierBreakpoint[];
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&middot;/g, "·")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * "50만원 미만" / "50만원 이상~100만원 미만" / "150만원 이상" -> [최소, 최대) 원 단위.
 * "이하"/"까지"(미만과 같은 취급)와 "초과"/"...부터"(이상과 같은 취급)도 인식한다 —
 * 1528장 전체를 훑어보니 "100만원 까지 / 100만원 초과부터"처럼 이 표현을 쓰는 카드가
 * 소수지만 실제로 있었다(포함/제외 경계가 살짝 다르지만, 이 근사 목적에는 무시할 정도).
 */
function parseSpendRangeLabel(label: string): { min: number; max: number } | null {
  const clean = label.replace(/,/g, "");
  const amounts = [...clean.matchAll(/(\d+(?:\.\d+)?)\s*만\s*원/g)].map((m) => parseFloat(m[1]) * 10000);
  if (amounts.length === 0) return null;

  const hasUnder = /미만|이하|까지/.test(clean);
  const hasOver = /이상|초과/.test(clean);

  if (amounts.length === 1) {
    if (hasUnder) return { min: 0, max: amounts[0] };
    if (hasOver) return { min: amounts[0], max: Infinity };
    return null;
  }
  // "A 이상 ~ B 미만" 형태 (두 금액이 다 나오는 경우)
  return { min: Math.min(...amounts), max: Math.max(...amounts) };
}

/** "1~5% 적립처" / "0.2~2% 적립처" 같은 행 이름에서 범위(%) 추출. 없으면 null. */
function parsePercentRangeLabel(label: string): { lo: number; hi: number } | null {
  const match = label.match(/(\d+(?:\.\d+)?)\s*~\s*(\d+(?:\.\d+)?)\s*%/);
  if (!match) return null;
  return { lo: parseFloat(match[1]), hi: parseFloat(match[2]) };
}

/** 카테고리 설명 문장("전국 가맹점 0.2~2.0% 적립" 등)에서 %범위를 뽑는다. 표 행 라벨과 동일한 패턴. */
function extractPercentRangeFromText(text: string): { lo: number; hi: number } | null {
  return parsePercentRangeLabel(text);
}

function extractTablesFromHtml(html: string): string[] {
  return [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)].map((m) => m[0]);
}

function extractRows(tableHtml: string): string[][] {
  const rowsHtml = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => m[1]);
  return rowsHtml.map((rowHtml) =>
    [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => stripTags(m[1])),
  );
}

/**
 * 표 하나를 파싱해서, 데이터 행(요율 구간 정보를 담은 행)들의 목록으로 바꾼다.
 *
 * 실제로 30장을 받아서 보니 <table>이 있다고 다 우리가 찾는 "구간별 요율" 표는 아니었다.
 * 사은품 목록, 마일리지 적립처 목록, 전월실적 구간별 "월 한도"(요율이 아니라 금액 한도)
 * 표, 매달 패키지 하나를 고르는 표 같은 것도 섞여 있다. 그래서 헤더 행을 무조건
 * "첫 번째 행"으로 보지 않고, 실적 구간(예: "50만원 미만")이 2칸 이상 파싱되는 행을
 * 찾아서 그 행을 헤더로 삼는다 — 못 찾으면 이 표는 구간별 요율 표가 아니라고 보고
 * 빈 배열을 반환한다.
 *
 * 헤더가 rowspan/colspan으로 두 행에 걸쳐 있는 카드(예: RPM+ Platinum#)는 실제 구간
 * 행에 라벨 칸이 아예 없어서(rowspan으로 이미 소비됨) 데이터 행과 칸 수가 안 맞는다.
 * 그래서 칸 인덱스로 정렬을 맞추는 대신, 헤더 행에서 "구간으로 파싱된 칸들"과 데이터
 * 행에서 "순수 퍼센트로만 이뤄진 칸들"을 각각 나온 순서대로 추려서 그 순서로 1:1 대응시킨다.
 *
 * %가 아니라 원 단위 값만 있는 행(리터당 할인액, 통합할인한도 등)은 valueCells가
 * 0개가 되어 자동으로 걸러진다 — 이런 행은 이번 버전에서 다루지 않기로 했기 때문에
 * 의도된 동작이다.
 *
 * 라벨 칸 선택: %값이 아닌 칸이 2개 이상인 행(예: "그린재킷 골프연습 할인" + "할인율"처럼
 * 상품/가맹점명 칸과 요율 설명 칸이 같이 있는 경우, 그린재킷 체크카드/id770에서 실제로
 * 발견됨)에서는 첫 번째가 아니라 "마지막" 비-% 칸을 라벨로 쓴다 — 요율 칸 바로 앞에
 * 오는 게 실제 구간 설명(예: "할인율")이고, 앞쪽 칸들은 대개 무관한 상품명이기 때문이다.
 */
function parseOneTable(tableHtml: string): ParsedRow[] {
  const rows = extractRows(tableHtml);
  if (rows.length < 2) return [];

  let orderedRanges: { min: number; max: number }[] = [];
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 3); i++) {
    const ranges = rows[i].map(parseSpendRangeLabel).filter((r): r is { min: number; max: number } => r !== null);
    if (ranges.length >= 2) {
      headerRowIdx = i;
      orderedRanges = ranges;
      break;
    }
  }
  if (headerRowIdx === -1) return []; // 구간별 요율 표가 아님 (다른 종류의 표)

  const parsedRows: ParsedRow[] = [];
  for (const row of rows.slice(headerRowIdx + 1)) {
    if (row.length === 0) continue;

    const valueCells = row.filter((cell) => /^\d+(?:\.\d+)?\s*%$/.test(cell));
    if (valueCells.length === 0) continue; // %값이 없는 행(원 단위 한도, 리터당 할인 등)은 스킵

    const labelCell = row.findLast((cell) => !valueCells.includes(cell)) ?? row[0];
    const percentRange = parsePercentRangeLabel(labelCell);

    const tiers: TierBreakpoint[] = [];
    valueCells.forEach((cellText, idx) => {
      const range = orderedRanges[idx];
      const rateMatch = cellText.match(/(\d+(?:\.\d+)?)\s*%/);
      if (!range || !rateMatch) return;
      tiers.push({ minSpend: range.min, rate: parseFloat(rateMatch[1]) / 100 });
    });
    if (tiers.length === 0) continue;
    const distinctRates = new Set(tiers.map((t) => t.rate));
    if (distinctRates.size < 2) continue; // 요율이 실제로는 구간마다 다 같으면(=사실상 고정 요율) 버림

    tiers.sort((a, b) => a.minSpend - b.minSpend);
    // 첫 구간의 하한을 0으로 강제한다(표에 "0원~50만원 미만"처럼 명시가 안 돼 있어도
    // 가장 낮은 구간은 항상 실적 0원부터 시작한다고 본다).
    if (tiers[0].minSpend > 0) tiers[0] = { ...tiers[0], minSpend: 0 };

    parsedRows.push({
      label: labelCell,
      loPercent: percentRange?.lo ?? null,
      hiPercent: percentRange?.hi ?? null,
      tiers,
    });
  }
  return parsedRows;
}

/**
 * (C) "행 방향" 표 파싱 — parseOneTable(열 방향)이 아무것도 못 찾았을 때만 시도한다.
 *
 * 처음엔 "헤더 행(rows[0])에 실적/이용 단어가 있는지"로 걸렀는데, 실제 데이터를 더
 * 살펴보니 rowspan 때문에 "국내 전월실적(...)" 같은 라벨이 헤더가 아니라 첫 데이터
 * 행에만 붙어 있고, 그 아래 행들은 라벨 칸 자체가 없어서 칸 개수도 행마다 다른 경우가
 * 있었다(클래시 트래블카드 등). 그래서 이제는 칸 "위치"에 의존하지 않고, 행마다
 * 독립적으로 "구간처럼 보이는 칸"과 "순수 %인 칸"을 각각 찾아서 짝짓는다 — rowspan으로
 * 칸이 밀려도 안전하다.
 *
 * 안전장치: (1) 표 전체에 "실적"/"전월"/"지난달" 언급이 있어야 한다. 처음엔 "이용금액"/
 * "이용액"도 함께 허용했는데, 나라사랑체크카드(id739)처럼 "건당 이용금액"(1회 결제 금액
 * 기준 할인, 월 실적과 무관)이라는 표까지 구간표로 오인하는 사례가 실제로 있었다. "실적/
 * 전월/지난달"은 전부 "그 달 누적 실적"을 가리킬 때만 쓰이는 표현이라 더 안전하다(이
 * 조합으로 확인된 진짜 구간표 카드들은 전부 이 세 단어 중 하나를 포함한다 — 단,
 * "당월"만 쓰는 극소수 카드 하나는 이 조건이 더 엄격해지면서 못 잡게 된다는 트레이드오프는
 * 감수한다). (2) 이렇게 짝지어지는 행이 최소 2개는 있어야 한다(우연히 한 행만
 * "2만원 이상 이용 시" 같은 조건문을 구간으로 오인해도, 그 한 행만으론 구간표로 인정
 *되지 않음). (3) 그렇게 모인 요율 값이 실제로 서로 달라야 한다(다 같으면 사실상 고정
 * 요율이므로 버림 — 요율 고정+한도만 구간별인 카드를 다루지 않기로 한 방침과 동일).
 */
function parseRowWiseTable(rows: string[][]): ParsedRow[] {
  if (rows.length < 3) return []; // 최소 구간 2개 + 어떤 형태로든 표 맥락 한 줄은 있어야 함
  const wholeText = rows.map((r) => r.join(" ")).join(" ");
  if (!/실적|전월|지난달/.test(wholeText)) return [];

  interface RowMatch {
    range: { min: number; max: number };
    // 같은 행에서 구간 칸을 뺀 나머지 칸 중 순수 %인 칸들, 나온 순서대로
    rates: number[];
  }
  const rowMatches: RowMatch[] = [];
  for (const row of rows) {
    let range: { min: number; max: number } | null = null;
    let rangeIdx = -1;
    for (let i = 0; i < row.length; i++) {
      // "1만원 이상 결제 시"/"3만원 이상 결제 시"처럼 "N만원 이상"을 포함하지만 실제로는
      // "1회 결제 금액이 N만원 이상이면"이라는 건당(per-transaction) 최소 결제 조건인
      // 칸이 있다 — 카카오페이 트래블로그 체크카드(id2775)에서 실제로 이런 칸이 진짜
      // 전월실적 칸("40만원 이상")보다 앞에 나와서, 이 칸을 구간으로 오인해 서로 다른
      // 혜택(커피/편의점/생활비/쇼핑 등)의 건당 조건을 하나의 가짜 구간표로 잘못 엮은
      // 사례가 있었다. "결제 시"/"건당"이 붙은 칸은 구간 후보에서 제외한다.
      if (/결제\s*시|건당/.test(row[i])) continue;
      const r = parseSpendRangeLabel(row[i]);
      if (r) {
        range = r;
        rangeIdx = i;
        break;
      }
    }
    if (!range) continue;

    const rates: number[] = [];
    row.forEach((cell, idx) => {
      if (idx === rangeIdx) return;
      const m = cell.match(/^(\d+(?:\.\d+)?)\s*%$/);
      if (m) rates.push(parseFloat(m[1]) / 100);
    });
    if (rates.length === 0) continue;
    rowMatches.push({ range, rates });
  }
  if (rowMatches.length < 2) return []; // 구간처럼 보이는 행이 최소 2개는 있어야 진짜 구간표

  // 한 행에 %칸이 여러 개면(예: 주유/전기차처럼 칸이 여럿), 몇 번째로 나온 %칸인지로 묶는다.
  const byOrder = new Map<number, TierBreakpoint[]>();
  for (const { range, rates } of rowMatches) {
    rates.forEach((rate, order) => {
      const list = byOrder.get(order) ?? [];
      list.push({ minSpend: range.min, rate });
      byOrder.set(order, list);
    });
  }

  const parsedRows: ParsedRow[] = [];
  for (const tiers of byOrder.values()) {
    if (tiers.length < 2) continue; // 유효한 구간이 2개 미만이면(=사실상 고정 요율) 버림
    const distinctRates = new Set(tiers.map((t) => t.rate));
    if (distinctRates.size < 2) continue; // 방어적 이중 체크: 요율이 실제로는 다 같으면 의미 없음

    tiers.sort((a, b) => a.minSpend - b.minSpend);
    if (tiers[0].minSpend > 0) tiers[0] = { ...tiers[0], minSpend: 0 };
    parsedRows.push({ label: "행방향구간", loPercent: null, hiPercent: null, tiers });
  }
  return parsedRows;
}

function extractRowsFromInfo(info: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  for (const tableHtml of extractTablesFromHtml(info)) {
    const tableRows = extractRows(tableHtml);
    const columnWise = parseOneTable(tableHtml);
    // 열 방향으로 못 읽었을 때만 행 방향으로 다시 시도한다(같은 표를 두 번 세지 않기 위함).
    rows.push(...(columnWise.length > 0 ? columnWise : parseRowWiseTable(tableRows)));
  }
  return rows;
}

export interface KeyBenefitLike {
  title?: string;
  comment?: string;
  info?: string;
}

/**
 * 카드 한 장의 key_benefit 전체에서, 카테고리(= title)별로 실제 구간별 요율(tiers)을
 * 찾아낸다. 찾은 카테고리만 담기므로(대부분의 카드는 아예 빈 Map), 호출하는 쪽에서는
 * "이 카드는 이 카테고리에 한해 진짜 다구간 요율이 있다"는 뜻으로 받아들이면 된다.
 */
export function extractCardTiers(entries: KeyBenefitLike[]): Map<string, TierBreakpoint[]> {
  const direct = new Map<string, TierBreakpoint[]>();
  // "공용" 표(한 표에 여러 카테고리 행이 섞여 있는 경우)에서 나온, 아직 주인을 못 찾은 행들.
  const pooled: ParsedRow[] = [];

  for (const entry of entries) {
    if (!entry.info) continue;
    const rows = extractRowsFromInfo(entry.info);
    if (rows.length === 0) continue;

    if (rows.length === 1) {
      // 이 항목 자체가 카테고리 하나를 의미하므로, 행 라벨과 무관하게 바로 귀속시킨다.
      if (entry.title) direct.set(entry.title, rows[0].tiers);
    } else {
      pooled.push(...rows);
    }
  }

  // 아직 본인 표를 못 찾은 항목은, comment에 적힌 %범위로 공용 풀에서 찾아본다.
  for (const entry of entries) {
    if (!entry.title || direct.has(entry.title)) continue;
    const range = extractPercentRangeFromText(entry.comment ?? "");
    if (!range) continue;

    const TOLERANCE = 0.05;
    const match = pooled.find(
      (row) =>
        row.loPercent !== null &&
        row.hiPercent !== null &&
        Math.abs(row.loPercent - range.lo) <= TOLERANCE &&
        Math.abs(row.hiPercent - range.hi) <= TOLERANCE,
    );
    if (match) direct.set(entry.title, match.tiers);
  }

  // 그래도 못 찾은 공용 표 행은 행 이름 자체로 시도해본다 — "적립" 같은 총괄 섹션 안에
  // "국내 가맹점"/"국외 가맹점"처럼 이미 카테고리별로 나뉜 행이 있는 경우가 있었다(예:
  // GOAT BC 바로카드). loPercent가 null인 행만 대상으로 한다 — "1~5% 적립처"처럼 %범위가
  // 박힌 라벨은 위에서 이미 comment 매칭을 시도했고, 라벨 자체는 카테고리명이 아니라서
  // 여기서 다시 시도해봐야 의미가 없다(오히려 "1~5% 적립처"라는 이상한 이름의 항목만
  // 하나 더 생긴다).
  for (const row of pooled) {
    if (row.loPercent !== null || direct.has(row.label)) continue;
    direct.set(row.label, row.tiers);
  }

  return direct;
}

// ---- 자체 테스트 (tsx scripts/tierTableParser.ts 로 직접 실행) ----
if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const fixture = JSON.parse(readFileSync(join(process.cwd(), "scripts/__fixtures__/shinhan-hipoint.json"), "utf-8"));
  const tierMap = extractCardTiers(fixture.keyBenefit);
  console.log(`카드: ${fixture.name}`);
  console.log(`구간별 요율을 찾은 카테고리 ${tierMap.size}개:`);
  for (const [title, tiers] of tierMap) {
    console.log(`  "${title}":`, tiers);
  }
}
