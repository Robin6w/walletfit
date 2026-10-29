import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useSavedCards } from "@/domain/state/useSavedCards";
import { useAzuLlmApiKey, type UseAzuLlmApiKeyResult } from "@/shared/hooks/useAzuLlmApiKey";
import { useSavedWallet } from "@/v1/state";
import type { LastRun, SavedWalletV2 } from "@/v2/app/state";

interface AppDataValue {
  myCards: ReturnType<typeof useSavedCards>;
  wallet: SavedWalletV2 | null;
  setWallet: (w: SavedWalletV2 | null) => void;
  toggleTodo: (id: string) => void;
  azuLlm: UseAzuLlmApiKeyResult;
  lastRun: LastRun | null;
  setLastRun: (r: LastRun | null) => void;
}

const Ctx = createContext<AppDataValue | null>(null);

/** 화면 여러 곳이 같이 쓰는 값: 내 카드, 저장한 지갑, 아주LLM 키, 마지막 계산 결과 */
export function AppDataProvider({ children }: { children: ReactNode }) {
  const myCards = useSavedCards();
  const saved = useSavedWallet();
  const azuLlm = useAzuLlmApiKey();
  const [lastRun, setLastRun] = useState<LastRun | null>(null);
  const value = useMemo<AppDataValue>(
    () => ({
      myCards,
      wallet: saved.wallet as SavedWalletV2 | null,
      setWallet: (w) => saved.setWallet(w),
      toggleTodo: saved.toggleTodo,
      azuLlm,
      lastRun,
      setLastRun,
    }),
    // saved.setWallet·toggleTodo는 안정적인 함수
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [myCards, saved.wallet, azuLlm, lastRun],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppData(): AppDataValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("AppDataProvider 밖에서 useAppData를 불렀어요");
  return v;
}
