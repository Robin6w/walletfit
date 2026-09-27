import { useState, type CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import { formatWon, formatRatePercent } from "@/shared/lib/format";
import { CardThumb } from "@/shared/components/CardThumb";
import { Money } from "@/shared/components/Money";
import { CardDetailModal } from "@/features/catalog/CardDetailModal";
import { findCatalogEntryByCardId } from "@/domain/engine/loadCatalog";
import { ANNUAL_FEE_CEILING_MAX, ANNUAL_FEE_CEILING_STEP, type OptimizationMode } from "@/domain/engine/walletOptimizer";
import { categoryColor, categoryIcon } from "@/shared/lib/categoryStyle";
import type { useSavedCards } from "@/domain/state/useSavedCards";
import type { SpendCategory } from "@/domain/types/card";
import type { CatalogListing } from "@/domain/types/catalog";
import type { CardFitScore } from "@/domain/types/recommendation";
import type { CardTierStatus, SlotAssignment, WalletBlueprint } from "@/domain/types/optimization";

const REWARD_KIND_LABEL: Record<string, string> = {
  discount: "할인",
  point: "포인트 적립",
  cashback: "캐시백",
};

/**
 * "이 카테고리 지출이 왜 이만큼의 혜택으로 이어졌는지"를 사람이 읽을 수 있는 문장으로 풀어준다.
 * 월 한도가 있는 카드는 한도까지만 배정되고 남은 지출은 다른 카드로 넘어갈 수 있어서
 * (assignment.spend는 이 카드가 맡은 몫일 뿐, 카테고리 전체 지출과 다를 수 있음),
 * 전액인지 일부인지도 함께 밝혀준다. 별도 AI 설명 없이도 지출액 × 혜택률 계산 과정을 그대로 보여줄 수 있다.
 *
 * tierIndex: 이 카드가 이번 조합에서 실제로 도달한 구간(cardTierStatus 기준, 없으면 0 =
 * tiers[0]). 다구간 카드에서 실제 적용된 요율을 보여주려면 무조건 tiers[0]이 아니라 이
 * 값으로 조회해야 한다.
 */
function describeAssignment(assignment: SlotAssignment, categoryTotalSpend: number, tierIndex: number): string {
  const isPartial = assignment.spend < categoryTotalSpend - 0.5;
  const spendLabel = isPartial
    ? `${formatWon(assignment.spend)} (카테고리 지출 ${formatWon(categoryTotalSpend)} 중 일부)`
    : `${formatWon(assignment.spend)} 전액`;

  const rule = assignment.card.tiers[tierIndex]?.benefits.find((b) => b.category === assignment.category);
  if (!rule) {
    return `이번 달 지출 ${spendLabel}이 이 카드로 배정됐어요.`;
  }

  const kindLabel = REWARD_KIND_LABEL[rule.type] ?? "혜택";
  const rawAmount = Math.round(assignment.spend * rule.rate);
  const isCapped = rule.capPerMonth !== undefined && rawAmount > rule.capPerMonth;
  const base = `이번 달 지출 ${spendLabel} × ${kindLabel} ${formatRatePercent(rule.rate)} = ${formatWon(rawAmount)}`;

  if (isCapped) {
    return `${base}이지만, 월 한도 ${formatWon(rule.capPerMonth!)}까지만 인정돼요${isPartial ? ". 남은 지출은 다른 카드로 넘어갔어요" : ""}.`;
  }
  return rule.capPerMonth !== undefined
    ? `${base} (월 한도 ${formatWon(rule.capPerMonth)} 이내라 전액 인정)`
    : base;
}

/**
 * 카드 한 장의 구간 도달 현황을 "3/4구간 · 다음 구간까지 12만원" 같은 짧은 문구로 요약한다.
 * 구간이 하나뿐이거나(cardTierStatus에 아예 없음) 아직 실적이 안 잡힌 카드는 null을 반환해서
 * 뱃지 자체를 숨긴다.
 */
function describeTierBadge(status: CardTierStatus | undefined): string | null {
  if (!status) return null;
  const position = `${status.tierIndex + 1}/${status.tierCount}구간`;
  if (status.tierLocked) return position;
  if (status.nextTierMinSpend === null) return `${position} (최고 구간)`;
  const remaining = Math.max(0, status.nextTierMinSpend - status.qualifyingSpend);
  return `${position} · 다음 구간까지 ${formatWon(remaining)}`;
}

interface WalletCombinationResultProps {
  result: WalletBlueprint;
  /** Worker(Pyodide/HiGHS)가 지금 새 조합을 계산 중인지. true여도 이전 result를 계속 보여주고, 계산 중임만 표시합니다. */
  isComputing?: boolean;
  /** Worker 초기화 또는 계산 자체가 실패했을 때의 에러 메시지 */
  error?: string | null;
  categories: SpendCategory[];
  maxCards: number;
  onMaxCardsChange: (value: number) => void;
  maxCardsUpperBound: number;
  /**
   * 효율적 모드에서 solveWalletWithMode가 돌려준 고정 상한(efficientRosterSize). 이 값을
   * 넘겨서 maxCards를 올려도 실제 조합에는 변화가 없다는 걸 사용자에게 설명하는 데 씁니다.
   * 혜택 최대화 모드거나 아직 계산 전이면 null.
   */
  efficientCeiling?: number | null;
  /** 지갑에 담긴 카드들의 연회비 합계 상한(원/년). ANNUAL_FEE_CEILING_MAX 이상이면 "제한 없음"으로 표시합니다. */
  maxAnnualFee: number;
  onMaxAnnualFeeChange: (value: number) => void;
  /** "혜택 최대화"(카드 수 제한 없이 순혜택 최대화) / "효율적"(관리 부담을 크게 반영해 카드 수를 줄임) */
  optimizationMode: OptimizationMode;
  onOptimizationModeChange: (mode: OptimizationMode) => void;
  /** 그리디(단일 카드) 최선 결과와 비교해서 조합이 실제로 더 나은지 보여주기 위한 평가 결과 */
  bestSingleCard: CardFitScore | null;
  myCards: ReturnType<typeof useSavedCards>;
}

/**
 * "카드 한 장 추천"이 아니라 "카드 K장 조합"을 MILP로 최적화한 결과를 보여주는 패널.
 * walletfit의 핵심 차별점(단일 카드 추천 서비스와의 차이)을 화면에서 바로 체감할 수 있게,
 * 그리디 방식(단일 카드 최선)과 조합 방식의 순혜택을 나란히 비교합니다.
 */
export function WalletCombinationResult({
  result,
  isComputing = false,
  error = null,
  categories,
  maxCards,
  onMaxCardsChange,
  maxCardsUpperBound,
  efficientCeiling = null,
  maxAnnualFee,
  onMaxAnnualFeeChange,
  optimizationMode,
  onOptimizationModeChange,
  bestSingleCard,
  myCards,
}: WalletCombinationResultProps) {
  const [selectedEntry, setSelectedEntry] = useState<CatalogListing | null>(null);
  const categoryLabel = (id: string) => categories.find((c) => c.id === id)?.label ?? id;
  const upperBound = Math.max(1, maxCardsUpperBound);
  const setClampedMaxCards = (next: number) => onMaxCardsChange(Math.min(upperBound, Math.max(1, next)));
  const setClampedMaxAnnualFee = (next: number) =>
    onMaxAnnualFeeChange(Math.min(ANNUAL_FEE_CEILING_MAX, Math.max(0, next)));
  const isFeeUnlimited = maxAnnualFee >= ANNUAL_FEE_CEILING_MAX;
  const isFeeCeilingActive = !isFeeUnlimited;

  const improvement =
    bestSingleCard !== null ? result.netMonthlyBenefit - bestSingleCard.netMonthlyBenefit : null;

  // 카드 한 장이 여러 카테고리를 맡을 수 있으므로, 카드별로 실제 받는 혜택 합계를 미리 집계해둔다.
  const cardBenefitTotals = new Map<string, number>();
  for (const assignment of result.assignments) {
    cardBenefitTotals.set(
      assignment.card.id,
      (cardBenefitTotals.get(assignment.card.id) ?? 0) + assignment.benefitAmount,
    );
  }

  // 한 카테고리가 여러 카드로 나뉘어 배정될 수 있으므로, 카테고리별로 묶어서 보여준다.
  const assignmentsByCategory = new Map<string, SlotAssignment[]>();
  for (const assignment of result.assignments) {
    const list = assignmentsByCategory.get(assignment.category) ?? [];
    list.push(assignment);
    assignmentsByCategory.set(assignment.category, list);
  }

  return (
    <section className="glass-panel rounded-2xl border border-[#e6ecf8] p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">추천 결과 — 최적 카드 조합</h2>
          <p className="mt-1 text-xs text-slate-500">
            카드 한 장이 아니라, 카테고리별로 다른 카드를 조합해서 썼을 때의 최적 지갑을 계산해요.
            혜택 최대화 모드는 순혜택 자체를 최대화하고, 효율적 모드는 그중 기여도가 낮은 카드를
            추려내서 확실히 이득이 큰 카드만 자동으로 골라 담아요.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex items-center gap-1 rounded-2xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => onOptimizationModeChange("maxBenefit")}
              className={`tap-press flex-1 rounded-xl px-3 py-1.5 text-xs font-bold transition sm:flex-initial ${
                optimizationMode === "maxBenefit" ? "brand-gradient-select text-white shadow-sm" : "text-slate-500"
              }`}
            >
              혜택 최대화
            </button>
            <button
              type="button"
              onClick={() => onOptimizationModeChange("efficient")}
              className={`tap-press flex-1 rounded-xl px-3 py-1.5 text-xs font-bold transition sm:flex-initial ${
                optimizationMode === "efficient" ? "brand-gradient-select text-white shadow-sm" : "text-slate-500"
              }`}
            >
              효율적
            </button>
          </div>

          <div className="brand-gradient-soft flex items-center justify-between gap-2.5 rounded-2xl px-3.5 py-2 shadow-sm sm:justify-start">
            <span className="text-xs font-bold text-white">최대 카드 수</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setClampedMaxCards(maxCards - 1)}
                disabled={maxCards <= 1}
                aria-label="카드 수 줄이기"
                className="tap-press flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-base font-bold leading-none text-white transition hover:bg-white/25 disabled:opacity-30"
              >
                −
              </button>
              <span className="w-6 text-center text-base font-extrabold text-white">{maxCards}</span>
              <button
                type="button"
                onClick={() => setClampedMaxCards(maxCards + 1)}
                disabled={maxCards >= upperBound}
                aria-label="카드 수 늘리기"
                className="tap-press flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-base font-bold leading-none text-white transition hover:bg-white/25 disabled:opacity-30"
              >
                +
              </button>
            </div>
            <span className="text-[11px] font-medium text-white/75">장까지</span>
          </div>

          <div className="brand-gradient-soft flex items-center justify-between gap-2.5 rounded-2xl px-3.5 py-2 shadow-sm sm:justify-start">
            <span className="text-xs font-bold text-white">연회비 상한</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setClampedMaxAnnualFee(maxAnnualFee - ANNUAL_FEE_CEILING_STEP)}
                disabled={maxAnnualFee <= 0}
                aria-label="연회비 상한 낮추기"
                className="tap-press flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-base font-bold leading-none text-white transition hover:bg-white/25 disabled:opacity-30"
              >
                −
              </button>
              <span className="min-w-[64px] text-center text-sm font-extrabold text-white">
                {isFeeUnlimited ? "제한 없음" : `${formatWon(maxAnnualFee)}/년`}
              </span>
              <button
                type="button"
                onClick={() => setClampedMaxAnnualFee(maxAnnualFee + ANNUAL_FEE_CEILING_STEP)}
                disabled={isFeeUnlimited}
                aria-label="연회비 상한 높이기"
                className="tap-press flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-base font-bold leading-none text-white transition hover:bg-white/25 disabled:opacity-30"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-600">
          계산 엔진을 불러오는 데 문제가 생겼어요: {error}
        </p>
      ) : (
        isComputing && (
          <p className="mt-4 flex items-center gap-1.5 text-[11.5px] font-medium text-brand-blue">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-blue" />
            최적 조합을 다시 계산하고 있어요…
          </p>
        )
      )}

      {!result.feasible ? (
        <p className="mt-4 text-sm text-slate-500">최적화에 사용할 카드나 지출 내역이 없습니다.</p>
      ) : result.selectedCards.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          현재 지출 기준으로는 담을 카드가 없습니다. 지출 규모에 비해 연회비를 넘어서는 이득을 주는 카드가
          아직 없는 상태예요. 지출액, 카드 수, 연회비 상한을 조정해 보세요.
        </p>
      ) : (
        <>
          {/* 2026-09 UI 고도화: 리파인드 글래스 타일 + 순혜택 타일만 그라데이션으로 강조 */}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="glass-tile-flat rounded-2xl border border-[#e6ecf8] p-4">
              <p className="text-xs text-slate-400">월 총 혜택</p>
              <p className="mt-1 text-base font-bold text-slate-900">
                <Money amount={result.totalMonthlyBenefit} />
              </p>
            </div>
            <div className="glass-tile-flat rounded-2xl border border-[#e6ecf8] p-4">
              <p className="text-xs text-slate-400">월 환산 연회비 합계</p>
              <p className="mt-1 text-base font-bold text-slate-900">
                <Money amount={result.totalMonthlyFee} />
              </p>
            </div>
            <div className="brand-gradient animate-[popIn_0.4s_ease-out] rounded-2xl p-4 text-white shadow-[0_14px_32px_rgba(27,63,196,0.4),0_5px_16px_rgba(107,70,193,0.28)]">
              <p className="text-xs text-white/75">조합 순혜택</p>
              <p className="mt-1 text-2xl font-extrabold leading-none tracking-tight">
                <Money amount={result.netMonthlyBenefit} />
              </p>
              <p className="mt-1.5 text-[11px] font-semibold text-white/75">
                연간 약 {formatWon(result.netMonthlyBenefit * 12)}
              </p>
            </div>
          </div>

          {bestSingleCard && (
            // 좁은 화면(모바일)에서 세 구획이 한 줄에 억지로 눌려 카드 이미지·글자가 잘리던 문제 —
            // sm 미만에서는 세로로 쌓이게 하고, 화살표도 그에 맞춰 아래쪽을 가리키게 돌립니다.
            <div className="glass-tile-flat mt-4 flex flex-col items-stretch gap-3 overflow-hidden rounded-2xl border border-[#e6ecf8] p-4 sm:flex-row sm:gap-0">
              <div className="flex flex-1 flex-col items-center gap-2 text-center">
                <span className="text-[11.5px] font-bold text-slate-400">지금처럼 카드 1장만 쓴다면</span>
                <CardThumb imageUrl={bestSingleCard.card.imageUrl} name={bestSingleCard.card.name} size={72} />
                <span className="text-lg font-extrabold text-slate-500">
                  <Money amount={Math.max(0, bestSingleCard.netMonthlyBenefit)} />
                </span>
                <span className="text-[10.5px] text-slate-400">단일 카드 최선 · 월 순혜택</span>
              </div>

              <div className="flex shrink-0 flex-row items-center justify-center gap-1.5 py-1 sm:flex-col sm:px-5 sm:py-0">
                <ArrowRight className="h-5 w-5 rotate-90 text-brand-blue sm:rotate-0" />
                {improvement !== null && (
                  <span
                    className={`whitespace-nowrap rounded-full px-3 py-1 text-[12.5px] font-extrabold ${
                      improvement > 0 ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {improvement > 0 ? `+${formatWon(improvement)} 더 유리` : `${formatWon(improvement)} 차이`}
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col items-center gap-2 rounded-xl bg-brand-blue-deep/5 p-2 text-center">
                <span className="text-[11.5px] font-bold text-[#14192f]">walletfit 조합으로 쓴다면</span>
                <div className="flex items-center justify-center">
                  {result.selectedCards.slice(0, 3).map((card, i) => (
                    <div
                      key={card.id}
                      className="-ml-3.5 rounded-[7px] ring-2 ring-white first:ml-0"
                      style={{ zIndex: 3 - i }}
                    >
                      <CardThumb imageUrl={card.imageUrl} name={card.name} size={56} fit="cover" />
                    </div>
                  ))}
                </div>
                <span className="text-lg font-extrabold text-brand-blue-deep">
                  <Money amount={result.netMonthlyBenefit} />
                </span>
                <span className="text-[10.5px] text-slate-500">
                  카드 {result.selectedCards.length}장 조합 · 월 순혜택
                </span>
              </div>
            </div>
          )}

          <div className="mt-4 rounded-xl bg-brand-blue-deep/5 p-3.5 text-[11.5px] leading-relaxed text-slate-600">
            <p>
              <span className="font-semibold text-brand-blue-deep">이렇게 계산돼요.</span> 카테고리 지출을 무조건
              카드 한 장에 몰아주지 않고, 월 한도가 있는 카드는 한도까지만 채운 다음 남는 지출은 다음으로
              유리한 카드로 넘기는 방식으로 배정해요. 그래서 카테고리 하나가 여러 카드로 나뉘어 배정될 수
              있어요.
            </p>
            <p className="mt-1.5">
              {optimizationMode === "efficient"
                ? "지금은 효율적 모드라, 일단 순혜택이 가장 큰 조합을 계산한 다음 그중 기여도가 가장 큰 카드 대비 벌어주는 몫이 작은 카드는 추려내서, 확실히 이득이 큰 카드만 남겨요."
                : "지금은 혜택 최대화 모드라, 연회비를 넘어서는 이득이 조금이라도 있으면 카드를 더 담아서 순혜택 자체를 최대화해요."}{" "}
              두 모드가 결국 같은 카드 조합을 고른다면 화면에 보이는 혜택 숫자도 항상 똑같아요.
              {optimizationMode === "efficient" && efficientCeiling !== null && (
                <>
                  {" "}지금 지출 규모에서는 최대{" "}
                  <span className="font-semibold text-brand-blue-deep">{efficientCeiling}장</span>까지가 확실히
                  이득이라서, "최대 카드 수"를 이보다 더 올려도 조합은 그대로예요.
                </>
              )}
              {isFeeCeilingActive && (
                <>
                  {" "}지금은 연회비 상한을 연{" "}
                  <span className="font-semibold text-brand-blue-deep">{formatWon(maxAnnualFee)}</span>으로
                  설정해뒀어요. 이 금액을 넘는 카드 조합은 처음부터 후보에서 빠져요.
                </>
              )}
            </p>
            <p className="mt-1.5 text-slate-500">각 배정의 계산 과정은 아래 카테고리별 목록에서 확인할 수 있어요.</p>
          </div>

          <p className="mt-5 text-xs font-semibold text-slate-500">이 조합에 담긴 카드</p>
          <div className="mt-2.5 flex gap-4 overflow-x-auto pb-1.5">
            {result.selectedCards.map((card) => {
              const cardBenefit = cardBenefitTotals.get(card.id) ?? 0;
              const tierBadge = describeTierBadge(result.cardTierStatus[card.id]);
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setSelectedEntry(findCatalogEntryByCardId(card.id) ?? null)}
                  className="glass-panel flex w-[136px] shrink-0 flex-col items-center gap-2 rounded-2xl p-3 text-center shadow-sm ring-1 ring-slate-200/70 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-brand-blue-deep/50"
                >
                  <CardThumb imageUrl={card.imageUrl} name={card.name} size={104} />
                  <span className="text-xs font-bold leading-snug text-[#14192f]">{card.name}</span>
                  <span className="text-[10.5px] text-slate-400">{card.issuer}</span>
                  {cardBenefit > 0 && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-600">
                      월 {formatWon(cardBenefit)} 혜택
                    </span>
                  )}
                  {tierBadge && (
                    <span className="rounded-full bg-brand-navy/10 px-2 py-0.5 text-[10px] font-semibold text-brand-navy">
                      {tierBadge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* 2026-09 UI 고도화 (수정): 처음엔 벤토 그리드(bento-span-2/4)로 폭을 다르게 줬는데,
              1장 배정 카드 옆에 3장으로 분할된 카드가 나란히 놓이면 그리드가 짧은 카드를
              긴 카드 높이만큼 늘려서(align-items: stretch 기본값) 텅 빈 유리 패널만 남는
              버그가 실제로 나서, 폭 대신 컬럼 매스너리로 바꿨다 — 카드마다 자기 내용만큼만
              높이를 쓰고, 왼쪽 색 스트라이프로 카테고리를 더 강하게 드러낸다. */}
          <div className="mt-4 masonry-cols">
            {Array.from(assignmentsByCategory.entries()).map(([category, categoryAssignments]) => {
              const categoryTotalSpend = categoryAssignments.reduce((sum, a) => sum + a.spend, 0);
              const categoryTotalBenefit = categoryAssignments.reduce((sum, a) => sum + a.benefitAmount, 0);
              const isSplit = categoryAssignments.length > 1;
              const Icon = categoryIcon(category);
              const color = categoryColor(category);
              const tileStyle = { "--tile-accent": color } as CSSProperties;
              return (
                <div
                  key={category}
                  style={tileStyle}
                  className="category-tile glass-panel relative overflow-hidden rounded-2xl border border-slate-200 p-3.5 pl-4"
                >
                  <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: color }} />
                  <div className="flex items-center justify-between gap-3">
                    <p className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] text-white"
                        style={{ backgroundColor: color }}
                      >
                        <Icon className="h-3 w-3" />
                      </span>
                      {categoryLabel(category)}
                      {isSplit && (
                        <span
                          className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                          style={{ backgroundColor: `${color}22`, color }}
                        >
                          {categoryAssignments.length}장으로 분할
                        </span>
                      )}
                    </p>
                    <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">
                      월 {formatWon(categoryTotalBenefit)}
                    </span>
                  </div>
                  <div className="mt-2.5 flex flex-col gap-2">
                    {categoryAssignments.map((assignment) => (
                      <button
                        key={assignment.card.id}
                        type="button"
                        onClick={() => setSelectedEntry(findCatalogEntryByCardId(assignment.card.id) ?? null)}
                        className="flex flex-col gap-1.5 rounded-lg bg-slate-50 p-2.5 text-left text-sm transition hover:bg-slate-100"
                      >
                        <div className="flex items-center gap-2.5">
                          <CardThumb imageUrl={assignment.card.imageUrl} name={assignment.card.name} size={40} />
                          <div className="min-w-0 flex-1">
                            {/* 긴 카드명이 한 줄 truncate로 잘려 보이던 문제 — 두 줄까지 허용 */}
                            <p className="line-clamp-2 font-medium leading-snug text-slate-800">
                              {assignment.card.name}
                            </p>
                            <p className="text-[11px] text-slate-400">{formatWon(assignment.spend)} 결제</p>
                          </div>
                          <span className="shrink-0 text-xs font-semibold text-emerald-600">
                            {formatWon(assignment.benefitAmount)}
                          </span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-slate-500">
                          {describeAssignment(
                            assignment,
                            categoryTotalSpend,
                            result.cardTierStatus[assignment.card.id]?.tierIndex ?? 0,
                          )}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <CardDetailModal
        entry={selectedEntry}
        onClose={() => setSelectedEntry(null)}
        inMyCards={selectedEntry ? myCards.has(selectedEntry.sourceId) : false}
        onToggleMyCards={(e) => myCards.toggle(e.sourceId)}
      />
    </section>
  );
}
