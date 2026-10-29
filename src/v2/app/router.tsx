import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from "react";

/**
 * 해시 주소(#/wallet 등)로 화면을 나눈다. 새 라이브러리 없이 hashchange만 쓴다.
 *  - 브라우저 뒤로 가기가 화면·단계마다 동작한다
 *  - 상담 창이 지금 보고 있는 화면을 알 수 있다(useRoute)
 */
export interface Route {
  /** '/make/own/result' 처럼 '#' 뒤, '?' 앞 */
  path: string;
  parts: string[];
  query: URLSearchParams;
}

function readHash(): string {
  if (typeof window === "undefined") return "";
  return window.location.hash;
}

function subscribe(cb: () => void) {
  window.addEventListener("hashchange", cb);
  window.addEventListener("popstate", cb);
  return () => {
    window.removeEventListener("hashchange", cb);
    window.removeEventListener("popstate", cb);
  };
}

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, "") || "/";
  const [p, q = ""] = raw.split("?");
  const path = ("/" + p.replace(/^\/+/, "")).replace(/\/+$/, "") || "/";
  return { path, parts: path.split("/").filter(Boolean), query: new URLSearchParams(q) };
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, readHash, () => "");
  return parseHash(hash);
}

/** '#/wallet' 또는 '/wallet' 모두 받는다 */
export function toHash(to: string): string {
  return to.startsWith("#") ? to : `#${to.startsWith("/") ? to : `/${to}`}`;
}

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  const next = toHash(to);
  if (next === window.location.hash) return;
  if (opts.replace) {
    window.history.replaceState(null, "", next);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.hash = next;
  }
}

/** 화면 이동 링크. 기본 a 태그라서 새 탭 열기·키보드가 그대로 동작한다 */
export function Link({ to, onClick, ...rest }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { to: string }) {
  return (
    <a
      href={toHash(to)}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
      }}
      {...rest}
    />
  );
}
