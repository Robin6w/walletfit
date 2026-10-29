import type { BrandShare } from "@/domain/types/engine";

/**
 * 자주 가는 곳(A3·B3) 규칙 — 2026-10-28 사용자 결정
 *  - 고른 브랜드들이 그 카테고리 지출의 70%를 똑같이 나눠 가진다고 본다(나머지 30%는 다른 가게)
 *  - '이 중엔 자주 가는 곳이 없어요'를 누른 카테고리는 브랜드 한정 할인 0
 *  - 건드리지 않은 카테고리는 넣지 않는다 → 계산기 가정값(브랜드 35%)으로 계산하고 '추정' 표시
 *  - 명세서로 읽은 브랜드 금액은 금액 ÷ 카테고리 지출 그대로 쓴다
 */
export const PICKED_TOTAL_SHARE = 0.7;

export interface BrandPick {
  /** 고른 브랜드(화면 이름) */
  brands: string[];
  /** '이 중엔 자주 가는 곳이 없어요' */
  none?: boolean;
}
export type BrandPicks = Record<string, BrandPick>;

/** 디자인의 카테고리 탭과 대표 브랜드(로고 있음) */
export const BRAND_TABS: { cat: string; label: string; brands: string[] }[] = [
  { cat: "cafe", label: "카페·디저트", brands: ["스타벅스", "투썸플레이스", "메가MGC커피", "이디야커피", "컴포즈커피", "빽다방", "커피빈", "폴바셋", "파리바게뜨"] },
  { cat: "convenience", label: "편의점", brands: ["GS25", "CU", "세븐일레븐", "이마트24"] },
  { cat: "dining", label: "외식·배달", brands: ["배달의민족", "쿠팡이츠", "요기요"] },
  { cat: "onlineShopping", label: "온라인쇼핑", brands: ["쿠팡", "네이버쇼핑", "G마켓", "11번가", "SSG.COM"] },
  { cat: "gas", label: "주유", brands: ["SK에너지", "GS칼텍스", "S-OIL", "HD현대오일뱅크"] },
];

/**
 * 화면 이름 → 혜택 표에 적힌 가맹점 이름들. 혜택 표에서 같은 브랜드를 다르게 적은 경우를 모은다.
 * 2026-10-28 혜택 표 전수 확인: 한 혜택 안에 같은 브랜드의 별칭이 함께 적힌 경우 0건(비중이 두 번 더해지지 않음)
 */
export const BRAND_ALIASES: Record<string, string[]> = {
  투썸플레이스: ["투썸플레이스", "투썸"],
  메가MGC커피: ["메가MGC커피", "메가커피", "메가엠지씨커피"],
  이디야커피: ["이디야커피", "이디야"],
  컴포즈커피: ["컴포즈커피", "컴포즈"],
  네이버쇼핑: ["네이버쇼핑", "네이버플러스스토어", "네이버스마트스토어"],
  G마켓: ["G마켓", "지마켓"],
  "SSG.COM": ["SSG.COM", "SSG닷컴", "쓱닷컴"],
  SK에너지: ["SK에너지", "SK주유소"],
  GS칼텍스: ["GS칼텍스", "GS주유소"],
  "S-OIL": ["S-OIL", "에쓰오일"],
  HD현대오일뱅크: ["HD현대오일뱅크", "현대오일뱅크", "에이치디현대오일뱅크"],
};

export function aliasesOf(brand: string): string[] {
  return BRAND_ALIASES[brand] ?? [brand];
}

const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();

/** 혜택 표 가맹점 이름 → 화면 이름(별칭 모음 기준). 없으면 그대로 */
export function canonicalBrand(name: string): string {
  const n = norm(name);
  for (const [brand, al] of Object.entries(BRAND_ALIASES)) if (al.some((a) => norm(a) === n)) return brand;
  return name;
}

/** 디자인 캔버스의 브랜드 로고(public/brands) */
export const BRAND_LOGOS: Record<string, string> = {
  SK에너지: "/brands/sk-energy.png",
  HD현대오일뱅크: "/brands/hd-oilbank.png",
  "S-OIL": "/brands/s-oil.png",
  GS칼텍스: "/brands/gs-caltex.png",
  "11번가": "/brands/11st.png",
  G마켓: "/brands/gmarket.png",
  "SSG.COM": "/brands/ssg.png",
  네이버쇼핑: "/brands/naver-shopping.png",
  쿠팡: "/brands/coupang.png",
  배달의민족: "/brands/baemin.png",
  요기요: "/brands/yogiyo.png",
  쿠팡이츠: "/brands/coupang-eats.png",
  CU: "/brands/cu.png",
  이마트24: "/brands/emart24.png",
  GS25: "/brands/gs25.png",
  세븐일레븐: "/brands/7eleven.png",
  메가MGC커피: "/brands/mega-coffee.png",
  빽다방: "/brands/paik.png",
  스타벅스: "/brands/starbucks.png",
  이디야커피: "/brands/ediya.png",
  커피빈: "/brands/coffeebean.png",
  컴포즈커피: "/brands/compose.png",
  투썸플레이스: "/brands/twosome.png",
  파리바게뜨: "/brands/paris-baguette.png",
  폴바셋: "/brands/paul-bassett.png",
};

export function logoOf(brand: string): string | null {
  const url = BRAND_LOGOS[brand];
  return url ? `${import.meta.env.BASE_URL}${url.replace(/^\//, "")}` : null;
}

/** 고른 브랜드 → 계산기 브랜드 비중. 지출이 없는 카테고리는 넣지 않는다 */
export function picksToBrandShare(spending: Record<string, number>, picks: BrandPicks): BrandShare {
  const out: BrandShare = {};
  for (const [cat, pick] of Object.entries(picks)) {
    if (!(spending[cat] > 0)) continue;
    if (pick.none) {
      out[cat] = {};
      continue;
    }
    const brands = Array.from(new Set(pick.brands));
    if (brands.length === 0) continue;
    const each = PICKED_TOTAL_SHARE / brands.length;
    const m: Record<string, number> = {};
    for (const b of brands) for (const a of aliasesOf(b)) m[a] = each;
    out[cat] = m;
  }
  return out;
}

/** 명세서에서 읽은 브랜드 금액 → 계산기 브랜드 비중 */
export function amountsToBrandShare(spending: Record<string, number>, amounts: Record<string, Record<string, number>>): BrandShare {
  const out: BrandShare = {};
  for (const [cat, brands] of Object.entries(amounts ?? {})) {
    const total = spending[cat] ?? 0;
    const byBrand = new Map<string, number>();
    for (const [name, v] of Object.entries(brands ?? {})) if (v > 0) byBrand.set(canonicalBrand(name), (byBrand.get(canonicalBrand(name)) ?? 0) + v);
    if (!total || byBrand.size === 0) continue;
    const m: Record<string, number> = {};
    for (const [brand, v] of byBrand) for (const a of aliasesOf(brand)) m[a] = Math.min(1, v / total);
    out[cat] = m;
  }
  return out;
}

export function pickedCount(picks: BrandPicks): number {
  return Object.values(picks).reduce((s, p) => s + (p.none ? 0 : p.brands.length), 0);
}
