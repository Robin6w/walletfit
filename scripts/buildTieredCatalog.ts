/**
 * cards-catalog.json(정적 SEO 요약) + cards-detail-raw.json(내부 API 상세, key_benefit)을
 * 합쳐서, 진짜 전월실적 구간별 요율이 있는 카드는 그 구간(tiers)까지 채운
 * cards-catalog.json을 다시 씁니다.
 *
 * 구간 데이터가 있는 카테고리만 채우고, 없는 카테고리/카드는 지금과 동일하게
 * cardConverter.ts가 benefitSummary 텍스트에서 단일 요율로 파싱하도록 그대로 둡니다
 * (회귀 없음 — 못 채운 부분은 그냥 기존 동작 그대로).
 *
 * 실행: npx tsx scripts/buildTieredCatalog.ts
 * (사전 조건: fetchCardCatalog.ts와 fetchCardTierDetail.ts를 먼저 돌려서
 *  data/catalog/cards-catalog.json, data/catalog/cards-detail-raw.json이 있어야 함)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { extractCardTiers, type KeyBenefitLike, type TierBreakpoint } from "./tierTableParser";
import {
  KEYWORD_CATEGORY_PAIRS,
  blankOutAll,
  stripFalsePositivePhrases,
} from "../src/features/statement/importerParser";

// cardConverter.ts의 matchCategories와 완전히 동일한 로직이다. cardConverter.ts는 "@/..."
// 별칭 import를 쓰는데, 이 스크립트는 tsx로 직접 실행돼서(비트/빌드 단계 없음) 별칭이
// 안 풀린다. 그래서 별칭 없는 이 파일(importerParser.ts)에서 재료만 가져와 여기서 다시
// 조립한다 — cardConverter.ts를 고치는 게 아니라 이 스크립트만의 사정.
const GENERIC_MERCHANT_KEYWORDS = ["가맹점", "전국", "국내외", "모든", "마일", "해외"];

function matchCategories(clause: string): string[] {
  let working = stripFalsePositivePhrases(clause.toLowerCase());
  const matched = new Set<string>();

  for (const { keyword, category } of KEYWORD_CATEGORY_PAIRS) {
    const keywordLower = keyword.toLowerCase();
    if (working.includes(keywordLower)) {
      matched.add(category);
      working = blankOutAll(working, keywordLower);
    }
  }

  if (matched.size === 0 && GENERIC_MERCHANT_KEYWORDS.some((keyword) => clause.includes(keyword))) {
    matched.add("etc");
  }

  return [...matched];
}

const CATALOG_DIR = join(process.cwd(), "data", "catalog");
const CATALOG_FILE = join(CATALOG_DIR, "cards-catalog.json");
const DETAIL_FILE = join(CATALOG_DIR, "cards-detail-raw.json");

interface CatalogEntry {
  sourceId: number;
  [key: string]: unknown;
}

interface DetailEntry {
  sourceId: number;
  name?: string;
  keyBenefit: KeyBenefitLike[];
}

/** 카테고리별 구간별 요율 데이터. cardConverter.ts에서 benefitSummary 파싱 대신 이 값을 우선 사용합니다. */
export interface CategoryTierData {
  category: string;
  /** 할인 / 포인트적립 / 캐시백 구분. comment 텍스트에서 추정합니다. */
  type: "discount" | "point" | "cashback";
  tiers: TierBreakpoint[];
}

/** cardConverter.ts의 resolveRewardKind와 동일한 로직 (마찬가지로 별칭 import 문제로 재조립). */
function resolveRewardKind(text: string): CategoryTierData["type"] {
  if (text.includes("적립") || text.includes("포인트")) return "point";
  if (text.includes("캐시백")) return "cashback";
  return "discount";
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

/**
 * key_benefit의 title(예: "쇼핑", "모든가맹점")을 SpendCategoryId로 매핑한다.
 * matchCategories는 원래 은행 문자메시지 속 가맹점명을 보고 카테고리를 추정하도록 만든
 * 함수라, "쇼핑"처럼 추상적인 카테고리명 자체는 못 알아듣는 경우가 있다. title과 comment를
 * 같이 넣어서 최대한 맞혀보고, 그래도 못 찾으면 매핑 실패로 남긴다(억지로 끼워 맞추지 않음).
 */
function resolveCategoryIds(entry: KeyBenefitLike): string[] {
  const text = `${entry.title ?? ""} ${entry.comment ?? ""}`;
  return matchCategories(text);
}

function main() {
  const catalog = loadJson<CatalogEntry[]>(CATALOG_FILE);
  const details = loadJson<DetailEntry[]>(DETAIL_FILE);
  const detailById = new Map(details.map((d) => [d.sourceId, d]));

  let cardsWithTierData = 0;
  let categoriesFilled = 0;
  const unmappedTitles = new Map<string, number>(); // title -> 등장 횟수 (매핑 실패 -> 리포트용)
  // 카드 하나 안에서 같은 카테고리가 서로 다른 구간 데이터로 두 번 이상 매핑되는 경우
  // (예: id2198 캐롯손해보험-현대카드M Edition3 — "스타벅스/폴바셋/이디야" 전용 그룹과
  // "기타 커피..." 캐치올 그룹이 둘 다 cafe로 매핑됨). "카드명 - 카테고리" -> 충돌 횟수.
  const categoryConflicts = new Map<string, number>();

  // 이 스크립트를 여러 번 재실행할 수 있다(파서를 고친 뒤 다시 돌리는 식). 이전 실행에서
  // categoryTiers를 채워놨던 카드가 이번엔(파서 버그 수정으로) 더 이상 안 걸리면, 그냥
  // entry를 손대지 않고 반환하는 것만으론 부족하다 — 이전 실행이 남긴 stale한
  // categoryTiers가 그대로 남아있게 된다(나라사랑체크카드/id739에서 실제로 발생: 건당
  // 할인 표를 구간표로 오인했던 버그를 고친 뒤 재실행해도, 예전에 써놨던 잘못된
  // categoryTiers가 지워지지 않고 남아있었다). 그래서 "이번엔 못 찾음"인 경우 항상
  // categoryTiers 필드 자체를 명시적으로 지운다.
  const withoutCategoryTiers = (entry: CatalogEntry): CatalogEntry => {
    if (!("categoryTiers" in entry)) return entry;
    const { categoryTiers: _drop, ...rest } = entry as CatalogEntry & { categoryTiers?: unknown };
    return rest as CatalogEntry;
  };

  const updated = catalog.map((entry) => {
    const detail = detailById.get(entry.sourceId);
    if (!detail) return withoutCategoryTiers(entry);

    const tierMap = extractCardTiers(detail.keyBenefit);
    if (tierMap.size === 0) return withoutCategoryTiers(entry);

    // 카테고리별로 하나만 남긴다 — RewardRule은 카테고리당 규칙 하나만 표현할 수 있고,
    // 실제로 한 카드 안에서 같은 카테고리가 서로 다른 title(예: 브랜드 특정 그룹 vs
    // 캐치올 그룹)로 두 번 이상 매핑되는 경우가 있었다. 둘 중 어느 쪽이 사용자에게 실제로
    // 적용될지 알 수 없으니, 과대 약속을 피하기 위해 0구간(최저 실적) 요율이 더 낮은
    // (보수적인) 쪽을 남긴다.
    const byCategory = new Map<string, CategoryTierData>();

    for (const [title, tiers] of tierMap) {
      if (tiers.length < 2) continue; // 구간이 1개뿐이면(=사실상 고정 요율) 굳이 tiers로 안 채움
      // title이 실제 key_benefit 항목의 title과 일치하면 그 항목의 title+comment로 매핑을
      // 시도하고, 일치하는 항목이 없으면(공용 표 안의 행 이름 자체가 title로 온 경우 —
      // 예: "국내 가맹점" — tierTableParser.ts의 마지막 fallback 참고) title 텍스트 자체로
      // 시도한다.
      const kb = detail.keyBenefit.find((k) => k.title === title);
      const categories = kb ? resolveCategoryIds(kb) : matchCategories(title);
      if (categories.length === 0) {
        unmappedTitles.set(title, (unmappedTitles.get(title) ?? 0) + 1);
        continue;
      }
      const type = resolveRewardKind(`${kb?.title ?? ""} ${kb?.comment ?? ""}`);
      for (const category of categories) {
        const candidate: CategoryTierData = { category, type, tiers };
        const existing = byCategory.get(category);
        if (!existing) {
          byCategory.set(category, candidate);
          continue;
        }
        const key = `${detail.name ?? entry.sourceId} - ${category}`;
        categoryConflicts.set(key, (categoryConflicts.get(key) ?? 0) + 1);
        if (candidate.tiers[0].rate < existing.tiers[0].rate) {
          byCategory.set(category, candidate);
        }
      }
    }

    const categoryTiers = [...byCategory.values()];
    categoriesFilled += categoryTiers.length;

    if (categoryTiers.length === 0) return withoutCategoryTiers(entry);
    cardsWithTierData++;
    return { ...withoutCategoryTiers(entry), categoryTiers };
  });

  writeFileSync(CATALOG_FILE, JSON.stringify(updated, null, 2) + "\n", "utf-8");

  console.log(`완료: ${cardsWithTierData}장에 구간별 요율 데이터를 채웠습니다 (카테고리 ${categoriesFilled}건).`);
  if (unmappedTitles.size > 0) {
    console.log("\n카테고리 매핑에 실패해서 못 채운 항목(수동 확인 필요):");
    for (const [title, count] of unmappedTitles) {
      console.log(`  "${title}" (${count}건) — KEYWORD_MAP에 관련 키워드 추가 검토`);
    }
  }
  if (categoryConflicts.size > 0) {
    console.log("\n한 카드 안에서 같은 카테고리가 여러 번 매핑돼서 더 낮은(보수적인) 쪽만 남긴 항목:");
    for (const [key, count] of categoryConflicts) {
      console.log(`  ${key} (충돌 ${count}회)`);
    }
  }
}

main();
