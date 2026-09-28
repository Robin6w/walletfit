import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { rankByNetReward } from "@/domain/engine/recommender";
import { shortlistCandidates, ANNUAL_FEE_CEILING_MAX, type OptimizationMode } from "@/domain/engine/walletOptimizer";
import { useWalletBlueprintAsync } from "@/domain/engine/useWalletBlueprintAsync";
import { catalogCards, isInfoInsufficient, isDiscontinued, categories } from "@/domain/engine/loadCatalog";
import { toWalletCard } from "@/domain/engine/cardConverter";
import type { useSavedCards } from "@/domain/state/useSavedCards";
import type { CardKind, MonthlySpend } from "@/domain/types/card";
import type { WalletBlueprint } from "@/domain/types/optimization";
import { useMonthlySpend } from "@/domain/state/useMonthlySpend";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { SpendingSimulator } from "@/shared/components/SpendingSimulator";
import { CardList } from "@/shared/components/CardList";
import { WalletCombinationResult } from "@/features/wallet/WalletCombinationResult";
import { IncomeCardCountEstimator } from "@/features/wallet/IncomeCardCountEstimator";
import { IssuerExclusionFilter } from "@/features/wallet/IssuerExclusionFilter";
import type { AppTab } from "@/App";

const OPTIMIZATION_TOP_N_PER_CATEGORY = 8;
const ALL_CARD_TYPES: CardKind[] = ["credit", "check"];
const ALL_CARDS_DISPLAY_LIMIT = 30;
/** 처음부터 넉넉하게 열어두고, 실제로 이득이 되는 장수는 사용자가 최대 카드 수·연회비 상한으로 직접 조절합니다. */
const DEFAULT_MAX_CARDS = 5;
/**
 * "내 카드 중 추천" 범위는 원래 후보 풀 상한이 없었습니다(무제한으로 그대로 MILP에 넘김).
 * 이제 실제 계산은 Worker(Pyodide/HiGHS)에서 돌아 브라우저가 멈추지는 않지만, 사용자가
 * 저장한 카드가 아주 많아지는 경우를 대비한 안전망으로 이 상한을 넘으면 "전체" 범위와
 * 동일하게 카테고리별 상위 후보로 미리 추립니다.
 */
const SAFETY_CANDIDATE_CEILING = 60;
/** 지출 슬라이더를 드래그하는 동안 Worker에 계산 요청이 과도하게 쌓이지 않도록 디바운스합니다. */
const SPENDING_DEBOUNCE_MS = 300;
export type SimulatorScope = "myCards" | "all";

interface WalletWizardPageProps {
  myCards: ReturnType<typeof useSavedCards>;
  onNavigate: (tab: AppTab) => void;
  step: number;
  onStepChange: (step: number) => void;
  /** 시작 화면에서 고른 범위("보유한 카드로" / "새 카드까지 포함해서")를 그대로 이어받습니다. */
  initialScope?: SimulatorScope;
  /**
   * 계산된 추천 조합을 App.tsx로 올려보냅니다. 챗봇(추천 결과 설명 역할)이 "왜 이 조합인지"
   * 답하려면 이 화면을 벗어난 뒤에도 마지막 결과를 기억하고 있어야 해서, 상태를 이 화면
   * 안에만 두지 않고 App.tsx로 끌어올립니다.
   */
  onResultChange?: (result: WalletBlueprint) => void;
}

const STEPS = ["카드 선택", "지출 입력", "추천 결과"];

export function WalletWizardPage({
  myCards,
  onNavigate,
  step,
  onStepChange,
  initialScope,
  onResultChange,
}: WalletWizardPageProps) {
  const { spending, updateCategory, setSpending, resetSpending } = useMonthlySpend(categories);
  // "소득으로 빠르게 시작하기"에서 방금 값을 채웠는지 추적합니다. 지출 시뮬레이터에 안내
  // 문구를 띄워 두 영역이 하나의 흐름이라는 걸 보여주고, 사용자가 슬라이더를 직접 만지거나
  // 초기화하면 다시 "manual"로 돌아가 안내 문구가 사라집니다.
  const [spendingSource, setSpendingSource] = useState<"manual" | "income">("manual");
  const [cardTypes, setCardTypes] = useState<CardKind[]>(ALL_CARD_TYPES);
  const [scope, setScope] = useState<SimulatorScope>(initialScope ?? "myCards");
  const [maxCards, setMaxCards] = useState(DEFAULT_MAX_CARDS);
  // 기본값은 "제한 없음"(ANNUAL_FEE_CEILING_MAX)으로 둬서, 사용자가 직접 낮추기 전까지는 기존 동작과 같습니다.
  const [maxAnnualFee, setMaxAnnualFee] = useState(ANNUAL_FEE_CEILING_MAX);
  // "혜택 최대화"를 기본값으로 둡니다. 사용자가 "효율적"으로 바꾸면 같은 결과에서 기여도가
  // 낮은 카드를 사후에 추려내는 방식으로 카드 수를 줄입니다(useWalletBlueprintAsync.ts의
  // solveWalletWithMode 참고).
  const [optimizationMode, setOptimizationMode] = useState<OptimizationMode>("maxBenefit");
  // 통째로 후보에서 제외할 카드사. 비어있으면(기본값) 현재 스코프의 모든 카드사가 후보에
  // 포함됩니다. "내 카드 중 추천"/"전체 카드 중 추천" 두 스코프 모두에 적용됩니다.
  const [excludedIssuers, setExcludedIssuers] = useState<Set<string>>(new Set());

  const toggleCardType = (type: CardKind) => {
    setCardTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  };

  const myCardObjects = useMemo(() => {
    const idSet = new Set(myCards.ids);
    return catalogCards.filter((c) => idSet.has(c.sourceId)).map(toWalletCard);
  }, [myCards.ids]);

  const allCardObjects = useMemo(
    () => catalogCards.filter((entry) => !isInfoInsufficient(entry) && !isDiscontinued(entry)).map(toWalletCard),
    [],
  );

  const scopedCardObjects = scope === "all" ? allCardObjects : myCardObjects;

  // 카드사 제외 필터는 "전체 카드 중 추천"/"내 카드 중 추천" 두 스코프 모두에 적용합니다.
  // 선택지는 항상 현재 스코프의 후보 풀(scopedCardObjects)에 실제로 등장하는 카드사만
  // 보여줘서, "내 카드 중 추천"에서는 내가 실제로 가진 카드사만 필터에 뜨게 합니다.
  const availableIssuers = useMemo(
    () => Array.from(new Set(scopedCardObjects.map((card) => card.issuer))).sort((a, b) => a.localeCompare(b, "ko")),
    [scopedCardObjects],
  );

  const toggleIssuer = (issuer: string) => {
    setExcludedIssuers((prev) => {
      const next = new Set(prev);
      if (next.has(issuer)) {
        next.delete(issuer);
      } else {
        next.add(issuer);
      }
      return next;
    });
  };
  const includeAllIssuers = () => setExcludedIssuers(new Set());
  const excludeAllIssuers = () => setExcludedIssuers(new Set(availableIssuers));

  const filteredCards = useMemo(() => {
    let cards = scopedCardObjects.filter((card) => cardTypes.includes(card.cardType));
    if (excludedIssuers.size > 0) {
      cards = cards.filter((card) => !excludedIssuers.has(card.issuer));
    }
    return cards;
  }, [scopedCardObjects, cardTypes, excludedIssuers]);

  const ranked = useMemo(() => rankByNetReward(filteredCards, spending), [filteredCards, spending]);
  const rankedForDisplay = useMemo(
    () => (scope === "all" ? ranked.slice(0, ALL_CARDS_DISPLAY_LIMIT) : ranked),
    [ranked, scope],
  );

  const handleApplyEstimatedSpending = (nextSpending: MonthlySpend) => {
    setSpendingSource("income");
    setSpending(nextSpending);
  };
  const handleManualSpendingChange = (categoryId: string, value: number) => {
    setSpendingSource("manual");
    updateCategory(categoryId, value);
  };
  const handleResetSpending = () => {
    setSpendingSource("manual");
    resetSpending();
  };

  const debouncedSpending = useDebounce(spending, SPENDING_DEBOUNCE_MS);

  const optimizationCandidates = useMemo(() => {
    const needsShortlist = scope === "all" || filteredCards.length > SAFETY_CANDIDATE_CEILING;
    return needsShortlist
      ? shortlistCandidates(filteredCards, debouncedSpending, OPTIMIZATION_TOP_N_PER_CATEGORY)
      : filteredCards;
  }, [scope, filteredCards, debouncedSpending]);

  const walletOptions = useMemo(
    () => ({
      maxCards,
      mode: optimizationMode,
      maxTotalAnnualFee: maxAnnualFee >= ANNUAL_FEE_CEILING_MAX ? undefined : maxAnnualFee,
    }),
    [maxCards, optimizationMode, maxAnnualFee],
  );
  // 실제 MILP 계산은 Web Worker(Pyodide + scipy.optimize.milp/HiGHS) 안에서 돌아서,
  // 아무리 오래 걸려도 이 화면(메인 스레드)을 멈추지 않습니다.
  const {
    result: walletResult,
    isComputing: isOptimizing,
    error: optimizerError,
    efficientCeiling,
  } = useWalletBlueprintAsync(optimizationCandidates, debouncedSpending, walletOptions);
  const bestSingleCard = ranked.length > 0 ? ranked[0] : null;

  // 챗봇(추천 결과 설명 역할)이 이 화면을 벗어난 뒤에도 "마지막으로 계산된 조합"을 계속
  // 참고할 수 있도록 App.tsx로 결과를 올려보냅니다. 계산이 새로 끝날 때마다(walletResult가
  // 바뀔 때마다) 최신 값으로 갱신합니다.
  useEffect(() => {
    onResultChange?.(walletResult);
  }, [walletResult, onResultChange]);

  // 효율적 모드에서는 efficientCeiling(이 지출 규모에서 확실히 이득인 카드 수)을 넘겨서
  // maxCards를 올려도 실제 조합은 바뀌지 않습니다. "숫자를 눌러도 반영이 안 된다"는 혼란을
  // 없애려고, +/- 컨트롤의 상한 자체를 이 값으로 캡하고(아래 modeAwareMaxCardsUpperBound),
  // 이미 슬라이더가 그 값을 넘어서 있으면(예: 혜택 최대화 모드에서 올려두고 효율적 모드로
  // 전환한 경우) 화면에 보이는 숫자 자체도 실제로 반영되는 값으로 맞춰 내립니다.
  useEffect(() => {
    if (optimizationMode !== "efficient" || efficientCeiling === null) return;
    if (efficientCeiling >= 1 && maxCards > efficientCeiling) {
      setMaxCards(efficientCeiling);
    }
  }, [optimizationMode, efficientCeiling, maxCards]);

  const modeAwareMaxCardsUpperBound =
    optimizationMode === "efficient" && efficientCeiling !== null
      ? Math.min(optimizationCandidates.length, Math.max(1, efficientCeiling))
      : optimizationCandidates.length;

  // "저장한 카드 자체가 없음"과 "필터(카드 종류/카드사) 조건에 맞는 카드가 없음"은 원인이
  // 달라서 안내 문구와 CTA를 다르게 보여줍니다. 두 경우 모두 다음 단계로 못 넘어가야
  // 하므로(filteredCards가 비면 지출을 입력해도 계산할 대상이 없음), "다음" 버튼은 이 둘을
  // 합친 noCandidates로 막습니다 — 예전에는 카드 종류 토글을 전부 꺼서 filteredCards가
  // 비어도 "다음"이 눌려서 3단계에서 빈 결과만 보게 되는 문제가 있었습니다.
  const hasNoSavedCards = scope === "myCards" && myCards.ids.length === 0;
  const hasNoFilteredCards = !hasNoSavedCards && filteredCards.length === 0;
  const noCandidates = hasNoSavedCards || hasNoFilteredCards;
  const totalSpend = categories.reduce((sum, c) => sum + (spending[c.id] ?? 0), 0);

  return (
    <div>
      <h1 className="text-xl font-extrabold text-[#14192f]">내 지갑 만들기</h1>
      <p className="mb-6 mt-1 text-[12.5px] text-slate-500">
        카드를 고르고 지출을 입력하면 최적의 카드 조합을 계산해드려요
      </p>

      <div className="mb-6 flex items-center gap-1 sm:gap-2">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const isDone = step > n;
          const isCurrent = step === n;
          return (
            <div key={label} className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
              {/* 진행 상태만 보여주는 표시로, 단계 이동은 항상 아래쪽 "다음/이전" 버튼으로만
                  가능해야 합니다(단계를 건너뛰면 필터·지출 검증을 우회하게 됩니다). */}
              <div
                aria-hidden="true"
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${
                  isDone
                    ? "bg-brand-blue-deep text-white"
                    : isCurrent
                      ? "brand-gradient-select text-white"
                      : "bg-slate-200 text-slate-400"
                }`}
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : n}
              </div>
              <span
                className={`truncate text-[11px] font-semibold sm:text-[12.5px] ${isCurrent || isDone ? "text-[#14192f]" : "text-slate-400"}`}
              >
                {label}
              </span>
              {n < STEPS.length && (
                <div className={`mx-1 h-px flex-1 ${isDone ? "bg-brand-blue-deep" : "bg-slate-200"}`} />
              )}
            </div>
          );
        })}
      </div>

      {step === 1 && (
        <div className="glass-panel rounded-2xl border border-[#e6ecf8] p-5">
          <div className="mb-4 flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setScope("myCards")}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                scope === "myCards" ? "brand-gradient-select text-white shadow-sm" : "text-slate-500"
              }`}
            >
              내 카드 중 추천
            </button>
            <button
              type="button"
              onClick={() => setScope("all")}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                scope === "all" ? "brand-gradient-select text-white shadow-sm" : "text-slate-500"
              }`}
            >
              전체 카드 중 추천
            </button>
          </div>

          <div className="mb-4 flex gap-2">
            {(["credit", "check"] as CardKind[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => toggleCardType(t)}
                className={`rounded-full border px-4 py-1.5 text-[12px] font-semibold transition ${
                  cardTypes.includes(t)
                    ? "brand-gradient-select border-transparent text-white"
                    : "border-slate-200 text-slate-400"
                }`}
              >
                {t === "credit" ? "신용카드" : "체크카드"}
              </button>
            ))}
          </div>

          <IssuerExclusionFilter
            issuers={availableIssuers}
            excludedIssuers={excludedIssuers}
            onToggleIssuer={toggleIssuer}
            onIncludeAll={includeAllIssuers}
            onExcludeAll={excludeAllIssuers}
          />

          {hasNoSavedCards ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-slate-200 py-14 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-blue-deep/10 text-2xl">💳</div>
              <div>
                <h3 className="text-[13.5px] font-bold text-[#14192f]">시뮬레이션할 카드가 없습니다</h3>
                <p className="mt-1.5 max-w-sm text-[11.5px] leading-relaxed text-slate-400">
                  전체 카드 보기에서 카드를 담거나, "전체 카드 중 추천"을 선택해 보세요.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate("gallery")}
                className="cta-btn brand-gradient rounded-xl px-5 py-2.5 text-xs font-bold text-white"
              >
                전체 카드 보기로 이동
              </button>
            </div>
          ) : hasNoFilteredCards ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 py-14 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-2xl">🔍</div>
              <div>
                <h3 className="text-[13.5px] font-bold text-[#14192f]">조건에 맞는 카드가 없습니다</h3>
                <p className="mt-1.5 max-w-sm text-[11.5px] leading-relaxed text-slate-400">
                  카드 종류나 카드사 필터를 다시 확인해 보세요.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-brand-blue-deep/5 p-4 text-[12.5px] text-[#14192f]">
              {scope === "myCards" ? (
                <>선택된 <strong>{filteredCards.length}개 카드</strong>로 다음 단계를 진행해요.</>
              ) : (
                <>총 <strong>{filteredCards.length}개 카드</strong>를 대상으로 최적 조합을 계산해요.</>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => onStepChange(2)}
            disabled={noCandidates}
            className="brand-gradient mt-5 w-full rounded-xl py-3 text-[12.5px] font-bold text-white disabled:opacity-40"
          >
            다음: 지출 입력 →
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-5">
          <IncomeCardCountEstimator
            categories={categories}
            candidates={optimizationCandidates}
            maxAnnualFee={walletOptions.maxTotalAnnualFee}
            mode={optimizationMode}
            onApplySpending={handleApplyEstimatedSpending}
            onApplyMaxCards={setMaxCards}
          />
          <SpendingSimulator
            categories={categories}
            spending={spending}
            onChange={handleManualSpendingChange}
            onReset={handleResetSpending}
            autoFilledNotice={
              spendingSource === "income"
                ? "위에서 입력한 소득 추정값이 반영됐어요. 아래에서 직접 조정할 수 있어요."
                : undefined
            }
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onStepChange(1)}
              className="flex-1 rounded-xl bg-slate-100 py-3 text-[12.5px] font-bold text-slate-500"
            >
              ← 이전
            </button>
            <button
              type="button"
              onClick={() => onStepChange(3)}
              disabled={totalSpend === 0}
              className="brand-gradient flex-[2] rounded-xl py-3 text-[12.5px] font-bold text-white disabled:opacity-40"
            >
              다음: 추천 결과 보기 →
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-5">
          <WalletCombinationResult
            result={walletResult}
            isComputing={isOptimizing}
            error={optimizerError}
            categories={categories}
            maxCards={maxCards}
            onMaxCardsChange={setMaxCards}
            maxCardsUpperBound={modeAwareMaxCardsUpperBound}
            efficientCeiling={optimizationMode === "efficient" ? efficientCeiling : null}
            maxAnnualFee={maxAnnualFee}
            onMaxAnnualFeeChange={setMaxAnnualFee}
            optimizationMode={optimizationMode}
            onOptimizationModeChange={setOptimizationMode}
            bestSingleCard={bestSingleCard}
            myCards={myCards}
          />
          <CardList
            evaluations={rankedForDisplay}
            cardTypes={cardTypes}
            categories={categories}
            onToggleCardType={toggleCardType}
          />
          <button
            type="button"
            onClick={() => onStepChange(2)}
            className="w-full rounded-xl bg-slate-100 py-3 text-[12.5px] font-bold text-slate-500"
          >
            ← 지출 다시 입력하기
          </button>
        </div>
      )}
    </div>
  );
}
