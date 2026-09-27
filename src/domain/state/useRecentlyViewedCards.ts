import { useCallback, useState } from "react";

const STORAGE_KEY = "walletfit:recently-viewed-cards";
const MAX_ENTRIES = 6;

function readStoredIds(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "number") : [];
  } catch {
    return [];
  }
}

function writeStoredIds(ids: number[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // 시크릿 모드 등 저장 실패는 조용히 무시 — 최근 본 카드는 편의 기능일 뿐이라 필수는 아님
  }
}

/**
 * "최근 본 카드"(카탈로그 갤러리에서 상세보기를 연 카드) 목록을 localStorage에 보관합니다.
 * useSavedCards와 달리 카드 소유 여부와는 무관한 단순 열람 이력이라, 탭 간 실시간 동기화까지는
 * 필요하지 않다고 판단해 훨씬 가벼운 useState 기반으로 구현했습니다.
 */
export function useRecentlyViewedCards() {
  const [ids, setIds] = useState<number[]>(() => readStoredIds());

  const markViewed = useCallback((sourceId: number) => {
    setIds((prev) => {
      const next = [sourceId, ...prev.filter((id) => id !== sourceId)].slice(0, MAX_ENTRIES);
      writeStoredIds(next);
      return next;
    });
  }, []);

  return { ids, markViewed };
}
