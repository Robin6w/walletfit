import { useSyncExternalStore } from "react";
import conditions from "@data/catalog/benefit-conditions.json";

/**
 * 고르는 질문의 답(2026-11-04): 어느 통신사를 쓰나, 기후동행카드를 쓰나.
 * 통신사 전용 할인(KT 통신요금 자동이체 등)은 답이 없으면 엔진이 그 통신사일 확률(점유율)만큼 계산하고,
 * 답하면 맞는 통신사 혜택만 전액 계산한다. 질문과 확률은 data/catalog/benefit-conditions.json의 choices.
 * 답은 이 브라우저에만 남기고(localStorage), 모든 엔진 호출에 choices로 실어 보낸다(engineCall).
 */
export type ChoiceKey = keyof typeof conditions.choices;
export type Choices = Partial<Record<ChoiceKey, string>>;

export const CHOICE_QUESTIONS = conditions.choices as Record<
  ChoiceKey,
  { question: string; options: Record<string, { label: string; share: number }>; source: string }
>;

const STORAGE_KEY = "walletfit:choices";
const subs = new Set<() => void>();

function load(): Choices {
  try {
    const raw = typeof window === "undefined" ? null : window.localStorage.getItem(STORAGE_KEY);
    const v = raw ? (JSON.parse(raw) as Choices) : {};
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

let current: Choices = load();

export function getChoices(): Choices {
  return current;
}

/** value가 null이면 '잘 모름'(답 지움): 엔진은 확률로 계산한다 */
export function setChoice(key: ChoiceKey, value: string | null) {
  const next = { ...current };
  if (value) next[key] = value;
  else delete next[key];
  current = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // 저장이 막혀 있으면 이번 세션 안에서만 쓴다
  }
  subs.forEach((f) => f());
}

export function useChoices(): Choices {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    getChoices,
    getChoices,
  );
}

/** 엔진 요청에 답을 싣는다(답이 하나도 없거나 이미 choices가 있으면 그대로) */
export function withChoices<T>(args: T): T {
  if (!args || typeof args !== "object" || "choices" in (args as object) || Object.keys(current).length === 0) return args;
  return { ...args, choices: current };
}
