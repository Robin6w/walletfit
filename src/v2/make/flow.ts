import { useMemo, useSyncExternalStore } from "react";
import type { CardKind } from "@/domain/types/card";
import type { BrandShare } from "@/domain/types/engine";
import { useMonthlySpend } from "@/domain/state/useMonthlySpend";
import { catalogBySourceId, categories, issuableCards } from "@/v1/catalog";
import { korWon } from "@/v1/format";
import { useMargin } from "@/v1/state";
import { paths, type Flow, type MakeStep } from "@/v2/app/paths";
import { readSession, writeSession } from "@/v2/app/storage";
import { useAppData } from "@/v2/app/AppData";
import { useBrandPicks, useNewCardTypes, useStatementState } from "@/v2/app/state";
import { amountsToBrandShare, pickedCount, picksToBrandShare } from "@/v2/model/brands";
import type { StepPill } from "@/v2/ui/TopBar";

/**
 * 지갑 만들기 흐름이 같이 쓰는 값(2026-10-28 v2).
 *  - 지출(walletfit:monthly-spend), 자주 가는 곳, 명세서, 새 카드 종류는 localStorage
 *  - 조건 바꾸기(계산 방식·최대 카드 수·연회비 상한·카드사 제외·가진 카드 종류)는 탭을 닫으면 처음 값(sessionStorage)
 */

export interface Conditions {
  mode: "maxBenefit" | "efficient";
  maxCards: number;
  /** 연회비 상한(원/년). null이면 제한 없음 */
  feeCap: number | null;
  excludedIssuers: string[];
  /** 계산에 넣을 카드 종류(가진 카드에도 적용). 새 카드 종류는 B1 단계 값과 함께 본다 */
  kinds: CardKind[];
  /** 새 카드까지 포함 흐름에서 꼭 넣을 카드(카드 비교의 '○○까지 넣어서 지갑 다시 짜기', 2026-10-29) */
  pinned: number[];
}

const COND_KEY = "walletfit:v2:conditions";
// 기본 최대 3장(2026-10-30): 지출 20가지 측정에서 4장 이상이 이득인 경우는 적고(+1~3%), 4~5장 계산은 오래 걸려
// 결과 화면의 '4~5장 조합도 찾아보기'로 따로 연다
const DEFAULT_COND: Conditions = { mode: "maxBenefit", maxCards: 3, feeCap: null, excludedIssuers: [], kinds: ["credit", "check"], pinned: [] };
let cond: Conditions = { ...DEFAULT_COND, ...readSession<Partial<Conditions>>(COND_KEY, {}) };
if (!Array.isArray(cond.pinned)) cond = { ...cond, pinned: [] };
const condListeners = new Set<() => void>();

export const conditionsStore = {
  get: () => cond,
  set(patch: Partial<Conditions>) {
    cond = { ...cond, ...patch };
    writeSession(COND_KEY, cond);
    condListeners.forEach((l) => l());
  },
  reset() {
    conditionsStore.set(DEFAULT_COND);
  },
  subscribe(l: () => void) {
    condListeners.add(l);
    return () => {
      condListeners.delete(l);
    };
  },
};

export function useConditions(): [Conditions, (patch: Partial<Conditions>) => void] {
  const c = useSyncExternalStore(conditionsStore.subscribe, conditionsStore.get, conditionsStore.get);
  return [c, conditionsStore.set];
}

export function kindOf(sid: number): CardKind {
  return catalogBySourceId.get(sid)?.category === "체크" ? "check" : "credit";
}

/** 결과 화면 기본 실적 여유. v1에서 0을 저장했어도 v2는 '여유 없이 다시 계산'을 따로 보여 주므로 2만원으로 본다 */
export function baseMarginOf(stored: number): number {
  return stored > 0 ? stored : 20000;
}

export function useFlowInputs() {
  const { myCards } = useAppData();
  const spend = useMonthlySpend(categories);
  const [picks, setPicks] = useBrandPicks();
  const [statement, setStatement] = useStatementState();
  const [newTypes, setNewTypes] = useNewCardTypes();
  const [storedMargin, setMargin] = useMargin();
  const [conditions, setConditions] = useConditions();

  const spending = useMemo(() => Object.fromEntries(Object.entries(spend.spending).filter(([, v]) => v > 0)), [spend.spending]);
  const total = Object.values(spending).reduce((s, v) => s + v, 0);
  const owned = myCards.ids;

  const issuerOk = (sid: number) => !conditions.excludedIssuers.includes(catalogBySourceId.get(sid)?.issuer ?? "");
  /** 보유한 카드 흐름에서 계산에 넣는 카드(조건 바꾸기의 카드 종류·카드사 제외 적용) */
  const ownIds = owned.filter((s) => conditions.kinds.includes(kindOf(s)) && issuerOk(s));
  /** 새 카드 후보: 고른 종류(B1) + 조건의 카드 종류 + 카드사 제외 + 연회비 상한. 꼭 넣을 카드는 조건과 상관없이 넣는다 */
  const newPool = useMemo(() => {
    const kinds = (newTypes.length ? newTypes : (["credit", "check"] as CardKind[])).filter((k) => conditions.kinds.includes(k));
    const ownedSet = new Set(owned);
    const pool = issuableCards()
      .filter((c) => !ownedSet.has(c.sourceId))
      .filter((c) => kinds.includes(c.category === "체크" ? "check" : "credit"))
      .filter((c) => !conditions.excludedIssuers.includes(c.issuer ?? ""))
      .filter((c) => conditions.feeCap === null || (c.annualFee ?? 0) <= conditions.feeCap)
      .map((c) => c.sourceId);
    const extra = conditions.pinned.filter((s) => !ownedSet.has(s) && catalogBySourceId.has(s) && !pool.includes(s));
    return [...extra, ...pool];
  }, [newTypes, conditions, owned]);
  /** 꼭 넣을 카드(가진 카드가 아니고 카드 목록에 있는 것만) */
  const pinned = useMemo(() => conditions.pinned.filter((s) => !owned.includes(s) && catalogBySourceId.has(s)), [conditions.pinned, owned]);

  const brandShareFor = (source: "manual" | "statement"): BrandShare => brandShareWith(spending, source);
  /** 다른 지출(예: 소득으로 채울 지출)에 같은 규칙으로 브랜드 비중을 만든다 */
  const brandShareWith = (spend: Record<string, number>, source: "manual" | "statement"): BrandShare =>
    source === "statement" && statement ? amountsToBrandShare(spend, statement.brands) : picksToBrandShare(spend, picks);

  return {
    spend,
    spending,
    total,
    owned,
    ownIds,
    newPool,
    pinned,
    picks,
    setPicks,
    statement,
    setStatement,
    newTypes,
    setNewTypes,
    margin: baseMarginOf(storedMargin),
    setMargin,
    conditions,
    setConditions,
    brandShareFor,
    brandShareWith,
    pickCount: pickedCount(picks),
  };
}

export type FlowInputs = ReturnType<typeof useFlowInputs>;

const TYPE_LABEL: Record<CardKind, string> = { credit: "신용", check: "체크" };

/** 단계 표시(WizardBar). 명세서 경로는 '자주 가는 곳' 없이 3단계 */
export function stepPills(flow: Flow, step: MakeStep, inp: FlowInputs, source: "manual" | "statement"): StepPill[] {
  const viaStatement = step === "statement" || (step === "result" && source === "statement");
  const order: MakeStep[] = viaStatement ? [flow === "own" ? "cards" : "type", "statement", "result"] : [flow === "own" ? "cards" : "type", "spend", "brands", "result"];
  const cur = order.indexOf(step);
  const state = (i: number): StepPill["state"] => (i < cur ? "done" : i === cur ? "current" : "todo");
  return order.map((s, i) => {
    switch (s) {
      case "cards":
        return { label: "카드 선택", summary: `${inp.owned.length}장`, state: state(i), to: paths.make(flow, "cards") };
      case "type":
        return { label: "카드 종류 선택", summary: inp.newTypes.map((t) => TYPE_LABEL[t]).join("·") || undefined, state: state(i), to: paths.make(flow, "type") };
      case "spend":
        return { label: "지출 입력", summary: inp.total ? korWon(inp.total) : undefined, state: state(i), to: paths.make(flow, "spend") };
      case "statement":
        return { label: "지출 입력", summary: "명세서", state: state(i), to: paths.make(flow, "statement") };
      case "brands":
        return { label: "자주 가는 곳", summary: `${inp.pickCount}곳`, state: state(i), to: paths.make(flow, "brands") };
      default:
        return { label: "추천 결과", state: state(i) };
    }
  });
}
