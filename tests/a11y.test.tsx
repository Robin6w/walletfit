import { render, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import axe from "axe-core";
import { CardList } from "@/shared/components/CardList";
import { CatalogCardTile } from "@/features/catalog/CatalogCardTile";
import { CardDetailModal } from "@/features/catalog/CardDetailModal";
import { ParsedItemsTable } from "@/features/statement/ParsedItemsTable";
import { SpendingImporter } from "@/features/statement/SpendingImporter";
import type { CatalogCardEntry } from "@/domain/types/catalog";

// Axe 실행 헬퍼: 가상 DOM 환경(happy-dom)에서 지원되지 않는 색상 대비 등 제외한 표준 WCAG 검사
async function checkA11y(container: HTMLElement) {
  const results = await axe.run(container, {
    rules: {
      // happy-dom 가상 환경에서는 레이아웃 및 폰트 렌더링 엔진 부재로 color-contrast 검사 신뢰성이 낮으므로 제외
      "color-contrast": { enabled: false },
    },
  });
  return results.violations;
}

describe("Accessibility (a11y) Automated Tests with axe-core", () => {
  const dummyEntry: CatalogCardEntry = {
    id: 1,
    name: "신한카드 Mr.Life",
    issuer: "신한카드",
    category: "신용카드",
    annualFee: 15000,
    annualFeeText: "국내전용 15,000원",
    benefitSummary: "공과금 10% 할인, 마트 10% 할인",
    sourceUrl: "https://example.com/card/1",
  };

  const dummyCategories = [
    { id: "cafe", label: "카페/디저트", monthlySpend: 50000 },
    { id: "transport", label: "대중교통", monthlySpend: 70000 },
  ];

  const dummyEvaluation = {
    card: {
      id: "sh-mrlife",
      name: "신한카드 Mr.Life",
      cardType: "credit" as const,
      issuer: "신한카드",
      annualFee: 15000,
      tiers: [],
    },
    qualifyingSpend: 300000,
    meetsMinimum: true,
    tierIndex: 0,
    breakdown: [],
    totalMonthlyBenefit: 25000,
    netMonthlyBenefit: 23750,
  };

  it("CardList 컴포넌트는 WCAG 접근성 위반 사항이 없어야 한다", async () => {
    const { container } = render(
      <CardList
        evaluations={[dummyEvaluation]}
        cardTypes={["credit", "check"]}
        categories={dummyCategories}
        onToggleCardType={() => {}}
      />
    );
    const violations = await checkA11y(container);
    expect(violations).toEqual([]);
  });

  it("CatalogCardTile 컴포넌트는 WCAG 접근성 위반 사항이 없어야 한다", async () => {
    const { container } = render(
      <CatalogCardTile
        entry={dummyEntry}
        inMyCards={false}
        onSelect={() => {}}
        onToggleMyCards={() => {}}
      />
    );
    const violations = await checkA11y(container);
    expect(violations).toEqual([]);
  });

  it("CardDetailModal 컴포넌트는 WCAG 접근성 위반 사항이 없어야 한다", async () => {
    const { container } = render(
      <CardDetailModal entry={dummyEntry} onClose={() => {}} />
    );
    const violations = await checkA11y(container);
    expect(violations).toEqual([]);
  });

  it("CardDetailModal은 Escape 키 입력 시 onClose 콜백을 호출해야 한다", () => {
    const handleClose = vi.fn();
    render(<CardDetailModal entry={dummyEntry} onClose={handleClose} />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("CardDetailModal은 오픈 시 body 스크롤을 잠그고 unmount 시 복원해야 한다", () => {
    document.body.style.overflow = "auto";
    const { unmount } = render(<CardDetailModal entry={dummyEntry} onClose={() => {}} />);
    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.body.style.overflow).toBe("auto");
  });

  it("CardDetailModal은 Tab 및 Shift+Tab 입력 시 내부 포커스가 순환(Focus Trap)되어야 한다", () => {
    const { getByRole, getByText } = render(
      <CardDetailModal entry={dummyEntry} onClose={() => {}} inMyCards={false} />
    );

    const closeBtn = getByRole("button", { name: "닫기" });
    const toggleBtn = getByText("내 카드에 추가");
    const detailLink = getByRole("link", { name: /상세보기/ });

    // 마지막 포커서블 요소에서 Tab 입력 시 첫 번째 요소로 순환
    detailLink.focus();
    expect(document.activeElement).toBe(detailLink);

    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(closeBtn);

    // 첫 번째 포커서블 요소에서 Shift+Tab 입력 시 마지막 요소로 역순환
    closeBtn.focus();
    expect(document.activeElement).toBe(closeBtn);

    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(detailLink);

    // 중간 요소(toggleBtn)는 기본 키 동작 방지 없이 포커스 이동 가능 확인
    toggleBtn.focus();
    expect(document.activeElement).toBe(toggleBtn);
  });

  it("CardDetailModal은 활성화 시 첫 포커서블 요소로 자동 포커스하고, 닫힘 시 이전 포커스를 복원해야 한다", async () => {
    const triggerButton = document.createElement("button");
    triggerButton.textContent = "카드 상세 열기";
    document.body.appendChild(triggerButton);
    triggerButton.focus();
    expect(document.activeElement).toBe(triggerButton);

    const { unmount, getByRole } = render(
      <CardDetailModal entry={dummyEntry} onClose={() => {}} />
    );

    const closeBtn = getByRole("button", { name: "닫기" });

    // requestAnimationFrame / setTimeout 대기 후 모달 내 첫 요소로 포커스
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(closeBtn);
    });

    // 모달 언마운트(닫힘) 시 직전 포커스 요소로 복원
    unmount();
    expect(document.activeElement).toBe(triggerButton);

    document.body.removeChild(triggerButton);
  });

  it("ParsedItemsTable 컴포넌트는 WCAG 접근성 위반 사항이 없어야 한다", async () => {
    const { container } = render(
      <ParsedItemsTable
        items={[{ merchant: "스타벅스", amount: 10000, category: "cafe" }]}
        categories={dummyCategories}
        importMode="merge"
        onImportModeChange={() => {}}
        onUpdateItem={() => {}}
        onDeleteItem={() => {}}
        onApply={() => {}}
        onCancel={() => {}}
      />
    );
    const violations = await checkA11y(container);
    expect(violations).toEqual([]);
  });

  it("SpendingImporter 컴포넌트는 WCAG 접근성 위반 사항이 없어야 한다", async () => {
    const { container } = render(
      <SpendingImporter
        categories={dummyCategories}
        onImport={() => {}}
      />
    );
    const violations = await checkA11y(container);
    expect(violations).toEqual([]);
  });
});
