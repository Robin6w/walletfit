import { useMemo } from "react";
import { formatWon } from "@/shared/lib/format";
import { SpendingImporter } from "@/features/statement/SpendingImporter";
import { ErrorBoundary } from "@/shared/components/ErrorBoundary";
import { useMonthlySpend } from "@/domain/state/useMonthlySpend";
import { categories } from "@/domain/engine/loadCatalog";
import { categoryColor } from "@/shared/lib/categoryStyle";
import type { AppTab } from "@/App";

interface StatementAnalysisPageProps {
  onNavigate: (tab: AppTab) => void;
}

export function StatementAnalysisPage({ onNavigate }: StatementAnalysisPageProps) {
  const { spending, applyImportedItems } = useMonthlySpend(categories);

  const breakdown = useMemo(
    () =>
      categories
        .map((c) => ({ ...c, amount: spending[c.id] ?? 0 }))
        .filter((c) => c.amount > 0)
        .sort((a, b) => b.amount - a.amount),
    [spending],
  );
  const total = breakdown.reduce((sum, c) => sum + c.amount, 0);

  return (
    <div>
      <h1 className="text-xl font-extrabold text-[#14192f]">명세서로 소비 분석</h1>
      <p className="mb-6 mt-1 text-[12.5px] text-slate-500">
        카드사에서 받은 이용대금 명세서를 올리면 카테고리별 지출로 자동 분류해드려요
      </p>

      <ErrorBoundary
        fallbackTitle="지출 내역 가져오기 오류"
        fallbackMessage="지출 내역 가져오기 컴포넌트를 불러오는 중 오류가 발생했습니다. 다시 시도해 주세요."
      >
        <SpendingImporter categories={categories} onImport={applyImportedItems} />
      </ErrorBoundary>

      <div className="glass-panel mt-5 rounded-2xl border border-[#e6ecf8] p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[13px] font-bold text-[#14192f]">분석된 카테고리별 지출</div>
          <div className="text-[12px] font-semibold text-brand-blue">합계 {formatWon(total)}</div>
        </div>
        {breakdown.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-[12px] text-slate-400">
            아직 분석된 지출이 없어요. 위에서 명세서를 업로드해 보세요.
          </div>
        ) : (
          <div className="space-y-2.5">
            {breakdown.map((c) => (
              <div key={c.id} className="flex items-center gap-3">
                <div className="w-20 shrink-0 text-[12px] text-slate-500">{c.label}</div>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${total > 0 ? Math.round((c.amount / total) * 100) : 0}%`,
                      backgroundColor: categoryColor(c.id),
                    }}
                  />
                </div>
                <div className="w-24 shrink-0 text-right text-[12px] font-semibold text-[#14192f]">
                  {formatWon(c.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
        {breakdown.length > 0 && (
          <button
            type="button"
            onClick={() => onNavigate("wizard")}
            className="brand-gradient mt-5 w-full rounded-xl py-3 text-[12.5px] font-bold text-white"
          >
            이 지출로 카드 추천받기 →
          </button>
        )}
      </div>
    </div>
  );
}
