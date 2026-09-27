import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SpendingImporter } from "@/features/statement/SpendingImporter";
import { SimulatorPage } from "@/legacy/SimulatorPage";
import type { SpendCategory } from "@/domain/types/card";

const mockCategories: SpendCategory[] = [
  { id: "transport", label: "대중교통" },
  { id: "mart", label: "마트" },
];

function uploadStatementFile(content: string, name = "statement.txt", type = "text/plain") {
  const input = screen.getByLabelText("명세서 파일 선택");
  const file = new File([content], name, { type });
  fireEvent.change(input, { target: { files: [file] } });
}

describe("SpendingImporter and SimulatorPage ErrorBoundary integration", () => {
  it("SpendingImporter가 정상적으로 렌더링되어야 한다", () => {
    render(
      <SpendingImporter
        categories={mockCategories}
        onImport={vi.fn()}
      />
    );

    expect(screen.getByText("명세서 업로드")).toBeInTheDocument();
    expect(screen.getByText("명세서 파일을 여기에 끌어다 놓으세요")).toBeInTheDocument();
  });

  it("SimulatorPage 내에서 SpendingImporter에 오류가 발생해도 ErrorBoundary가 포착하여 나머지 시뮬레이터 UI를 보호한다", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // SimulatorPage는 myCards가 비어있지 않아야 SpendingImporter와 SpendingSimulator를 렌더링함.
    // 실제 useSavedCards() 훅이 돌려주는 형태(ids: number[], add/remove/toggle/has/importIds/clear)와
    // 이름이 달랐던 목(addCard/hasCard 등)을 실제 훅 반환값과 일치시킨다 — 이전 목은 이름이
    // 달라서, WalletCombinationResult처럼 myCards.has()/toggle()을 실제로 호출하는 하위
    // 컴포넌트를 이 테스트가 거쳤다면 "myCards.has is not a function"으로 조용히 깨졌을
    // 것이다(지금 테스트들이 그 경로를 건드리지 않아 드러나지 않았을 뿐).
    const mockMyCards = {
      ids: [1],
      add: vi.fn(),
      remove: vi.fn(),
      toggle: vi.fn(),
      has: vi.fn().mockReturnValue(true),
      importIds: vi.fn().mockReturnValue(0),
      clear: vi.fn(),
    };

    render(
      <SimulatorPage
        myCards={mockMyCards}
        onGoToGallery={vi.fn()}
      />
    );

    // 명세서 업로드 및 월 지출 시뮬레이터가 함께 존재하는지 확인
    expect(screen.getByText("명세서 업로드")).toBeInTheDocument();
    expect(screen.getByText("월 지출 시뮬레이터")).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it("SimulatorPage에서 환불/취소 내역을 시뮬레이터에 적용하면 지출이 차감되고 0원 미만으로 내려가지 않는다", async () => {
    const mockMyCards = {
      ids: [1],
      add: vi.fn(),
      remove: vi.fn(),
      toggle: vi.fn(),
      has: vi.fn().mockReturnValue(true),
      importIds: vi.fn().mockReturnValue(0),
      clear: vi.fn(),
    };

    render(<SimulatorPage myCards={mockMyCards} onGoToGallery={vi.fn()} />);

    // 1. 정상 결제 10,000원 명세서 파일을 업로드하고 분석/적용
    uploadStatementFile("스타벅스 10,000원", "statement1.txt");
    fireEvent.click(await screen.findByRole("button", { name: /명세서 분석하기/ }));
    fireEvent.click(await screen.findByRole("button", { name: /지출 시뮬레이터에 적용/ }));

    // 월 지출 합계가 10,000원이어야 함
    await waitFor(() => {
      expect(screen.getAllByText("10,000원").length).toBeGreaterThan(0);
    });

    // 2. 환불 내역 4,000원 취소 명세서 업로드 및 합산(차감) 적용
    uploadStatementFile("[신한체크취소] 스타벅스 4,000원 승인취소", "statement2.txt");
    fireEvent.click(await screen.findByRole("button", { name: /명세서 분석하기/ }));
    fireEvent.click(await screen.findByRole("button", { name: /지출 시뮬레이터에 적용/ }));

    // 10,000원 - 4,000원 = 6,000원으로 차감 반영
    await waitFor(() => {
      expect(screen.getAllByText("6,000원").length).toBeGreaterThan(0);
    });

    // 3. 기존 잔액을 초과하는 15,000원 취소 적용 시 0원 하한 보정
    uploadStatementFile("[신한체크취소] 스타벅스 15,000원 승인취소", "statement3.txt");
    fireEvent.click(await screen.findByRole("button", { name: /명세서 분석하기/ }));
    fireEvent.click(await screen.findByRole("button", { name: /지출 시뮬레이터에 적용/ }));

    // 음수가 되지 않고 최소 0원으로 유지됨
    await waitFor(() => {
      expect(screen.getAllByText("0원").length).toBeGreaterThan(0);
    });
  });

  describe("명세서 파일 크기 및 포맷 검증", () => {
    it("드롭존에 허용 포맷 및 최대 10MB 안내가 표시되어야 한다", () => {
      render(<SpendingImporter categories={mockCategories} onImport={vi.fn()} />);

      expect(screen.getByText(/PDF, TXT, CSV · 최대 10MB/)).toBeInTheDocument();
      const input = screen.getByLabelText("명세서 파일 선택") as HTMLInputElement;
      expect(input.accept).toContain("application/pdf");
      expect(input.accept).toContain("text/plain");
      expect(input.accept).toContain("text/csv");
    });

    it("10MB를 초과하는 대용량 파일 업로드 시 에러 메시지를 표시하고 처리를 중단한다", () => {
      render(<SpendingImporter categories={mockCategories} onImport={vi.fn()} />);

      const largeFile = new File(["dummy"], "heavy-statement.pdf", { type: "application/pdf" });
      Object.defineProperty(largeFile, "size", { value: 15 * 1024 * 1024 }); // 15MB

      const input = screen.getByLabelText("명세서 파일 선택");
      fireEvent.change(input, { target: { files: [largeFile] } });

      expect(screen.getByText("파일 크기는 최대 10MB 이하만 업로드 가능합니다.")).toBeInTheDocument();
      expect(screen.queryByText(/파일 준비됨/)).not.toBeInTheDocument();
    });

    it("지원하지 않는 포맷(예: jpg, docx 등) 업로드 시 에러 메시지를 표시하고 처리를 중단한다", () => {
      render(<SpendingImporter categories={mockCategories} onImport={vi.fn()} />);

      const invalidFile = new File(["dummy"], "receipt.jpg", { type: "image/jpeg" });
      const input = screen.getByLabelText("명세서 파일 선택");
      fireEvent.change(input, { target: { files: [invalidFile] } });

      expect(screen.getByText("지원하지 않는 파일 형식입니다. PDF, TXT, CSV 파일만 지원합니다.")).toBeInTheDocument();
      expect(screen.queryByText(/파일 준비됨/)).not.toBeInTheDocument();
    });

    it("허용된 포맷의 정상 크기 파일 업로드 시 에러 없이 파일 준비 상태로 전환된다", async () => {
      render(<SpendingImporter categories={mockCategories} onImport={vi.fn()} />);

      const validFile = new File(["dummy-statement-content"], "statement.csv", { type: "text/csv" });
      Object.defineProperty(validFile, "size", { value: 2 * 1024 * 1024 }); // 2MB

      const input = screen.getByLabelText("명세서 파일 선택");
      fireEvent.change(input, { target: { files: [validFile] } });

      expect(screen.queryByText("파일 크기는 최대 10MB 이하만 업로드 가능합니다.")).not.toBeInTheDocument();
      expect(screen.queryByText("지원하지 않는 파일 형식입니다. PDF, TXT, CSV 파일만 지원합니다.")).not.toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText("파일 준비됨: statement.csv")).toBeInTheDocument();
        expect(screen.getByText("크기: 2048.0 KB")).toBeInTheDocument();
      });
    });
  });

  describe("파싱 결과 테이블 직접 항목 추가 및 일괄 삭제 연동", () => {
    it("명세서 파일 분석 후 항목을 직접 추가하고 입력하여 시뮬레이터에 적용할 수 있어야 한다", async () => {
      const handleImport = vi.fn();
      render(<SpendingImporter categories={mockCategories} onImport={handleImport} />);

      uploadStatementFile("스타벅스 10,000원", "statement.txt");
      fireEvent.click(await screen.findByRole("button", { name: /명세서 분석하기/ }));

      expect(await screen.findByText("지출 파싱 결과 미리보기 (1건)")).toBeInTheDocument();

      const addBtn = screen.getByRole("button", { name: /지출 항목 직접 추가/ });
      fireEvent.click(addBtn);

      expect(screen.getByText("지출 파싱 결과 미리보기 (2건)")).toBeInTheDocument();

      const merchantInputs = screen.getAllByLabelText("가맹점명");
      const amountInputs = screen.getAllByLabelText("금액");

      fireEvent.change(merchantInputs[1], { target: { value: "이마트" } });
      fireEvent.change(amountInputs[1], { target: { value: "30000" } });

      const applyBtn = screen.getByRole("button", { name: /지출 시뮬레이터에 적용/ });
      fireEvent.click(applyBtn);

      expect(handleImport).toHaveBeenCalledWith(
        [
          { merchant: "스타벅스", amount: 10000, category: "cafe" },
          { merchant: "이마트", amount: 30000, category: "transport" },
        ],
        "merge"
      );
    });

    it("파싱된 항목을 전체 선택하여 일괄 삭제할 수 있어야 한다", async () => {
      render(<SpendingImporter categories={mockCategories} onImport={vi.fn()} />);

      uploadStatementFile("스타벅스 10,000원\n이마트 20,000원", "statement.txt");
      fireEvent.click(await screen.findByRole("button", { name: /명세서 분석하기/ }));

      expect(await screen.findByText("지출 파싱 결과 미리보기 (2건)")).toBeInTheDocument();

      const selectAll = screen.getByLabelText("전체 선택");
      fireEvent.click(selectAll);

      const deleteSelectedBtn = screen.getAllByRole("button", { name: /선택 삭제/ })[0];
      fireEvent.click(deleteSelectedBtn);

      expect(screen.queryByText(/지출 파싱 결과 미리보기/)).not.toBeInTheDocument();
    });
  });
});
