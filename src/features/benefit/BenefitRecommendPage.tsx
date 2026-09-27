import { useMemo, useState, type CSSProperties } from "react";
import { ChevronRight, Crown } from "lucide-react";
import { formatWon } from "@/shared/lib/format";
import { scoreCard } from "@/domain/engine/benefitCalculator";
import {
  catalogCards,
  categories,
  isInfoInsufficient,
  isDiscontinued,
  findCatalogEntryByCardId,
} from "@/domain/engine/loadCatalog";
import { toWalletCard } from "@/domain/engine/cardConverter";
import { CardThumb } from "@/shared/components/CardThumb";
import { Money } from "@/shared/components/Money";
import { CardDetailModal } from "@/features/catalog/CardDetailModal";
import { categoryColor, categoryIcon } from "@/shared/lib/categoryStyle";
import type { useSavedCards } from "@/domain/state/useSavedCards";
import type { SpendCategoryId, MonthlySpend } from "@/domain/types/card";
import type { CatalogListing } from "@/domain/types/catalog";

interface BenefitRecommendPageProps {
  myCards: ReturnType<typeof useSavedCards>;
}

const QUICK_AMOUNTS = [100000, 300000, 500000, 1000000];

export function BenefitRecommendPage({ myCards }: BenefitRecommendPageProps) {
  const [category, setCategory] = useState<SpendCategoryId>(categories[0]?.id ?? "");
  const [amount, setAmount] = useState(300000);
  const [scope, setScope] = useState<"myCards" | "all">("all");
  const [selectedEntry, setSelectedEntry] = useState<CatalogListing | null>(null);

  const scopedCards = useMemo(() => {
    if (scope === "myCards") {
      const idSet = new Set(myCards.ids);
      return catalogCards.filter((c) => idSet.has(c.sourceId)).map(toWalletCard);
    }
    return catalogCards.filter((entry) => !isInfoInsufficient(entry) && !isDiscontinued(entry)).map(toWalletCard);
  }, [scope, myCards.ids]);

  const results = useMemo(() => {
    const spending: MonthlySpend = { [category]: amount };
    return scopedCards
      .map((card) => scoreCard(card, spending))
      .filter((ev) => ev.meetsMinimum && ev.breakdown.some((b) => b.category === category && b.benefitAmount > 0))
      .sort((a, b) => {
        const ba = a.breakdown.find((b) => b.category === category)?.benefitAmount ?? 0;
        const bb = b.breakdown.find((b) => b.category === category)?.benefitAmount ?? 0;
        return bb - ba;
      })
      .slice(0, 8);
  }, [scopedCards, category, amount]);

  const categoryLabel = categories.find((c) => c.id === category)?.label ?? category;
  const accent = categoryColor(category);
  const CategoryIcon = categoryIcon(category);
  const sliderStyle = { accentColor: accent } as CSSProperties;
  const maxBenefit = Math.max(
    1,
    ...results.map((ev) => ev.breakdown.find((b) => b.category === category)?.benefitAmount ?? 0),
  );

  return (
    <div>
      <h1 className="text-xl font-extrabold text-[#14192f]">혜택별 카드 추천</h1>
      <p className="mb-6 mt-1 text-[12.5px] text-slate-500">
        카테고리 하나만 골라도 그 분야에서 가장 유리한 카드를 바로 찾아드려요
      </p>

      <div className="glass-panel rounded-2xl border border-[#e6ecf8] p-5">
        <div className="mb-4 flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setScope("all")}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              scope === "all" ? "brand-gradient-select text-white shadow-sm" : "text-slate-500"
            }`}
          >
            전체 카드 중 추천
          </button>
          <button
            type="button"
            onClick={() => setScope("myCards")}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              scope === "myCards" ? "brand-gradient-select text-white shadow-sm" : "text-slate-500"
            }`}
          >
            내 카드 중 추천
          </button>
        </div>

        <div className="mb-4">
          <div className="mb-2 text-[12px] font-semibold text-slate-600">카테고리 선택</div>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const active = category === c.id;
              const color = categoryColor(c.id);
              const Icon = categoryIcon(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className="flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition"
                  style={
                    active
                      ? { backgroundColor: color, borderColor: color, color: "#ffffff" }
                      : { borderColor: `${color}33`, color: "#475569", backgroundColor: `${color}0d` }
                  }
                >
                  <Icon className="h-3.5 w-3.5" style={{ color: active ? "#ffffff" : color }} />
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-1">
          <div className="mb-2 flex items-center justify-between text-[12px] font-semibold text-slate-600">
            <span>{categoryLabel} 예상 월 지출액</span>
            <span style={{ color: accent }}>{formatWon(amount)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={1000000}
            step={10000}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full"
            style={sliderStyle}
          />
          <div className="mt-2 flex gap-1.5">
            {QUICK_AMOUNTS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAmount(v)}
                className={`rounded-full px-2.5 py-1 text-[10.5px] font-semibold transition ${
                  amount === v ? "text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
                style={amount === v ? { backgroundColor: accent } : undefined}
              >
                {formatWon(v)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="glass-panel mt-5 rounded-2xl border border-[#e6ecf8] p-5">
        <div className="mb-4 flex items-center gap-2.5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${accent}1a`, color: accent }}
          >
            <CategoryIcon className="h-4 w-4" />
          </span>
          <div>
            <div className="text-[13.5px] font-bold text-[#14192f]">{categoryLabel} 추천 카드</div>
            <div className="text-[10.5px] text-slate-400">
              {results.length > 0
                ? `${results.length}장 · 월 ${formatWon(amount)} 지출 기준`
                : "조건에 맞는 카드가 없어요"}
            </div>
          </div>
        </div>

        {results.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 py-10 text-center text-[12px] text-slate-400">
            <CategoryIcon className="h-6 w-6" style={{ color: `${accent}99` }} />
            조건을 만족하는 카드가 없어요. 지출액을 조정하거나 범위를 바꿔보세요.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {results.map((ev, idx) => {
              const benefit = ev.breakdown.find((b) => b.category === category)?.benefitAmount ?? 0;
              const isBest = idx === 0;
              const widthPct = Math.max(6, Math.round((benefit / maxBenefit) * 100));
              const tileStyle = { "--tile-accent": accent } as CSSProperties;

              return (
                <button
                  key={ev.card.id}
                  type="button"
                  onClick={() => setSelectedEntry(findCatalogEntryByCardId(ev.card.id) ?? null)}
                  style={tileStyle}
                  className={`catalog-tile relative flex w-full items-center gap-3.5 overflow-hidden rounded-2xl border bg-white py-3.5 pl-6 pr-4 text-left transition ${
                    isBest ? "border-transparent" : "border-slate-200/80"
                  }`}
                >
                  {isBest && (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 rounded-2xl"
                      style={{ boxShadow: `inset 0 0 0 1.5px ${accent}66` }}
                    />
                  )}
                  <div
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 w-1.5"
                    style={{ background: `linear-gradient(180deg, ${accent} 0%, #1b1f3b 100%)` }}
                  />

                  {isBest ? (
                    <span
                      className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold text-white shadow-sm"
                      style={{ background: `linear-gradient(135deg, ${accent}, #1b1f3b)` }}
                      title={`현재 조건에서 ${categoryLabel} 혜택이 가장 큰 카드`}
                    >
                      <Crown className="h-3 w-3" />
                      BEST
                    </span>
                  ) : (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-400">
                      {idx + 1}
                    </span>
                  )}

                  <CardThumb imageUrl={ev.card.imageUrl} name={ev.card.name} size={52} />

                  <div className="min-w-0 flex-1">
                    {/* 카드명이 길면(예: "삼성카드 iD ON POINT") 한 줄 truncate로 잘려 보이던 문제 —
                        최대 두 줄까지는 그대로 보여주고, 그 이상만 줄임표 처리합니다. */}
                    <div className="line-clamp-2 text-[13.5px] font-bold leading-snug text-[#14192f]">
                      {ev.card.name}
                    </div>
                    <div className="mt-0.5 text-[10.5px] text-slate-400">
                      {ev.card.issuer} · 연회비 {formatWon(ev.card.annualFee)}
                    </div>
                    <div className="mt-1.5 h-1 w-full max-w-[140px] overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${widthPct}%`, backgroundColor: accent }}
                      />
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <div className="text-right text-[15px] font-extrabold" style={{ color: accent }}>
                      월 <Money amount={benefit} />
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <CardDetailModal
        entry={selectedEntry}
        onClose={() => setSelectedEntry(null)}
        inMyCards={selectedEntry ? myCards.has(selectedEntry.sourceId) : false}
        onToggleMyCards={(e) => myCards.toggle(e.sourceId)}
      />
    </div>
  );
}
