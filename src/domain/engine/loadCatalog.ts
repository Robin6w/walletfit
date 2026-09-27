import type { CatalogListing } from "@/domain/types/catalog";
import catalogJson from "@data/catalog/cards-catalog.json";
import categoriesJson from "@data/categories.json";
import discontinuedCardNamesJson from "@data/catalog/discontinued-cards.json";
import type { SpendCategory } from "@/domain/types/card";

export const categories: SpendCategory[] = categoriesJson as SpendCategory[];

const raw = catalogJson as CatalogListing[];

// 이름이 비어있는 항목(사이트맵 오탐 등)은 카드 목록에서 제외합니다.
export const catalogCards: CatalogListing[] = raw.filter((entry) => entry.name.trim().length > 0);

export const catalogIssuers: string[] = Array.from(
  new Set(catalogCards.map((c) => c.issuer).filter(Boolean)),
).sort((a, b) => a.localeCompare(b, "ko"));

export const catalogTypes: string[] = Array.from(
  new Set(catalogCards.map((c) => c.category).filter(Boolean)),
).sort((a, b) => a.localeCompare(b, "ko"));

const catalogBySourceId = new Map<number, CatalogListing>(catalogCards.map((c) => [c.sourceId, c]));

/**
 * WalletCard(toWalletCard로 변환된 계산용 카드 객체)의 id("catalog-123")로부터
 * 원본 카탈로그 항목(CatalogListing)을 역으로 찾습니다. 추천/조합 결과 화면에서
 * 계산용 카드 카드만 들고 있다가, 사용자가 카드를 눌렀을 때 상세 정보(CardDetailModal)를
 * 보여주기 위해 필요합니다.
 */
export function findCatalogEntryByCardId(cardId: string): CatalogListing | undefined {
  const sourceId = Number(cardId.replace("catalog-", ""));
  return Number.isFinite(sourceId) ? catalogBySourceId.get(sourceId) : undefined;
}

/**
 * 연회비와 혜택 요약이 모두 비어있는 카드는 카드고릴라에서 기본정보조차 채워지지 않은
 * 상태로, 실제로 신청 가능한 카드인지 확인이 어렵습니다. "만들 수 없는 카드"의 근사치로 취급합니다.
 */
export function isInfoInsufficient(entry: CatalogListing): boolean {
  const hasFee = entry.annualFee !== undefined;
  const hasSummary = Boolean(entry.benefitSummary?.trim());
  return !hasFee && !hasSummary;
}

const discontinuedCardNames = new Set<string>(discontinuedCardNamesJson as string[]);

/**
 * 카드사가 신규 발급을 중단한 카드입니다. scripts/fetchCardCatalog.ts가 카드고릴라 내부 API
 * (is_discon 필드)에서 직접 수집해오는 entry.isDiscontinued 값을 기준으로 판단합니다.
 *
 * data/catalog/discontinued-cards.json은 보조 수단입니다. 아직 재수집 전이라 isDiscontinued
 * 값이 비어있는(undefined) 카드를 급하게 빼야 할 때, 카드 이름을 이 파일에 직접 추가하면
 * 임시로도 배제할 수 있습니다. 평소에는 비워둬도 됩니다.
 *
 * 이미 그 카드를 보유하고 있는 사용자에게는 여전히 유효한 카드이므로, "내 카드 중 추천"이나
 * 카드 갤러리에는 이 필터를 적용하지 않습니다. 새로 만들 카드를 추천하는 화면에서만 씁니다.
 */
export function isDiscontinued(entry: CatalogListing): boolean {
  return entry.isDiscontinued === true || discontinuedCardNames.has(entry.name.trim());
}
