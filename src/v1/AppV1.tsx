import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useSavedCards } from "@/domain/state/useSavedCards";
import { useAzuLlmApiKey } from "@/shared/hooks/useAzuLlmApiKey";
import { ToastProvider } from "@/shared/contexts/ToastContext";
import { ErrorBoundary } from "@/shared/components/ErrorBoundary";
import { useMonthlySpend } from "@/domain/state/useMonthlySpend";
import { categories } from "@/domain/engine/loadCatalog";
import { warmUpEngine } from "@/domain/engine/walletEngine";
import type { RecommendResponse } from "@/domain/types/engine";
import { Shell, type V1Tab } from "@/v1/Shell";
import { HomeV1 } from "@/v1/pages/HomeV1";
import { useBrandSpend, useMargin, useSavedWallet } from "@/v1/state";
import { Spinner } from "@/v1/ui";
import type { WizardStep } from "@/v1/wizard/WizardV1";

const WizardV1 = lazy(() => import("@/v1/wizard/WizardV1").then((m) => ({ default: m.WizardV1 })));
const WalletV1 = lazy(() => import("@/v1/pages/WalletV1").then((m) => ({ default: m.WalletV1 })));
const GalleryV1 = lazy(() => import("@/v1/pages/GalleryV1").then((m) => ({ default: m.GalleryV1 })));
const BenefitV1 = lazy(() => import("@/v1/pages/BenefitV1").then((m) => ({ default: m.BenefitV1 })));
const StatementV1 = lazy(() => import("@/v1/pages/StatementV1").then((m) => ({ default: m.StatementV1 })));
const ChatV1 = lazy(() => import("@/v1/chat/ChatV1").then((m) => ({ default: m.ChatV1 })));

function Loading() {
  return (
    <div className="flex justify-center py-24">
      <Spinner label="화면을 불러오고 있어요" />
    </div>
  );
}

function AppContent() {
  const [tab, setTab] = useState<V1Tab>("home");
  const [scope, setScope] = useState<"myCards" | "all">("myCards");
  const [step, setStep] = useState<WizardStep>(1);
  const [lastRec, setLastRec] = useState<RecommendResponse | null>(null);
  const [recCtx, setRecCtx] = useState<{ spending: Record<string, number>; margin: number }>({ spending: {}, margin: 20000 });
  const [question, setQuestion] = useState<string | null>(null);
  const myCards = useSavedCards();
  const azuLlm = useAzuLlmApiKey();
  const { spending } = useMonthlySpend(categories);
  const { brandSpend, addBrands } = useBrandSpend();
  const [, setMargin] = useMargin();
  const saved = useSavedWallet();

  // 계산 엔진(Pyodide·scipy·혜택 표)은 몇 초 걸려서 첫 화면에서 미리 띄워 둔다
  useEffect(() => {
    const t = window.setTimeout(() => warmUpEngine(), 800);
    return () => window.clearTimeout(t);
  }, []);

  const navigate = useCallback((next: V1Tab) => {
    setTab(next);
    window.scrollTo({ top: 0 });
  }, []);
  const startWizard = (s: "myCards" | "all", at: WizardStep = 1) => {
    setScope(s);
    setStep(at);
    navigate("wizard");
  };
  // 상담에서 '결과 보기'로 돌아갈 때 쓸 범위: 이번에 계산한 결과가 있으면 그 범위, 새로고침 뒤에는 저장한 지갑의 범위
  const resultScope: "myCards" | "all" = lastRec ? scope : (saved.wallet?.scope ?? scope);
  const ask = (q?: string) => {
    setQuestion(q ?? null);
    navigate("chat");
  };

  if (tab === "wizard") {
    return (
      <Suspense fallback={<Loading />}>
        <ErrorBoundary fallbackTitle="지갑 만들기 오류" fallbackMessage="지갑 만들기 화면을 불러오는 중 오류가 났어요. 다시 시도해 주세요.">
          <WizardV1
            scope={scope}
            onScope={setScope}
            step={step}
            onStep={setStep}
            myCards={myCards}
            onNavigate={navigate}
            onResult={(r, ctx) => {
              setLastRec(r);
              setRecCtx(ctx);
            }}
            onAsk={ask}
            onSave={saved.setWallet}
          />
        </ErrorBoundary>
      </Suspense>
    );
  }

  const chatRec = lastRec ?? (saved.wallet ? ({ ok: true, k: saved.wallet.pack.cards.length, mode: "maxBenefit", margin: saved.wallet.margin, efficientCeiling: null, result: saved.wallet.pack, bar: [], alt: null, pool: [], spending: saved.wallet.spending, elapsed: 0 } as RecommendResponse) : null);

  return (
    <Shell tab={tab} onNavigate={navigate}>
      <Suspense fallback={<Loading />}>
        <ErrorBoundary key={tab} fallbackTitle="화면 오류" fallbackMessage="이 화면을 불러오는 중 오류가 났어요. 다른 메뉴로 이동하거나 다시 시도해 주세요.">
          {tab === "home" && <HomeV1 onStart={(s) => startWizard(s)} saved={saved.wallet} onOpenWallet={() => navigate("wallet")} />}
          {tab === "wallet" && (
            <WalletV1
              wallet={saved.wallet}
              ownedIds={myCards.ids}
              onToggleTodo={saved.toggleTodo}
              onStart={() => startWizard("myCards")}
              onEditSpend={() => startWizard(saved.wallet?.scope ?? "myCards", 2)}
              onSwap={() => startWizard(saved.wallet?.scope ?? "myCards", 4)}
              onAsk={ask}
            />
          )}
          {tab === "gallery" && <GalleryV1 myCards={myCards} spending={spending} brandSpend={brandSpend} />}
          {tab === "benefit" && <BenefitV1 myCards={myCards} spending={spending} brandSpend={brandSpend} lastRec={lastRec} onStartWizard={() => startWizard(myCards.ids.length ? "myCards" : "all", myCards.ids.length ? 2 : 1)} />}
          {tab === "statement" && <StatementV1 addBrands={addBrands} brandSpend={brandSpend} onRecommend={() => startWizard(scope, 2)} />}
          {tab === "chat" && (
            <ChatV1
              ctx={{ rec: chatRec, spending: lastRec ? recCtx.spending : saved.wallet?.spending ?? {}, margin: lastRec ? recCtx.margin : saved.wallet?.margin ?? 20000 }}
              azuLlm={azuLlm}
              initialQuestion={question}
              onConsumed={() => setQuestion(null)}
              onOpenResult={() => startWizard(resultScope, 4)}
              onNoMargin={() => {
                setMargin(0);
                startWizard(resultScope, 4);
              }}
            />
          )}
        </ErrorBoundary>
      </Suspense>
    </Shell>
  );
}

/** v1 화면(10월 초 디자인). 2026-10-28부터 기본 화면은 src/v2이고, v1은 주소 #/v1 에서 비교용으로 연다. */
export function AppV1() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
