import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SpendingSimulator } from "@/shared/components/SpendingSimulator";
import { getSliderMax } from "@/domain/state/useMonthlySpend";
import type { SpendCategory, MonthlySpend } from "@/domain/types/card";

describe("SpendingSimulator Component Smoke Test", () => {
  const mockCategories: SpendCategory[] = [
    { id: "transport", label: "대중교통" },
    { id: "mart", label: "마트" },
  ];

  const mockSpending: MonthlySpend = {
    transport: 120000,
    mart: 350000,
  };

  const mockOnChange = vi.fn();
  const mockOnReset = vi.fn();

  it("헤더, 카테고리 정보, 슬라이더, 숫자 입력창 및 퀵 입력 버튼들이 올바르게 렌더링되어야 한다", () => {
    render(
      <SpendingSimulator
        categories={mockCategories}
        spending={mockSpending}
        onChange={mockOnChange}
      />
    );

    // 컴포넌트 타이틀 확인
    expect(screen.getByText("월 지출 시뮬레이터")).toBeInTheDocument();

    // 합계 지출액 렌더링 확인 (120,000 + 350,000 = 470,000원)
    expect(screen.getByText("470,000원")).toBeInTheDocument();

    // 카테고리 텍스트 확인
    expect(screen.getByText("대중교통")).toBeInTheDocument();
    expect(screen.getByText("마트")).toBeInTheDocument();

    // 퀵 스텝 5만 버튼 확인
    const quickButtons = screen.getAllByRole("button", { name: "5만" });
    expect(quickButtons.length).toBe(2);
  });

  it("슬라이더(range) 값을 변경할 때 onChange 핸들러가 올바르게 호출되어야 한다", () => {
    render(
      <SpendingSimulator
        categories={mockCategories}
        spending={mockSpending}
        onChange={mockOnChange}
      />
    );

    const rangeInputs = screen.getAllByRole("slider");
    expect(rangeInputs.length).toBe(2);

    fireEvent.change(rangeInputs[0], { target: { value: "150000" } });
    expect(mockOnChange).toHaveBeenCalledWith("transport", 150000);
  });

  it("수치 입력창(number) 값을 변경할 때 onChange 핸들러가 올바르게 호출되어야 한다", () => {
    render(
      <SpendingSimulator
        categories={mockCategories}
        spending={mockSpending}
        onChange={mockOnChange}
      />
    );

    const numberInputs = screen.getAllByRole("spinbutton");
    expect(numberInputs.length).toBe(2);

    fireEvent.change(numberInputs[1], { target: { value: "400000" } });
    expect(mockOnChange).toHaveBeenCalledWith("mart", 400000);
  });

  it("퀵 버튼 클릭 시 onChange 핸들러가 올바르게 호출되어야 한다", () => {
    render(
      <SpendingSimulator
        categories={mockCategories}
        spending={mockSpending}
        onChange={mockOnChange}
      />
    );

    const quickButtons = screen.getAllByRole("button", { name: "10만" });
    fireEvent.click(quickButtons[0]);
    expect(mockOnChange).toHaveBeenCalledWith("transport", 100000);
  });

  it("onReset 전달 시 전체 초기화 버튼이 노출되고 사용자 확인 후 onReset이 호출되어야 한다", () => {
    const originalConfirm = window.confirm;
    const confirmMock = vi.fn().mockReturnValue(true);
    window.confirm = confirmMock;

    render(
      <SpendingSimulator
        categories={mockCategories}
        spending={mockSpending}
        onChange={mockOnChange}
        onReset={mockOnReset}
      />
    );

    const resetButton = screen.getByRole("button", { name: /전체 초기화/i });
    expect(resetButton).toBeInTheDocument();

    fireEvent.click(resetButton);
    expect(confirmMock).toHaveBeenCalled();
    expect(mockOnReset).toHaveBeenCalledTimes(1);

    window.confirm = originalConfirm;
  });

  it("사용자가 초기화 확인 창에서 취소를 누르면 onReset이 호출되지 않아야 한다", () => {
    const originalConfirm = window.confirm;
    const confirmMock = vi.fn().mockReturnValue(false);
    window.confirm = confirmMock;
    mockOnReset.mockClear();

    render(
      <SpendingSimulator
        categories={mockCategories}
        spending={mockSpending}
        onChange={mockOnChange}
        onReset={mockOnReset}
      />
    );

    const resetButton = screen.getByRole("button", { name: /전체 초기화/i });
    fireEvent.click(resetButton);
    expect(confirmMock).toHaveBeenCalled();
    expect(mockOnReset).not.toHaveBeenCalled();

    window.confirm = originalConfirm;
  });

  it("getSliderMax는 금액에 따라 100만/300만/500만 등으로 슬라이더 최대값을 동적 스케일링해야 한다", () => {
    expect(getSliderMax(0)).toBe(1000000);
    expect(getSliderMax(500000)).toBe(1000000);
    expect(getSliderMax(1000000)).toBe(1000000);
    expect(getSliderMax(1200000)).toBe(3000000);
    expect(getSliderMax(3000000)).toBe(3000000);
    expect(getSliderMax(3500000)).toBe(5000000);
    expect(getSliderMax(5000000)).toBe(5000000);
    expect(getSliderMax(6500000)).toBe(7000000);
  });

  it("고액 지출 입력 시 슬라이더의 max 속성이 동적으로 확장되어 렌더링되어야 한다", () => {
    render(
      <SpendingSimulator
        categories={mockCategories}
        spending={{ transport: 2500000, mart: 4500000 }}
        onChange={mockOnChange}
      />
    );

    const sliders = screen.getAllByRole("slider");
    expect(sliders[0]).toHaveAttribute("max", "3000000");
    expect(sliders[1]).toHaveAttribute("max", "5000000");
    expect(screen.getByText("최대 300만")).toBeInTheDocument();
    expect(screen.getByText("최대 500만")).toBeInTheDocument();
  });
});
