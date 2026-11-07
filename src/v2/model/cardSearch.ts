import type { CatalogListing } from "@/domain/types/catalog";
import type { CardViewEntry } from "@/domain/types/cardView";
import { KEYWORD_MAP } from "@/features/statement/importerParser";
import { catalogCards, isDiscontinued, isVerified } from "@/v1/catalog";

/** 그 카테고리 혜택이 있는 카드(전체 카드 '혜택으로 찾기', 혜택별 추천 금액 넣기 전 목록).
 *  원문 정제 혜택 표에 그 카테고리 혜택(계산 제외 빼고)이 있으면 참.
 *  혜택 표를 받기 전이거나 없는 카드는 혜택 요약에 그 카테고리 낱말(스타벅스·커피·편의점 등)이 있거나 구간표가 있는 카드 */
export function hasBenefit(c: CatalogListing, cat: string, view: CardViewEntry | undefined): boolean {
  if (view) return view.b.some((b) => b.c === cat && b.st !== "no_calc");
  if (c.categoryTiers?.some((t) => t.category === cat)) return true;
  const text = (c.benefitSummary ?? "").toLowerCase();
  return (KEYWORD_MAP[cat] ?? []).some((k) => k.length >= 2 && text.includes(k.toLowerCase()));
}

/** 카드 찾기(A1 카드 선택, 전체 카드). 영문 카드명은 한글 별명으로도 찾는다 */
export const NAME_ALIASES: Record<string, string[]> = {
  taptap: ["탭탭", "탭탭오", "탭탭에스"],
  "mr.life": ["미스터라이프", "미스터 라이프"],
  loca: ["로카"],
  "deep dream": ["딥드림"],
  "id on": ["아이디온"],
  "the more": ["더모아"],
  "the pit": ["더핏"],
  "deep on": ["딥온"],
  "kb pay": ["케이비페이"],
};

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, "");

export function matchesCard(c: Pick<CatalogListing, "name" | "issuer">, q: string): boolean {
  const n = squash(`${c.name} ${c.issuer}`);
  const query = squash(q);
  if (!query) return true;
  if (n.includes(query)) return true;
  return Object.entries(NAME_ALIASES).some(
    ([en, ko]) => ko.some((k) => squash(k).includes(query) || query.includes(squash(k))) && n.includes(squash(en)),
  );
}

export interface SearchOpts {
  q: string;
  kind: "all" | "신용" | "체크";
  issuer: string | null;
  /** 앞에 둘 카드(담은 카드) */
  pinned?: Set<number>;
}

/**
 * 담은 카드 → 발급 중인 카드 → 발급 중단 카드 순.
 * 발급 중인 카드 안에서는 혜택 표를 원문과 대조한 카드(67장)를 앞에 둔다.
 * 검색어가 없으면 나머지는 최신순(카탈로그 순서는 카드사별로 몰려 있어 첫 화면이 한 카드사로 채워진다, 2026-10-29)
 */
export function searchCards({ q, kind, issuer, pinned }: SearchOpts): CatalogListing[] {
  let list = catalogCards;
  const query = q.trim();
  if (query) list = list.filter((c) => matchesCard(c, query));
  if (kind !== "all") list = list.filter((c) => c.category === kind);
  if (issuer) list = list.filter((c) => c.issuer === issuer);
  return [...list].sort(
    (a, b) =>
      Number(pinned?.has(b.sourceId) ?? 0) - Number(pinned?.has(a.sourceId) ?? 0) ||
      Number(isDiscontinued(a)) - Number(isDiscontinued(b)) ||
      Number(isVerified(b)) - Number(isVerified(a)) ||
      (query ? 0 : b.sourceId - a.sourceId),
  );
}

/** 이름에서 검색어와 같은 부분(대소문자 무시)을 나눈다: [{text, hit}] */
export function splitHighlight(text: string, q: string): { text: string; hit: boolean }[] {
  const query = q.trim();
  if (!query) return [{ text, hit: false }];
  const lower = text.toLowerCase();
  const ql = query.toLowerCase();
  const out: { text: string; hit: boolean }[] = [];
  let i = 0;
  for (;;) {
    const j = lower.indexOf(ql, i);
    if (j < 0) break;
    if (j > i) out.push({ text: text.slice(i, j), hit: false });
    out.push({ text: text.slice(j, j + ql.length), hit: true });
    i = j + ql.length;
  }
  if (i < text.length) out.push({ text: text.slice(i), hit: false });
  return out.length ? out : [{ text, hit: false }];
}

export const TOP_ISSUERS = ["신한카드", "삼성카드", "KB국민카드", "현대카드", "우리카드", "롯데카드"];
/** 칩 이름: 카드고릴라 표기(BC 바로카드 등)를 짧게 */
export const issuerChip = (i: string) => (i.startsWith("BC") ? "BC" : i.replace(/카드$/, ""));
