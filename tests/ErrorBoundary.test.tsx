import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ErrorBoundary } from "@/shared/components/ErrorBoundary";

function ThrowErrorComponent({ shouldThrow, message }: { shouldThrow: boolean; message?: string }) {
  if (shouldThrow) {
    throw new Error(message || "Test rendering error");
  }
  return <div>정상 렌더링 컨텐츠</div>;
}

function BuggyParent() {
  const [hasError, setHasError] = useState(true);

  return (
    <ErrorBoundary
      fallbackTitle="커스텀 오류 제목"
      fallbackMessage="커스텀 오류 메시지"
      onReset={() => setHasError(false)}
    >
      <ThrowErrorComponent shouldThrow={hasError} />
    </ErrorBoundary>
  );
}

describe("ErrorBoundary Component", () => {
  // Silence console.error from error boundary during tests
  const originalError = console.error;
  beforeEach(() => {
    console.error = vi.fn();
  });
  afterEach(() => {
    console.error = originalError;
  });

  it("에러가 없을 때는 자식 컴포넌트를 정상적으로 렌더링해야 한다", () => {
    render(
      <ErrorBoundary>
        <div>자식 컴포넌트 내용</div>
      </ErrorBoundary>
    );

    expect(screen.getByText("자식 컴포넌트 내용")).toBeInTheDocument();
  });

  it("자식 컴포넌트 렌더링 중 에러 발생 시 기본 폴백 UI를 렌더링해야 한다", () => {
    render(
      <ErrorBoundary fallbackTitle="오류가 발생했습니다" fallbackMessage="테스트용 에러 메시지">
        <ThrowErrorComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("오류가 발생했습니다")).toBeInTheDocument();
    expect(screen.getByText("테스트용 에러 메시지")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /다시 시도/i })).toBeInTheDocument();
  });

  it("onError 콜백이 제공되면 에러 발생 시 해당 콜백이 호출되어야 한다", () => {
    const onErrorMock = vi.fn();
    render(
      <ErrorBoundary onError={onErrorMock}>
        <ThrowErrorComponent shouldThrow={true} message="고유 에러 메시지" />
      </ErrorBoundary>
    );

    expect(onErrorMock).toHaveBeenCalledTimes(1);
    expect(onErrorMock.mock.calls[0][0].message).toBe("고유 에러 메시지");
  });

  it("함수형 fallback prop이 제공되면 해당 함수를 실행하여 렌더링해야 한다", () => {
    render(
      <ErrorBoundary
        fallback={({ error, resetErrorBoundary }) => (
          <div>
            <span>커스텀 렌더: {error.message}</span>
            <button onClick={resetErrorBoundary}>리셋 버튼</button>
          </div>
        )}
      >
        <ThrowErrorComponent shouldThrow={true} message="함수형 폴백 테스트" />
      </ErrorBoundary>
    );

    expect(screen.getByText("커스텀 렌더: 함수형 폴백 테스트")).toBeInTheDocument();
    expect(screen.getByText("리셋 버튼")).toBeInTheDocument();
  });

  it("ReactNode fallback prop이 제공되면 해당 노드를 렌더링해야 한다", () => {
    render(
      <ErrorBoundary fallback={<div>정적 폴백 UI</div>}>
        <ThrowErrorComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText("정적 폴백 UI")).toBeInTheDocument();
  });

  it("compact 속성이 true이면 간소화된 인라인 폴백 UI를 렌더링해야 한다", () => {
    render(
      <ErrorBoundary compact fallbackMessage="간소화 에러 안내">
        <ThrowErrorComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(screen.getByText("간소화 에러 안내")).toBeInTheDocument();
  });

  it("다시 시도 버튼을 클릭하면 onReset을 호출하고 에러 상태를 초기화해야 한다", () => {
    render(<BuggyParent />);

    expect(screen.getByText("커스텀 오류 제목")).toBeInTheDocument();
    const retryButton = screen.getByRole("button", { name: /다시 시도/i });
    fireEvent.click(retryButton);

    expect(screen.getByText("정상 렌더링 컨텐츠")).toBeInTheDocument();
  });
});
