import { useCallback, useState } from "react";

/**
 * 아주LLM API Gateway(Mindlogic FactChat 기반, OpenAI/Anthropic SDK 호환 프록시) 키를
 * 저장하는 훅입니다. 백엔드 서버가 없어서(연구계획서 기준 베타테스트 단계에나 도입 예정)
 * 키는 브라우저 저장소(세션/로컬)에만 남습니다.
 *
 * 챗봇 화면과, 이후 명세서 분석 화면(현재는 규칙 기반 파싱만 씀)에서도 같은 키를 그대로
 * 공유해서 쓸 수 있도록 features 폴더가 아니라 shared/hooks에 둡니다. 원래 있던
 * features/settings/ApiKeySettings.tsx는 "Groq API Key" 전용 UI였는데, 실제로는 어디에도
 * 연결돼 있지 않던 컴포넌트라 이번에 아주LLM 키 UI로 재사용합니다.
 */

export type StorageType = "session" | "local";

const KEY_STORAGE_NAME = "walletfit:azu-llm-api-key";
const STORAGE_TYPE_STORAGE_NAME = "walletfit:azu-llm-api-key-storage";

function readStoredStorageType(): StorageType {
  try {
    const raw = localStorage.getItem(STORAGE_TYPE_STORAGE_NAME);
    return raw === "local" ? "local" : "session";
  } catch {
    return "session";
  }
}

function readStoredApiKey(storageType: StorageType): string {
  try {
    const storage = storageType === "local" ? localStorage : sessionStorage;
    return storage.getItem(KEY_STORAGE_NAME) ?? "";
  } catch {
    return "";
  }
}

export interface UseAzuLlmApiKeyResult {
  /** 지금 입력창/badge에 반영되는 현재 값. save()를 부르기 전까지는 메모리에만 있습니다. */
  apiKey: string;
  storageType: StorageType;
  /** 입력창 onChange에 바로 연결하는 용도(아직 저장하지 않음). */
  setApiKey: (value: string) => void;
  /** 저장 방식 라디오 선택만 반영합니다(아직 저장하지 않음). */
  setStorageType: (type: StorageType) => void;
  /** 지금의 apiKey를 지정한(또는 현재 선택된) 저장 방식으로 실제 저장소에 씁니다. */
  save: (nextStorageType?: StorageType) => void;
  /** 키를 완전히 지웁니다(세션/로컬 저장소 모두). */
  remove: () => void;
}

export function useAzuLlmApiKey(): UseAzuLlmApiKeyResult {
  const [storageType, setStorageTypeState] = useState<StorageType>(readStoredStorageType);
  const [apiKey, setApiKeyState] = useState<string>(() => readStoredApiKey(readStoredStorageType()));

  const setApiKey = useCallback((value: string) => {
    setApiKeyState(value);
  }, []);

  const setStorageType = useCallback((type: StorageType) => {
    setStorageTypeState(type);
  }, []);

  const save = useCallback(
    (nextStorageType?: StorageType) => {
      // setState 업데이터 함수 안에서 저장소 쓰기(부수효과)를 하면 StrictMode 개발 모드에서
      // 업데이터가 두 번 호출돼 불필요하게 두 번 저장될 수 있어, 여기서 먼저 부수효과를
      // 끝내고 마지막에 단순 값 대입만 setState에 넘깁니다.
      const resolvedType = nextStorageType ?? storageType;
      try {
        localStorage.setItem(STORAGE_TYPE_STORAGE_NAME, resolvedType);
        if (resolvedType === "local") {
          localStorage.setItem(KEY_STORAGE_NAME, apiKey);
          sessionStorage.removeItem(KEY_STORAGE_NAME);
        } else {
          sessionStorage.setItem(KEY_STORAGE_NAME, apiKey);
          localStorage.removeItem(KEY_STORAGE_NAME);
        }
      } catch {
        // 시크릿 모드 저장 용량 제한 등으로 저장이 실패해도 무시합니다 — 메모리 상의
        // apiKey 상태는 이미 반영돼 있어 이번 세션 안에서는 계속 사용할 수 있습니다.
      }
      setStorageTypeState(resolvedType);
    },
    [apiKey, storageType],
  );

  const remove = useCallback(() => {
    setApiKeyState("");
    try {
      localStorage.removeItem(KEY_STORAGE_NAME);
      sessionStorage.removeItem(KEY_STORAGE_NAME);
    } catch {
      // 위와 동일하게 무시합니다.
    }
  }, []);

  return { apiKey, storageType, setApiKey, setStorageType, save, remove };
}
