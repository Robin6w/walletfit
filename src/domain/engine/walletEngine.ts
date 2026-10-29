import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getEngineState, getWorker, onEngineStateChange, postRequest } from "@/domain/engine/workerClient";
import type { BrandRow, BrandShare, EnginePack, RankRow, RecommendArgs, RecommendResponse, BenefitStatus } from "@/domain/types/engine";

/**
 * 새 계산 엔진 호출(wf_engine.py). 모든 카드는 혜택 표(data/catalog/cards-benefit.json)로 계산합니다.
 *  - recommend: 조합 찾기(추천 엔진 v2) + 카드별 계산 근거(calc.py)
 *  - explain: 정해진 카드들로 배분만 다시 고르기(카드 바꿔보기, 저장한 지갑 다시 계산)
 *  - rank: 카드마다 지출 전부를 그 카드로 냈을 때의 월 혜택(정렬·혜택별 추천)
 *  - brands: 담은 카드의 브랜드 한정 혜택에 나오는 브랜드
 *  - alt: 실적 여유 없이 고른 대안 조합(recommend 응답의 pool·k로, 필요할 때만 계산)
 */
export type EngineFn = "recommend" | "explain" | "rank" | "brands" | "categoryRank" | "cardsInfo" | "alt";

export function engineCall<T>(fn: EngineFn, args: unknown): Promise<T> {
  return postRequest<T>("engine", { fn, args });
}

export function warmUpEngine() {
  getWorker();
}

export function useEngineState() {
  return useSyncExternalStore(
    (cb) => {
      getWorker();
      return onEngineStateChange(cb) as unknown as () => void;
    },
    () => getEngineState().state,
  );
}

/** 카테고리 지출과 브랜드 금액(원)으로 calc.py가 읽는 브랜드 비중을 만든다. 비운 카테고리는 넣지 않는다(35% 추정). */
export function toBrandShare(spending: Record<string, number>, brandSpend: Record<string, Record<string, number>>): BrandShare {
  const out: BrandShare = {};
  for (const [cat, brands] of Object.entries(brandSpend ?? {})) {
    const total = spending[cat] ?? 0;
    const entries = Object.entries(brands ?? {}).filter(([, v]) => v > 0);
    if (!total || entries.length === 0) continue;
    out[cat] = Object.fromEntries(entries.map(([name, v]) => [name, Math.min(1, v / total)]));
  }
  return out;
}

interface AsyncState<T> {
  data: T | null;
  /** 계산 중에도 직전 결과를 보여주기 위해 남겨 둔다 */
  lastGood: T | null;
  isComputing: boolean;
  error: string | null;
}

/** key가 바뀔 때마다 다시 계산하고, 가장 마지막에 시작한 계산의 결과만 반영한다. */
function useEngineQuery<T extends { ok: boolean; error?: string }>(
  fn: EngineFn,
  args: unknown | null,
): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ data: null, lastGood: null, isComputing: false, error: null });
  const gen = useRef(0);
  const key = args === null ? "" : JSON.stringify(args);
  useEffect(() => {
    if (args === null) {
      gen.current += 1;
      setState((s) => ({ ...s, data: null, isComputing: false, error: null }));
      return;
    }
    const mine = ++gen.current;
    setState((s) => ({ ...s, isComputing: true, error: null }));
    engineCall<T>(fn, args).then((res) => {
      if (gen.current !== mine) return;
      if (!res.ok) {
        setState((s) => ({ ...s, isComputing: false, error: res.error ?? "계산하지 못했어요" }));
      } else {
        setState({ data: res, lastGood: res, isComputing: false, error: null });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fn, key]);
  return state;
}

export function useRecommendation(args: RecommendArgs | null) {
  return useEngineQuery<RecommendResponse>("recommend", args);
}

export function useExplain(args: { ids: number[]; spending: Record<string, number>; margin: number; brandShare?: BrandShare } | null) {
  return useEngineQuery<{ ok: boolean; error?: string; result: EnginePack }>("explain", args);
}

export function useRank(args: { ids?: number[]; spending: Record<string, number>; brandShare?: BrandShare; detail?: boolean } | null) {
  return useEngineQuery<{ ok: boolean; error?: string; rows: RankRow[] }>("rank", args);
}

export function useBrands(ids: number[] | null) {
  return useEngineQuery<{ ok: boolean; error?: string; categories: Record<string, BrandRow[]>; defaultShare: number }>(
    "brands",
    ids === null ? null : { ids },
  );
}

export interface CategoryRankRow {
  sid: number;
  value: number;
  name: string;
  note: string | null;
  /** 그 카테고리 혜택이 가장 큰 패키지(하나만 고르는 선택형). 2026-10-29부터 */
  options: string[];
  /** 지출 전체 기준으로 고른 패키지와 다르면 true(2026-10-29 추가) */
  switched?: boolean;
  status?: BenefitStatus;
  /** 가장 큰 혜택과 걸린 한도(2026-10-29 추가, 금액이 있는 카드만) */
  detail?: CategoryRankDetail;
}

export interface CategoryRankDetail {
  options: { id: string; label: string }[];
  title?: string;
  kind?: string;
  type?: string;
  value?: number | null;
  specificity?: string;
  merchants?: string[];
  final?: number;
  /** 혜택 자체 월 한도에 걸렸으면 그 한도(원) */
  capHit?: number | null;
  /** 묶음 한도에 걸렸으면 그 한도 */
  shared?: { label: string; cap: number } | null;
  perTxnCap?: number | null;
  maxCountedTxn?: number | null;
  minTxn?: number | null;
  countLimits?: { per_day?: number; per_month?: number; per_year?: number } | null;
  /** 브랜드 혜택: 입력한 브랜드 비중 */
  share?: number | null;
}

export function useCategoryRank(
  args: { category: string; amount: number; spending: Record<string, number>; ids?: number[]; brandShare?: BrandShare; limit?: number } | null,
) {
  return useEngineQuery<{ ok: boolean; error?: string; rows: CategoryRankRow[]; total: number }>("categoryRank", args);
}

export interface CardInfo {
  titles: string[];
  tiers: number[];
  excludesDiscounted: boolean;
  status: string;
  hasChoice: boolean;
  benefitCount: number;
}

export function useCardsInfo(ids: number[] | null) {
  return useEngineQuery<{ ok: boolean; error?: string; cards: Record<string, CardInfo> }>("cardsInfo", ids === null ? null : { ids });
}
