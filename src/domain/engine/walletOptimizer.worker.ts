/**
 * 카드 계산 엔진 Web Worker (Pyodide + scipy).
 *
 * 메인(UI) 스레드를 막지 않도록 브라우저 안의 Python(WASM)에서 계산합니다. Pyodide 런타임은
 * public/pyodide-dist에 정적 파일로 직접 서빙합니다(학교/사내망에서 외부 CDN이 막히는 경우 대비).
 *
 * 메시지 두 종류를 받습니다.
 *  - "engine" (새 계산): 혜택 표(data/catalog/cards-benefit.json)를 읽는 추천 엔진 v2(milp.py)로 조합을 고르고,
 *    카드 한 장 계산기(calc.py)로 화면 숫자와 계산 근거(trace)를 만듭니다. wf_engine.py가 둘을 묶습니다.
 *    fn: recommend | explain | rank | brands | categoryRank | cardsInfo | alt
 *  - "solve" (이전 계산): walletOptimizerCore.py. 회귀 확인용 legacy 화면에서만 씁니다.
 *
 * 모듈(ESM) Worker로 띄웁니다(workerClient.ts의 `new Worker(url, { type: "module" })`).
 * dev 서버와 빌드 결과물에서 똑같이 동작하도록 pyodide.mjs를 동적 import로 불러옵니다.
 */
import walletOptimizerCoreSource from "./walletOptimizerCore.py?raw";
import calcSource from "./py/calc.py?raw";
import milpSource from "./py/milp.py?raw";
import engineSource from "./py/wf_engine.py?raw";
import benefitCatalogUrl from "@data/catalog/cards-benefit.json?url";
import assumptionsUrl from "@data/catalog/assumptions.json?url";

interface PyProxyFn {
  (...args: string[]): string;
}

interface PyodideLike {
  loadPackage(names: string | string[]): Promise<unknown>;
  loadedPackages: Record<string, string>;
  runPython(code: string): unknown;
  FS: { writeFile(path: string, data: string): void; mkdirTree(path: string): void };
  pyimport(name: string): Record<string, PyProxyFn>;
  globals: { get(name: string): PyProxyFn };
}

interface SolveRequestPayload {
  requestId: number;
  candidates: unknown;
  spending: unknown;
  options: unknown;
}

interface EngineRequestPayload {
  requestId: number;
  fn: "recommend" | "explain" | "rank" | "brands" | "categoryRank" | "cardsInfo" | "alt";
  args: unknown;
}

const PYODIDE_DIST_PATH = new URL(`${import.meta.env.BASE_URL}pyodide-dist/`, self.location.href).href;
const PY_DIR = "/home/pyodide/walletfit";

function errorText(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

let pyodideReadyPromise: Promise<{ pyodide: PyodideLike; engine: Record<string, PyProxyFn> }> | null = null;
let legacyLoaded = false;

function getRuntime() {
  if (!pyodideReadyPromise) {
    pyodideReadyPromise = (async () => {
      const pyodideModule = (await import(/* @vite-ignore */ `${PYODIDE_DIST_PATH}pyodide.mjs`)) as {
        loadPyodide: (options: { indexURL: string }) => Promise<PyodideLike>;
      };
      const [pyodide, catalogText, assumptionsText] = await Promise.all([
        pyodideModule.loadPyodide({ indexURL: PYODIDE_DIST_PATH }),
        fetch(benefitCatalogUrl).then((r) => {
          if (!r.ok) throw new Error(`혜택 표를 불러오지 못했어요 (${r.status})`);
          return r.text();
        }),
        fetch(assumptionsUrl).then((r) => r.text()),
      ]);
      await pyodide.loadPackage(["scipy", "numpy"]);
      // loadPackage는 파일이 없어도 예외 없이 넘어가서, 나중에 'No module named scipy'로만 보인다. 여기서 바로 알려 준다
      for (const name of ["numpy", "scipy"]) {
        if (!pyodide.loadedPackages[name]) {
          throw new Error(
            `계산 엔진에 필요한 ${name} 파일을 불러오지 못했어요. public/pyodide-dist 폴더에 ${name} wheel(.whl) 파일이 있는지 확인한 뒤 새로고침해 주세요.`,
          );
        }
      }
      // 이전 계산(walletOptimizerCore.py)은 v1 화면이 요청할 때만 불러온다(scipy 불러오기에 3초 넘게 걸림, 2026-10-29)
      pyodide.FS.mkdirTree(PY_DIR);
      pyodide.FS.writeFile(`${PY_DIR}/calc.py`, calcSource);
      pyodide.FS.writeFile(`${PY_DIR}/milp.py`, milpSource);
      pyodide.FS.writeFile(`${PY_DIR}/wf_engine.py`, engineSource);
      pyodide.runPython(`import sys\nif "${PY_DIR}" not in sys.path: sys.path.insert(0, "${PY_DIR}")`);
      const engine = pyodide.pyimport("wf_engine");
      engine.init_json(catalogText, assumptionsText);
      return { pyodide, engine };
    })();
  }
  return pyodideReadyPromise;
}

// 첫 요청 전에 미리 부팅해 둔다(Pyodide·scipy·혜택 표 로딩에 몇 초 걸림).
getRuntime()
  .then(({ pyodide }) => {
    postMessage({ type: "ready" });
    // 준비가 끝나면 이미 와 있던 요청부터 처리하고, 그다음 한가할 때 MILP용 scipy를 미리 불러 둔다
    setTimeout(() => {
      try {
        pyodide.runPython("import milp\nmilp.preload()");
      } catch {
        // 미리 불러오기 실패는 무시한다(실제 계산 때 다시 불러오며 오류를 알린다)
      }
    }, 0);
  })
  .catch((err) => postMessage({ type: "init_error", message: errorText(err) }));

const ENGINE_FN: Record<EngineRequestPayload["fn"], string> = {
  recommend: "recommend_json",
  explain: "explain_json",
  rank: "rank_json",
  brands: "brands_json",
  categoryRank: "category_rank_json",
  cardsInfo: "cards_info_json",
  alt: "alt_json",
};

self.onmessage = async (event: MessageEvent<{ type: string; payload: SolveRequestPayload | EngineRequestPayload }>) => {
  const { type, payload } = event.data ?? {};
  if (type === "engine") {
    const p = payload as EngineRequestPayload;
    try {
      const { engine } = await getRuntime();
      const out = engine[ENGINE_FN[p.fn]](JSON.stringify(p.args));
      postMessage({ type: "engine_result", requestId: p.requestId, data: JSON.parse(String(out)) });
    } catch (err) {
      postMessage({ type: "engine_result", requestId: p.requestId, data: { ok: false, error: errorText(err) } });
    }
    return;
  }
  if (type !== "solve") return;
  const p = payload as SolveRequestPayload;
  try {
    const { pyodide } = await getRuntime();
    if (!legacyLoaded) {
      pyodide.runPython(walletOptimizerCoreSource);
      legacyLoaded = true;
    }
    const solveFn = pyodide.globals.get("solve_wallet_json");
    const resultJson = solveFn(JSON.stringify(p.candidates), JSON.stringify(p.spending), JSON.stringify(p.options));
    postMessage({ type: "result", requestId: p.requestId, data: JSON.parse(resultJson) });
  } catch (err) {
    postMessage({ type: "result", requestId: p.requestId, data: { feasible: false, error: String(err) } });
  }
};
