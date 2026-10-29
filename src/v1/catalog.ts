import { catalogCards, categories, isDiscontinued, isInfoInsufficient } from "@/domain/engine/loadCatalog";
import type { CatalogListing } from "@/domain/types/catalog";
import benefitStatus from "@data/catalog/benefit-status.json";

export { catalogCards, categories, isDiscontinued };

export const catalogBySourceId = new Map<number, CatalogListing>(catalogCards.map((c) => [c.sourceId, c]));

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(categories.map((c) => [c.id, c.label]));

/** 화면용 짧은 이름(카페·디저트처럼 / 대신 ·) */
export function catLabel(id: string): string {
  return (CATEGORY_LABEL[id] ?? id).replace(/\//g, "·");
}

/** 기본으로 보여주는 지출 항목. 나머지는 '다른 데도 쓰나요?'에서 추가 */
export const MAIN_CATEGORIES = ["convenience", "cafe", "transport", "mobile", "onlineShopping", "mart", "dining", "gas"];

/**
 * 발급 대상이 정해진 카드(군 장병, 정부 바우처, 청소년·선불)는 '새 카드까지 포함' 추천에서 뺍니다.
 * 이미 가진 카드는 그대로 계산합니다(검증 결과 문서의 비교 실험과 같은 기준).
 */
const RESTRICTED = /(나라사랑|국민행복|청소년|틴즈|Teens|TEENS|틴업|선불|키즈|아이행복|바우처|학생증|외국인|개인사업자)/;
/** 이름으로는 안 걸리는 대상 한정 카드(추천 엔진 비교 실험의 제외 목록 + 10대 카드) */
const RESTRICTED_IDS = new Set([
  2934, // 하나 나라사랑카드(병역 의무자)
  712, // 신한 국민행복(정부 바우처)
  713, // 신한 국민행복 체크(정부 바우처)
  2192, // 국민행복 체크(정부 바우처)
  2857, // 신한 처음(선불, 만 14~18세)
  2887, // 신한카드 처음 체크(10대)
  2889, // 신한카드 처음 체크(냐한남자)(10대)
  3019, // zgm 스스로카드(미성년 자녀)
  1202, // 부산 동백전 체크(부산 가맹점 한정)
  // 2026-10-07 전수검사: 원문 발급 대상 문구로 확인(이름으로는 안 걸림)
  2060, // 롯데체크카드(만 12~18세)
  2639, // 카드의정석 DON CHECK(만 12~18세)
  2665, // 폼 체크카드(만 12~18세)
  2419, // 삼성 iD POCKET(청소년, 부모가 신청)
  546, // 다둥이 행복카드(서울 거주 2자녀 이상)
  2756, // the Purple(기존 the Purple 회원 전용)
  2668, // 탐나는전 체크카드(제주 지역화폐)
]);

export function isRestricted(entry: CatalogListing): boolean {
  return RESTRICTED_IDS.has(entry.sourceId) || RESTRICTED.test(entry.name);
}

const VERIFIED = (benefitStatus as { verified: Record<string, string> }).verified;
const UNREAD = new Set<number>((benefitStatus as { unread?: number[] }).unread ?? []);

/** 자동 변환에서 혜택을 하나도 못 읽은 카드. 0원은 '혜택 없음'이 아니라 '아직 못 읽음'이라 화면에서 따로 표시한다 */
export function isUnread(sid: number): boolean {
  return UNREAD.has(sid);
}

/** 혜택 표를 원문과 대조한 카드(정답표·AI 추출 검수). 나머지는 혜택 요약 한 줄을 자동 변환한 카드 */
export function isVerified(entry: CatalogListing): boolean {
  return String(entry.sourceId) in VERIFIED;
}

/**
 * 새 카드 추천 후보. 기본은 검수한 카드만 쓴다.
 * 자동 변환 카드는 실적 조건을 거의 못 읽어서(발급 중 1,088장 중 1,051장이 '실적 조건 없음') 섞으면 원문대로 계산한 카드가 밀린다.
 */
export function issuableCards(opts: { includeUnverified?: boolean } = {}): CatalogListing[] {
  return catalogCards.filter(
    (e) => !isInfoInsufficient(e) && !isDiscontinued(e) && !isRestricted(e) && (opts.includeUnverified || isVerified(e)),
  );
}

/** 카탈로그 혜택 요약을 칩 몇 개로 */
export function summaryChips(entry: CatalogListing | undefined, max = 3): string[] {
  if (!entry?.benefitSummary) return [];
  return entry.benefitSummary
    .split(/,\s+|\s*\|\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max)
    .map((s) => (s.length > 18 ? `${s.slice(0, 17)}…` : s));
}

export function cardTypeLabel(entry: CatalogListing | undefined): string {
  if (!entry) return "";
  return entry.category === "체크" ? "체크" : entry.category === "신용" ? "신용" : entry.category;
}

export function feeLabel(entry: CatalogListing | undefined): string {
  const fee = entry?.annualFee ?? 0;
  return fee > 0 ? `연 ${fee.toLocaleString("ko-KR")}원` : "연회비 없음";
}
