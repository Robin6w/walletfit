/**
 * "내 카드" 목록을 JSON 파일로 내보내고, 다시 불러올 때 검증하는 로직입니다.
 * 실시간 상태 관리(useSavedCards)와 책임이 다르므로 별도 모듈로 분리했습니다.
 */

export interface SavedCardsBackup {
  version: 1;
  exportedAt: string;
  cardCount: number;
  cardIds: number[];
}

export type BackupValidation =
  | { success: true; cardIds: number[]; count: number }
  | { success: false; error: string };

export function exportSavedCards(ids: number[]): string {
  const data: SavedCardsBackup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    cardCount: ids.length,
    cardIds: [...ids],
  };
  return JSON.stringify(data, null, 2);
}

type BackupValidator = (rawIds: unknown) => BackupValidation | null;

/** 실패 조건을 하나씩 검사하다가, 처음으로 걸리는 검증기에서 멈춘다. */
const BACKUP_ID_VALIDATORS: BackupValidator[] = [
  (rawIds) => (!Array.isArray(rawIds) ? { success: false, error: "카드 목록(cardIds)이 배열 형식이 아닙니다." } : null),
  (rawIds) =>
    Array.isArray(rawIds) && rawIds.length === 0
      ? { success: false, error: "백업 파일에 저장된 카드 목록이 없습니다." }
      : null,
  (rawIds) => {
    if (!Array.isArray(rawIds)) return null;
    const invalid = rawIds.find((item) => typeof item !== "number" || !Number.isInteger(item) || item <= 0);
    return invalid !== undefined ? { success: false, error: `유효하지 않은 카드 ID(${String(invalid)})가 포함되어 있습니다.` } : null;
  },
];

function extractRawCardIds(parsed: unknown): unknown {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object" && "cardIds" in parsed) {
    return (parsed as { cardIds: unknown }).cardIds;
  }
  return undefined;
}

export function parseSavedCardsBackup(rawJson: string): BackupValidation {
  if (!rawJson || !rawJson.trim()) {
    return { success: false, error: "파일 내용이 비어 있습니다." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { success: false, error: "올바른 JSON 형식이 아닙니다." };
  }

  const rawIds = extractRawCardIds(parsed);
  if (rawIds === undefined) {
    return { success: false, error: "내 카드 백업 스키마와 일치하지 않는 형식입니다." };
  }

  for (const validate of BACKUP_ID_VALIDATORS) {
    const failure = validate(rawIds);
    if (failure) return failure;
  }

  const uniqueIds = Array.from(new Set(rawIds as number[]));
  return { success: true, cardIds: uniqueIds, count: uniqueIds.length };
}

export function downloadSavedCardsBackup(ids: number[]) {
  const jsonString = exportSavedCards(ids);
  const blob = new Blob([jsonString], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = `my-cards-backup-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
