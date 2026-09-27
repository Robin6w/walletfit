import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CatalogGallery } from "@/features/catalog/CatalogGallery";

describe("CatalogGallery Component Smoke Test", () => {
  const mockMyCards = {
    ids: [1, 2],
    add: vi.fn(),
    remove: vi.fn(),
    toggle: vi.fn(),
    has: vi.fn((id: number) => id === 1),
  };

  it("검색 입력창, 필터 및 정렬 셀렉트 박스, 카드 목록이 올바르게 렌더링되어야 한다", () => {
    render(<CatalogGallery myCards={mockMyCards} />);

    // 검색 입력창 확인
    const searchInput = screen.getByPlaceholderText("카드 이름 또는 카드사로 검색");
    expect(searchInput).toBeInTheDocument();

    // 필터 및 정렬용 셀렉트 박스 확인 (카드사, 종류, 정렬 기준 총 3개)
    const selects = screen.getAllByRole("combobox");
    expect(selects.length).toBe(3);

    // 정렬 셀렉트 박스 확인
    const sortSelect = screen.getByRole("combobox", { name: "정렬 기준" });
    expect(sortSelect).toBeInTheDocument();

    // 정보 부족 카드 제외 버튼 확인
    const filterButton = screen.getByRole("button", { name: /정보 부족 카드 제외/ });
    expect(filterButton).toBeInTheDocument();

    // 총 카드 수 안내 텍스트 확인
    const totalCountText = screen.getByText(/총/);
    expect(totalCountText).toBeInTheDocument();
  });

  it("정렬 옵션을 변경하면 정렬 기준 상태가 반영되어야 한다", () => {
    render(<CatalogGallery myCards={mockMyCards} />);
    const sortSelect = screen.getByRole("combobox", { name: "정렬 기준" }) as HTMLSelectElement;

    // 기본값 확인
    expect(sortSelect.value).toBe("default");

    // 연회비 낮은순으로 변경
    fireEvent.change(sortSelect, { target: { value: "fee-asc" } });
    expect(sortSelect.value).toBe("fee-asc");

    // 카드명 가나다순으로 변경
    fireEvent.change(sortSelect, { target: { value: "name-asc" } });
    expect(sortSelect.value).toBe("name-asc");

    // 최신 등록순으로 변경
    fireEvent.change(sortSelect, { target: { value: "newest" } });
    expect(sortSelect.value).toBe("newest");
  });

  it("검색어 입력 시 입력값이 정상적으로 반영되어야 한다", () => {
    render(<CatalogGallery myCards={mockMyCards} />);
    const searchInput = screen.getByPlaceholderText("카드 이름 또는 카드사로 검색") as HTMLInputElement;

    fireEvent.change(searchInput, { target: { value: "신한" } });
    expect(searchInput.value).toBe("신한");
  });

  it("검색어 입력 시 초기화(X) 버튼이 노출되고 클릭 시 검색어가 초기화되어야 한다", () => {
    render(<CatalogGallery myCards={mockMyCards} />);
    const searchInput = screen.getByPlaceholderText("카드 이름 또는 카드사로 검색") as HTMLInputElement;

    // 검색어 입력 전에는 초기화 버튼이 없음
    expect(screen.queryByRole("button", { name: "검색어 초기화" })).not.toBeInTheDocument();

    // 검색어 입력
    fireEvent.change(searchInput, { target: { value: "국민" } });
    const clearButton = screen.getByRole("button", { name: "검색어 초기화" });
    expect(clearButton).toBeInTheDocument();

    // 초기화 버튼 클릭
    fireEvent.click(clearButton);
    expect(searchInput.value).toBe("");
    expect(screen.queryByRole("button", { name: "검색어 초기화" })).not.toBeInTheDocument();
  });

  it("더 보기 버튼 클릭 시 추가 카드가 로드되고 맨 위로 이동 버튼이 표시되어야 한다", () => {
    render(<CatalogGallery myCards={mockMyCards} />);

    // 초기에는 맨 위로 이동 버튼이 없음 (24개 렌더링)
    expect(screen.queryByRole("button", { name: "맨 위로 이동" })).not.toBeInTheDocument();

    // 더 보기 버튼 확인 및 클릭
    const loadMoreButton = screen.getByRole("button", { name: /더 보기/ });
    expect(loadMoreButton).toBeInTheDocument();

    fireEvent.click(loadMoreButton);

    // 더 보기 후 맨 위로 이동 버튼 표시 확인
    const scrollToTopButton = screen.getByRole("button", { name: "맨 위로 이동" });
    expect(scrollToTopButton).toBeInTheDocument();
  });
});
