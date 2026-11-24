import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import {
  useSavedCards,
  exportSavedCards,
  parseSavedCardsBackup,
} from "@/domain/state/useSavedCards";

const STORAGE_KEY = "walletfit:saved-cards";

// 2026-11-24: 담은 카드는 이 탭에서만 둔다(sessionStorage). 새로고침해도 남고 탭을 닫으면 지워진다
describe("useSavedCards", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("초기 상태에 빈 배열을 반환해야 한다", () => {
    const { result } = renderHook(() => useSavedCards());
    expect(result.current.ids).toEqual([]);
  });

  it("예전에 localStorage에 저장한 카드는 읽지 않는다(다시 들어오면 빈 상태)", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([1, 2, 3]));
    const { result } = renderHook(() => useSavedCards());
    expect(result.current.ids).toEqual([]);
  });

  it("add 호출 시 카드가 상태와 탭 저장소에 추가되고, 브라우저를 다시 열어도 남는 저장소에는 쓰지 않는다", () => {
    const { result } = renderHook(() => useSavedCards());

    act(() => {
      result.current.add(10);
    });

    expect(result.current.ids).toEqual([10]);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe("[10]");
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("이미 존재하는 카드를 add하면 무시해야 한다", () => {
    const { result } = renderHook(() => useSavedCards());

    act(() => {
      result.current.add(10);
    });
    act(() => {
      result.current.add(10);
    });

    expect(result.current.ids).toEqual([10]);
  });

  it("remove 호출 시 카드가 제거되어야 한다", () => {
    const { result } = renderHook(() => useSavedCards());
    act(() => {
      result.current.importIds([10, 20], "overwrite");
    });

    act(() => {
      result.current.remove(10);
    });

    expect(result.current.ids).toEqual([20]);
  });

  it("toggle 호출 시 카드가 없으면 추가하고 있으면 제거해야 한다", () => {
    const { result } = renderHook(() => useSavedCards());

    act(() => {
      result.current.toggle(30);
    });
    expect(result.current.ids).toEqual([30]);

    act(() => {
      result.current.toggle(30);
    });
    expect(result.current.ids).toEqual([]);
  });

  it("has 호출 시 카드의 포함 여부를 정확히 판단해야 한다", () => {
    const { result } = renderHook(() => useSavedCards());
    act(() => {
      result.current.add(40);
    });

    expect(result.current.has(40)).toBe(true);
    expect(result.current.has(50)).toBe(false);
  });

  it("importIds(merge 모드) 호출 시 기존 카드와 중복 없이 병합되어야 한다", () => {
    const { result } = renderHook(() => useSavedCards());
    act(() => {
      result.current.importIds([1, 2], "overwrite");
    });

    let added = 0;
    act(() => {
      added = result.current.importIds([2, 3, 4], "merge");
    });

    expect(added).toBe(2);
    expect(result.current.ids).toEqual([1, 2, 3, 4]);
  });

  it("importIds(overwrite 모드) 호출 시 기존 카드가 완전히 대체되어야 한다", () => {
    const { result } = renderHook(() => useSavedCards());
    act(() => {
      result.current.importIds([1, 2], "overwrite");
    });

    let total = 0;
    act(() => {
      total = result.current.importIds([5, 6], "overwrite");
    });

    expect(total).toBe(2);
    expect(result.current.ids).toEqual([5, 6]);
  });

  it("clear 호출 시 모든 카드가 제거되어야 한다", () => {
    const { result } = renderHook(() => useSavedCards());
    act(() => {
      result.current.importIds([1, 2, 3], "overwrite");
    });

    act(() => {
      result.current.clear();
    });

    expect(result.current.ids).toEqual([]);
  });

  it("새로고침(훅을 새로 만듦)해도 담은 카드가 남고, 탭을 닫으면(탭 저장소가 비면) 비어 있다", () => {
    const first = renderHook(() => useSavedCards());
    act(() => {
      first.result.current.add(7);
    });
    first.unmount();
    expect(renderHook(() => useSavedCards()).result.current.ids).toEqual([7]);
    sessionStorage.clear();
    expect(renderHook(() => useSavedCards()).result.current.ids).toEqual([]);
  });
});

describe("MyCards Backup and Validation", () => {
  it("exportMyCards는 메타데이터와 카드 ID 목록을 포함한 올바른 JSON 문자열을 생성해야 한다", () => {
    const json = exportSavedCards([10, 20, 30]);
    const parsed = JSON.parse(json);

    expect(parsed.version).toBe(1);
    expect(parsed.cardCount).toBe(3);
    expect(parsed.cardIds).toEqual([10, 20, 30]);
    expect(typeof parsed.exportedAt).toBe("string");
  });

  it("정상적인 백업 객체 JSON을 유효하게 파싱하고 중복을 제거해야 한다", () => {
    const raw = JSON.stringify({
      version: 1,
      exportedAt: "2026-09-11T00:00:00.000Z",
      cardCount: 4,
      cardIds: [101, 102, 101, 103],
    });

    const result = parseSavedCardsBackup(raw);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.cardIds).toEqual([101, 102, 103]);
      expect(result.count).toBe(3);
    }
  });

  it("원시 배열 형태의 JSON도 호환하여 정상 파싱해야 한다", () => {
    const raw = JSON.stringify([201, 202, 203]);
    const result = parseSavedCardsBackup(raw);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.cardIds).toEqual([201, 202, 203]);
      expect(result.count).toBe(3);
    }
  });

  it("비어있는 문자열이면 실패해야 한다", () => {
    const result = parseSavedCardsBackup("");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("비어 있습니다");
    }
  });

  it("JSON 형식이 깨진 문자열이면 실패해야 한다", () => {
    const result = parseSavedCardsBackup("{ invalid: json }");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("올바른 JSON 형식이 아닙니다");
    }
  });

  it("cardIds 속성이 없는 일반 객체이면 실패해야 한다", () => {
    const result = parseSavedCardsBackup(JSON.stringify({ someKey: "value" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("일치하지 않는 형식");
    }
  });

  it("cardIds가 배열이 아니면 실패해야 한다", () => {
    const result = parseSavedCardsBackup(JSON.stringify({ cardIds: "not-array" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("배열 형식이 아닙니다");
    }
  });

  it("빈 카드 배열이면 실패해야 한다", () => {
    const result = parseSavedCardsBackup(JSON.stringify({ cardIds: [] }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("카드 목록이 없습니다");
    }
  });

  it("유효하지 않은 카드 ID(음수, 문자열, 실수 등)가 포함되어 있으면 실패해야 한다", () => {
    const stringIdResult = parseSavedCardsBackup(JSON.stringify({ cardIds: [1, "abc", 3] }));
    expect(stringIdResult.success).toBe(false);
    if (!stringIdResult.success) {
      expect(stringIdResult.error).toContain("유효하지 않은 카드 ID");
    }

    const negativeIdResult = parseSavedCardsBackup(JSON.stringify({ cardIds: [1, -5, 3] }));
    expect(negativeIdResult.success).toBe(false);

    const floatIdResult = parseSavedCardsBackup(JSON.stringify({ cardIds: [1, 2.5, 3] }));
    expect(floatIdResult.success).toBe(false);
  });
});
