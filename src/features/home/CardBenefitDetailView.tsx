import { formatWon, formatRatePercent } from "@/shared/lib/format";
import { CardThumb } from "@/shared/components/CardThumb";
import { categoryColor, categoryIcon } from "@/shared/lib/categoryStyle";
import type { SpendCategory } from "@/domain/types/card";
import type { CardFitScore } from "@/domain/types/recommendation";

const REWARD_KIND_LABEL: Record<string, string> = {
  discount: "할인",
  point: "포인트 적립",
  cashback: "캐시백",
};

interface CardBenefitDetailViewProps {
  evaluation: CardFitScore;
  /** "내 카드 현황"에서 실적을 충족한 카드 전체 평가 목록 — 지갑 내 비중, 다른 카드 칩에 사용 */
  eligible: CardFitScore[];
  categories: SpendCategory[];
  onBack: () => void;
  onSelectCard: (cardId: string) => void;
}

/** "250,000원 전액 × 할인 5% = 12,500원" 같은 계산 과정 문장을 만든다. */
function describeBreakdownLine(
  evaluation: CardFitScore,
  line: CardFitScore["breakdown"][number],
): string {
  const tierIndex = evaluation.tierIndex ?? 0;
  const rule = evaluation.card.tiers[tierIndex]?.benefits.find((b) => b.category === line.category);
  if (!rule) {
    return `${formatWon(line.spend)} 지출이 혜택으로 반영됐어요.`;
  }
  const kindLabel = REWARD_KIND_LABEL[rule.type] ?? "혜택";
  const rawAmount = Math.round(line.spend * rule.rate);
  const base = `${formatWon(line.spend)} 전액 × ${kindLabel} ${formatRatePercent(rule.rate)} = ${formatWon(rawAmount)}`;
  if (line.capped) {
    return `${base}이지만, 월 한도 ${formatWon(rule.capPerMonth!)}까지만 인정돼요.`;
  }
  return rule.capPerMonth !== undefined ? `${base} (월 한도 ${formatWon(rule.capPerMonth)} 이내라 전액 인정)` : base;
}

export function CardBenefitDetailView({
  evaluation,
  eligible,
  categories,
  onBack,
  onSelectCard,
}: CardBenefitDetailViewProps) {
  const categoryLabel = (id: string) => categories.find((c) => c.id === id)?.label ?? id;
  const { card, tierIndex, breakdown, totalMonthlyBenefit } = evaluation;
  const tierCount = card.tiers.length;
  const walletTotal = eligible.reduce((sum, e) => sum + e.totalMonthlyBenefit, 0);
  const sharePercent = walletTotal > 0 ? Math.round((totalMonthlyBenefit / walletTotal) * 100) : null;
  const nextTier = tierIndex !== null ? card.tiers[tierIndex + 1] : card.tiers[0];
  const otherCards = eligible.filter((e) => e.card.id !== card.id);

  const sortedBreakdown = breakdown.slice().sort((a, b) => b.benefitAmount - a.benefitAmount);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between text-[12.5px] text-slate-400">
        <button type="button" onClick={onBack} className="font-semibold text-slate-500 hover:text-brand-blue">
          ← 내 지갑 보기
        </button>
        <span className="font-bold text-[#14192f]">{card.name}</span>
      </div>

      {/* 카드 히어로 + 구간 진행 */}
      <div className="glass-panel mb-4.5 flex flex-col gap-5 rounded-[22px] border border-[#e6ecf8] p-6 sm:flex-row sm:items-center">
        <div className="shrink-0">
          <CardThumb imageUrl={card.imageUrl} name={card.name} size={132} ratio={0.64} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-extrabold text-[#14192f]">{card.name}</p>
          <p className="mt-0.5 text-xs text-slate-400">
            {card.issuer} · 연회비 {formatWon(card.annualFee)}
          </p>
          {tierCount > 1 && (
            <div className="mt-3.5 flex items-center gap-2.5">
              <span className="shrink-0 text-[11.5px] font-bold text-slate-500">구간 진행</span>
              <div className="flex max-w-[420px] flex-1 gap-1">
                {Array.from({ length: tierCount }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-2 flex-1 rounded-full ${i <= (tierIndex ?? -1) ? "bg-brand-blue-deep" : "bg-slate-100"}`}
                  />
                ))}
              </div>
              <span className="shrink-0 text-[11.5px] font-bold text-[#14192f]">
                {(tierIndex ?? 0) + (tierIndex === null ? 0 : 1)}/{tierCount}구간
              </span>
            </div>
          )}
          {tierCount > 1 && nextTier && (
            <p className="mt-1.5 text-[11px] text-slate-400">
              다음 구간까지 <strong className="text-[#14192f]">{formatWon(nextTier.minSpend - evaluation.qualifyingSpend)}</strong> 더 쓰면,
              적립률이 한 단계 더 올라가요.
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-slate-400">이번 달 이 카드 혜택</p>
          <p className="mt-1.5 text-2xl font-extrabold text-[#14192f]">{formatWon(totalMonthlyBenefit)}</p>
          {sharePercent !== null && (
            <p className="mt-1 text-[11px] text-slate-400">
              실적 충족 카드 혜택의 <strong className="text-brand-blue">약 {sharePercent}%</strong>
            </p>
          )}
        </div>
      </div>

      {/* 카테고리별 배정 */}
      <p className="mb-2.5 text-xs font-bold text-slate-500">이 카드가 담당하는 카테고리</p>
      {sortedBreakdown.length === 0 ? (
        <div className="glass-panel rounded-2xl border border-[#e6ecf8] py-8 text-center text-[12px] text-slate-400">
          이번 지출 기준으로는 이 카드가 혜택을 주는 카테고리가 없어요.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sortedBreakdown.map((line) => {
            const Icon = categoryIcon(line.category);
            const color = categoryColor(line.category);
            return (
              <div
                key={line.category}
                className="glass-panel flex items-center gap-3.5 rounded-2xl border border-[#e6ecf8] p-3.5"
              >
                <span
                  className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-[10px] text-white"
                  style={{ backgroundColor: color }}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-[#14192f]">
                    {categoryLabel(line.category)}
                    {line.capped && (
                      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                        한도 도달
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
                    {describeBreakdownLine(evaluation, line)}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-600">
                  {formatWon(line.benefitAmount)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* 지갑 속 다른 카드 */}
      {otherCards.length > 0 && (
        <div className="mt-5">
          <p className="mb-2.5 text-xs font-bold text-slate-500">지갑 속 다른 카드</p>
          <div className="flex flex-wrap gap-2.5">
            {otherCards.map((e) => (
              <button
                key={e.card.id}
                type="button"
                onClick={() => onSelectCard(e.card.id)}
                className="glass-panel flex items-center gap-2.5 rounded-full border border-[#e2e5f2] py-1.5 pl-1.5 pr-4 transition hover:border-brand-blue/40"
              >
                <CardThumb imageUrl={e.card.imageUrl} name={e.card.name} size={30} />
                <span className="text-xs font-bold text-[#14192f]">{e.card.name}</span>
                <span className="text-[11px] text-slate-400">약 {formatWon(e.totalMonthlyBenefit)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
