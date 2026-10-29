import { useEffect, useRef, useState } from "react";
import { engineCall, type EngineFn } from "@/domain/engine/walletEngine";
import { ENGINE_VERSION } from "@/domain/engine/engineVersion";

/**
 * v2 화면의 계산 엔진 호출. 같은 인자로 다시 부르면 저장해 둔 결과를 바로 쓴다.
 * 조합 찾기는 7~9초 걸려서, 결과 → 내 지갑 → 결과로 돌아올 때 다시 계산하지 않게 한다.
 * 실패한 결과(ok: false)는 저장하지 않아서 '다시 계산'이 실제로 다시 계산한다.
 *
 * 2026-10-29: 조합 찾기(recommend·alt) 결과는 브라우저에도 최근 8개를 남긴다. 새로고침 뒤 결과 화면으로 바로
 * 들어와도(엔진 준비 약 10초 + 계산) 같은 입력이면 기다리지 않는다. 엔진 코드나 혜택 표가 바뀌면 버전이 달라져 버린다.
 */
const MAX_ENTRIES = 30;
const inflight = new Map<string, Promise<unknown>>();
const done = new Map<string, unknown>();

const PERSIST_KEY = "walletfit:v2:engine-results";
const PERSIST_FNS: ReadonlySet<EngineFn> = new Set<EngineFn>(["recommend", "alt"]);
const PERSIST_MAX = 8;
type Persisted = { ver: string; items: [string, unknown][] };

function keyOf(fn: EngineFn, args: unknown): string {
  return `${fn}:${JSON.stringify(args)}`;
}

function loadPersisted(): [string, unknown][] {
  if (!ENGINE_VERSION) return [];
  try {
    const raw = window.localStorage.getItem(PERSIST_KEY);
    const parsed = raw ? (JSON.parse(raw) as Persisted) : null;
    return parsed && parsed.ver === ENGINE_VERSION && Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

const persisted: [string, unknown][] = loadPersisted();
for (const [k, v] of persisted) done.set(k, v);

function persist(key: string, value: unknown) {
  if (!ENGINE_VERSION) return;
  const i = persisted.findIndex(([k]) => k === key);
  if (i >= 0) persisted.splice(i, 1);
  persisted.push([key, value]);
  while (persisted.length > PERSIST_MAX) persisted.shift();
  try {
    window.localStorage.setItem(PERSIST_KEY, JSON.stringify({ ver: ENGINE_VERSION, items: persisted } satisfies Persisted));
  } catch {
    // 저장 공간이 모자라거나 막혀 있으면 이번 세션 안에서만 다시 쓴다
  }
}

function remember(key: string, value: unknown, fn: EngineFn) {
  done.delete(key);
  done.set(key, value);
  while (done.size > MAX_ENTRIES) done.delete(done.keys().next().value as string);
  if (PERSIST_FNS.has(fn)) persist(key, value);
}

export function cachedEngineCall<T extends { ok: boolean }>(fn: EngineFn, args: unknown): Promise<T> {
  const key = keyOf(fn, args);
  if (done.has(key)) return Promise.resolve(done.get(key) as T);
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const p = engineCall<T>(fn, args).then((res) => {
    inflight.delete(key);
    if (res && res.ok) remember(key, res, fn);
    return res;
  });
  inflight.set(key, p);
  return p;
}

/** 저장해 둔 결과가 있으면 바로 돌려준다(첫 그림에서 깜빡임 없이) */
export function peekEngine<T>(fn: EngineFn, args: unknown): T | null {
  return (done.get(keyOf(fn, args)) as T | undefined) ?? null;
}

export interface EngineState<T> {
  data: T | null;
  /** 다시 계산하는 동안에도 직전 결과를 보여 주기 위해 남긴다 */
  lastGood: T | null;
  isComputing: boolean;
  error: string | null;
}

/** args가 null이면 계산하지 않는다. key가 바뀌면 다시 계산하고 마지막으로 시작한 계산만 반영한다 */
export function useEngine<T extends { ok: boolean; error?: string }>(fn: EngineFn, args: unknown | null): EngineState<T> {
  const key = args === null ? "" : keyOf(fn, args);
  const [state, setState] = useState<EngineState<T>>(() => {
    const hit = args === null ? null : peekEngine<T>(fn, args);
    return { data: hit, lastGood: hit, isComputing: args !== null && !hit, error: null };
  });
  const gen = useRef(0);
  useEffect(() => {
    const mine = ++gen.current;
    if (args === null) {
      setState((s) => ({ ...s, data: null, isComputing: false, error: null }));
      return;
    }
    const hit = peekEngine<T>(fn, args);
    if (hit) {
      setState({ data: hit, lastGood: hit, isComputing: false, error: null });
      return;
    }
    setState((s) => ({ ...s, data: null, isComputing: true, error: null }));
    cachedEngineCall<T>(fn, args).then((res) => {
      if (gen.current !== mine) return;
      if (!res || !res.ok) setState((s) => ({ ...s, isComputing: false, error: res?.error ?? "계산하지 못했어요" }));
      else setState({ data: res, lastGood: res, isComputing: false, error: null });
    });
    // key가 args 내용 전체를 담는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fn, key]);
  return state;
}
