/**
 * 카드고릴라 혜택 요약 한 줄을 사람이 읽듯 해석한 결과(1_혜택정보구조화/요약해석/summary-labels.json) → 혜택 표(양식 v0.2.1).
 *
 * 2026-10-07: 예전 변환기(cardConverter.ts, 키워드 사전 + 정규식)는 요약 자체를 제대로 옮기지 못했다
 * (발급 중 자동 변환 1,070장 중 요약대로 계산되는 카드 194장). 그래서 요약 해석을 그대로 표로 옮긴다.
 * 해석이 없는 카드(새로 수집한 카드 등)만 예전 변환기(autoRecord.ts)를 쓴다.
 *
 * 요약만으로 정해지지 않는 부분은 보수적으로 계산한다(사용자 결정).
 *  - 계산에서 뺌: 해외, 연간·1회 혜택, 앱 카테고리 밖 대상(병원·놀이공원 등), 어디인지 모르는 묶음(생활업종 등),
 *    숫자 없는 항목, 선택형 카드의 선택 영역
 *  - 범위(N~M%)는 낮은 값, '최대 N%'는 N(요약에 다른 값이 없음)
 *  - 정액(N원 할인)은 예전처럼 요율로 바꾸고(상한 50%) 한도는 N원
 *    ('최대 N원'에 정답표 중앙값 5%를 써 봤지만 정답표 52장 기준 ±50% 안이 65→59건으로 줄어 쓰지 않음)
 *  - 한도는 요약에 없으므로 요율로 추정(예전 변환기와 같은 규칙)
 * 원문의 전월실적·통합 한도는 요약에 없어서 여기서도 반영하지 못한다(원문 추출기에서 다룬다).
 */
import type { CatalogListing } from "../src/domain/types/catalog";
import type { WalletCard } from "../src/domain/types/card";
import { BRAND_NAMES } from "../src/domain/engine/brandScope";
import { autoRecord, type BenefitRecord } from "./autoRecord";

export interface SummaryItem {
  text: string;
  calc: boolean;
  why: string;
  cats: string[];
  scope: "category" | "brand" | "group";
  merchants: string[];
  region: "domestic" | "overseas";
  kind: "percent" | "won" | "won_per_liter" | "per_amount" | "mileage" | "none";
  value: number | null;
  value_high: number | null;
  per_won: number | null;
  is_max: boolean;
  reward: "discount" | "point" | "cashback" | "mileage";
  period: "year" | "once" | "per_txn" | "unspecified";
  cond: string;
}

export interface SummaryLabel {
  sid: number;
  choice: boolean;
  items: SummaryItem[];
}

/** 정액 혜택을 요율로 바꿀 때 기준 결제 금액(예전 변환기와 같음) */
const REFERENCE_WON: Record<string, number> = { transport: 1500, mobile: 50000 };

/** 예전 변환기와 같은 요율별 추정 한도 */
function estimateCap(rate: number): number {
  if (rate >= 0.08) return 10000;
  if (rate >= 0.05) return 15000;
  if (rate >= 0.03) return 20000;
  if (rate >= 0.015) return 30000;
  return 50000;
}

const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();

/** 가맹점 이름이 어느 앱 카테고리의 어느 브랜드인지(brandScope.ts 목록 기준). 대표 이름으로 묶어서 정답표 표기와 맞춘다 */
function brandOf(merchant: string): { cat: string; canonical: string } | null {
  const m = norm(merchant);
  for (const [cat, groups] of Object.entries(BRAND_NAMES)) {
    for (const names of groups) {
      if (names.some((alias) => m.includes(norm(alias)))) return { cat, canonical: names[0] };
    }
  }
  return null;
}
const brandCategory = (merchant: string) => brandOf(merchant)?.cat ?? null;

/** 요약에 적힌 한도 문구: '월 최대 통합 할인한도 50,000원'(카드 전체), '영역별 월 최대 할인한도 15,000원'(혜택마다) */
function capNotice(item: SummaryItem): { shared: boolean; amount: number } | null {
  if (!/한도/.test(item.text) || item.kind !== "won" || item.value == null || /없이|없음|제한\s*없/.test(item.text)) return null;
  return { shared: /통합/.test(item.text), amount: item.value };
}
const noCapStated = (item: SummaryItem) => /한도\s*(없이|제한\s*없)|한도없이/.test(item.text + item.cond);

export type SkipReason = "계산 대상 아님" | "해외" | "연간·1회" | "앱 카테고리 밖" | "어디인지 모르는 묶음" | "숫자 없음" | "선택형 영역";

/** 이 항목을 계산에서 빼는 이유. 계산하면 null */
export function skipReason(item: SummaryItem, choiceCard: boolean): SkipReason | null {
  if (!item.calc) return "계산 대상 아님";
  if (item.region === "overseas") return "해외";
  if (item.period === "year" || item.period === "once") return "연간·1회";
  if (item.cats.includes("UNSPECIFIED")) return "어디인지 모르는 묶음";
  if (item.cats.length === 0) return "앱 카테고리 밖";
  if (item.kind === "none" || item.value == null) return "숫자 없음";
  if (choiceCard && /선택|택\s*\d|맞춤|최다|1위/.test(item.text + item.cond)) return "선택형 영역";
  if ((item.kind === "per_amount" || item.kind === "mileage") && !item.per_won) return "숫자 없음";
  return null;
}

interface RewardPart {
  reward: Record<string, unknown>;
  caps: Record<string, unknown>[];
  note: string[];
}

function rewardOf(item: SummaryItem, cat: string | null): RewardPart {
  const v = item.value as number;
  const kind = item.reward === "mileage" && item.kind !== "mileage" ? "point" : item.reward;
  const note: string[] = [];
  if (item.value_high != null) note.push(`범위 ${item.value}~${item.value_high} 중 낮은 값`);
  if (item.is_max) note.push("'최대' 값 그대로");
  const monthCap = (amount: number) => [{ period: "month", basis: "benefit", by_tier: [{ tier: null, amount_won: Math.round(amount) }] }];
  switch (item.kind) {
    case "percent": {
      const rate = v / 100;
      return { reward: { kind, type: "percent", value_by_tier: [{ tier: null, value: rate }] }, caps: monthCap(estimateCap(rate)), note: [...note, "한도는 요율로 추정"] };
    }
    case "per_amount": {
      const rate = v / (item.per_won as number);
      return { reward: { kind, type: "percent", value_by_tier: [{ tier: null, value: rate }] }, caps: monthCap(estimateCap(rate)), note: [...note, "한도는 요율로 추정"] };
    }
    case "mileage": {
      const per = item.per_won as number;
      const rate = (v * 15) / per; // 1마일 15원(assumptions.json과 같은 가정)
      return {
        reward: { kind: "mileage", type: "per_unit_spend", unit_spend_won: per, value_by_tier: [{ tier: null, value: v }] },
        caps: monthCap(estimateCap(rate)),
        note: [...note, "한도는 요율로 추정"],
      };
    }
    case "won_per_liter":
      return { reward: { kind, type: "won_per_liter", value_by_tier: [{ tier: null, value: v }] }, caps: [], note };
    case "won": {
      const ref = REFERENCE_WON[cat ?? ""] ?? 10000;
      const rate = Math.min(v / ref, 0.5);
      return {
        reward: { kind, type: "percent", value_by_tier: [{ tier: null, value: Math.round(rate * 10000) / 10000 }] },
        caps: monthCap(v),
        note: [...note, `정액 ${v.toLocaleString("ko-KR")}원을 요율로 바꿈(한도 ${v.toLocaleString("ko-KR")}원)`],
      };
    }
    default:
      throw new Error(`알 수 없는 kind ${item.kind}`);
  }
}

/** 요약 해석 → 혜택 표. 해석이 없으면 null */
export function summaryRecord(entry: CatalogListing, card: WalletCard, label: SummaryLabel | undefined): BenefitRecord | null {
  if (!label) return null;
  const base = autoRecord(entry, card);
  // 카드고릴라 실적 구간표(categoryTiers)가 있는 카테고리는 구간표 값을 그대로 쓴다(요약보다 자세한 원문 자료)
  const tierCats = new Set((entry.categoryTiers ?? []).map((t) => t.category as string));
  const benefits: Record<string, unknown>[] = base.benefits.filter((b: { scope: { app_category: string } }) => tierCats.has(b.scope.app_category));
  const skipped: string[] = [];
  const notices = label.items.map(capNotice).filter((x): x is { shared: boolean; amount: number } => x !== null);
  const sharedNotice = notices.find((n) => n.shared);
  label.items.forEach((item, i) => {
    if (capNotice(item)) return; // 한도 문구는 아래에서 다른 혜택에 붙인다
    const why = skipReason(item, label.choice);
    if (why) {
      if (item.calc) skipped.push(`${item.text.trim()}(${why})`);
      return;
    }
    const targets = item.cats.includes("ALL") ? [null] : item.cats.filter((c) => !tierCats.has(c));
    targets.forEach((cat) => {
      const { reward, caps: estCaps, note } = rewardOf(item, cat);
      const perArea = notices.find((n) => !n.shared);
      let caps = estCaps;
      if (noCapStated(item)) {
        caps = [];
        note.push("요약에 '한도 없이'");
      } else if (perArea) {
        const est = (estCaps[0] as { by_tier?: { amount_won: number }[] } | undefined)?.by_tier?.[0]?.amount_won;
        const amount = est != null ? Math.min(est, perArea.amount) : perArea.amount;
        caps = [{ period: "month", basis: "benefit", by_tier: [{ tier: null, amount_won: amount }] }];
        note.push(`요약의 영역별 한도 ${perArea.amount.toLocaleString("ko-KR")}원`);
      }
      let specificity = cat === null ? "all_merchants" : "category";
      let merchants: string[] = [];
      if (cat !== null && item.scope !== "category") {
        const mine = item.merchants.filter((m) => brandCategory(m) === cat);
        const placed = item.merchants.filter((m) => brandCategory(m) !== null);
        // 브랜드 목록으로 카테고리를 알 수 있으면 그 카테고리에만 붙이고, 모르면 항목 전체의 범위를 따른다
        merchants = mine.length ? mine : placed.length ? [] : item.merchants;
        merchants = Array.from(new Set(merchants.map((m) => brandOf(m)?.canonical ?? m)));
        if (merchants.length) specificity = item.scope === "group" || merchants.length > 3 ? "merchant_group" : "brand";
      }
      benefits.push({
        id: `s${i + 1}_${cat ?? "all"}`,
        title: item.text.trim(),
        scope: {
          app_category: cat,
          merchants,
          specificity,
          region: "domestic",
          channel: "any",
          payment_condition: item.cond && /결제|PAY|페이/i.test(item.cond) ? item.cond : null,
          days: "any",
          excluded: [],
        },
        reward,
        caps,
        source_quote: item.text.trim(),
        ...(sharedNotice ? { shared_cap_ids: ["summary_total"] } : {}),
        confidence: 0.4,
        notes: ["카드고릴라 혜택 요약을 해석한 값(원문 대조 전)", ...note].join(". "),
      });
    });
  });
  return {
    ...base,
    ...(sharedNotice
      ? { shared_caps: [{ id: "summary_total", label: "요약의 통합 한도", period: "month", by_tier: [{ tier: null, amount_won: sharedNotice.amount }] }] }
      : {}),
    source: { url: entry.sourceUrl, extracted_by: "summary:labels" },
    benefits,
    extraction_notes: skipped.map((x) => `요약에 있지만 계산에서 뺀 항목: ${x}`),
  };
}
