import { useMemo, useState, type CSSProperties } from "react";
import { LayoutGrid, Receipt, Tag, Sparkles, AlertTriangle, ArrowRight, Wallet, ChevronRight, Crown } from "lucide-react";
import { formatWon } from "@/shared/lib/format";
import { CardThumb } from "@/shared/components/CardThumb";
import { Money } from "@/shared/components/Money";
import { rankByNetReward } from "@/domain/engine/recommender";
import { catalogCards } from "@/domain/engine/loadCatalog";
import { toWalletCard } from "@/domain/engine/cardConverter";
import { categoryColor, categoryIcon } from "@/shared/lib/categoryStyle";
import type { useSavedCards } from "@/domain/state/useSavedCards";
import type { SpendCategory } from "@/domain/types/card";
import type { CardFitScore } from "@/domain/types/recommendation";
import { useMonthlySpend } from "@/domain/state/useMonthlySpend";
import type { AppTab } from "@/App";
import { CardBenefitDetailView } from "@/features/home/CardBenefitDetailView";
import { WalletQuickEditView } from "@/features/wallet/WalletQuickEditView";

interface HomePageProps {
  myCards: ReturnType<typeof useSavedCards>;
  categories: SpendCategory[];
  onNavigate: (tab: AppTab) => void;
}

const SHORTCUTS: { id: AppTab; icon: typeof LayoutGrid; title: string; desc: string }[] = [
  {
    id: "gallery",
    icon: LayoutGrid,
    title: "전체 카드 보기",
    desc: "국내 카드를 조건별로 검색하고 비교해보세요",
  },
  {
    id: "statement",
    icon: Receipt,
    title: "명세서로 소비 분석",
    desc: "카드 명세서나 영수증을 올리면 자동으로 지출을 분석해요",
  },
  {
    id: "benefit",
    icon: Tag,
    title: "혜택별 카드 추천",
    desc: "카페, 외식 등 카테고리 하나만 골라도 바로 추천받아요",
  },
];

/**
 * 이 카드가 실제 지출 기준으로 가장 많은 혜택을 벌어들이는 카테고리 색상을 구한다.
 * CardList/BenefitRecommendPage에서 쓰는 것과 같은 방식으로, "이 카드가 왜 좋은가"를
 * 색으로 보여준다.
 */
function topCategoryAccent(evaluation: CardFitScore): string {
  const top = evaluation.breakdown.slice().sort((a, b) => b.benefitAmount - a.benefitAmount)[0];
  return top && top.benefitAmount > 0 ? categoryColor(top.category) : "#1b3fc4";
}

export function HomePage({ myCards, categories, onNavigate }: HomePageProps) {
  const { spending } = useMonthlySpend(categories);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [quickEditOpen, setQuickEditOpen] = useState(false);

  const myCardObjects = useMemo(() => {
    const idSet = new Set(myCards.ids);
    return catalogCards.filter((c) => idSet.has(c.sourceId)).map(toWalletCard);
  }, [myCards.ids]);

  const ranked = useMemo(() => rankByNetReward(myCardObjects, spending), [myCardObjects, spending]);
  const eligible = ranked.filter((r) => r.meetsMinimum);
  const top = eligible[0] ?? null;
  const runnerUpGap =
    eligible.length > 1 ? Math.max(0, eligible[0].netMonthlyBenefit - eligible[1].netMonthlyBenefit) : 0;

  const totalMonthlySpend = useMemo(
    () => Object.values(spending).reduce((sum, value) => sum + (value || 0), 0),
    [spending],
  );

  const benefitRateLabel = useMemo(() => {
    if (!top || totalMonthlySpend <= 0) return null;
    const rate = (top.netMonthlyBenefit / totalMonthlySpend) * 100;
    return `${rate >= 0 ? rate.toFixed(1) : "0.0"}%`;
  }, [top, totalMonthlySpend]);

  const topCategories = useMemo(() => {
    return categories
      .map((category) => ({ ...category, spend: spending[category.id] || 0 }))
      .filter((c) => c.spend > 0)
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 5);
  }, [categories, spending]);

  const maxCategorySpend = topCategories[0]?.spend ?? 1;
  const topRecommended = eligible.slice(0, 3);
  const maxRecommendedBenefit = topRecommended[0]?.netMonthlyBenefit ?? 1;

  const selectedEvaluation = selectedCardId ? ranked.find((r) => r.card.id === selectedCardId) ?? null : null;

  if (quickEditOpen) {
    return (
      <WalletQuickEditView
        myCards={myCards}
        categories={categories}
        spending={spending}
        onBack={() => setQuickEditOpen(false)}
        onEditSpending={() => onNavigate("wizard")}
      />
    );
  }

  if (selectedEvaluation) {
    return (
      <CardBenefitDetailView
        evaluation={selectedEvaluation}
        eligible={eligible}
        categories={categories}
        onBack={() => setSelectedCardId(null)}
        onSelectCard={(cardId) => setSelectedCardId(cardId)}
      />
    );
  }

  return (
    <div>
      <h1 className="text-xl font-extrabold text-[#14192f]">내 지갑 한눈에 보기</h1>
      <p className="mb-6 mt-1 text-[12.5px] text-slate-500">
        등록한 카드와 추천 결과를 한 화면에서 확인해요
      </p>

      {/* 이번 달 예상 순혜택 히어로 배너 — 파랑+보라 두 톤이 번지는 글로우로 화면 진입 시
          시선이 바로 여기로 오게 강조한다. */}
      <div className="brand-gradient mb-3.5 animate-[popIn_0.4s_ease-out] overflow-hidden rounded-[22px] p-5.5 text-white shadow-[0_18px_40px_rgba(27,63,196,0.4),0_6px_18px_rgba(107,70,193,0.3)]">
        {top ? (
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-white/80">
                <Sparkles className="h-3.5 w-3.5" /> 이번 달 예상 순혜택
              </div>
              <div className="mt-1.5 text-[28px] font-extrabold leading-none">
                <Money amount={Math.max(0, top.netMonthlyBenefit)} />
              </div>
              <div className="mt-2 text-[12px] text-white/85">
                지금은 <span className="font-bold">{top.card.name}</span>가 가장 유리해요
                {runnerUpGap > 0 && <> · 2순위와 {formatWon(runnerUpGap)} 차이</>}
              </div>
            </div>
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-white/10 p-3">
              <div className="rounded-md bg-white/90 p-1">
                <CardThumb imageUrl={top.card.imageUrl} name={top.card.name} size={56} />
              </div>
              {benefitRateLabel && (
                <div className="text-center text-[10px] leading-tight text-white/80">
                  지출 대비
                  <br />
                  <span className="text-xs font-bold text-white">{benefitRateLabel}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-white/80">
                <Sparkles className="h-3.5 w-3.5" /> 아직 계산된 혜택이 없어요
              </div>
              <div className="mt-1.5 text-[15px] font-bold leading-relaxed">
                내 지갑 만들기에서 지출을 입력하면
                <br />
                예상 순혜택을 바로 보여드려요
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("wizard")}
              className="flex shrink-0 items-center gap-1 rounded-xl bg-white px-4 py-2 text-[12px] font-bold text-brand-blue-deep transition hover:bg-white/90"
            >
              시작하기 <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* 보조 지표 3종 + 카테고리 TOP5 / 추천 카드 TOP3 — 정보량에 따라 타일 크기가 달라지는
          벤토 그리드로 묶는다. 1행은 균등한 정사각 타일 3개(마지막 한 칸은 값이 길어질 수
          있는 "2순위 카드와의 차이"라 2칸을 준다), 2행은 목록이 있는 두 패널을 각각 2칸씩. */}
      <div className="mb-6.5 bento-grid">
        <div className="glass-panel rounded-2xl border border-[#e6ecf8] p-4.5">
          <div className="mb-1.5 text-[11px] text-slate-400">등록된 카드</div>
          <div className="text-lg font-extrabold text-[#14192f]">{myCards.ids.length}장</div>
        </div>
        <div className="glass-panel rounded-2xl border border-[#e6ecf8] p-4.5">
          <div className="mb-1.5 text-[11px] text-slate-400">지출 대비 혜택률</div>
          <div className="text-lg font-extrabold text-[#14192f]">{benefitRateLabel ?? "-"}</div>
        </div>
        <div className="bento-span-2 glass-panel rounded-2xl border border-[#e6ecf8] p-4.5">
          <div className="mb-1.5 text-[11px] text-slate-400">2순위 카드와의 차이</div>
          <div className="text-lg font-extrabold text-[#14192f]">{formatWon(runnerUpGap)}</div>
        </div>

        <div className="bento-span-2 glass-panel rounded-2xl border border-[#e6ecf8] p-5">
          <div className="mb-3.5 text-[13px] font-bold text-[#14192f]">카테고리별 지출 TOP5</div>
          {topCategories.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-[12px] text-slate-400">
              아직 입력된 지출이 없어요
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {topCategories.map((c) => {
                const color = categoryColor(c.id);
                const Icon = categoryIcon(c.id);
                return (
                  <div key={c.id} className="flex items-center gap-2.5">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${color}1a`, color }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="w-14 shrink-0 truncate text-[11px] text-slate-500">{c.label}</div>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.max(4, (c.spend / maxCategorySpend) * 100)}%`, backgroundColor: color }}
                      />
                    </div>
                    <div className="w-20 shrink-0 text-right text-[11px] font-semibold text-slate-600">
                      {formatWon(c.spend)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bento-span-2 glass-panel rounded-2xl border border-[#e6ecf8] p-5">
          <div className="mb-3.5 flex items-center justify-between text-[13px] font-bold text-[#14192f]">
            추천 카드 TOP3
            <button
              type="button"
              onClick={() => onNavigate("wizard")}
              className="flex items-center gap-0.5 text-[11px] font-bold text-brand-blue"
            >
              전체 보기 <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          {topRecommended.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-[12px] text-slate-400">
              실적 조건을 충족하는 카드가 아직 없어요
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {topRecommended.map((r, i) => {
                const accent = topCategoryAccent(r);
                return (
                  <button
                    key={r.card.id}
                    type="button"
                    onClick={() => setSelectedCardId(r.card.id)}
                    className="flex w-full items-center gap-3 rounded-lg text-left transition hover:bg-brand-sky/10"
                  >
                    {i === 0 ? (
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white"
                        style={{ backgroundColor: accent }}
                      >
                        <Crown className="h-3 w-3" />
                      </span>
                    ) : (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                        {i + 1}
                      </span>
                    )}
                    <div className="w-20 shrink-0 truncate text-[11.5px] font-medium text-slate-700">
                      {r.card.name}
                    </div>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(4, (r.netMonthlyBenefit / maxRecommendedBenefit) * 100)}%`,
                          backgroundColor: accent,
                        }}
                      />
                    </div>
                    <div className="w-16 shrink-0 text-right text-[11px] font-semibold text-slate-600">
                      {formatWon(r.netMonthlyBenefit)}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="mb-2.5 text-[13px] font-bold text-slate-600">무엇을 도와드릴까요</div>
      <div className="mb-6.5 grid grid-cols-3 gap-3.5">
        {SHORTCUTS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onNavigate(s.id)}
            className="tap-press glass-panel rounded-2xl border border-[#e6ecf8] p-4.5 text-left transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="brand-gradient-soft mb-3 flex h-8.5 w-8.5 items-center justify-center rounded-[10px] text-white">
              <s.icon className="h-4 w-4" />
            </div>
            <div className="mb-1 text-[13.5px] font-bold text-[#14192f]">{s.title}</div>
            <div className="text-[11px] leading-relaxed text-slate-400">{s.desc}</div>
          </button>
        ))}
      </div>

      {/* 내 카드 현황: 실적 충족 여부와 순혜택을 한 번에 확인 */}
      <div className="glass-panel rounded-2xl border border-[#e6ecf8] p-5">
        <div className="mb-3.5 flex items-center justify-between text-[13px] font-bold text-[#14192f]">
          <span className="flex items-center gap-1.5">
            <Wallet className="h-3.5 w-3.5 text-brand-blue" /> 내 카드 현황
          </span>
          <span className="flex items-center gap-3">
            {ranked.length > 0 && (
              <button
                type="button"
                onClick={() => setQuickEditOpen(true)}
                className="text-[11px] font-bold text-slate-500 hover:text-brand-blue"
              >
                빠르게 바꾸기
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate("gallery")}
              className="flex items-center gap-0.5 text-[11px] font-bold text-brand-blue"
            >
              관리하기 <ArrowRight className="h-3 w-3" />
            </button>
          </span>
        </div>
        {ranked.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-[12px] text-slate-400">
            아직 담은 카드가 없어요. 전체 카드 보기에서 카드를 담아보세요.
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {ranked.map((r, i) => {
              const accent = topCategoryAccent(r);
              const isBest = i === 0 && r.meetsMinimum;
              const tileStyle = { "--tile-accent": accent } as CSSProperties;
              return (
                <button
                  key={r.card.id}
                  type="button"
                  onClick={() => setSelectedCardId(r.card.id)}
                  style={tileStyle}
                  className="catalog-tile relative flex w-full items-center gap-3 overflow-hidden rounded-xl py-2.5 pl-4 pr-2.5 text-left transition hover:bg-slate-50"
                >
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-1.5 left-0 w-1 rounded-full"
                    style={{ backgroundColor: accent }}
                  />
                  <CardThumb imageUrl={r.card.imageUrl} name={r.card.name} size={30} />
                  <div className="flex-1">
                    <div className="flex items-center gap-1">
                      {isBest && <Crown className="h-3 w-3 shrink-0" style={{ color: accent }} />}
                      <div className="text-[12.5px] font-medium text-[#14192f]">{r.card.name}</div>
                    </div>
                    <div className="text-[10px] text-slate-400">{r.card.issuer}</div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      r.meetsMinimum ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {r.meetsMinimum ? "실적 충족" : "실적 미충족"}
                  </span>
                  <div className="w-20 shrink-0 text-right text-[11.5px] font-semibold text-slate-600">
                    {formatWon(r.netMonthlyBenefit)}
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!top && ranked.some((r) => !r.meetsMinimum) && (
        <div className="mt-3.5 flex items-center gap-1.5 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[11px] text-amber-800">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
          실적 조건을 채우지 못한 카드가 있어요. 지출을 조정하거나 지갑 조합을 다시 계산해보세요.
        </div>
      )}
    </div>
  );
}
