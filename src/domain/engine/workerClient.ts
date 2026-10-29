/**
 * 계산 엔진 Worker(walletOptimizer.worker.ts)를 앱 전체에서 하나만 띄워 같이 씁니다.
 * Worker를 새로 만들 때마다 Pyodide를 다시 부팅해야 해서(수 초), 처음 쓸 때 한 번만 만듭니다.
 *
 * - engineCall: 새 계산(추천 엔진 v2 + calc.py). 응답 type "engine_result"
 * - legacySolve: 이전 계산(walletOptimizerCore.py). 응답 type "result"
 */
type Resolver = (data: unknown) => void;

let sharedWorker: Worker | null = null;
let seq = 0;
const pending = new Map<number, Resolver>();
let readyState: "booting" | "ready" | "error" = "booting";
let initError: string | null = null;
const readyListeners = new Set<() => void>();

function failAll(message: string) {
  for (const [id, resolve] of pending) {
    pending.delete(id);
    resolve({ ok: false, feasible: false, error: message });
  }
}

export function getWorker(): Worker {
  if (!sharedWorker) {
    sharedWorker = new Worker(new URL("./walletOptimizer.worker.ts", import.meta.url), { type: "module" });
    sharedWorker.onmessage = (event: MessageEvent) => {
      const { type, requestId, data, message } = event.data ?? {};
      if (type === "ready" || type === "init_error") {
        readyState = type === "ready" ? "ready" : "error";
        initError = type === "init_error" ? String(message) : null;
        readyListeners.forEach((fn) => fn());
        return;
      }
      if (type !== "result" && type !== "engine_result") return;
      const resolve = pending.get(requestId);
      if (!resolve) return;
      pending.delete(requestId);
      resolve(data);
    };
    // Pyodide 부팅 실패처럼 응답 자체가 오지 않는 실패는 onerror로만 잡힌다. 기다리던 요청을 모두 풀어 주고
    // Worker는 버린다(다음 요청에서 새로 띄움).
    sharedWorker.onerror = (event: ErrorEvent) => {
      failAll(event.message || "계산 엔진에서 오류가 났어요.");
      sharedWorker = null;
      readyState = "booting";
    };
    sharedWorker.onmessageerror = () => failAll("계산 엔진과 주고받는 중 오류가 났어요.");
  }
  return sharedWorker;
}

export function postRequest<T>(type: "engine" | "solve", payload: Record<string, unknown>): Promise<T> {
  const requestId = ++seq;
  const worker = getWorker();
  return new Promise<T>((resolve) => {
    pending.set(requestId, resolve as Resolver);
    worker.postMessage({ type, payload: { ...payload, requestId } });
  });
}

export function getEngineState() {
  return { state: readyState, error: initError };
}

export function onEngineStateChange(fn: () => void) {
  readyListeners.add(fn);
  return () => readyListeners.delete(fn);
}
