/**
 * 명세서 읽기용 브랜드 → 카테고리 사전을 카드 혜택 데이터(cards-benefit.json)에서 만든다(2026-10-31).
 *   npx tsx scripts/buildBrandCategory.ts
 * 결과: data/catalog/brand-category.json  { generatedAt, brands: { [가맹점 이름]: 카테고리 id } }
 *
 * 왜: 엔진은 브랜드 혜택을 그 혜택의 카테고리(scope.app_category) 안에서만 계산한다. 명세서에서 엔제리너스가
 * '그 외'로 들어가면 엔제리너스 할인 카드가 있어도 혜택이 0원이 된다. 혜택에 나오는 브랜드만큼만 사전을 둔다.
 *
 * 고르는 기준(엔진 brands_json과 같음): specificity가 brand·merchant_group, app_category 있음, 해외 전용 아님.
 * 빼는 것
 *   - 이름이 아니라 설명인 것: 괄호·쉼표·빗금, '가맹점'·'업종'·'포함' 같은 말, 20글자 넘는 것
 *   - 브랜드가 아닌 일반 낱말이거나 다른 가게 이름에 섞이기 쉬운 것(GENERIC)
 * 한 이름이 여러 카테고리에 나오면 그 이름을 쓴 혜택 수가 많은 쪽('그 외'는 다른 카테고리가 없을 때만).
 * 띄어쓰기·대소문자만 다른 이름('오늘의 집'·'오늘의집')은 한 이름으로 합쳐 센다(명세서에서는 띄어쓰기 없이 비교하므로).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

interface Benefit {
  scope?: { specificity?: string; app_category?: string; region?: string; merchants?: string[] };
}

const ROOT = resolve(import.meta.dirname, "..");
const catalog = JSON.parse(readFileSync(resolve(ROOT, "data/catalog/cards-benefit.json"), "utf8")) as {
  cards: { record: { benefits: Benefit[] } }[];
};

const DESCRIPTION = /[(),/·]|가맹점|업종|포함|이용|등록|제휴|선정|상기|그룹|전용|상품|보험료|통신료|요금|^각 |\s내\s/;

/** 브랜드가 아닌 일반 낱말이거나, 짧아서 다른 가게 이름에 섞이는 것('현대'→현대아울렛, '크림'→아이스크림) */
const GENERIC = new Set([
  "항공", "호텔", "면세점", "택시", "헬스장", "요가", "필라테스", "수영", "볼링", "스키", "당구", "골프장", "골프연습장",
  // 교통수단 이름은 브랜드가 아니다(2026-11-02 NH 앱 캡처: '(주)티머니 지하철'만 브랜드로 잡혀, 명세서 경로에서 버스 결제가
  // '시내버스·지하철' 묶음 혜택 대상에서 빠질 뻔함)
  "시내버스", "공항버스", "지하철", "공항철도", "마을버스", "광역버스", "버스", "전철",
  "외국어학원", "보습학원", "입시전문학원", "컴퓨터학원", "예체능계 학원",
  "LPG 충전소", "LPG충전소", "온라인 서점", "오프라인 서점",
  "현대", "롯데", "CJ", "GS", "NS", "크림", "웰스", "대교", "교원", "모다", "우노", "온달", "조공", "부츠",
]);

const key = (name: string) => name.toLowerCase().replace(/\s+/g, "");
/** 합친 이름 → 카테고리별 혜택 수, 표기별 혜택 수 */
const counts = new Map<string, { cats: Map<string, number>; spellings: Map<string, number> }>();
for (const card of catalog.cards) {
  for (const b of card.record.benefits) {
    const sc = b.scope ?? {};
    if (!["brand", "merchant_group"].includes(sc.specificity ?? "") || !sc.app_category || sc.region === "overseas") continue;
    for (const raw of (sc.merchants ?? []).slice(0, 12)) {
      const name = raw.trim();
      if (!name || name.length > 20 || DESCRIPTION.test(name) || GENERIC.has(name)) continue;
      const c = counts.get(key(name)) ?? { cats: new Map<string, number>(), spellings: new Map<string, number>() };
      c.cats.set(sc.app_category, (c.cats.get(sc.app_category) ?? 0) + 1);
      c.spellings.set(name, (c.spellings.get(name) ?? 0) + 1);
      counts.set(key(name), c);
    }
  }
}

const most = (m: Map<string, number>, last?: string) => [...m].sort((a, b) => (a[0] === last ? 1 : 0) - (b[0] === last ? 1 : 0) || b[1] - a[1])[0][0];
const brands: Record<string, string> = {};
for (const c of [...counts.values()].map((v) => ({ name: most(v.spellings), cat: most(v.cats, "etc") })).sort((a, b) => a.name.localeCompare(b.name, "ko"))) {
  brands[c.name] = c.cat;
}

writeFileSync(resolve(ROOT, "data/catalog/brand-category.json"), JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), brands }, null, 1) + "\n");
console.log(`brand-category.json: ${Object.keys(brands).length}개`);
