import { formatWon } from "@/shared/lib/format";
import type { SpendCategory } from "@/domain/types/card";
import type { CardFitScore, CategoryTopPick } from "@/domain/types/recommendation";

interface RecommendationResultProps {
  ranked: CardFitScore[];
  categoryWinners: CategoryTopPick[];
  categories: SpendCategory[];
}

export function RecommendationResult({
  ranked,
  categoryWinners,
  categories,
}: RecommendationResultProps) {
  const eligible = ranked.filter((r) => r.meetsMinimum);
  const top = eligible[0] ?? null;
  const categoryLabel = (id: string) => categories.find((c) => c.id === id)?.label ?? id;
  const activeWinners = categoryWinners.filter((w) => w.bestCard);

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">추천 결과</h2>

      {top ? (
        <div className="mb-6 flex flex-col gap-1 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 p-5 text-white shadow-md">
          <p className="text-xs font-medium uppercase tracking-wide text-blue-100">
            최적의 카드 1장
          </p>
          <p className="text-xl font-bold">{top.card.name}</p>
          <p className="text-sm text-blue-100">
            월 순혜택 <span className="font-semibold text-white">{formatWon(top.netMonthlyBenefit)}</span>
          </p>
        </div>
      ) : (
        <div className="mb-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
          현재 지출 기준으로 전월실적을 충족하는 카드가 없습니다. 지출액을 조정해 보세요.
        </div>
      )}

      <h3 className="mb-3 text-sm font-semibold text-slate-700">카테고리별 최적 카드 조합</h3>
      {activeWinners.length === 0 ? (
        <p className="text-sm text-slate-400">추천할 수 있는 카테고리 조합이 없습니다.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {categoryWinners.map((winner) => (
            <div
              key={winner.category}
              className={`flex items-center justify-between rounded-xl border p-3 text-sm ${
                winner.bestCard
                  ? "border-slate-200 bg-white"
                  : "border-slate-100 bg-slate-50 text-slate-400"
              }`}
            >
              <div>
                <p className="text-xs text-slate-400">{categoryLabel(winner.category)}</p>
                <p className="font-medium text-slate-800">
                  {winner.bestCard ? winner.bestCard.name : "해당 없음"}
                </p>
              </div>
              {winner.bestCard && (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">
                  {formatWon(winner.benefitAmount)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
