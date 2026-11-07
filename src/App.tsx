import { lazy, Suspense } from "react";

/** 이전 화면(legacy, 회귀 테스트용 컴포넌트)이 쓰던 탭 이름. 새 화면은 src/v2의 주소(#/wallet 등)를 씁니다. */
export type AppTab = "start" | "home" | "gallery" | "statement" | "benefit" | "wizard";

/**
 * 앱 진입점. 사이트 두 개를 같은 저장소에서 만든다(2026-11-07).
 *  - 기본(PC 사이트): v2 화면(Claude Design 'WalletFit 디자인 개선' 양준서 페이지, src/v2)
 *  - VITE_UI=mobile 또는 --mode mobile(모바일 사이트, npm run dev:mobile·build:mobile): 휴대폰 화면(src/mobile). 빌드 때 값이 정해져서 다른 쪽 화면은 들어가지 않는다
 */
const MOBILE = import.meta.env.VITE_UI === "mobile" || import.meta.env.MODE === "mobile";
const Site = MOBILE ? lazy(() => import("@/mobile/MobileApp")) : lazy(() => import("@/v2/AppV2"));

export default function App() {
  return (
    <Suspense fallback={null}>
      <Site />
    </Suspense>
  );
}
