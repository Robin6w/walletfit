import { useMemo, useState } from "react";
import { Info, ChevronDown } from "lucide-react";
import { formatWon } from "@/shared/lib/format";
import { categoryColor } from "@/shared/lib/categoryStyle";
import {
  ASSUMED_CARD_SPEND_RATIO,
  CARD_SPEND_RATIO_BASIS,
  CATEGORY_SPEND_SHARE,
  DISCOVERY_MAX_CARDS_CEILING,
  MIN_CARD_SPEND_RATIO,
  MAX_CARD_SPEND_RATIO,
  estimateSpendingFromIncome,
} from "@/domain/engine/incomeEstimate";
import { solveWalletWithMode } from "@/domain/engine/useWalletBlueprintAsync";
import type { OptimizationMode } from "@/domain/engine/walletOptimizer";
import type { SpendCategory, MonthlySpend, WalletCard } from "@/domain/types/card";

interface IncomeCardCountEstimatorProps {
  categories: SpendCategory[];
  /** 카드 수 추천 계산에 쓸 후보 카드 목록(현재 화면에서 이미 필터링/추린 후보를 그대로 씁니다). */
  candidates: WalletCard[];
  /** 이미 설정된 연회비 상한이 있으면 그대로 반영합니다(무제한이면 undefined). */
  maxAnnualFee?: number;
  /**
   * "혜택 최대화/효율적" 모드. 추천 카드 수 계산에도 그대로 반영해서, 메인 결과와 같은
   * 성향으로 카드 수를 추천합니다.
   */
  mode: OptimizationMode;
  /** "지출 채우기" 버튼을 눌렀을 때 추정 지출을 실제 지출 상태에 반영하는 콜백 */
  onApplySpending: (spending: MonthlySpend) => void;
  /** 추천받은 카드 수를 실제 maxCards 상태에 반영하는 콜백 */
  onApplyMaxCards: (count: number) => void;
}

type EstimateStatus = "idle" | "loading" | "done" | "error";

/**
 * 지출을 카테고리별로 직접 입력하기 번거로운 사용자를 위한 "소득으로 빠르게 시작하기" 패널.
 *
 * 동작 순서: (1) 월 소득을 입력하면 incomeEstimate.ts의 가정 비율로 카테고리별 지출을
 * 추정해서 채워주고, (2) 그 지출을 그대로 MILP에 한 번 통과시키되 maxCards를 넉넉하게
 * 열어줍니다(DISCOVERY_MAX_CARDS_CEILING). solver의 목적함수에는 이미 연회비·관리비용이
 * 들어있어서, 순혜택에 도움이 안 되는 카드는 자기가 알아서 담지 않습니다 — 그래서 이 "넉넉한
 * 상한" 아래에서 실제로 선택된 카드 수가 곧 이 지출 규모에 맞는 자연스러운 추천 카드 수가
 * 됩니다. 사용자는 이 숫자를 그대로 쓸지, 아래 카드 수 스테퍼에서 직접 더 조정할지 선택할 수
 * 있습니다.
 *
 * "카테고리별 지출과 따로 노는 느낌"을 줄이기 위해, 적용 전에 이 비율로 어떤 카테고리에
 * 얼마씩 채워질지 미리보기 칩으로 보여주고, 적용 버튼에도 "아래 지출 시뮬레이터로" 화살표를
 * 붙여 두 영역이 하나의 흐름이라는 걸 시각적으로 드러냅니다. 또한 "40%가 어디서 나온
 * 숫자인지" 바로 확인하고 직접 조정할 수 있게 근거 패널을 열어둡니다.
 */
export function IncomeCardCountEstimator({
  categories,
  candidates,
  maxAnnualFee,
  mode,
  onApplySpending,
  onApplyMaxCards,
}: IncomeCardCountEstimatorProps) {
  const [income, setIncome] = useState(0);
  const [cardSpendRatio, setCardSpendRatio] = useState(ASSUMED_CARD_SPEND_RATIO);
  const [showBasis, setShowBasis] = useState(false);
  const [status, setStatus] = useState<EstimateStatus>("idle");
  const [recommendedCount, setRecommendedCount] = useState<number | null>(null);
  const [recommendedBenefit, setRecommendedBenefit] = useState<number | null>(null);

  const hasIncome = income > 0;
  const ratioPercent = Math.round(cardSpendRatio * 100);
  const estimatedTotal = hasIncome ? Math.round(income * cardSpendRatio) : 0;

  const previewSpending = useMemo(
    () => (hasIncome ? estimateSpendingFromIncome(income, categories, cardSpendRatio) : null),
    [hasIncome, income, categories, cardSpendRatio],
  );

  const previewTopCategories = useMemo(() => {
    if (!previewSpending) return [];
    return categories
      .map((c) => ({ id: c.id, label: c.label, amount: previewSpending[c.id] ?? 0 }))
      .filter((c) => c.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4);
  }, [previewSpending, categories]);

  const handleEstimate = async () => {
    if (!hasIncome || candidates.length === 0) return;
    const estimatedSpending = estimateSpendingFromIncome(income, categories, cardSpendRatio);
    onApplySpending(estimatedSpending);
    setStatus("loading");
    setRecommendedCount(null);
    setRecommendedBenefit(null);
    try {
      const { blueprint: result } = await solveWalletWithMode(candidates, estimatedSpending, {
        maxCards: Math.min(DISCOVERY_MAX_CARDS_CEILING, candidates.length),
        mode,
        maxTotalAnnualFee: maxAnnualFee,
      });
      if (!result.feasible) {
        setStatus("error");
        return;
      }
      setRecommendedCount(result.selectedCards.length);
      setRecommendedBenefit(result.netMonthlyBenefit);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  return (
    <section className="rounded-2xl border border-[#e6ecf8] bg-brand-blue-deep/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900">소득으로 빠르게 시작하기</h3>
        <button
          type="button"
          onClick={() => setShowBasis((v) => !v)}
          className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10.5px] font-semibold text-brand-blue-deep shadow-sm transition hover:bg-slate-100"
        >
          <Info className="h-3 w-3" /> 이 비율({ratioPercent}%)은 어떻게 나왔나요?
        </button>
      </div>
      <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">
        지출을 카테고리별로 직접 입력하기 번거롭다면, 월 소득만 넣어도 대략적인 지출을 채워드려요.
        아래 카테고리별 지출 시뮬레이터에 그대로 반영되고, 적용한 뒤에도 언제든 값을 고쳐 쓸 수
        있어요.
      </p>

      {showBasis && (
        <div className="glass-panel mt-2.5 rounded-xl border border-[#e6ecf8] p-3.5 text-[11px] leading-relaxed text-slate-600">
          <p>
            <strong className="text-slate-800">기본값 {Math.round(ASSUMED_CARD_SPEND_RATIO * 100)}%</strong>는 두
            근사치를 곱한 값이에요: 소비성향 약{" "}
            <strong>{Math.round(CARD_SPEND_RATIO_BASIS.consumptionPropensity * 100)}%</strong>(소득 중 실제로
            소비에 쓰는 비중) × 카드결제비율 약{" "}
            <strong>{Math.round(CARD_SPEND_RATIO_BASIS.cardPaymentShare * 100)}%</strong>(소비 중 카드로 결제하는
            비중, 통계청 가계동향조사 등에서 흔히 보이는 수준). 사람마다 저축률·현금 사용 비중이 달라 이 값도
            달라지므로, 실측치가 아닌 출발점일 뿐입니다.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <span className="w-24 shrink-0 text-[10.5px] font-semibold text-slate-500">직접 조정</span>
            <input
              type="range"
              min={Math.round(MIN_CARD_SPEND_RATIO * 100)}
              max={Math.round(MAX_CARD_SPEND_RATIO * 100)}
              step={5}
              value={ratioPercent}
              aria-label="카드 지출 비중 직접 조정"
              onChange={(e) => setCardSpendRatio(Number(e.target.value) / 100)}
              className="flex-1 accent-brand-blue-deep"
            />
            <span className="w-10 shrink-0 text-right text-[11px] font-bold text-brand-blue-deep">
              {ratioPercent}%
            </span>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="number"
          min={0}
          step={100000}
          value={income || ""}
          onChange={(e) => setIncome(Math.max(0, Number(e.target.value) || 0))}
          placeholder="월 소득(세전, 원)"
          aria-label="월 소득 입력"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-blue-deep focus:ring-2 focus:ring-brand-blue-deep/20 sm:w-44"
        />
        <button
          type="button"
          onClick={handleEstimate}
          disabled={!hasIncome || candidates.length === 0 || status === "loading"}
          className="cta-btn brand-gradient flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
        >
          {status === "loading" ? "계산 중…" : "아래 지출에 채우고 카드 수 추천받기"}
          {status !== "loading" && <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {hasIncome && (
        <div className="mt-2.5">
          <p className="text-[11px] text-slate-400">
            추정 월 카드 지출 {formatWon(estimatedTotal)} (소득의 {ratioPercent}% 가정)
          </p>
          {previewTopCategories.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {previewTopCategories.map((c) => (
                <span
                  key={c.id}
                  className="rounded-full bg-white px-2.5 py-1 text-[10.5px] font-medium text-slate-600 shadow-sm"
                >
                  {c.label}{" "}
                  <span className="font-semibold" style={{ color: categoryColor(c.id) }}>
                    {formatWon(c.amount)}
                  </span>
                </span>
              ))}
              <span className="self-center text-[10px] text-slate-400">
                등 {Object.values(CATEGORY_SPEND_SHARE).filter((v) => v > 0).length}개 카테고리로 자동 배분돼요
              </span>
            </div>
          )}
        </div>
      )}

      {candidates.length === 0 && (
        <p className="mt-2 text-[11.5px] text-amber-600">
          먼저 이전 단계에서 카드를 담아야(또는 "전체 카드 중 추천"을 선택해야) 계산할 수 있어요.
        </p>
      )}

      {status === "error" && (
        <p className="mt-2 text-[11.5px] text-rose-600">계산에 실패했어요. 잠시 후 다시 시도해 주세요.</p>
      )}

      {status === "done" && recommendedCount !== null && (
        <div className="glass-panel mt-3 flex flex-wrap items-center gap-2.5 rounded-xl p-3 shadow-sm">
          {recommendedCount > 0 ? (
            <p className="text-[12.5px] text-slate-700">
              이 지출 규모라면 <span className="font-bold text-brand-blue-deep">{recommendedCount}장</span> 조합이
              가장 유리해요
              {recommendedBenefit !== null && ` (월 순혜택 ${formatWon(recommendedBenefit)})`}.
            </p>
          ) : (
            <p className="text-[12.5px] text-slate-700">
              이 지출 규모로는 연회비를 넘어서는 이득이 있는 카드가 없어요. 지출을 더 정확히
              입력해보시거나, 연회비가 없는 카드 위주로 찾아보는 걸 추천해요.
            </p>
          )}
          {recommendedCount > 0 && (
            <button
              type="button"
              onClick={() => onApplyMaxCards(recommendedCount)}
              className="cta-btn brand-gradient rounded-lg px-3 py-1.5 text-xs font-bold text-white"
            >
              이 카드 수로 설정
            </button>
          )}
        </div>
      )}
    </section>
  );
}
