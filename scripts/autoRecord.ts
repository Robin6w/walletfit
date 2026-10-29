/**
 * 카탈로그 한 장(혜택 요약 한 줄) → 혜택 표(양식 v0.2.1) 자동 변환.
 * buildBenefitCatalog.ts가 정답표·AI 추출이 없는 카드에 씁니다. 실험·채점 스크립트도 이 파일을 그대로 불러 씁니다
 * (buildBenefitCatalog.ts는 불러오는 순간 파일을 다시 쓰기 때문에 따로 뺐습니다).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { CatalogListing } from "../src/domain/types/catalog";
import type { WalletCard } from "../src/domain/types/card";
import { inferBrandScope } from "../src/domain/engine/brandScope";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BenefitRecord = Record<string, any>;

const ROOT = path.resolve(import.meta.dirname, "..");
const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  (JSON.parse(readFileSync(path.join(ROOT, "data/categories.json"), "utf-8")) as { id: string; label: string }[]).map(
    (c) => [c.id, c.label],
  ),
);

/** 정확도는 기존 파서 수준이고, 계산 근거에 '자동 변환' 한 줄이 붙습니다. 브랜드 이름만 적힌 혜택은 그 브랜드로 한정합니다(brandScope.ts). */
export function autoRecord(entry: CatalogListing, card: WalletCard): BenefitRecord {
  const mins = Array.from(new Set(card.tiers.map((t) => t.minSpend))).sort((a, b) => a - b);
  const tierIds = mins.map((_, i) => `t${i}`);
  const tiers = mins.map((min, i) => ({ id: tierIds[i], min_won: min, max_won: i + 1 < mins.length ? mins[i + 1] : null }));

  // (카테고리, 혜택 종류) 하나 = 혜택 하나. 구간마다 요율·한도가 다를 수 있다.
  const byKey = new Map<
    string,
    { category: string; type: string; values: { tier: string; value: number }[]; caps: { tier: string; amount_won: number }[]; clauses: Set<string> }
  >();
  card.tiers.forEach((tier) => {
    const tid = tierIds[mins.indexOf(tier.minSpend)];
    for (const rule of tier.benefits) {
      if (!(rule.rate > 0)) continue;
      const key = `${rule.category}|${rule.type}`;
      const slot = byKey.get(key) ?? { category: rule.category, type: rule.type, values: [], caps: [], clauses: new Set<string>() };
      slot.values.push({ tier: tid, value: Math.round(rule.rate * 10000) / 10000 });
      if (rule.capPerMonth) slot.caps.push({ tier: tid, amount_won: Math.round(rule.capPerMonth) });
      if (rule.description) slot.clauses.add(rule.description);
      byKey.set(key, slot);
    }
  });

  const quote = (entry.benefitSummary ?? "").trim() || "혜택 요약 없음";
  const benefits = Array.from(byKey.values()).map((slot, i) => {
    const label = CATEGORY_LABEL[slot.category] ?? slot.category;
    const kindLabel = slot.type === "point" ? "적립" : slot.type === "cashback" ? "캐시백" : "할인";
    const top = Math.max(...slot.values.map((v) => v.value));
    const brand = inferBrandScope(slot.category, Array.from(slot.clauses));
    const target = brand.specificity === "category" ? label : brand.merchants.join("·");
    return {
      id: `a${i + 1}_${slot.category}`,
      title: `${target} ${Math.round(top * 1000) / 10}% ${kindLabel}`,
      scope: {
        app_category: slot.category,
        merchants: brand.merchants,
        specificity: brand.specificity,
        region: "domestic",
        channel: "any",
        payment_condition: null,
        days: "any",
        excluded: [],
      },
      reward: { kind: slot.type, type: "percent", value_by_tier: slot.values },
      conditions: { tier_set: "card", applies_in_tiers: slot.values.map((v) => v.tier) },
      caps: slot.caps.length ? [{ period: "month", basis: "benefit", by_tier: slot.caps }] : [],
      source_quote: quote,
      confidence: 0.3,
      notes:
        "카드 혜택 요약 문구에서 자동 변환(원문 대조 전). 한도는 요율로 추정" +
        (brand.specificity === "category" ? "" : ". 요약 문구에 브랜드 이름만 있어서 그 브랜드로 한정"),
    };
  });

  return {
    schema_version: "0.2",
    card: {
      source_id: entry.sourceId,
      name: entry.name,
      issuer: entry.issuer,
      card_type: card.cardType,
      annual_fee: { domestic: entry.annualFee ?? 0, overseas: entry.annualFee ?? 0 },
      discontinued: !!entry.isDiscontinued,
    },
    source: { url: entry.sourceUrl, extracted_by: "auto:cardConverter" },
    performance: {
      basis: "prev_month",
      tiers,
      excluded_app_categories: card.excludedCategories ?? [],
      excluded_items: [],
      excludes_discounted_spend: false,
    },
    benefits,
  };
}
