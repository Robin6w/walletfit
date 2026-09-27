import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ToastProvider } from "@/shared/contexts/ToastContext";
import { useToast } from "@/shared/hooks/useToast";

function TestToastConsumer() {
  const toast = useToast();

  return (
    <div>
      <button type="button" onClick={() => toast.success("성공 메시지입니다.")}>
        성공 알림
      </button>
      <button type="button" onClick={() => toast.error("에러 메시지입니다.")}>
        에러 알림
      </button>
      <button type="button" onClick={() => toast.warning("경고 메시지입니다.")}>
        경고 알림
      </button>
      <button type="button" onClick={() => toast.info("정보 메시지입니다.")}>
        정보 알림
      </button>
      <button
        type="button"
        onClick={() => toast.showToast("커스텀 시간 메시지", "info", 1000)}
      >
        커스텀 알림
      </button>
      <button type="button" onClick={() => toast.clearToasts()}>
        전체 알림 삭제
      </button>
    </div>
  );
}

describe("ToastContext & ToastProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
  });

  it("ToastProvider 렌더링 시 자식 컴포넌트와 알림 컨테이너 영역이 올바르게 렌더링되어야 한다", () => {
    render(
      <ToastProvider>
        <div data-testid="child">테스트 자식 엘리먼트</div>
      </ToastProvider>
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "알림 메시지" })).toBeInTheDocument();
  });

  it("success 알림 발생 시 role='status'와 aria-live='polite'가 부여되고 메시지가 렌더링되어야 한다", () => {
    render(
      <ToastProvider>
        <TestToastConsumer />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "성공 알림" }));

    const statusElement = screen.getByRole("status");
    expect(statusElement).toBeInTheDocument();
    expect(statusElement).toHaveTextContent("성공 메시지입니다.");
    expect(statusElement).toHaveAttribute("aria-live", "polite");
  });

  it("error 및 warning 알림 발생 시 role='alert'가 부여되고 메시지가 렌더링되어야 한다", () => {
    render(
      <ToastProvider>
        <TestToastConsumer />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "에러 알림" }));
    const errorAlert = screen.getByRole("alert");
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert).toHaveTextContent("에러 메시지입니다.");

    fireEvent.click(screen.getByRole("button", { name: "경고 알림" }));
    const alerts = screen.getAllByRole("alert");
    expect(alerts).toHaveLength(2);
    expect(alerts[1]).toHaveTextContent("경고 메시지입니다.");
  });

  it("info 알림 발생 시 role='status'로 렌더링되어야 한다", () => {
    render(
      <ToastProvider>
        <TestToastConsumer />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "정보 알림" }));
    const infoStatus = screen.getByRole("status");
    expect(infoStatus).toHaveTextContent("정보 메시지입니다.");
  });

  it("닫기 버튼(X)을 클릭하면 해당 토스트가 DOM에서 즉시 제거되어야 한다", () => {
    render(
      <ToastProvider>
        <TestToastConsumer />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "성공 알림" }));
    expect(screen.getByText("성공 메시지입니다.")).toBeInTheDocument();

    const closeBtn = screen.getByRole("button", { name: "알림 닫기" });
    fireEvent.click(closeBtn);

    expect(screen.queryByText("성공 메시지입니다.")).not.toBeInTheDocument();
  });

  it("지정된 duration 시간이 지나면 토스트가 자동으로 소멸되어야 한다", () => {
    render(
      <ToastProvider>
        <TestToastConsumer />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "커스텀 알림" }));
    expect(screen.getByText("커스텀 시간 메시지")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(screen.getByText("커스텀 시간 메시지")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(screen.queryByText("커스텀 시간 메시지")).not.toBeInTheDocument();
  });

  it("기본 duration(4000ms) 경과 시 토스트가 자동으로 소멸되어야 한다", () => {
    render(
      <ToastProvider>
        <TestToastConsumer />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "성공 알림" }));
    expect(screen.getByText("성공 메시지입니다.")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3999);
    });
    expect(screen.getByText("성공 메시지입니다.")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(screen.queryByText("성공 메시지입니다.")).not.toBeInTheDocument();
  });

  it("clearToasts 호출 시 모든 활성 토스트가 즉시 제거되어야 한다", () => {
    render(
      <ToastProvider>
        <TestToastConsumer />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "성공 알림" }));
    fireEvent.click(screen.getByRole("button", { name: "에러 알림" }));

    expect(screen.getByText("성공 메시지입니다.")).toBeInTheDocument();
    expect(screen.getByText("에러 메시지입니다.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "전체 알림 삭제" }));

    expect(screen.queryByText("성공 메시지입니다.")).not.toBeInTheDocument();
    expect(screen.queryByText("에러 메시지입니다.")).not.toBeInTheDocument();
  });

  it("ToastProvider 없이 useToast를 호출해도 안전하게 fallback되어 에러가 발생하지 않아야 한다", () => {
    render(<TestToastConsumer />);

    // 클릭 시 크래시 없이 안전하게 동작
    expect(() => {
      fireEvent.click(screen.getByRole("button", { name: "성공 알림" }));
    }).not.toThrow();
  });
});
