import { useMemo, useState, type CSSProperties } from "react";
import type { CatalogListing } from "@/domain/types/catalog";
import { formatWon, formatRatePercent } from "@/shared/lib/format";
import { categories } from "@/domain/engine/loadCatalog";
import { cardBaselineBenefits } from "@/domain/engine/catalogCategoryIndex";
import { categoryColor, categoryIcon } from "@/shared/lib/categoryStyle";

interface CatalogCardTileProps {
  entry: CatalogListing;
  onSelect: (entry: CatalogListing) => void;
  inMyCards: boolean;
  onToggleMyCards: (entry: CatalogListing) => void;
  compareChecked?: boolean;
  onToggleCompare?: (entry: CatalogListing) => void;
  compareDisabled?: boolean;
}

export function CatalogCardTile({
  entry,
  onSelect,
  inMyCards,
  onToggleMyCards,
  compareChecked = false,
  onToggleCompare,
  compareDisabled = false,
}: CatalogCardTileProps) {
  const [imgError, setImgError] = useState(false);
  const showImage = entry.imageUrl && !imgError;

  // 실제 실적 없이도 보장되는 기본 요율(tiers[0]) 중 상위 2개만 "잘 맞는 카테고리"
  // 태그로 보여준다. 가공/추정 없이 카탈로그 원본 데이터에서 그대로 뽑은 값이다.
  const topBenefits = useMemo(() => {
    return cardBaselineBenefits(entry.sourceId)
      .filter((b) => b.rate > 0)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 2)
      .map((b) => ({
        ...b,
        label: categories.find((c) => c.id === b.category)?.label ?? b.category,
      }));
  }, [entry.sourceId]);

  const accent = topBenefits[0] ? categoryColor(topBenefits[0].category) : "#1b3fc4";
  const tileStyle = { "--tile-accent": accent } as CSSProperties;

  return (
    <div
      style={{ contentVisibility: "auto", containIntrinsicSize: "360px", ...tileStyle }}
      className="catalog-tile group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white text-left shadow-sm"
    >
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-0 z-10 w-1.5 rounded-l-2xl"
        style={{ background: `linear-gradient(180deg, ${accent} 0%, #1b1f3b 100%)` }}
      />

      <button
        type="button"
        aria-pressed={inMyCards}
        aria-label={inMyCards ? `${entry.name} 내 카드에서 제거` : `${entry.name} 내 카드에 추가`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleMyCards(entry);
        }}
        className={`absolute right-3 top-3 z-20 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full shadow-md backdrop-blur transition hover:scale-110 ${
          inMyCards
            ? "brand-gradient-select text-white"
            : "bg-white/95 text-slate-400 hover:text-brand-blue"
        }`}
      >
        {inMyCards ? (
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 3.5c-2-2.5-6-1.8-6 2 0 3 3.5 5.7 6 8 2.5-2.3 6-5 6-8 0-3.8-4-4.5-6-2Z" />
          </svg>
        ) : (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m-7-7h14" />
          </svg>
        )}
      </button>

      {onToggleCompare && (
        <label
          className={`absolute right-3 top-[3.4rem] z-20 flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-bold shadow-sm backdrop-blur transition ${
            compareChecked ? "bg-brand-blue text-white" : "bg-white/95 text-slate-500"
          } ${compareDisabled && !compareChecked ? "opacity-50" : ""}`}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={compareChecked}
            disabled={compareDisabled}
            onChange={() => onToggleCompare(entry)}
            aria-label={`${entry.name} 비교에 추가`}
            className="h-3 w-3 accent-white"
          />
          비교
        </label>
      )}

      <button
        type="button"
        onClick={() => onSelect(entry)}
        className="flex flex-1 flex-col text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
        aria-label={`${entry.name} 상세 정보 보기`}
      >
        <div
          className="relative flex aspect-[1.586/1] w-full items-center justify-center overflow-hidden p-5"
          style={{
            background: `linear-gradient(150deg, ${accent}55 0%, ${accent}1f 45%, #ffffff 100%)`,
          }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-40 blur-3xl transition-transform duration-300 group-hover:scale-125"
            style={{ background: accent }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-10 -left-8 h-24 w-24 rounded-full opacity-25 blur-2xl"
            style={{ background: "#1b1f3b" }}
          />

          {showImage ? (
            <img
              src={entry.imageUrl}
              alt={entry.name}
              loading="lazy"
              onError={() => setImgError(true)}
              className="relative h-full max-h-28 w-auto object-contain drop-shadow-xl transition-transform duration-300 ease-out group-hover:-rotate-2 group-hover:scale-110"
            />
          ) : (
            <div
              className="relative flex h-full max-h-28 w-[85%] flex-col justify-between overflow-hidden rounded-xl p-3.5 shadow-xl transition-transform duration-300 ease-out group-hover:-rotate-2 group-hover:scale-[1.05]"
              style={{ background: `linear-gradient(135deg, ${accent} 0%, #1b1f3b 130%)` }}
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-white/10"
              />
              <div className="h-4 w-6 rounded-[3px] bg-gradient-to-br from-yellow-100 to-yellow-400/80" />
              <p className="text-[13px] font-bold tracking-[0.15em] text-white/50">•••• •••• ••••</p>
              <p className="line-clamp-1 text-[11.5px] font-semibold tracking-tight text-white">
                {entry.name}
              </p>
            </div>
          )}

          {entry.category && (
            <span className="absolute left-4 top-3 rounded-full bg-white/95 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 shadow-sm backdrop-blur">
              {entry.category}
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2.5 p-4 pl-5 w-full">
          {topBenefits.length > 0 && (
            <div className="-mt-1 flex flex-wrap gap-1.5">
              {topBenefits.map((b) => {
                const Icon = categoryIcon(b.category);
                const color = categoryColor(b.category);
                return (
                  <span
                    key={b.category}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-bold text-white shadow-sm"
                    style={{ backgroundColor: color }}
                  >
                    <Icon className="h-3 w-3" />
                    {b.label} {formatRatePercent(b.rate)}
                  </span>
                );
              })}
            </div>
          )}

          <div>
            <p
              className="text-[11px] font-bold uppercase tracking-wide"
              style={{ color: accent }}
            >
              {entry.issuer || "카드사 미상"}
            </p>
            <h3 className="mt-0.5 line-clamp-2 text-[15px] font-bold leading-snug text-slate-900">
              {entry.name}
            </h3>
          </div>

          {entry.benefitSummary && (
            <p className="line-clamp-2 flex-1 text-xs leading-relaxed text-slate-500">
              {entry.benefitSummary}
            </p>
          )}

          <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-2.5">
            <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-slate-400 transition group-hover:text-brand-blue">
              자세히 보기
              <svg
                className="h-3 w-3 transition-transform group-hover:translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
            <span
              className="rounded-full px-3 py-1 text-[13px] font-extrabold"
              style={{ backgroundColor: `${accent}1a`, color: accent }}
              title={entry.annualFeeApprox ? "국내전용/해외겸용 등 여러 연회비 중 하나로 추정한 값입니다." : undefined}
            >
              {entry.annualFeeApprox && "약 "}
              {entry.annualFee !== undefined ? formatWon(entry.annualFee) : "정보 없음"}
            </span>
          </div>
        </div>
      </button>
    </div>
  );
}
