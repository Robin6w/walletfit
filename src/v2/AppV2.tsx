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
import { Spinner } from "@/v2/ui/kit";

const Home = lazy(() => import("@/v2/pages/Home"));
const Guide = lazy(() => import("@/v2/pages/Guide"));
const Wallet = lazy(() => import("@/v2/pages/Wallet"));
const Cards = lazy(() => import("@/v2/pages/Cards"));
const Compare = lazy(() => import("@/v2/pages/Compare"));
const Benefit = lazy(() => import("@/v2/pages/Benefit"));
const MakeFlow = lazy(() => import("@/v2/make/MakeFlow"));
const ChatDock = lazy(() => import("@/v2/chat/ChatDock"));
const AppV1 = lazy(() => import("@/v1/AppV1").then((m) => ({ default: m.AppV1 })));

function Loading() {
  return (
    <div className="flex justify-center py-24">
      <Spinner label="화면을 불러오고 있어요" />
    </div>
  );
}

function Screen({ route }: { route: Route }) {
  const [a, b, c] = route.parts;
  if (!a) return <Home />;
  if (a === "guide") return <Guide />;
  if (a === "wallet") return <Wallet />;
  if (a === "cards") return <Cards />;
  if (a === "compare") return <Compare />;
  if (a === "benefit") return <Benefit />;
  if (a === "make" && isFlow(b)) return <MakeFlow flow={b} step={c} />;
  return <NotFound />;
}

/** 계산 엔진을 쓰는 화면: 지갑 만들기, 전체 카드(내 지출 순 정렬), 카드 비교, 혜택별 추천 */
const ENGINE_SCREENS: ReadonlySet<string> = new Set(["make", "cards", "compare", "benefit"]);

function saveDataOn(): boolean {
  try {
    return !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  } catch {
    return false;
  }
}

function NotFound() {
  useEffect(() => navigate("/", { replace: true }), []);
  return null;
}

function Root() {
  const route = useRoute();
  const { open } = useChatState();
  const prevPath = useRef(route.path);

  // 계산 엔진(Pyodide·scipy·혜택 표, 내려받기 약 36MB·준비 약 10초)은 엔진을 쓰는 화면에 들어오면 미리 띄운다.
  // 홈·이용 가이드·내 지갑만 보고 나가는 경우에는 내려받지 않고, 데이터 절약 모드면 실제로 계산할 때 띄운다(2026-10-29)
  const needsEngine = ENGINE_SCREENS.has(route.parts[0] ?? "") || open;
  useEffect(() => {
    if (!needsEngine || saveDataOn()) return;
    const t = window.setTimeout(() => warmUpEngine(), 300);
    return () => window.clearTimeout(t);
  }, [needsEngine]);

  // 화면이 바뀌면 맨 위로(같은 화면에서 주소 뒤 값만 바뀌면 그대로)
  useEffect(() => {
    if (prevPath.current !== route.path) window.scrollTo({ top: 0 });
    prevPath.current = route.path;
  }, [route.path]);

  if (route.parts[0] === "v1") {
    return (
      <Suspense fallback={<Loading />}>
        <AppV1 />
      </Suspense>
    );
  }

  return (
    <div className={`w-root min-h-screen transition-[padding] duration-200 ${open ? "lg:pr-[420px]" : ""}`}>
      <a href="#w-main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        본문으로 건너뛰기
      </a>
      <Suspense fallback={<Loading />}>
        <ErrorBoundary key={route.path} fallbackTitle="화면 오류" fallbackMessage="이 화면을 불러오는 중 오류가 났어요. 다른 메뉴로 이동하거나 다시 시도해 주세요.">
          <Screen route={route} />
        </ErrorBoundary>
      </Suspense>
      <Suspense fallback={null}>
        <ChatDock />
      </Suspense>
    </div>
  );
}

export default function AppV2() {
  return (
    // 알림은 머리줄(카드 상담 버튼)과 화면 오른쪽 위 버튼을 가리지 않게 넓은 화면에서는 머리줄 아래 가운데,
    // 좁은 화면에서는 아래쪽 가운데(2026-10-29)
    <ToastProvider placement="fixed bottom-5 left-1/2 -translate-x-1/2 sm:bottom-auto sm:top-24">
      <AppDataProvider>
        <Root />
      </AppDataProvider>
    </ToastProvider>
  );
}
