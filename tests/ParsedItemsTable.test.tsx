import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ParsedItemsTable } from "@/features/statement/ParsedItemsTable";
import type { SpendCategory } from "@/domain/types/card";
import type { ParsedSpendingItem } from "@/features/statement/importerParser";

const mockCategories: SpendCategory[] = [
  { id: "cafe", label: "카페/디저트" },
  { id: "mart", label: "대형마트" },
];

const mockItems: ParsedSpendingItem[] = [
  { merchant: "스타벅스", amount: 10000, category: "cafe" },
  { merchant: "스타벅스 승인취소", amount: -5500, category: "cafe" },
];

describe("ParsedItemsTable 환불/취소 항목 렌더링", () => {
  it("음수 금액 항목에 환불/취소 뱃지와 붉은색 텍스트 스타일이 적용되어야 한다", () => {
    render(
      <ParsedItemsTable
        categories={mockCategories}
        items={mockItems}
        onUpdateItem={vi.fn()}
        onDeleteItem={vi.fn()}
        importMode="merge"
        onImportModeChange={vi.fn()}
        onCancel={vi.fn()}
        onApply={vi.fn()}
      />
    );

    // 환불/취소 뱃지 확인
    expect(screen.getByText("환불/취소")).toBeInTheDocument();

    // 상단 안내 메시지 확인
    expect(
      screen.getByText("💡 환불/취소 내역(음수 금액)은 시뮬레이터 적용 시 지출에서 차감됩니다.")
    ).toBeInTheDocument();

    // 음수 금액 인풋 확인
    const amountInputs = screen.getAllByLabelText("금액");
    expect(amountInputs[1]).toHaveValue(-5500);
    expect(amountInputs[1]).toHaveClass("text-rose-600");
  });

  it("금액 수정 시 onUpdateItem이 호출되어야 한다", () => {
    const handleUpdate = vi.fn();
    render(
      <ParsedItemsTable
        categories={mockCategories}
        items={mockItems}
        onUpdateItem={handleUpdate}
        onDeleteItem={vi.fn()}
        importMode="merge"
        onImportModeChange={vi.fn()}
        onCancel={vi.fn()}
        onApply={vi.fn()}
      />
    );

    const amountInputs = screen.getAllByLabelText("금액");
    fireEvent.change(amountInputs[1], { target: { value: "-6000" } });
    expect(handleUpdate).toHaveBeenCalledWith(1, "amount", -6000);
  });
});

describe("ParsedItemsTable 직접 항목 추가 및 총액 요약 표시", () => {
  it("하단에 직접 추가 버튼이 렌더링되고 클릭 시 onAddItem이 호출되어야 한다", () => {
    const handleAddItem = vi.fn();
    render(
      <ParsedItemsTable
        categories={mockCategories}
        items={mockItems}
        onUpdateItem={vi.fn()}
        onDeleteItem={vi.fn()}
        onAddItem={handleAddItem}
        importMode="merge"
        onImportModeChange={vi.fn()}
        onCancel={vi.fn()}
        onApply={vi.fn()}
      />
    );

    const addBtn = screen.getByRole("button", { name: /지출 항목 직접 추가/ });
    expect(addBtn).toBeInTheDocument();
    fireEvent.click(addBtn);
    expect(handleAddItem).toHaveBeenCalledTimes(1);
  });

  it("테이블 상단과 하단에 파싱 건수와 환불이 반영된 총 파싱 금액이 정확히 표시되어야 한다", () => {
    render(
      <ParsedItemsTable
        categories={mockCategories}
        items={mockItems}
        onUpdateItem={vi.fn()}
        onDeleteItem={vi.fn()}
        importMode="merge"
        onImportModeChange={vi.fn()}
        onCancel={vi.fn()}
        onApply={vi.fn()}
      />
    );

    // 10000 + (-5500) = 4500원
    expect(screen.getByText("파싱 건수:")).toBeInTheDocument();
    expect(screen.getByText("2건")).toBeInTheDocument();
    expect(screen.getAllByText("총 파싱 금액:").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("4,500원").length).toBeGreaterThanOrEqual(1);
  });
});

describe("ParsedItemsTable 전체 선택 및 일괄 삭제", () => {
  it("전체 선택 체크박스 클릭 시 모든 항목이 선택되고 선택 삭제 버튼이 나타나며 일괄 삭제가 동작해야 한다", () => {
    const handleDeleteSelected = vi.fn();
    render(
      <ParsedItemsTable
        categories={mockCategories}
        items={mockItems}
        onUpdateItem={vi.fn()}
        onDeleteItem={vi.fn()}
        onDeleteSelected={handleDeleteSelected}
        importMode="merge"
        onImportModeChange={vi.fn()}
        onCancel={vi.fn()}
        onApply={vi.fn()}
      />
    );

    // 초기에는 선택 삭제 버튼이 보이지 않음
    expect(screen.queryByText(/선택 삭제/)).not.toBeInTheDocument();

    // 전체 선택 체크박스 클릭
    const selectAllCheckbox = screen.getByLabelText("전체 선택");
    fireEvent.click(selectAllCheckbox);

    // 선택 삭제 버튼 확인 (상단 및 하단 버튼 중 첫 번째 클릭)
    const deleteSelectedButtons = screen.getAllByRole("button", { name: /선택 삭제/ });
    expect(deleteSelectedButtons.length).toBeGreaterThanOrEqual(1);
    expect(deleteSelectedButtons[0]).toHaveTextContent("선택 삭제 (2개)");

    fireEvent.click(deleteSelectedButtons[0]);
    expect(handleDeleteSelected).toHaveBeenCalledWith([0, 1]);
  });

  it("개별 항목 체크박스를 선택하여 특정 항목만 선택 삭제할 수 있어야 한다", () => {
    const handleDeleteSelected = vi.fn();
    render(
      <ParsedItemsTable
        categories={mockCategories}
        items={mockItems}
        onUpdateItem={vi.fn()}
        onDeleteItem={vi.fn()}
        onDeleteSelected={handleDeleteSelected}
        importMode="merge"
        onImportModeChange={vi.fn()}
        onCancel={vi.fn()}
        onApply={vi.fn()}
      />
    );

    const itemCheckbox = screen.getByLabelText("항목 선택 2");
    fireEvent.click(itemCheckbox);

    const deleteSelectedBtn = screen.getAllByRole("button", { name: /선택 삭제/ })[0];
    expect(deleteSelectedBtn).toHaveTextContent("선택 삭제 (1개)");

    fireEvent.click(deleteSelectedBtn);
    expect(handleDeleteSelected).toHaveBeenCalledWith([1]);
  });
});

describe("ParsedItemsTable 가맹점명 및 금액 유효성 검사", () => {
  it("가맹점명이 비어있는 항목이 있으면 경고 메시지를 띄우고 적용(onApply)을 차단해야 한다", () => {
    const handleApply = vi.fn();
    const invalidItems: ParsedSpendingItem[] = [
      { merchant: "", amount: 5000, category: "cafe" },
    ];

    render(
      <ParsedItemsTable
        categories={mockCategories}
        items={invalidItems}
        onUpdateItem={vi.fn()}
        onDeleteItem={vi.fn()}
        importMode="merge"
        onImportModeChange={vi.fn()}
        onCancel={vi.fn()}
        onApply={handleApply}
      />
    );

    const applyBtn = screen.getByRole("button", { name: /지출 시뮬레이터에 적용/ });
    fireEvent.click(applyBtn);

    expect(handleApply).not.toHaveBeenCalled();
    expect(screen.getByText("1번째 항목의 가맹점명을 입력해 주세요.")).toBeInTheDocument();
  });

  it("금액이 0원인 항목이 있으면 경고 메시지를 띄우고 적용(onApply)을 차단해야 한다", () => {
    const handleApply = vi.fn();
    const invalidItems: ParsedSpendingItem[] = [
      { merchant: "테스트 식당", amount: 0, category: "cafe" },
    ];

    render(
      <ParsedItemsTable
        categories={mockCategories}
        items={invalidItems}
        onUpdateItem={vi.fn()}
        onDeleteItem={vi.fn()}
        importMode="merge"
        onImportModeChange={vi.fn()}
        onCancel={vi.fn()}
        onApply={handleApply}
      />
    );

    const applyBtn = screen.getByRole("button", { name: /지출 시뮬레이터에 적용/ });
    fireEvent.click(applyBtn);

    expect(handleApply).not.toHaveBeenCalled();
    expect(screen.getByText("1번째 항목의 금액을 0원 초과하여 입력해 주세요.")).toBeInTheDocument();
  });

  it("모든 항목이 유효하면 정상적으로 onApply가 호출되어야 한다", () => {
    const handleApply = vi.fn();
    render(
      <ParsedItemsTable
        categories={mockCategories}
        items={mockItems}
        onUpdateItem={vi.fn()}
        onDeleteItem={vi.fn()}
        importMode="merge"
        onImportModeChange={vi.fn()}
        onCancel={vi.fn()}
        onApply={handleApply}
      />
    );

    const applyBtn = screen.getByRole("button", { name: /지출 시뮬레이터에 적용/ });
    fireEvent.click(applyBtn);

    expect(handleApply).toHaveBeenCalledTimes(1);
  });
});
