import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

export interface FallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

export interface ErrorFallbackProps {
  error?: Error | null;
  title?: string;
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}

/**
 * 에러 발생 시 사용자에게 노출되는 폴백 UI 컴포넌트
 */
export function ErrorFallback({
  error,
  title,
  message,
  onRetry,
  compact = false,
}: ErrorFallbackProps) {
  const [showDetails, setShowDetails] = React.useState(false);

  const displayTitle = title || "문제가 발생했습니다";
  const displayMessage =
    message ||
    (error?.message ? error.message : "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");

  if (compact) {
    return (
      <div
        role="alert"
        className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50/90 px-3.5 py-2.5 text-xs text-rose-800 transition"
      >
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
          <span className="truncate font-medium">{displayMessage}</span>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="flex shrink-0 items-center gap-1 font-semibold text-rose-700 underline hover:text-rose-900 cursor-pointer"
          >
            <RefreshCw className="h-3 w-3" />
            다시 시도
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="rounded-2xl border border-rose-200 bg-rose-50/40 p-6 text-slate-800 shadow-xs transition-all"
    >
      <div className="flex items-start gap-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600 shadow-xs">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-slate-900">{displayTitle}</h3>
          <p className="mt-1 text-xs text-slate-600 leading-relaxed">{displayMessage}</p>

          {error && error.stack && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowDetails((prev) => !prev)}
                className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                <span>{showDetails ? "상세 정보 접기" : "오류 상세 정보 보기"}</span>
                {showDetails ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>
              {showDetails && (
                <pre className="mt-2 max-h-36 overflow-auto rounded-lg bg-slate-900/90 p-2.5 text-[10px] text-slate-100 font-mono leading-tight whitespace-pre-wrap">
                  {error.stack}
                </pre>
              )}
            </div>
          )}

          {onRetry && (
            <div className="mt-4">
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-rose-700 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                다시 시도
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((props: FallbackProps) => ReactNode);
  fallbackTitle?: string;
  fallbackMessage?: string;
  compact?: boolean;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * 예상치 못한 렌더링 예외를 포착하여 전체 화면 크래시를 방지하는 Error Boundary 컴포넌트
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.props.onError?.(error, errorInfo);
    console.error("[ErrorBoundary] Uncaught component error:", error, errorInfo);
  }

  resetErrorBoundary = (): void => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null });
  };

  override render(): ReactNode {
    const { hasError, error } = this.state;
    const {
      children,
      fallback,
      fallbackTitle,
      fallbackMessage,
      compact = false,
    } = this.props;

    if (hasError && error) {
      if (typeof fallback === "function") {
        return fallback({
          error,
          resetErrorBoundary: this.resetErrorBoundary,
        });
      }

      if (fallback) {
        return fallback;
      }

      return (
        <ErrorFallback
          error={error}
          title={fallbackTitle}
          message={fallbackMessage}
          compact={compact}
          onRetry={this.resetErrorBoundary}
        />
      );
    }

    return children;
  }
}
