import { Fragment, useState, type CSSProperties } from "react";
import { ChevronDown, ChevronUp, Sparkles, Crown } from "lucide-react";
import { formatWon } from "@/shared/lib/format";
import { getCardAdvice, type CardAdviceMap } from "@/features/chatbot/cardAdvice";
import type { SpendCategory, CardKind } from "@/domain/types/card";
import type { CardFitScore } from "@/domain/types/recommendation";
import { ErrorBoundary } from "@/shared/components/ErrorBoundary";
import { CardThumb } from "@/shared/components/CardThumb";
import { Money } from "@/shared/components/Money";
import { categoryColor, categoryIcon } from "@/shared/lib/categoryStyle";

interface CardListProps {
  evaluations: CardFitScore[];
  cardTypes: CardKind[];
  categories: SpendCategory[];
  onToggleCardType: (type: CardKind) => void;
}

interface AiAdviceBoxProps {
  advice: string;
}

export function AiAdviceBox({ advice }: AiAdviceBoxProps) {
  return (
    <div className="mb-3 flex items-start gap-2 rounded-lg bg-brand-sky/30 px-3 py-2 text-xs text-brand-navy">
      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-blue" />
      <span>{advice}</span>
    </div>
  );
}

const CARD_TYPE_LABEL: Record<CardKind, string> = {
  credit: "신용카드",
  check: "체크카드",
};

/**
 * 이 카드가 "실제 지출 기준"으로 가장 많은 혜택을 벌어들이고 있는 카테고리 색상을
 * 구한다. 카탈로그의 잠재 요율이 아니라 breakdown(사용자가 입력한 실제 지출로
 * 계산된 혜택)을 기준으로 삼아서, "이 카드가 나한테 왜 좋은가"를 색으로 보여준다.
 */
function primaryAccent(evaluation: CardFitScore): string {
  const top = evaluation.breakdown.slice().sort((a, b) => b.benefitAmount - a.benefitAmount)[0];
  return top && top.benefitAmount > 0 ? categoryColor(top.category) : "#1b3fc4";
}

/**
 * 구간(tiers)이 2개 이상인 카드에 대해 "N/M구간" + 다음 구간까지 남은 금액 힌트를 만든다.
 * 구간이 하나뿐인 카드(카탈로그 대다수)는 null을 반환해서 기존 단순 충족/미충족 배지를
 * 그대로 쓰게 한다. tierIndex가 null이면(첫 구간 기준에도 못 미침) "0/M구간"으로 표시한다.
 */
function describeCardTier(evaluation: CardFitScore): {
  position: string;
  hint: string | null;
  ratio: number;
} | null {
  const { card, tierIndex, qualifyingSpend } = evaluation;
  if (card.tiers.length <= 1) return null;
  const currentIndex = tierIndex ?? -1;
  const position = `${currentIndex + 1}/${card.tiers.length}구간`;
  const nextTier = card.tiers[currentIndex + 1];
  const hint = nextTier
    ? `다음 구간까지 ${formatWon(Math.max(0, nextTier.minSpend - qualifyingSpend))}`
    : null;
  return { position, hint, ratio: (currentIndex + 1) / card.tiers.length };
}

export function CardList({ evaluations, cardTypes, categories, onToggleCardType }: CardListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [advice, setAdvice] = useState<CardAdviceMap>({});
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [adviceError, setAdviceError] = useState<string | null>(null);

  const categoryLabel = (id: string) => categories.find((c) => c.id === id)?.label ?? id;

  const handleGetAdvice = async () => {
    setAdviceLoading(true);
    setAdviceError(null);
    try {
      const result = await getCardAdvice(evaluations, categories);
      setAdvice(result);
    } catch (error) {
      setAdviceError(error instanceof Error ? error.message : "AI 조언을 불러오지 못했습니다.");
    } finally {
      setAdviceLoading(false);
    }
  };

  return (
    <section className="glass-panel rounded-2xl border border-slate-200/80 p-6 shadow-sm">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">보유 카드 비교</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {evaluations.length > 0
              ? `순혜택이 높은 순으로 ${evaluations.length}장을 정렬했어요`
              : "선택한 카드 유형에 해당하는 카드가 없어요"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="glass-panel flex gap-1 rounded-xl border border-slate-200/80 p-1">
            {(Object.keys(CARD_TYPE_LABEL) as CardKind[]).map((type) => {
              const active = cardTypes.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => onToggleCardType(type)}
                  aria-pressed={active}
                  className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ${
                    active ? "brand-gradient-select text-white shadow-sm" : "text-slate-400 hover:text-brand-blue"
                  }`}
                >
                  {CARD_TYPE_LABEL[type]}
                </button>
              );
            })}
          </div>
          <ErrorBoundary
            compact
            fallbackTitle="AI 조언 오류"
            fallbackMessage="AI 조언 기능을 불러오는 중 문제가 발생했습니다."
          >
            <button
              type="button"
              onClick={handleGetAdvice}
              disabled={adviceLoading || evaluations.length === 0}
              className="cta-btn brand-gradient flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {adviceLoading ? "AI 조언 생성 중..." : "AI 조언 받기"}
            </button>
          </ErrorBoundary>
        </div>
      </div>

      {adviceError && (
        <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{adviceError}</div>
      )}

      {evaluations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
          선택한 카드 유형에 해당하는 카드가 없습니다.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {evaluations.map((evaluation, i) => {
            const isBest = i === 0 && evaluation.meetsMinimum;
            const isExpanded = expandedId === evaluation.card.id;
            const cardAdvice = advice[evaluation.card.id];
            const accent = primaryAccent(evaluation);
            const tileStyle = { "--tile-accent": accent } as CSSProperties;
            const tierInfo = describeCardTier(evaluation);
            const maxBenefit = Math.max(1, ...evaluation.breakdown.map((b) => b.benefitAmount));

            return (
              <div
                key={evaluation.card.id}
                style={tileStyle}
                className={`catalog-tile relative overflow-hidden rounded-2xl border ${
                  isBest ? "border-transparent" : "border-slate-200/80"
                } bg-white`}
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

                <div className="flex flex-col gap-4 py-3.5 pl-6 pr-4 sm:flex-row sm:items-center">
                  <div className="flex shrink-0 items-center gap-3">
                    {isBest ? (
                      <span
                        className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold text-white shadow-sm"
                        style={{ background: `linear-gradient(135deg, ${accent}, #1b1f3b)` }}
                        title="현재 조건에서 순혜택이 가장 높은 카드"
                      >
                        <Crown className="h-3 w-3" />
                        BEST
                      </span>
                    ) : (
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-400">
                        {i + 1}
                      </span>
                    )}
                    <CardThumb imageUrl={evaluation.card.imageUrl} name={evaluation.card.name} size={40} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* 다른 목록들과 동일하게, 긴 카드명은 한 줄 truncate 대신 두 줄까지 보여줍니다. */}
                      <h3 className="line-clamp-2 text-[14.5px] font-bold leading-snug text-slate-900">
                        {evaluation.card.name}
                      </h3>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                        {CARD_TYPE_LABEL[evaluation.card.cardType]}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">{evaluation.card.issuer}</p>
                  </div>

                  <div className="grid shrink-0 grid-cols-3 gap-x-5 gap-y-1 text-right sm:flex sm:items-center sm:gap-6">
                    <div>
                      <p className="text-[10px] font-medium text-slate-400">연회비</p>
                      <p className="text-[13px] font-semibold text-slate-600">
                        {formatWon(evaluation.card.annualFee)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-slate-400">실적 충족</p>
                      {tierInfo ? (
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={`text-[12px] font-semibold ${
                              evaluation.meetsMinimum ? "text-emerald-600" : "text-rose-500"
                            }`}
                          >
                            {tierInfo.position}
                          </span>
                          <div className="h-1 w-12 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.round(tierInfo.ratio * 100)}%`,
                                background: evaluation.meetsMinimum ? "#10b981" : "#f43f5e",
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            evaluation.meetsMinimum
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {evaluation.meetsMinimum ? "충족" : "미충족"}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-slate-400">월 혜택액</p>
                      <p className="text-[13px] font-semibold text-slate-600">
                        {formatWon(evaluation.totalMonthlyBenefit)}
                      </p>
                    </div>
                    <div className="col-span-3 sm:col-span-1">
                      <p className="text-[10px] font-medium text-slate-400">순혜택(연회비 반영)</p>
                      <p className="text-[16px] font-extrabold" style={{ color: accent }}>
                        <Money amount={evaluation.netMonthlyBenefit} />
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : evaluation.card.id)}
                    aria-label={isExpanded ? "상세 접기" : "상세 펼치기"}
                    className={`flex h-8 w-8 shrink-0 items-center justify-center self-end rounded-full transition sm:self-center ${
                      isExpanded ? "bg-brand-blue text-white" : "bg-slate-100 text-slate-400 hover:text-brand-blue"
                    }`}
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-100 bg-[#f9fafd] px-6 py-4 pl-7">
                    {cardAdvice && (
                      <ErrorBoundary
                        compact
                        fallbackTitle="AI 조언 오류"
                        fallbackMessage="해당 카드의 AI 조언을 렌더링하는 중 오류가 발생했습니다."
                      >
                        <AiAdviceBox advice={cardAdvice} />
                      </ErrorBoundary>
                    )}
                    {evaluation.breakdown.length === 0 ? (
                      <p className="text-xs text-slate-400">
                        전월실적 조건을 충족하지 못해 현재 받는 카테고리별 혜택이 없습니다.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {evaluation.breakdown
                          .slice()
                          .sort((a, b) => b.benefitAmount - a.benefitAmount)
                          .map((item) => {
                            const color = categoryColor(item.category);
                            const Icon = categoryIcon(item.category);
                            const widthPct = Math.max(4, Math.round((item.benefitAmount / maxBenefit) * 100));
                            return (
                              <div key={item.category} className="flex items-center gap-3">
                                <span
                                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                                  style={{ backgroundColor: `${color}1a`, color }}
                                >
                                  <Icon className="h-3.5 w-3.5" />
                                </span>
                                <span className="w-20 shrink-0 text-xs font-medium text-slate-600">
                                  {categoryLabel(item.category)}
                                </span>
                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{ width: `${widthPct}%`, backgroundColor: color }}
                                  />
                                </div>
                                <span className="w-16 shrink-0 text-right text-xs text-slate-400">
                                  {formatWon(item.spend)}
                                </span>
                                <span className="w-20 shrink-0 text-right text-xs font-bold text-slate-900">
                                  {formatWon(item.benefitAmount)}
                                </span>
                                {item.capped ? (
                                  <span className="w-16 shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-center text-[10px] font-semibold text-amber-700">
                                    한도 초과
                                  </span>
                                ) : (
                                  <span className="w-16 shrink-0" />
                                )}
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
