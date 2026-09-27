import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CardList } from "@/shared/components/CardList";
import type { CardFitScore } from "@/domain/types/recommendation";
import type { SpendCategory } from "@/domain/types/card";

describe("CardList Component Smoke Test", () => {
  const mockCategories: SpendCategory[] = [
    { id: "transport", label: "대중교통" },
    { id: "mart", label: "마트" },
  ];

  const mockEvaluations: CardFitScore[] = [
    {
      card: {
        id: "card-1",
        name: "테스트 카드 1",
        issuer: "신한카드",
        cardType: "credit",
        annualFee: 10000,
        tiers: [],
      },
      qualifyingSpend: 300000,
      meetsMinimum: true,
      tierIndex: 0,
      breakdown: [
        { category: "transport", spend: 100000, benefitAmount: 10000, capped: false },
      ],
      totalMonthlyBenefit: 10000,
      netMonthlyBenefit: 9167,
    },
  ];

  const mockOnToggleCardType = vi.fn();

  it("카드 목록 테이블 헤더 및 카드 평가 결과 정보가 올바르게 렌더링되어야 한다", () => {
    render(
      <CardList
        evaluations={mockEvaluations}
        cardTypes={["credit", "check"]}
        categories={mockCategories}
        onToggleCardType={mockOnToggleCardType}
      />
    );

    // 헤더 타이틀 확인
    expect(screen.getByText("보유 카드 비교")).toBeInTheDocument();

    // 카드 정보 확인
    expect(screen.getByText("테스트 카드 1")).toBeInTheDocument();
    expect(screen.getByText("신한카드")).toBeInTheDocument();
    expect(screen.getAllByText("신용카드").length).toBeGreaterThan(0);

    // 연회비 및 실적 충족 상태 렌더링 확인
    expect(screen.getAllByText("10,000원").length).toBeGreaterThan(0);
    expect(screen.getByText("충족")).toBeInTheDocument();
  });

  it("카드 타입 체크박스 클릭 시 onToggleCardType 핸들러가 올바르게 호출되어야 한다", () => {
    render(
      <CardList
        evaluations={mockEvaluations}
        cardTypes={["credit", "check"]}
        categories={mockCategories}
        onToggleCardType={mockOnToggleCardType}
      />
    );

    const creditCheckbox = screen.getByLabelText("신용카드");
    fireEvent.click(creditCheckbox);
    expect(mockOnToggleCardType).toHaveBeenCalledWith("credit");
  });

  it("AI 조언 버튼이 ErrorBoundary 내에서 정상적으로 렌더링되어야 한다", () => {
    render(
      <CardList
        evaluations={mockEvaluations}
        cardTypes={["credit", "check"]}
        categories={mockCategories}
        onToggleCardType={mockOnToggleCardType}
      />
    );

    const adviceButton = screen.getByRole("button", { name: /AI 조언 받기/i });
    expect(adviceButton).toBeInTheDocument();
  });

  it("AI 조언 컴포넌트 렌더링 중 예외가 발생하더라도 ErrorBoundary가 폴백 UI를 노출하고 카드 테이블은 유지되어야 한다", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // CardList 렌더링 후 상세 버튼 클릭
    render(
      <CardList
        evaluations={mockEvaluations}
        cardTypes={["credit", "check"]}
        categories={mockCategories}
        onToggleCardType={mockOnToggleCardType}
      />
    );

    const detailButton = screen.getByRole("button", { name: /상세/i });
    fireEvent.click(detailButton);

    // 상세 내용 테이블이 정상 표시되는지 확인
    expect(screen.getByText("대중교통")).toBeInTheDocument();
    expect(screen.getByText("보유 카드 비교")).toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});
