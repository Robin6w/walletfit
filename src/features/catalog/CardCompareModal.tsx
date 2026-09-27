import { useEffect, useRef } from "react";
import type { CatalogListing } from "@/domain/types/catalog";
import { formatWon, formatRatePercent } from "@/shared/lib/format";
import { categories } from "@/domain/engine/loadCatalog";
import { cardBaselineBenefits } from "@/domain/engine/catalogCategoryIndex";

const categoryLabel = (id: string) => categories.find((c) => c.id === id)?.label ?? id;

interface CardCompareModalProps {
  entries: CatalogListing[];
  onClose: () => void;
}

export function CardCompareModal({ entries, onClose }: CardCompareModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (entries.length === 0) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [entries.length, onClose]);

  if (entries.length === 0) return null;

  // 비교 중인 카드 중 하나라도 혜택을 주는 카테고리만 모아서 비교 행으로 보여준다
  // (아무도 혜택을 안 주는 카테고리까지 늘어놓으면 표만 길어지고 의미가 없다).
  const relevantCategoryIds = categories
    .map((c) => c.id)
    .filter((categoryId) => entries.some((entry) => cardBaselineBenefits(entry.sourceId).some((b) => b.category === categoryId && b.rate > 0)));

  return (
    <dialog
      ref={dialogRef}
      open
      aria-modal="true"
      aria-label="카드 비교"
      className="fixed inset-0 z-50 m-0 flex h-full w-full max-h-none max-w-none items-center justify-center border-none bg-transparent p-4 animate-[fadeIn_0.15s_ease-out]"
    >
      <button
        type="button"
        aria-label="대화상자 닫기"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
        className="fixed inset-0 h-full w-full bg-slate-900/50 backdrop-blur-sm -z-10 cursor-default border-none"
      />
      <div className="glass-panel relative z-10 flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#e6ecf8] bg-white shadow-2xl animate-[popIn_0.18s_ease-out]">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-bold text-[#14192f]">카드 비교 ({entries.length}장)</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
          >
            ✕
          </button>
        </div>

        <div className="content-scroll overflow-y-auto p-6">
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: `140px repeat(${entries.length}, minmax(0, 1fr))` }}
          >
            <div />
            {entries.map((entry) => (
              <div key={entry.sourceId} className="flex flex-col items-center gap-2 text-center">
                <div className="flex h-16 w-24 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-slate-50 to-slate-100">
                  {entry.imageUrl ? (
                    <img src={entry.imageUrl} alt={entry.name} className="h-full w-auto object-contain" />
                  ) : (
                    <span className="text-[10px] text-slate-400">이미지 없음</span>
                  )}
                </div>
                <p className="text-xs font-bold leading-snug text-[#14192f]">{entry.name}</p>
                <p className="text-[10.5px] text-slate-400">{entry.issuer}</p>
              </div>
            ))}

            <div className="self-center text-xs font-semibold text-slate-500">카드 종류</div>
            {entries.map((entry) => (
              <div key={entry.sourceId} className="self-center text-center text-xs text-slate-700">
                {entry.category || "정보 없음"}
              </div>
            ))}

            <div className="self-center text-xs font-semibold text-slate-500">연회비</div>
            {entries.map((entry) => (
              <div key={entry.sourceId} className="self-center text-center text-xs font-semibold text-slate-800">
                {entry.annualFeeApprox && "약 "}
                {entry.annualFee !== undefined ? formatWon(entry.annualFee) : "정보 없음"}
              </div>
            ))}

            <div className="self-start pt-1 text-xs font-semibold text-slate-500">혜택 요약</div>
            {entries.map((entry) => (
              <div key={entry.sourceId} className="self-start text-center text-[11px] leading-relaxed text-slate-600">
                {entry.benefitSummary || "정보 없음"}
              </div>
            ))}

            {relevantCategoryIds.length > 0 && (
              <>
                <div className="col-span-full my-1 h-px bg-slate-100" />
                <div className="col-span-full text-xs font-semibold text-slate-500">카테고리별 기본 요율</div>
                {relevantCategoryIds.map((categoryId) => (
                  <div key={categoryId} className="contents">
                    <div className="self-center text-[11.5px] text-slate-500">{categoryLabel(categoryId)}</div>
                    {entries.map((entry) => {
                      const rule = cardBaselineBenefits(entry.sourceId).find((b) => b.category === categoryId);
                      return (
                        <div key={entry.sourceId} className="self-center text-center text-[11.5px] font-semibold">
                          {rule ? (
                            <span className="text-emerald-600">{formatRatePercent(rule.rate)}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </>
            )}
          </div>
          <p className="mt-5 text-[10.5px] leading-relaxed text-slate-400">
            카테고리별 요율은 전월실적을 채우지 못했을 때도 보장되는 가장 낮은 구간 기준입니다. 실제로는 지출
            규모에 따라 더 높은 구간 요율이 적용될 수 있어요.
          </p>
        </div>
      </div>
    </dialog>
  );
}
