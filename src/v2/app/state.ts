import type { CardKind } from "@/domain/types/card";
import type { BrandShare, RecommendResponse } from "@/domain/types/engine";
import type { SavedWallet } from "@/v1/state";
import type { BrandPicks } from "@/v2/model/brands";
import type { Flow } from "@/v2/app/paths";
import { useStoredValue } from "@/v2/app/storage";

/** 자주 가는 곳에서 고른 브랜드 */
export function useBrandPicks() {
  return useStoredValue<BrandPicks>("walletfit:v2:brand-picks", {});
}

export interface StatementState {
  /** 명세서에서 읽은 브랜드 금액. 예: { cafe: { 스타벅스: 72000 } } */
  brands: Record<string, Record<string, number>>;
  fileName: string;
  /** '2026년 9월' 같은 이용 기간(읽었을 때만) */
  period: string | null;
  itemCount: number;
  readAt: string;
}

/** 마지막으로 읽은 명세서 정보. 명세서 경로(A2′·B2′)의 결과 계산에 쓴다 */
export function useStatementState() {
  return useStoredValue<StatementState | null>("walletfit:v2:statement", null);
}

/** B 흐름: 새 카드 종류(신용·체크). 비어 있으면 아직 고르지 않음 */
export function useNewCardTypes() {
  return useStoredValue<CardKind[]>("walletfit:v2:new-card-types", []);
}

/**
 * 저장한 지갑. v1 키(walletfit:v1:saved-wallet)를 그대로 쓰고 v2 필드는 선택으로 더한다.
 * v1에서 저장한 지갑도 그대로 읽힌다.
 */
export interface SavedWalletV2 extends SavedWallet {
  v?: 2;
  flow?: Flow;
  source?: "manual" | "statement";
  brandShare?: BrandShare;
  /** 카드 수별 순혜택(요약 문장용) */
  bar?: RecommendResponse["bar"];
  /** 여유 없는 조합을 저장했을 때 기본 추천(실적 여유 있는 조합) 요약 */
  baseline?: { names: string[]; net: number; margin: number } | null;
  /** 새 카드까지 포함한 결과: 이 조합에서 새로 발급할 카드 */
  newSids?: number[];
  /** 새 카드까지 포함한 결과: 가진 카드만 쓸 때 순혜택 */
  ownedOnlyNet?: number | null;
}

/** 지갑 만들기에서 마지막으로 계산한 결과(상담·혜택별 추천이 함께 씀). 새로고침하면 사라진다 */
export interface LastRun {
  flow: Flow;
  source: "manual" | "statement";
  rec: RecommendResponse;
  spending: Record<string, number>;
  margin: number;
  brandShare: BrandShare;
  at: number;
}
