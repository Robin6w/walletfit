import AppV2 from "@/v2/AppV2";

/** 이전 화면(legacy, 회귀 테스트용 컴포넌트)이 쓰던 탭 이름. 새 화면은 src/v2의 주소(#/wallet 등)를 씁니다. */
export type AppTab = "start" | "home" | "gallery" | "statement" | "benefit" | "wizard";

/**
 * 앱 진입점.
 *  - 기본: v2 화면(Claude Design 'WalletFit 디자인 개선' 양준서 페이지, src/v2)
 */
export default function App() {
  return <AppV2 />;
}
