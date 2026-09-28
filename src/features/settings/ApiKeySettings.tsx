import { useState } from "react";
import { Settings, Key, ShieldAlert, CheckCircle2 } from "lucide-react";
import type { StorageType } from "@/shared/hooks/useAzuLlmApiKey";

export type { StorageType };

interface ApiKeySettingsProps {
  apiKey: string;
  storageType?: StorageType;
  onChange: (value: string) => void;
  onSave: (storageType?: StorageType) => void;
  onRemove: () => void;
  onStorageTypeChange?: (type: StorageType) => void;
}

/**
 * 아주LLM API Key 등록/해제 버튼과 팝오버입니다. 원래는 Groq 전용으로 만들어졌다가
 * (Gemini 연동 제거 과정에서 GeminiApiKeyContext.tsx가 삭제된 뒤 여기 직접 선언했던
 * 시절도 있었습니다) 실제로는 어디에도 연결되지 않은 채 남아 있던 컴포넌트인데, 이제
 * 챗봇(추천 결과 설명)에 실제로 연동하면서 아주LLM 전용으로 바꿨습니다. 키 상태 자체는
 * useAzuLlmApiKey 훅(shared/hooks)에서 관리해서, 나중에 명세서 분석 화면에서도 같은 키를
 * 그대로 재사용할 수 있습니다.
 */
export function ApiKeySettings({
  apiKey,
  storageType = "session",
  onChange,
  onSave,
  onRemove,
  onStorageTypeChange,
}: ApiKeySettingsProps) {
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [currentStorageType, setCurrentStorageType] = useState<StorageType>(storageType);
  const hasKey = apiKey.trim().length > 0;

  const handleStorageChange = (type: StorageType) => {
    setCurrentStorageType(type);
    onStorageTypeChange?.(type);
  };

  const handleSave = () => {
    onSave(currentStorageType);
    setShowKeyInput(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowKeyInput(!showKeyInput)}
        aria-expanded={showKeyInput}
        className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold border transition-all duration-250 ${
          hasKey
            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
        }`}
      >
        <Settings className={`h-3.5 w-3.5 ${hasKey ? "text-emerald-600" : "text-slate-500"}`} />
        {hasKey ? `아주LLM (${currentStorageType === "session" ? "세션" : "로컬"})` : "아주LLM API 설정"}
      </button>

      {showKeyInput && (
        <div
          aria-label="아주LLM API Key 설정"
          className="glass-panel absolute right-0 top-11 z-20 w-96 rounded-2xl border border-slate-200 p-5 shadow-2xl transition-all duration-300"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h4 className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
              <Key className="h-4 w-4 text-brand-blue" />
              아주LLM API Key 보안 설정
            </h4>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
              클라이언트 전용
            </span>
          </div>

          {/* 보안 안내 및 위험 경고 배너 */}
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs leading-relaxed text-amber-900">
            <div className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="space-y-1">
                <p className="font-semibold text-amber-950">보안 및 키 보관 주의사항</p>
                <p className="text-[11px] text-amber-800">
                  API Key는 별도의 백엔드 서버 없이 브라우저 내부에만 저장됩니다. XSS 위험 완화를 위해 공용 기기에서는
                  반드시 <strong className="underline">세션 보관</strong>을 권장합니다.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3.5 flex flex-col gap-3">
            <div>
              <label htmlFor="azu-llm-api-key-input" className="mb-1 block text-xs font-semibold text-slate-700">
                API Key 입력
              </label>
              <input
                id="azu-llm-api-key-input"
                type="password"
                placeholder="아주LLM API Key"
                value={apiKey}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-mono focus:border-brand-blue focus:outline-none"
              />
            </div>

            {/* 저장 위치/스코프 선택 */}
            <fieldset className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <legend className="px-1 text-[11px] font-bold text-slate-600">저장 방식 선택</legend>
              <div className="mt-1 space-y-2">
                <div className="flex items-start gap-2.5 text-xs">
                  <input
                    type="radio"
                    id="storage-type-session"
                    name="storageType"
                    value="session"
                    checked={currentStorageType === "session"}
                    onChange={() => handleStorageChange("session")}
                    className="mt-0.5 text-brand-blue focus:ring-brand-blue"
                  />
                  <label htmlFor="storage-type-session" className="cursor-pointer">
                    <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                      세션 스토리지 보관
                      <span className="rounded bg-brand-sky/50 px-1.5 py-0.2 text-[10px] font-bold text-brand-blue-deep">
                        권장
                      </span>
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      브라우저 탭을 닫으면 API 키가 메모리에서 즉시 파기되어 안전합니다.
                    </span>
                  </label>
                </div>

                <div className="flex items-start gap-2.5 text-xs">
                  <input
                    type="radio"
                    id="storage-type-local"
                    name="storageType"
                    value="local"
                    checked={currentStorageType === "local"}
                    onChange={() => handleStorageChange("local")}
                    className="mt-0.5 text-brand-blue focus:ring-brand-blue"
                  />
                  <label htmlFor="storage-type-local" className="cursor-pointer">
                    <span className="block font-semibold text-slate-800">로컬 스토리지 보관 (영구 유지)</span>
                    <span className="block text-[11px] text-slate-500">
                      브라우저를 닫아도 키가 유지됩니다. 개인 신뢰 기기에서만 사용하세요.
                    </span>
                  </label>
                </div>
              </div>
            </fieldset>

            <div className="flex items-center justify-between pt-1">
              <div className="text-[11px] text-slate-400">
                {hasKey && (
                  <span className="flex items-center gap-1 text-emerald-600 font-medium">
                    <CheckCircle2 className="h-3 w-3" /> 등록됨
                  </span>
                )}
              </div>
              <div className="flex justify-end gap-2">
                {hasKey && (
                  <button
                    type="button"
                    onClick={() => {
                      onRemove();
                      setShowKeyInput(false);
                    }}
                    className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors"
                  >
                    삭제
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSave}
                  className="rounded-lg bg-brand-blue px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-blue-deep transition-colors"
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
