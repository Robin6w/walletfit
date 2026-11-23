/**
 * 배포 직후 옛 탭 오류 처리(2026-11-23).
 * 새 배포가 올라가면 예전 빌드의 화면 조각(assets/Cards-xxxx.js 등)이 서버에서 사라진다. 배포 전에 열어 둔 탭은
 * 다른 메뉴로 넘어갈 때 그 옛 파일을 불러오려다 404로 실패해 오류 화면이 뜬다. 이때 한 번 새로고침해 새 빌드를 받는다.
 * 새로고침해도 또 실패하면(진짜 네트워크 문제 등) 무한 새로고침이 되지 않게 짧은 시간 안에는 다시 하지 않는다.
 */

const KEY = "walletfit:stale-chunk-reload-at";
/** 이 시간 안에 이미 새로고침했다면 다시 하지 않는다 */
export const RELOAD_GUARD_MS = 10_000;

const PATTERNS = [
  "Failed to fetch dynamically imported module", // Chrome·Edge
  "Importing a module script failed", // Safari
  "error loading dynamically imported module", // Firefox
  "Unable to preload CSS",
  "Loading chunk",
];

/** 화면 조각(동적 import)을 못 불러온 오류인지 */
export function isStaleChunkError(err: unknown): boolean {
  if (!err) return false;
  const e = err as { name?: unknown; message?: unknown };
  if (e.name === "ChunkLoadError") return true;
  const msg = typeof e.message === "string" ? e.message : typeof err === "string" ? err : "";
  return PATTERNS.some((p) => msg.includes(p));
}

/** 최근에 새로고침하지 않았으면 새로고침하고 true. 저장소를 못 쓰면 반복 위험이 있어 하지 않는다 */
export function reloadOnceForStaleChunk(reload: () => void = () => window.location.reload(), now: number = Date.now()): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(KEY) ?? 0);
    if (last && now - last < RELOAD_GUARD_MS) return false;
    window.sessionStorage.setItem(KEY, String(now));
  } catch {
    return false;
  }
  reload();
  return true;
}

let installed = false;

/** 앱 시작 때 한 번: Vite가 알리는 조각 불러오기 실패와 잡히지 않은 같은 오류에 새로고침을 건다 */
export function installStaleChunkReload(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("vite:preloadError", (ev) => {
    if (reloadOnceForStaleChunk()) ev.preventDefault();
  });
  window.addEventListener("unhandledrejection", (ev) => {
    if (isStaleChunkError(ev.reason) && reloadOnceForStaleChunk()) ev.preventDefault();
  });
}
