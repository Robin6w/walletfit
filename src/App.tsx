import AppV2 from "@/v2/AppV2";

/** 이전 화면(legacy, 회귀 테스트용 컴포넌트)이 쓰던 탭 이름. 새 화면은 src/v2의 주소(#/wallet 등)를 씁니다. */
export type AppTab = "start" | "home" | "gallery" | "statement" | "benefit" | "wizard";

/**
 * 앱 진입점.
 *  - 기본: v2 화면(Claude Design 'WalletFit 디자인 개선' 양준서 페이지, src/v2)
 *  - #/v1: 10월 초 v1 화면(src/v1/AppV1.tsx). 엔진 고도화 때 예전 화면과 비교하는 용도
 */
export default function App() {
  return <AppV2 />;
}
