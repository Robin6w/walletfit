import { useMemo, useState } from "react";
import { rankByNetReward, topPickPerCategory } from "@/domain/engine/recommender";
import {
  buildWalletBlueprint,
  shortlistCandidates,
  ANNUAL_FEE_CEILING_MAX,
  type OptimizationMode,
} from "@/domain/engine/walletOptimizer";
import { catalogCards, isInfoInsufficient, isDiscontinued, categories } from "@/domain/engine/loadCatalog";
import { toWalletCard } from "@/domain/engine/cardConverter";
import type { useSavedCards } from "@/domain/state/useSavedCards";
import type { CardKind } from "@/domain/types/card";
import { useMonthlySpend } from "@/domain/state/useMonthlySpend";
import { SpendingSimulator } from "@/shared/components/SpendingSimulator";
import { CardList } from "@/shared/components/CardList";
import { RecommendationResult } from "@/legacy/RecommendationResult";
import { WalletCombinationResult } from "@/features/wallet/WalletCombinationResult";
import { SpendingImporter } from "@/features/statement/SpendingImporter";
import { ErrorBoundary } from "@/shared/components/ErrorBoundary";

/** "전체 카드" 범위에서 MILP 후보로 남길 카테고리별 상위 카드 수 (변수 폭발 방지) */
const OPTIMIZATION_TOP_N_PER_CATEGORY = 8;

const ALL_CARD_TYPES: CardKind[] = ["credit", "check"];
/** 카드 비교 테이블에 표시할 "전체 카드" 모드의 최대 행 수 (전체 카탈로그를 다 그리면 느려지므로 상위 N개만 표시) */
const ALL_CARDS_DISPLAY_LIMIT = 30;
type SimulatorScope = "myCards" | "all";

interface SimulatorPageProps {
  myCards: ReturnType<typeof useSavedCards>;
  onGoToGallery: () => void;
}

/**
 * 혜택 시뮬레이터 탭 전체를 담당합니다.
 * "내 카드 중 추천"은 즐겨찾기(내 카드)만, "전체 카드 중 추천"은 카탈로그의 전체 카드를
 * 대상으로 지출 프로필 기준 최적 카드를 계산해 보여줍니다.
 */
export function SimulatorPage({ myCards, onGoToGallery }: SimulatorPageProps) {
  const { spending, updateCategory, resetSpending, applyImportedItems } =
    useMonthlySpend(categories);
  const [cardTypes, setCardTypes] = useState<CardKind[]>(ALL_CARD_TYPES);
  const [scope, setScope] = useState<SimulatorScope>("myCards");

  const toggleCardType = (type: CardKind) => {
    setCardTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const myCardObjects = useMemo(() => {
    const idSet = new Set(myCards.ids);
    return catalogCards.filter((c) => idSet.has(c.sourceId)).map(toWalletCard);
  }, [myCards.ids]);

  // 정보가 충분하고(연회비/혜택 요약이 있음) 신규 발급이 중단되지 않은 카드만 "전체 카드 추천" 대상으로 삼습니다.
  const allCardObjects = useMemo(() => {
    return catalogCards.filter((entry) => !isInfoInsufficient(entry) && !isDiscontinued(entry)).map(toWalletCard);
  }, []);

  const scopedCardObjects = scope === "all" ? allCardObjects : myCardObjects;

  const filteredCards = useMemo(
    () => scopedCardObjects.filter((card) => cardTypes.includes(card.cardType)),
    [scopedCardObjects, cardTypes],
  );

  const ranked = useMemo(() => rankByNetReward(filteredCards, spending), [filteredCards, spending]);
  const categoryWinners = useMemo(
    () => topPickPerCategory(filteredCards, spending, categories.map((c) => c.id)),
    [filteredCards, spending],
  );
  const rankedForDisplay = useMemo(
    () => (scope === "all" ? ranked.slice(0, ALL_CARDS_DISPLAY_LIMIT) : ranked),
    [ranked, scope],
  );

  // 다중 카드 조합(MILP) 추천: "전체 카드"는 후보가 너무 많으면 느려지므로
  // 카테고리별 상위 카드만 추려서 넘깁니다. "내 카드"는 이미 사용자가 골라둔
  // 소수 카드라 그대로 넘겨도 충분히 빠릅니다.
  const optimizationCandidates = useMemo(
    () =>
      scope === "all"
        ? shortlistCandidates(filteredCards, spending, OPTIMIZATION_TOP_N_PER_CATEGORY)
        : filteredCards,
    [scope, filteredCards, spending],
  );
  const [maxCards, setMaxCards] = useState(2);
  const [maxAnnualFee, setMaxAnnualFee] = useState(ANNUAL_FEE_CEILING_MAX);
  // 이 레거시 페이지는 실제 서비스 경로가 아니라 참고용으로만 남아있어서, 새 모드 토글의 실제
  // 효율적-모드 필터링(useWalletBlueprintAsync.ts의 solveWalletWithMode)은 여기로는 이식하지
  // 않았습니다 — 화면이 깨지지 않을 정도로만, WalletCombinationResult의 prop 요구사항을
  // 맞추기 위한 상태만 최소한으로 반영합니다.
  const [optimizationMode, setOptimizationMode] = useState<OptimizationMode>("maxBenefit");
  const walletResult = useMemo(
    () =>
      buildWalletBlueprint(optimizationCandidates, spending, {
        maxCards,
        maxTotalAnnualFee: maxAnnualFee >= ANNUAL_FEE_CEILING_MAX ? undefined : maxAnnualFee,
      }),
    [optimizationCandidates, spending, maxCards, maxAnnualFee],
  );
  const bestSingleCardNetBenefit = ranked.length > 0 ? ranked[0].netMonthlyBenefit : null;

  const showEmptyState = scope === "myCards" && myCards.ids.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2 rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setScope("myCards")}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            scope === "myCards"
              ? "bg-white text-indigo-600 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          내 카드 중 추천
        </button>
        <button
          type="button"
          onClick={() => setScope("all")}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            scope === "all"
              ? "bg-white text-indigo-600 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          전체 카드 중 추천
        </button>
      </div>

      {showEmptyState ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center shadow-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 text-3xl">
            💳
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">시뮬레이션할 카드가 없습니다</h3>
            <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-slate-400">
              카드 갤러리 탭에서 분석 및 비교하고 싶은 카드를 먼저 담거나, "전체 카드 중 추천"을 선택해 보세요.
            </p>
          </div>
          <button
            type="button"
            onClick={onGoToGallery}
            className="mt-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition"
          >
            카드 갤러리로 이동하기
          </button>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 text-sm text-indigo-800">
            {scope === "myCards" ? (
              <>
                ✨ 내가 담은 <strong>{myCards.ids.length}개 카드</strong>의 혜택 정보가 시뮬레이션용으로 분석/반영되었습니다.
              </>
            ) : (
              <>
                ✨ 등록된 전체 <strong>{allCardObjects.length}개 카드</strong>를 대상으로 분석했습니다. 순혜택 상위{" "}
                {ALL_CARDS_DISPLAY_LIMIT}개만 표시됩니다.
              </>
            )}
          </div>
          <ErrorBoundary
            fallbackTitle="지출 내역 가져오기 오류"
            fallbackMessage="지출 내역 가져오기 컴포넌트를 불러오는 중 오류가 발생했습니다. 다시 시도해 주세요."
          >
            <SpendingImporter categories={categories} onImport={applyImportedItems} />
          </ErrorBoundary>
          <SpendingSimulator
            categories={categories}
            spending={spending}
            onChange={updateCategory}
            onReset={resetSpending}
          />
          <RecommendationResult ranked={ranked} categoryWinners={categoryWinners} categories={categories} />
          <WalletCombinationResult
            result={walletResult}
            categories={categories}
            maxCards={maxCards}
            onMaxCardsChange={setMaxCards}
            maxCardsUpperBound={optimizationCandidates.length}
            maxAnnualFee={maxAnnualFee}
            onMaxAnnualFeeChange={setMaxAnnualFee}
            optimizationMode={optimizationMode}
            onOptimizationModeChange={setOptimizationMode}
            bestSingleCardNetBenefit={bestSingleCardNetBenefit}
            myCards={myCards}
          />
          <CardList
            evaluations={rankedForDisplay}
            cardTypes={cardTypes}
            categories={categories}
            onToggleCardType={toggleCardType}
          />
        </>
      )}
    </div>
  );
}
