/**
 * buildWalletBlueprint의 MILP 풀이를 메인(UI) 스레드가 아니라 이 Web Worker 안에서,
 * Pyodide(브라우저 안에서 도는 Python/WASM) + scipy.optimize.milp(HiGHS)로 수행합니다.
 *
 * 기존에는 javascript-lp-solver(순수 JS)가 메인 스레드에서 동기적으로 돌아서, 후보 카드가
 * 늘어나면(특히 "내 카드 중 추천" 범위처럼 후보 풀 상한이 없는 경로) 브라우저가 멈췄습니다.
 * 이 Worker는 (1) 별도 스레드에서 돌기 때문에 계산이 오래 걸려도 UI가 멈추지 않고,
 * (2) HiGHS는 순수 JS 구현보다 훨씬 빠른 MILP 솔버라 계산 자체도 빨라집니다.
 * 서버는 필요 없습니다 — Pyodide 런타임은 public/pyodide-dist에 정적 파일로 셀프호스팅합니다
 * (jsdelivr 같은 외부 CDN을 학교/사내망에서 막아두는 경우가 흔해서, 배포 안정성을 위해
 * 우리가 통제하는 정적 자산으로 서빙합니다).
 *
 * 이 Worker는 명시적으로 모듈(ESM) Worker로 띄웁니다(useWalletBlueprintAsync.ts에서
 * `new Worker(url, { type: "module" })`). Vite의 dev 서버는 `type:"module"`을 안 줘도
 * 개발 중에는 항상 Worker를 ES 모듈로 실행하는데(빌드에서만 IIFE 등 다른 포맷을 쓸 수 있음),
 * 예전 버전은 importScripts(클래식 Worker 전용 API)를 썼다가 dev 서버(`npm run dev`)에서
 * Worker가 조용히 부팅 실패하는 문제가 있었습니다(빌드 결과물로만 테스트해서 놓쳤던 버그).
 * 그래서 pyodide의 ESM 빌드(pyodide.mjs)를 동적 import로 불러오는 방식으로 바꿔서,
 * dev/build 어느 쪽에서 실행되든 동일하게 동작하게 했습니다.
 */
import walletOptimizerCoreSource from "./walletOptimizerCore.py?raw";

interface PyodideLike {
  loadPackage(names: string | string[]): Promise<unknown>;
  runPython(code: string): unknown;
  globals: { get(name: string): (...args: string[]) => string };
}

interface SolveRequestPayload {
  requestId: number;
  candidates: unknown;
  spending: unknown;
  options: unknown;
}

// self.location 기준으로 절대경로를 만들어서, dev 서버/서브패스 배포 어디서든 동작하게 한다.
const PYODIDE_DIST_PATH = new URL(`${import.meta.env.BASE_URL}pyodide-dist/`, self.location.href).href;

let pyodideReadyPromise: Promise<PyodideLike> | null = null;

function getPyodideInstance(): Promise<PyodideLike> {
  if (!pyodideReadyPromise) {
    pyodideReadyPromise = (async () => {
      // 정적 경로를 런타임에 조합해서 만들기 때문에, Vite가 이 동적 import를 빌드 시점에
      // 모듈 그래프로 분석/번들링하려 하지 않도록 @vite-ignore로 표시한다
      // (pyodide.mjs는 public/ 아래의 별도 정적 자산이라 번들 대상이 아님).
      const pyodideModule = (await import(/* @vite-ignore */ `${PYODIDE_DIST_PATH}pyodide.mjs`)) as {
        loadPyodide: (options: { indexURL: string }) => Promise<PyodideLike>;
      };
      const pyodide = await pyodideModule.loadPyodide({ indexURL: PYODIDE_DIST_PATH });
      await pyodide.loadPackage(["scipy", "numpy"]);
      pyodide.runPython(walletOptimizerCoreSource);
      return pyodide;
    })();
  }
  return pyodideReadyPromise;
}

// 미리 부팅을 시작해둔다 — 첫 solve 요청이 오기 전에 Pyodide/scipy 로딩을 끝내둘수록
// 사용자가 체감하는 첫 계산 대기 시간이 줄어든다.
getPyodideInstance()
  .then(() => postMessage({ type: "ready" }))
  .catch((err) => postMessage({ type: "init_error", message: String(err) }));

self.onmessage = async (event: MessageEvent<{ type: string; payload: SolveRequestPayload }>) => {
  const { type, payload } = event.data ?? {};
  if (type !== "solve") return;

  try {
    const pyodide = await getPyodideInstance();
    const solveFn = pyodide.globals.get("solve_wallet_json");
    const resultJson = solveFn(
      JSON.stringify(payload.candidates),
      JSON.stringify(payload.spending),
      JSON.stringify(payload.options),
    );
    postMessage({ type: "result", requestId: payload.requestId, data: JSON.parse(resultJson) });
  } catch (err) {
    postMessage({
      type: "result",
      requestId: payload.requestId,
      data: { feasible: false, error: String(err) },
    });
  }
};
