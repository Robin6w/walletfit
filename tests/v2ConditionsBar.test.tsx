import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ConditionsBar } from "@/v2/result/MoreOptions";
import type { Conditions } from "@/v2/make/flow";

/** 2026-11-24: 조건 버튼은 고르기만 하고, '이 조건으로 다시 계산하기'를 눌러야 다시 계산한다 */
describe("계산 조건: 고른 뒤 계산하기를 눌러야 적용", () => {
  const conditions: Conditions = { mode: "maxBenefit", maxCards: 3, feeCap: null, kinds: ["credit", "check"], pinned: [] };
  const setup = () => {
    const setConditions = vi.fn();
    const setMargin = vi.fn();
    render(<ConditionsBar defaultOpen flow="own" conditions={conditions} setConditions={setConditions} margin={20000} setMargin={setMargin} noMargin={false} noMarginTo="#/x" />);
    return { setConditions, setMargin, calc: screen.getByRole("button", { name: "이 조건으로 다시 계산하기" }) };
  };

  it("조건을 골라도 바로 계산하지 않고, 계산하기를 누르면 바꾼 조건만 한 번에 적용한다", () => {
    const { setConditions, setMargin, calc } = setup();
    expect(calc).toBeDisabled();
    expect(screen.queryByRole("button", { name: "카드 바꿔보기" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "최대 카드 수 늘리기" }));
    fireEvent.click(screen.getByRole("button", { name: "연 5만원" }));
    fireEvent.click(screen.getByRole("button", { name: "5만원" }));
    expect(setConditions).not.toHaveBeenCalled();
    expect(setMargin).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "연 5만원" })).toHaveAttribute("aria-pressed", "true");
    expect(calc).toBeEnabled();

    fireEvent.click(calc);
    expect(setConditions).toHaveBeenCalledTimes(1);
    expect(setConditions).toHaveBeenCalledWith({ maxCards: 4, feeCap: 50000 });
    expect(setMargin).toHaveBeenCalledWith(50000);
  });

  it("원래 값으로 다시 고르면 계산하기가 꺼지고, 카드 종류를 다 빼면 계산하기를 막는다", () => {
    const { setConditions, calc } = setup();
    fireEvent.click(screen.getByRole("button", { name: "최대 카드 수 늘리기" }));
    expect(calc).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "최대 카드 수 줄이기" }));
    expect(calc).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "신용카드" }));
    fireEvent.click(screen.getByRole("button", { name: "체크카드" }));
    expect(calc).toBeDisabled();
    expect(screen.getByText("카드 종류를 하나 이상 골라 주세요.")).toBeInTheDocument();
    fireEvent.click(calc);
    expect(setConditions).not.toHaveBeenCalled();
  });
});
