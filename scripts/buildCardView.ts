/**
 * 화면용 카드 혜택 요약(data/catalog/card-view.json)을 만듭니다.
 *
 * 혜택 표(cards-benefit.json, 약 10MB)는 계산 엔진(워커)만 읽습니다. 전체 카드 화면과 카드 상세 창은
 * 엔진을 기다리지 않고 바로 보여 줘야 해서, 화면에 쓰는 칸만 골라 작은 파일로 따로 둡니다(2026-10-30).
 * 문구 만들기(할인율·한도 글자)는 화면 쪽(src/v2/model/cardView.ts)에서 합니다.
 *
 * 실행: npm run build:cardview (npm run build:benefit 끝에서도 같이 만듭니다)
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { CardViewFile, CardViewEntry } from "../src/domain/types/cardView";

const ROOT = path.resolve(import.meta.dirname, "..");
const IN = path.join(ROOT, "data/catalog/cards-benefit.json");
const OUT = path.join(ROOT, "data/catalog/card-view.json");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rec = Record<string, any>;

const amounts = (byTier: Rec[] | undefined) =>
  (byTier ?? []).filter((x) => typeof x.amount_won === "number").map((x) => ({ tier: x.tier ?? null, won: x.amount_won as number }));

export function cardViewOf(status: string, r: Rec): CardViewEntry {
  const perf = r.performance ?? {};
  return {
    st: status,
    basis: perf.basis ?? "unknown",
    tiers: (perf.tiers ?? []).map((t: Rec) => ({ id: t.id, min: t.min_won ?? 0, max: t.max_won ?? null })),
    exItems: (perf.excluded_items ?? []).slice(0, 30),
    exCats: perf.excluded_app_categories ?? [],
    disc: !!perf.excludes_discounted_spend,
    grace: perf.new_card_grace?.months_after_issue ?? null,
    shared: (r.shared_caps ?? []).map((s: Rec) => ({ id: s.id, label: s.label ?? "", period: s.period ?? "month", amounts: amounts(s.by_tier) })),
    choice: (r.choice_groups ?? []).map((g: Rec) => ({ label: g.label ?? "", options: (g.options ?? []).map((o: Rec) => o.label ?? "") })),
    b: (r.benefits ?? []).map((b: Rec) => {
      const sc = b.scope ?? {};
      const rw = b.reward ?? {};
      const cond = b.conditions ?? {};
      return {
        id: b.id,
        t: b.title ?? "",
        c: sc.app_category ?? null,
        ...(sc.specificity === "all_merchants" ? { all: true } : {}),
        k: rw.kind ?? "discount",
        ty: rw.type ?? "percent",
        v: (rw.value_by_tier ?? []).filter((x: Rec) => typeof x.value === "number").map((x: Rec) => ({ tier: x.tier ?? null, value: x.value as number })),
        ...(rw.unit_spend_won ? { unit: rw.unit_spend_won as number } : {}),
        caps: (b.caps ?? []).map((c: Rec) => ({ period: c.period ?? "month", amounts: amounts(c.by_tier) })),
        ...(b.shared_cap_ids?.length ? { sh: b.shared_cap_ids as string[] } : {}),
        st: b.status ?? "auto",
        q: typeof b.source_quote === "string" ? b.source_quote.slice(0, 240) : "",
        m: (sc.merchants ?? []).slice(0, 8),
        ch: sc.channel ?? "any",
        reg: sc.region ?? "any",
        ...(sc.payment_condition ? { pc: sc.payment_condition as string } : {}),
        ...(cond.min_txn_won ? { minTxn: cond.min_txn_won as number } : {}),
        ...(cond.max_benefit_per_txn_won ? { perTxn: cond.max_benefit_per_txn_won as number } : {}),
        ...(cond.count_limits && Object.keys(cond.count_limits).length ? { cnt: cond.count_limits as Record<string, number> } : {}),
        ...(cond.applies_in_tiers?.length ? { in: cond.applies_in_tiers as string[] } : {}),
      };
    }),
  };
}

export function buildCardView(cards: { sid: number; status: string; record: Rec }[], generatedAt: string): CardViewFile {
  return { generatedAt, cards: Object.fromEntries(cards.map((c) => [String(c.sid), cardViewOf(c.status, c.record)])) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const src = JSON.parse(readFileSync(IN, "utf-8")) as { generatedAt: string; cards: { sid: number; status: string; record: Rec }[] };
  const out = buildCardView(src.cards, src.generatedAt);
  writeFileSync(OUT, JSON.stringify(out));
  console.log(`카드 ${Object.keys(out.cards).length}장 → ${path.relative(ROOT, OUT)} (${Math.round(JSON.stringify(out).length / 1024)}KB)`);
}
