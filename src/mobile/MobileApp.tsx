import "@fontsource/ibm-plex-sans-kr/400.css";
import "@fontsource/ibm-plex-sans-kr/500.css";
import "@fontsource/ibm-plex-sans-kr/600.css";
import "@fontsource/ibm-plex-sans-kr/700.css";
import "@fontsource/outfit/500.css";
import "@fontsource/outfit/600.css";
import "@fontsource/outfit/700.css";
import "@fontsource/outfit/800.css";
import { lazy, Suspense, useEffect, useRef } from "react";
import { ToastProvider } from "@/shared/contexts/ToastContext";
import { ErrorBoundary } from "@/shared/components/ErrorBoundary";
import { warmUpEngine } from "@/domain/engine/walletEngine";
import { navigate, useRoute, type Route } from "@/v2/app/router";
import { AppDataProvider } from "@/v2/app/AppData";
import { isFlow } from "@/v2/app/paths";
import { useChatState } from "@/v2/chat/chatStore";
import { ChromeContext, type Chrome } from "@/v2/ui/chrome";
import { Spinner } from "@/v2/ui/kit";
import { MobileTopBar, MobileWizardBar, TabBar } from "@/mobile/chrome";
import { TAB_H, tabOf } from "@/mobile/tabs";

/**
 * 모바일 사이트(2026-11-07). VITE_UI=mobile로 빌드하면 PC 화면(AppV2) 대신 이 화면이 뜬다.
 *  - 계산 엔진·혜택 데이터·저장 방식은 PC 사이트와 같은 것을 쓴다(숫자가 어긋나지 않게)
 *  - 홈과 틀(머리줄·아래 탭·단계 막대)은 휴대폰용으로 새로 만들고,
 *    지갑 만들기 단계·결과·내 지갑 등 본문은 PC 화면 본문을 휴대폰 틀 안에서 그대로 쓴다
 */

const MobileHome = lazy(() => import("@/mobile/MobileHome"));
const Guide = lazy(() => import("@/v2/pages/Guide"));
const Wallet = lazy(() => import("@/v2/pages/Wallet"));
const Cards = lazy(() => import("@/v2/pages/Cards"));
const Compare = lazy(() => import("@/v2/pages/Compare"));
const Benefit = lazy(() => import("@/v2/pages/Benefit"));
const MakeFlow = lazy(() => import("@/v2/make/MakeFlow"));
const ChatDock = lazy(() => import("@/v2/chat/ChatDock"));

const CHROME: Chrome = { MenuBar: MobileTopBar, WizardBar: MobileWizardBar, compact: true };

/** 계산 엔진을 쓰는 화면(PC와 같음) */
const ENGINE_SCREENS: ReadonlySet<string> = new Set(["make", "cards", "compare", "benefit"]);

function saveDataOn(): boolean {
  try {
    return !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  } catch {
    return false;
  }
}

function Loading() {
  return (
    <div className="flex justify-center py-24">
      <Spinner label="화면을 불러오고 있어요" />
    </div>
  );
}

function NotFound() {
  useEffect(() => navigate("/", { replace: true }), []);
  return null;
}

function Screen({ route }: { route: Route }) {
  const [a, b, c] = route.parts;
  if (!a) return <MobileHome />;
  if (a === "guide") return <Guide />;
  if (a === "wallet") return <Wallet />;
  if (a === "cards") return <Cards />;
  if (a === "compare") return <Compare />;
  if (a === "benefit") return <Benefit />;
  if (a === "make" && isFlow(b)) return <MakeFlow flow={b} step={c} />;
  return <NotFound />;
}

/**
 * 본문을 88%로 줄여서(index.css .w-mobile #w-main) 입력칸 글자가 16px보다 작아진다.
 * 아이폰 사파리는 그런 칸을 누르면 화면을 확대하므로, 아이폰에서만 확대 한도를 1로 막는다
 * (아이폰은 이 값이 있어도 손가락 확대는 그대로 된다. 안드로이드는 손가락 확대를 막으므로 건드리지 않는다)
 */
function useNoInputZoomOnIOS() {
  useEffect(() => {
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (!ios || !meta || meta.content.includes("maximum-scale")) return;
    meta.content += ", maximum-scale=1";
  }, []);
}

function Root() {
  useNoInputZoomOnIOS();
  const route = useRoute();
  const { open } = useChatState();
  const prevPath = useRef(route.path);
  // 지갑 만들기 중에는 아래 탭을 숨긴다(단계마다 아래에 '다음' 바가 붙는다)
  const tabs = route.parts[0] !== "make";

  const needsEngine = ENGINE_SCREENS.has(route.parts[0] ?? "") || open;
  useEffect(() => {
    if (!needsEngine || saveDataOn()) return;
    const t = window.setTimeout(() => warmUpEngine(), 300);
    return () => window.clearTimeout(t);
  }, [needsEngine]);

  useEffect(() => {
    if (prevPath.current !== route.path) window.scrollTo({ top: 0 });
    prevPath.current = route.path;
  }, [route.path]);

  return (
    <ChromeContext.Provider value={CHROME}>
      <div className="w-root w-mobile min-h-screen" style={tabs ? { paddingBottom: `calc(${TAB_H}px + env(safe-area-inset-bottom))` } : undefined}>
        <a href="#w-main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
          본문으로 건너뛰기
        </a>
        <Suspense fallback={<Loading />}>
          <ErrorBoundary key={route.path} fallbackTitle="화면 오류" fallbackMessage="이 화면을 불러오는 중 오류가 났어요. 다른 메뉴로 이동하거나 다시 시도해 주세요.">
            <Screen route={route} />
          </ErrorBoundary>
        </Suspense>
        {tabs && <TabBar active={tabOf(route.parts[0])} />}
        <Suspense fallback={null}>
          <ChatDock />
        </Suspense>
      </div>
    </ChromeContext.Provider>
  );
}

export default function MobileApp() {
  return (
    // 알림은 아래 탭 위쪽 가운데
    <ToastProvider placement="fixed bottom-[88px] left-1/2 -translate-x-1/2">
      <AppDataProvider>
        <Root />
      </AppDataProvider>
    </ToastProvider>
  );
}
