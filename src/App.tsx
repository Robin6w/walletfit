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

// 2026-11-24: 사용자가 기능을 쓰며 넣거나 고른 값(지출·자주 가는 곳·명세서 정보·담은 카드·저장한 지갑·실적 여유·통신사 답·
// 새 카드 종류·바꾼 가맹점 분류·계산 결과)은 이 탭에서만 둔다(sessionStorage). 새로고침해도 남고 탭을 닫으면 지워진다.
// 예전에 localStorage(브라우저를 껐다 켜도 남는 곳)에 남아 있던 값은 더 읽지 않으니 지운다
try {
  for (const key of [
    "walletfit:monthly-spend",
    "walletfit:v2:brand-picks",
    "walletfit:v2:statement",
    "walletfit:saved-cards",
    "walletfit:v1:saved-wallet",
    "walletfit:v1:margin",
    "walletfit:v1:brand-spend",
    "walletfit:v1:include-unverified",
    "walletfit:choices",
    "walletfit:v2:merchant-categories",
    "walletfit:v2:new-card-types",
    "walletfit:v2:engine-results",
  ])
    window.localStorage.removeItem(key);
} catch {
  /* 저장소를 못 써도 앱은 동작 */
}

export default function App() {
  return (
    <Suspense fallback={null}>
      <Site />
    </Suspense>
  );
}
