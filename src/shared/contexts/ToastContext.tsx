import { useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import {
  type ToastType,
  type ToastItem,
  type ToastContextType,
  ToastContext,
} from "./toastContextDef";

export type { ToastType, ToastItem, ToastContextType };

const DEFAULT_DURATION = 4000;

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
    setToasts([]);
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "info", duration = DEFAULT_DURATION) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const newToast: ToastItem = { id, type, message, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        const timer = setTimeout(() => {
          dismissToast(id);
        }, duration);
        timersRef.current.set(id, timer);
      }
    },
    [dismissToast],
  );

  const success = useCallback(
    (message: string, duration?: number) => showToast(message, "success", duration),
    [showToast],
  );
  const error = useCallback(
    (message: string, duration?: number) => showToast(message, "error", duration),
    [showToast],
  );
  const info = useCallback(
    (message: string, duration?: number) => showToast(message, "info", duration),
    [showToast],
  );
  const warning = useCallback(
    (message: string, duration?: number) => showToast(message, "warning", duration),
    [showToast],
  );

  useEffect(() => {
    const currentTimers = timersRef.current;
    return () => {
      currentTimers.forEach((timer) => clearTimeout(timer));
      currentTimers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider
      value={{
        toasts,
        showToast,
        success,
        error,
        info,
        warning,
        dismissToast,
        clearToasts,
      }}
    >
      {children}
      {/* 전역 토스트 렌더링 컨테이너 */}
      <section
        aria-label="알림 메시지"
        className="fixed top-5 right-5 z-50 flex max-w-sm w-full flex-col gap-2.5 pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((toast) => {
          const isAlert = toast.type === "error" || toast.type === "warning";
          return (
            <div
              key={toast.id}
              role={isAlert ? "alert" : "status"}
              aria-live="polite"
              className={`pointer-events-auto flex items-start justify-between gap-3 rounded-2xl border p-4 shadow-xl backdrop-blur-md transition-all duration-300 ${
                toast.type === "success"
                  ? "border-emerald-200 bg-emerald-50/95 text-emerald-900 shadow-emerald-500/10"
                  : toast.type === "error"
                  ? "border-rose-200 bg-rose-50/95 text-rose-900 shadow-rose-500/10"
                  : toast.type === "warning"
                  ? "border-amber-200 bg-amber-50/95 text-amber-900 shadow-amber-500/10"
                  : "border-blue-200 bg-blue-50/95 text-blue-900 shadow-blue-500/10"
              }`}
            >
              <div className="flex items-start gap-3">
                {toast.type === "success" && (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                )}
                {toast.type === "error" && (
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                )}
                {toast.type === "warning" && (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                )}
                {toast.type === "info" && (
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                )}
                <p className="text-xs font-semibold leading-relaxed whitespace-pre-wrap">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-black/5 hover:text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400 transition"
                aria-label="알림 닫기"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </section>
    </ToastContext.Provider>
  );
}
