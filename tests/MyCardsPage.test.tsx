import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MyCardsPage } from "@/features/catalog/MyCardsPage";
import { ToastProvider } from "@/shared/contexts/ToastContext";
import * as myCardsModule from "@/domain/state/useSavedCards";

describe("MyCardsPage Component", () => {
  const mockMyCards = {
    ids: [1, 2],
    add: vi.fn(),
    remove: vi.fn(),
    toggle: vi.fn(),
    has: vi.fn((id: number) => id === 1 || id === 2),
    importIds: vi.fn((_ids: number[], _mode?: "merge" | "overwrite") => 2),
    clear: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("카드가 없을 때 빈 화면과 불러오기 버튼이 렌더링되어야 한다", () => {
    const emptyMyCards = {
      ...mockMyCards,
      ids: [],
      has: vi.fn(() => false),
    };

    render(
      <ToastProvider>
        <MyCardsPage myCards={emptyMyCards} />
      </ToastProvider>
    );

    expect(screen.getByText("아직 담아둔 카드가 없습니다.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /백업 파일 불러오기/ })).toBeInTheDocument();
  });

  it("카드가 있을 때 카드 목록과 상단 백업/불러오기 버튼이 렌더링되어야 한다", () => {
    render(
      <ToastProvider>
        <MyCardsPage myCards={mockMyCards} />
      </ToastProvider>
    );

    expect(screen.getByRole("heading", { name: "내 카드" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /백업 다운로드/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /불러오기/ })).toBeInTheDocument();
  });

  it("백업 다운로드 버튼 클릭 시 downloadMyCardsBackup이 호출되어야 한다", () => {
    const spyDownload = vi.spyOn(myCardsModule, "downloadSavedCardsBackup").mockImplementation(() => {});

    render(
      <ToastProvider>
        <MyCardsPage myCards={mockMyCards} />
      </ToastProvider>
    );

    const downloadBtn = screen.getByRole("button", { name: /백업 다운로드/ });
    fireEvent.click(downloadBtn);

    expect(spyDownload).toHaveBeenCalledWith(mockMyCards.ids);
    expect(screen.getByRole("status")).toHaveTextContent("내 카드 목록 백업 파일이 다운로드되었습니다.");
  });

  it("유효한 JSON 파일 업로드 시 importIds가 호출되고 성공 토스트가 표시되어야 한다", async () => {
    render(
      <ToastProvider>
        <MyCardsPage myCards={mockMyCards} />
      </ToastProvider>
    );

    const fileInput = screen.getByTestId("my-cards-file-input") as HTMLInputElement;
    const validJson = JSON.stringify({
      version: 1,
      exportedAt: "2026-09-11T00:00:00.000Z",
      cardCount: 2,
      cardIds: [10, 20],
    });

    const file = new File([validJson], "backup.json", { type: "application/json" });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockMyCards.importIds).toHaveBeenCalledWith([10, 20], "merge");
      const status = screen.getByRole("status");
      expect(status).toHaveTextContent("성공적으로 불러왔습니다");
    });
  });

  it("잘못된 JSON 파일 업로드 시 스키마 검증 실패 및 에러 토스트가 표시되어야 한다", async () => {
    render(
      <ToastProvider>
        <MyCardsPage myCards={mockMyCards} />
      </ToastProvider>
    );

    const fileInput = screen.getByTestId("my-cards-file-input") as HTMLInputElement;
    const invalidJson = JSON.stringify({ wrongField: "notValid" });

    const file = new File([invalidJson], "broken.json", { type: "application/json" });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockMyCards.importIds).not.toHaveBeenCalled();
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("일치하지 않는 형식");
    });
  });
});
