import { useEffect, useRef, useState } from "react";
import type { WalletCard, MonthlySpend } from "@/domain/types/card";
import type { CardTierStatus, SlotAssignment, WalletBlueprint } from "@/domain/types/optimization";
import type { WalletBlueprintOptions, OptimizationMode } from "@/domain/engine/walletOptimizer";

/**
 * buildWalletBlueprint(walletOptimizer.ts)와 완전히 동일한 MILP 모델을, 메인 스레드를
 * 막지 않도록 Web Worker(Pyodide + scipy.optimize.milp/HiGHS) 안에서 비동기로 계산합니다.
 *
 * Worker는 카드 전체 객체 대신 cardId 기준으로만 결과를 돌려줍니다 (카드 데이터를 왕복시킬
 * 필요가 없어서 메시지 크기가 작아집니다). 여기서 원래 candidates 배열을 이용해
 * WalletBlueprint 형태(WalletCard 전체 객체 포함)로 다시 조립합니다.
 */

interface WorkerSolveResult {
  feasible: boolean;
  selectedCardIds?: string[];
  assignments?: { category: string; cardId: string; spend: number; benefitAmount: number }[];
  totalMonthlyBenefit?: number;
  totalMonthlyFee?: number;
  totalMonthlyManagementCost?: number;
  netMonthlyBenefit?: number;
  cardTierStatus?: Record<string, CardTierStatus>;
  error?: string;
}

const EMPTY_BLUEPRINT: WalletBlueprint = {
  feasible: true,
  selectedCards: [],
  assignments: [],
  totalMonthlyBenefit: 0,
  totalMonthlyFee: 0,
  totalMonthlyManagementCost: 0,
  netMonthlyBenefit: 0,
  cardTierStatus: {},
};

type PendingResolver = (result: WorkerSolveResult) => void;

/**
 * 앱 전체에서 Worker 인스턴스를 하나만 띄워서 재사용한다 (매번 새로 만들면 Pyodide를
 * 다시 부팅해야 해서 몇 초씩 걸린다). 첫 사용 시점에 한 번만 생성한다(lazy singleton).
 */
let sharedWorker: Worker | null = null;
let requestSeq = 0;
const pending = new Map<number, PendingResolver>();

/**
 * 대기 중인 모든 요청을 에러로 해소하고 정리한다. Worker 자체가 죽어서(onerror) 더 이상
 * 메시지를 보낼 수 없는 상황에서, 응답을 기다리며 걸려 있던 Promise들을 전부 풀어준다.
 * 이렇게 안 하면 pending에 남은 요청들은 영원히 resolve되지 않아, 그 요청을 기다리던
 * useWalletBlueprintAsync 쪽 isComputing이 "최적 조합을 다시 계산하고 있어요…" 상태로
 * 무한히 멈춰 있게 된다.
 */
function rejectAllPending(message: string) {
  for (const [requestId, resolve] of pending) {
    pending.delete(requestId);
    resolve({ feasible: false, error: message });
  }
}

function getWorker(): Worker {
  if (!sharedWorker) {
    // 명시적으로 모듈(ESM) Worker로 띄운다 — dev 서버와 프로덕션 빌드에서 동일하게 동작하게
    // 하기 위해서다 (walletOptimizer.worker.ts 상단 주석 참고).
    sharedWorker = new Worker(new URL("./walletOptimizer.worker.ts", import.meta.url), { type: "module" });
    sharedWorker.onmessage = (event: MessageEvent) => {
      const { type, requestId, data } = event.data ?? {};
      if (type !== "result") return;
      const resolve = pending.get(requestId);
      if (!resolve) return;
      pending.delete(requestId);
      resolve(data as WorkerSolveResult);
    };
    // 원래 onmessage만 등록돼 있었다. Pyodide 부팅 실패나 Worker 스크립트 자체의
    // 예외처럼 "result" 메시지가 아예 오지 않는 실패는 onerror로만 잡힌다. 여기서 잡지
    // 않으면 대기 중이던 요청들이 영원히 응답을 못 받아 무한 로딩 상태가 된다. Worker
    // 인스턴스 자체는 손상된 것으로 보고 버리고(다음 getWorker 호출에서 새로 띄움),
    // 다음 계산 시도가 정상적인 새 Worker로 다시 시작할 수 있게 한다.
    sharedWorker.onerror = (event: ErrorEvent) => {
      rejectAllPending(event.message || "카드 조합 계산 엔진(Worker)에서 오류가 발생했습니다.");
      sharedWorker = null;
    };
    sharedWorker.onmessageerror = () => {
      rejectAllPending("카드 조합 계산 엔진(Worker)과의 통신 중 오류가 발생했습니다.");
    };
  }
  return sharedWorker;
}

function solveInWorker(candidates: WalletCard[], spending: MonthlySpend, options: WalletBlueprintOptions) {
  const requestId = ++requestSeq;
  const worker = getWorker();
  const promise = new Promise<WorkerSolveResult>((resolve) => {
    pending.set(requestId, resolve);
  });
  worker.postMessage({ type: "solve", payload: { requestId, candidates, spending, options } });
  return { requestId, promise };
}

function assembleBlueprint(candidates: WalletCard[], raw: WorkerSolveResult): WalletBlueprint {
  if (!raw.feasible) {
    return { ...EMPTY_BLUEPRINT, feasible: false };
  }
  const byId = new Map(candidates.map((card) => [card.id, card]));
  const selectedCards = (raw.selectedCardIds ?? []).map((id) => byId.get(id)).filter((c): c is WalletCard => !!c);

  const assignments: SlotAssignment[] = (raw.assignments ?? [])
    .map((a) => {
      const card = byId.get(a.cardId);
      if (!card) return null;
      return { category: a.category, card, spend: a.spend, benefitAmount: a.benefitAmount };
    })
    .filter((a): a is SlotAssignment => a !== null);

  return {
    feasible: true,
    selectedCards,
    assignments,
    totalMonthlyBenefit: raw.totalMonthlyBenefit ?? 0,
    totalMonthlyFee: raw.totalMonthlyFee ?? 0,
    totalMonthlyManagementCost: raw.totalMonthlyManagementCost ?? 0,
    netMonthlyBenefit: raw.netMonthlyBenefit ?? 0,
    cardTierStatus: raw.cardTierStatus ?? {},
  };
}

/**
 * useWalletBlueprintAsync 훅(지출/카드 목록이 바뀔 때마다 자동으로 재계산)과 별도로,
 * "지금 이 조건으로 딱 한 번만" 계산 결과가 필요할 때 쓰는 1회성 호출입니다. 같은 공용
 * Worker를 재사용하지만(요청마다 별도 requestId라 서로 방해하지 않음) 화면 상태에 계속
 * 반영되지는 않고, 호출한 쪽이 await한 시점에만 값을 받습니다.
 *
 * 예: 소득 기반 카드 수 추천(IncomeCardCountEstimator) — 사용자가 버튼을 눌렀을 때만
 * "카드 수를 넉넉하게 열어주면 몇 장을 담는 게 최적인지"를 한 번 물어보고, 슬라이더를
 * 조작할 때마다 계속 재계산하지는 않습니다.
 */
export function solveWalletOnce(
  candidates: WalletCard[],
  spending: MonthlySpend,
  options: WalletBlueprintOptions,
): Promise<WalletBlueprint> {
  const { promise } = solveInWorker(candidates, spending, options);
  return promise.then((raw) => {
    if (raw.error) {
      throw new Error(raw.error);
    }
    return assembleBlueprint(candidates, raw);
  });
}

/**
 * "효율적" 모드에서, 카드 하나의 순혜택 기여도가 1등 카드 대비 이 비율보다 낮으면 지갑에서
 * 제외합니다. 관리 비용이라는 가상의 페널티를 objective에 섞는 대신, 이미 나온 최적해를
 * 그대로 두고 "각 카드가 실제로 얼마나 벌어줬는지"만 사후에 걸러내는 방식입니다. 이렇게 하면
 * 두 모드가 우연히 같은 카드 조합을 고를 경우 화면에 보이는 혜택 숫자도 완전히 똑같습니다
 * (예전의 관리 비용 방식은 조합이 같아도 관리 비용이 다르게 빠져서 숫자가 달라지는 문제가
 * 있었습니다).
 */
export const EFFICIENT_RELATIVE_CUTOFF = 0.3;

/**
 * 조합에 담긴 카드별로 "이 카드가 실제로 벌어준 혜택 − 이 카드의 월 환산 연회비"를 계산합니다.
 * 카드 한 장이 여러 카테고리를 맡을 수 있으므로 assignments에서 카드별 혜택을 먼저 합산합니다.
 */
export function computeNetContributionByCard(result: WalletBlueprint): Map<string, number> {
  const benefitByCard = new Map<string, number>();
  for (const assignment of result.assignments) {
    benefitByCard.set(assignment.card.id, (benefitByCard.get(assignment.card.id) ?? 0) + assignment.benefitAmount);
  }
  const netByCard = new Map<string, number>();
  for (const card of result.selectedCards) {
    const benefit = benefitByCard.get(card.id) ?? 0;
    netByCard.set(card.id, benefit - card.annualFee / 12);
  }
  return netByCard;
}

/**
 * "효율적" 모드에서 실제로 남길 카드 수를 정합니다. 1등 카드의 순혜택 기여도를 기준으로
 * EFFICIENT_RELATIVE_CUTOFF 비율 이상 기여하는 카드만 남깁니다. 1등마저 기여도가 0 이하인
 * (이론상 거의 일어나지 않는) 경우에는 걸러낼 기준 자체가 없으므로 원래 카드 수를 그대로
 * 돌려줍니다.
 */
export function resolveEfficientCardCount(result: WalletBlueprint): number {
  const netByCard = computeNetContributionByCard(result);
  const values = Array.from(netByCard.values());
  if (values.length === 0) return 0;
  const top = Math.max(...values);
  if (top <= 0) return result.selectedCards.length;
  const threshold = top * EFFICIENT_RELATIVE_CUTOFF;
  return values.filter((v) => v >= threshold).length;
}

export interface WalletModeOptions {
  /** 지갑에 담을 수 있는 카드 개수 상한 (사용자가 직접 입력) */
  maxCards: number;
  /** 지갑에 담긴 카드들의 연회비 합계 상한(원/년). 지정하지 않으면 제한 없음. */
  maxTotalAnnualFee?: number;
  /** "혜택 최대화" / "효율적" — 이 파일의 resolveEfficientCardCount 등으로 구현됩니다. */
  mode: OptimizationMode;
}

/**
 * "혜택 최대화" 모드는 관리 비용 없이 MILP를 한 번 풉니다 — 연회비만으로도, 선택된 카드는
 * 항상 자기 연회비 이상을 벌어주고 있어야 최적해가 되므로 별도 로직이 필요 없습니다.
 *
 * "효율적" 모드는 사용자가 정한 maxCards(최대 카드 수 슬라이더)와 무관하게, 먼저 후보 풀
 * 전체를 다 써도 되는 것처럼(maxCards = candidates.length) 한 번 풀어서 "이 지출 규모에서
 * 확실하게 이득인 카드가 원래 몇 장인지"(efficientRosterSize)를 슬라이더 값에 흔들리지
 * 않는 고정된 기준으로 구합니다. 그 다음 실제로 쓸 카드 수는 이 고정 기준과 사용자의
 * maxCards 중 더 작은 쪽으로 정해서, 필요하면 그 카드 수로 다시 한 번 풀어 지출을
 * 재배정합니다.
 *
 * 처음에는 사용자가 고른 maxCards 그대로 한 번만 풀고 그 결과에서 기여도 낮은 카드를
 * 걸러내는 방식이었는데, 그러면 슬라이더를 올릴 때마다 "1등 카드"의 기여도 자체가
 * 달라져서(카드가 늘어날수록 지출이 더 많은 카드로 쪼개지며 1등의 몫도 줄어듦) 추려지는
 * 기준이 매번 흔들리고, 심지어 슬라이더를 올렸는데 최종 카드 수·순혜택이 줄어드는
 * 경우까지 있었습니다. 기준을 maxCards와 무관한 고정값으로 뽑아두면 이 문제가 사라져서,
 * 슬라이더를 올릴수록 결과가 늘어나거나(그 고정 기준에 도달하기 전까지) 그대로
 * 유지되기만(그 이후) 하고, 절대 줄어들지 않습니다.
 */
export interface WalletModeSolveOutcome {
  blueprint: WalletBlueprint;
  /**
   * 효율적 모드에서, 이 지출 규모에서 "확실히 이득인 카드 수"로 정해진 고정 상한
   * (efficientRosterSize). 사용자의 maxCards 슬라이더 값과 무관하게 정해지는 값이라, 이
   * 값을 넘겨서 maxCards를 올려도 실제 조합에는 아무 변화가 없습니다. UI에서 "최대 카드
   * 수" +/- 컨트롤의 실질적인 상한으로 쓰고, 슬라이더가 이미 이 값을 넘어서 있으면 화면에
   * 보이는 숫자도 이 값으로 맞춰 내려서(WalletWizardPage 참고) "숫자를 올려도 반영이
   * 안 된다"는 혼란을 없앱니다. 혜택 최대화 모드에서는 이런 고정 상한이 없으므로 null.
   */
  efficientCeiling: number | null;
}

export async function solveWalletWithMode(
  candidates: WalletCard[],
  spending: MonthlySpend,
  options: WalletModeOptions,
): Promise<WalletModeSolveOutcome> {
  const { maxCards, maxTotalAnnualFee, mode } = options;
  if (mode === "maxBenefit") {
    const blueprint = await solveWalletOnce(candidates, spending, { maxCards, maxTotalAnnualFee });
    return { blueprint, efficientCeiling: null };
  }

  const globalBase = await solveWalletOnce(candidates, spending, {
    maxCards: candidates.length,
    maxTotalAnnualFee,
  });
  if (!globalBase.feasible || globalBase.selectedCards.length === 0) {
    return { blueprint: globalBase, efficientCeiling: 0 };
  }
  const efficientRosterSize = resolveEfficientCardCount(globalBase);
  const effectiveMaxCards = Math.min(efficientRosterSize, maxCards);
  if (effectiveMaxCards >= globalBase.selectedCards.length) {
    // 슬라이더가 이미 "효율적으로 추천할 카드 수" 전체를 담을 만큼 넉넉하면 재계산 없이
    // 그대로 씁니다.
    return { blueprint: globalBase, efficientCeiling: efficientRosterSize };
  }
  const blueprint = await solveWalletOnce(candidates, spending, { maxCards: effectiveMaxCards, maxTotalAnnualFee });
  return { blueprint, efficientCeiling: efficientRosterSize };
}

export interface UseWalletBlueprintAsyncResult {
  /** 가장 최근에 "완료된" 계산 결과. 계산 도중에는 이전 결과를 그대로 유지합니다(화면 깜빡임 방지). */
  result: WalletBlueprint;
  /** 지금 백그라운드(Worker)에서 새 조합을 계산하고 있는지 여부 */
  isComputing: boolean;
  /** Worker 초기화(Pyodide 부팅) 또는 계산 자체가 실패한 경우의 에러 메시지 */
  error: string | null;
  /** solveWalletWithMode가 함께 돌려준 효율적 모드 고정 상한. WalletModeSolveOutcome 참고. */
  efficientCeiling: number | null;
}

/**
 * candidates/spending/options가 바뀔 때마다 solveWalletWithMode로 새 계산을 요청하고,
 * "가장 마지막으로 시작한 계산"의 결과만 반영합니다(요청 순서가 뒤바뀌어 와도 오래된
 * 결과로 화면이 덮이지 않도록 세대 번호(generation)로 최신 계산만 골라 받습니다 — 효율적
 * 모드는 재계산이 한 번 더 걸릴 수 있어 응답 순서가 요청 순서와 다를 수 있습니다).
 */
export function useWalletBlueprintAsync(
  candidates: WalletCard[],
  spending: MonthlySpend,
  options: WalletModeOptions,
): UseWalletBlueprintAsyncResult {
  const [result, setResult] = useState<WalletBlueprint>(EMPTY_BLUEPRINT);
  const [isComputing, setIsComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [efficientCeiling, setEfficientCeiling] = useState<number | null>(null);
  const generationRef = useRef(0);
  // candidates는 매 렌더마다 새 배열/객체일 수 있으므로, 계산 시점에 최신 candidates를 쓰기 위해 ref로 들고 있는다.
  const candidatesRef = useRef(candidates);
  candidatesRef.current = candidates;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const spendingKey = JSON.stringify(spending);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const optionsKey = JSON.stringify(options);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const candidateIdsKey = candidates.map((c) => c.id).join(",");

  useEffect(() => {
    if (candidates.length === 0 || Object.values(spending).every((v) => !v)) {
      generationRef.current += 1;
      setResult({ ...EMPTY_BLUEPRINT, feasible: true });
      setIsComputing(false);
      setError(null);
      setEfficientCeiling(null);
      return;
    }

    const myGeneration = ++generationRef.current;
    setIsComputing(true);
    setError(null);

    solveWalletWithMode(candidatesRef.current, spending, options)
      .then(({ blueprint, efficientCeiling: ceiling }) => {
        if (generationRef.current !== myGeneration) return; // 더 최신 계산이 이미 시작된 뒤 도착한 응답 — 버린다
        setIsComputing(false);
        setResult(blueprint);
        setEfficientCeiling(ceiling);
      })
      .catch((err: unknown) => {
        if (generationRef.current !== myGeneration) return;
        setIsComputing(false);
        setError(err instanceof Error ? err.message : String(err));
      });
    // candidates/spending/options 내용이 바뀔 때만 재계산하도록 안정된 key로 의존성을 표현한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateIdsKey, spendingKey, optionsKey]);

  return { result, isComputing, error, efficientCeiling };
}
