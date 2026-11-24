import type { CardKind } from "@/domain/types/card";
import type { BrandShare, RecommendResponse, Tickets } from "@/domain/types/engine";
import type { SavedWallet } from "@/v1/state";
import type { BrandPicks } from "@/v2/model/brands";
import type { Flow } from "@/v2/app/paths";
import { useStoredValue } from "@/v2/app/storage";

/** 자주 가는 곳에서 고른 브랜드. 지출 입력과 같이 이 탭에서만 쓴다(새로고침해도 남고 탭을 닫으면 지워짐, 2026-11-24) */
export function useBrandPicks() {
  return useStoredValue<BrandPicks>("walletfit:v2:brand-picks", {}, "session");
}

export interface StatementState {
  /** 명세서에서 읽은 브랜드 금액. 예: { cafe: { 스타벅스: 72000 } } */
  brands: Record<string, Record<string, number>>;
  fileName: string;
  /** '2026년 9월' 같은 이용 기간(읽었을 때만) */
  period: string | null;
  itemCount: number;
  readAt: string;
  /** 카테고리별 결제 금액 한 건씩(건당 조건 계산용, 2026-10-31). 이전에 저장한 명세서에는 없다 */
  tickets?: Tickets;
}

/** 마지막으로 읽은 명세서 정보. 명세서 경로(A2′·B2′)의 결과 계산에 쓴다. 명세서로 채운 지출과 같이 이 탭에서만 쓴다(2026-11-24) */
export function useStatementState() {
  return useStoredValue<StatementState | null>("walletfit:v2:statement", null, "session");
}

/**
 * 사용자가 명세서 표에서 고친 가맹점 분류(merchantKey → 카테고리, 2026-11-23). 이 탭에서 다음에 올리는 명세서에도 적용한다.
 * 2026-11-24: 이 탭에서만 둔다(sessionStorage, 탭을 닫으면 지워짐). 가맹점 이름은 서버로 가지 않는다
 */
export function useMerchantCategories() {
  return useStoredValue<Record<string, string>>("walletfit:v2:merchant-categories", {}, "session");
}

/** B 흐름: 새 카드 종류(신용·체크). 비어 있으면 아직 고르지 않음. 이 탭에서만 둔다(2026-11-24) */
export function useNewCardTypes() {
  return useStoredValue<CardKind[]>("walletfit:v2:new-card-types", [], "session");
}

/**
 * 저장한 지갑. v1 모양(SavedWallet)에 v2 필드를 선택으로 더한다.
 * 2026-11-24부터 이 탭에서만 둔다(새로고침해도 남고 탭을 닫으면 지워짐, v1/state.ts useSavedWallet).
 */
export interface SavedWalletV2 extends SavedWallet {
  v?: 2;
  flow?: Flow;
  source?: "manual" | "statement";
  brandShare?: BrandShare;
  /** 명세서 결제 금액(명세서로 계산한 지갑만) */
  tickets?: Tickets;
  /** 카드 수별 순혜택(요약 문장용) */
  bar?: RecommendResponse["bar"];
  /** 여유 없는 조합을 저장했을 때 기본 추천(실적 여유 있는 조합) 요약 */
  baseline?: { names: string[]; net: number; margin: number } | null;
  /** 새 카드까지 포함한 결과: 이 조합에서 새로 발급할 카드 */
  newSids?: number[];
  /** 새 카드까지 포함한 결과: 가진 카드만 쓸 때 순혜택 */
  ownedOnlyNet?: number | null;
}

/** 지갑 만들기에서 마지막으로 계산한 결과(상담이 함께 씀, 혜택별 추천은 2026-11-07부터 쓰지 않음). 새로고침하면 사라진다 */
export interface LastRun {
  flow: Flow;
  source: "manual" | "statement";
  rec: RecommendResponse;
  spending: Record<string, number>;
  margin: number;
  brandShare: BrandShare;
  tickets?: Tickets;
  at: number;
}
