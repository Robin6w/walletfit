import { useMemo, useState, lazy, Suspense } from "react";
import { Menu } from "lucide-react";
import { useSavedCards } from "@/domain/state/useSavedCards";
import { useAzuLlmApiKey } from "@/shared/hooks/useAzuLlmApiKey";
import { ToastProvider } from "@/shared/contexts/ToastContext";
import { ErrorBoundary } from "@/shared/components/ErrorBoundary";
import { Sidebar } from "@/shared/layout/Sidebar";
import { Chatbot } from "@/features/chatbot/Chatbot";
import { HomePage } from "@/features/home/HomePage";
import { StartPage } from "@/features/start/StartPage";
import type { SimulatorScope } from "@/features/wallet/WalletWizardPage";
import type { WalletBlueprint } from "@/domain/types/optimization";
import { rankByNetReward } from "@/domain/engine/recommender";
import { catalogCards, categories } from "@/domain/engine/loadCatalog";
import { toWalletCard } from "@/domain/engine/cardConverter";
import { useMonthlySpend, clearMonthlySpend } from "@/domain/state/useMonthlySpend";

const CardsPage = lazy(() => import("@/features/catalog/CardsPage").then((m) => ({ default: m.CardsPage })));
const StatementAnalysisPage = lazy(() =>
  import("@/features/statement/StatementAnalysisPage").then((m) => ({ default: m.StatementAnalysisPage })),
);
const BenefitRecommendPage = lazy(() =>
  import("@/features/benefit/BenefitRecommendPage").then((m) => ({ default: m.BenefitRecommendPage })),
);
const WalletWizardPage = lazy(() =>
  import("@/features/wallet/WalletWizardPage").then((m) => ({ default: m.WalletWizardPage })),
);

export type AppTab = "start" | "home" | "gallery" | "statement" | "benefit" | "wizard";

function PageLoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
      <p className="text-sm text-slate-500">페이지를 불러오는 중입니다...</p>
    </div>
  );
}

function AppContent() {
  const [tab, setTab] = useState<AppTab>("start");
  const [wizardStep, setWizardStep] = useState(1);
  const [chatOpen, setChatOpen] = useState(false);
  // 좁은 화면(모바일)에서만 쓰는 사이드바 오버레이 열림 상태. sm 이상에서는 사이드바가
  // 항상 고정 표시되므로 이 상태와 무관합니다.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // 시작 화면에서 고른 갈래("보유한 카드로" / "새 카드까지 포함해서")를 지갑 만들기
  // 마법사로 그대로 넘겨줍니다.
  const [startScope, setStartScope] = useState<SimulatorScope>("myCards");
  // 지갑 마법사가 마지막으로 계산한 추천 조합. 챗봇이 그 화면을 벗어난 뒤에도 "왜 이
  // 조합인지" 답할 수 있도록 여기(App.tsx)에서 들고 있습니다. 마법사를 아직 한 번도
  // 열지 않았으면 null입니다.
  const [wizardResult, setWizardResult] = useState<WalletBlueprint | null>(null);
  const myCards = useSavedCards();
  const azuLlm = useAzuLlmApiKey();
  const { spending } = useMonthlySpend(categories);

  const chatEvaluations = useMemo(() => {
    const idSet = new Set(myCards.ids);
    const cards = catalogCards.filter((c) => idSet.has(c.sourceId)).map(toWalletCard);
    return rankByNetReward(cards, spending);
  }, [myCards.ids, spending]);

  const handleNavigate = (next: AppTab) => setTab(next);

  const handleSelectScope = (scope: SimulatorScope) => {
    setStartScope(scope);
    setWizardStep(1);
    setTab("wizard");
  };

  const handleRestart = () => {
    if (typeof window !== "undefined" && typeof window.confirm === "function") {
      if (!window.confirm("입력한 지출과 진행 상황을 초기화하고 처음부터 다시 시작할까요?")) {
        return;
      }
    }
    clearMonthlySpend();
    setWizardStep(1);
    setTab("wizard");
  };

  // 시작 화면은 사이드바 없이 단독으로 보여줍니다("내 지갑 만들기" 두 갈래를 고르기 전까지는
  // 사이드바·기존 홈 화면을 아직 노출하지 않기로 한 결정 반영).
  if (tab === "start") {
    return <StartPage onSelectScope={handleSelectScope} />;
  }

  return (
    <div className="mesh-bg flex min-h-screen items-center justify-center p-3.5">
      {/* sm 미만(모바일)에서는 250px 고정 사이드바 칸이 본문을 150px 안팎으로 짓눌러서
          글자가 한 글자씩 줄바꿈되던 문제 — 그 폭에서는 그리드를 쓰지 않고 사이드바를
          오버레이(햄버거 메뉴)로 빼서 본문이 화면 전체 폭을 그대로 씁니다. */}
      <div className="app-shell relative flex h-[calc(100vh-1.75rem)] w-full max-w-[1400px] overflow-hidden rounded-[18px] shadow-[0_10px_32px_rgba(20,26,69,0.16)] sm:grid sm:grid-cols-[250px_1fr]">
        <Sidebar
          active={tab}
          onNavigate={handleNavigate}
          onRestart={handleRestart}
          onOpenChat={() => setChatOpen(true)}
          mobileOpen={mobileNavOpen}
          onMobileClose={() => setMobileNavOpen(false)}
        />

        <main className="min-w-0 flex-1 overflow-y-auto bg-transparent px-4 py-5 sm:px-10 sm:py-7.5">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="메뉴 열기"
            className="glass-panel mb-4 flex items-center gap-2 rounded-lg border border-slate-200/80 px-3 py-2 text-[12.5px] font-semibold text-[#14192f] shadow-sm sm:hidden"
          >
            <Menu className="h-4 w-4" /> 메뉴
          </button>
          {/* 이전에는 StatementAnalysisPage/SpendingImporter/CardList 내부에만 ErrorBoundary가
              있었고, 정작 가장 자주 쓰는 홈·지갑 만들기 화면은 렌더링 중 오류가 나면 앱
              전체가 하얗게 죽었다. 탭마다 감싸서, 한 화면이 깨져도 사이드바로 다른 화면으로
              이동할 수 있게 한다. */}
          <Suspense fallback={<PageLoadingFallback />}>
            {tab === "home" && (
              <ErrorBoundary fallbackTitle="홈 화면 오류" fallbackMessage="홈 화면을 불러오는 중 오류가 발생했습니다. 다시 시도해 주세요.">
                <HomePage myCards={myCards} categories={categories} onNavigate={handleNavigate} />
              </ErrorBoundary>
            )}
            {tab === "gallery" && (
              <ErrorBoundary fallbackTitle="전체 카드 보기 오류" fallbackMessage="카드 목록을 불러오는 중 오류가 발생했습니다. 다시 시도해 주세요.">
                <CardsPage myCards={myCards} categories={categories} spending={spending} />
              </ErrorBoundary>
            )}
            {tab === "statement" && (
              <ErrorBoundary fallbackTitle="명세서로 소비 분석 오류" fallbackMessage="이 화면을 불러오는 중 오류가 발생했습니다. 다시 시도해 주세요.">
                <StatementAnalysisPage onNavigate={handleNavigate} />
              </ErrorBoundary>
            )}
            {tab === "benefit" && (
              <ErrorBoundary fallbackTitle="혜택별 카드 추천 오류" fallbackMessage="추천 결과를 불러오는 중 오류가 발생했습니다. 다시 시도해 주세요.">
                <BenefitRecommendPage myCards={myCards} />
              </ErrorBoundary>
            )}
            {tab === "wizard" && (
              <ErrorBoundary fallbackTitle="내 지갑 만들기 오류" fallbackMessage="지갑 만들기 화면을 불러오는 중 오류가 발생했습니다. 다시 시도해 주세요.">
                <WalletWizardPage
                  myCards={myCards}
                  onNavigate={handleNavigate}
                  step={wizardStep}
                  onStepChange={setWizardStep}
                  initialScope={startScope}
                  onResultChange={setWizardResult}
                />
              </ErrorBoundary>
            )}
          </Suspense>
        </main>

        <Chatbot
          open={chatOpen}
          onOpenChange={setChatOpen}
          evaluations={chatEvaluations}
          categories={categories}
          walletResult={wizardResult}
          apiKey={azuLlm.apiKey}
          storageType={azuLlm.storageType}
          onApiKeyChange={azuLlm.setApiKey}
          onApiKeySave={azuLlm.save}
          onApiKeyRemove={azuLlm.remove}
          onApiKeyStorageTypeChange={azuLlm.setStorageType}
        />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
