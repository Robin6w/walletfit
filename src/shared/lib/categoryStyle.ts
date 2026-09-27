import {
  ShoppingBag,
  Coffee,
  Bus,
  Smartphone,
  ShoppingCart,
  Store,
  UtensilsCrossed,
  Film,
  Fuel,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";

/**
 * 카테고리별 아이콘 칩 색상. 카테고리 수가 색상 수보다 많아도 순환하도록 배열로 관리한다
 * (디자인 목업에서 편의점/대형마트/그외=네이비, 카페/외식=핑크, 대중교통/통신비/주유=틸,
 * 온라인쇼핑/영화·공연=앰버 4색을 돌려썼던 것과 같은 방식).
 */
const CATEGORY_COLOR_BY_ID: Record<string, string> = {
  convenience: "#4b5aa8",
  cafe: "#be185d",
  transport: "#0f766e",
  mobile: "#0f766e",
  onlineShopping: "#b5651d",
  mart: "#4b5aa8",
  dining: "#be185d",
  culture: "#b5651d",
  gas: "#0f766e",
  etc: "#4b5aa8",
};

const CATEGORY_ICON_BY_ID: Record<string, LucideIcon> = {
  convenience: ShoppingBag,
  cafe: Coffee,
  transport: Bus,
  mobile: Smartphone,
  onlineShopping: ShoppingCart,
  mart: Store,
  dining: UtensilsCrossed,
  culture: Film,
  gas: Fuel,
  etc: MoreHorizontal,
};

const FALLBACK_COLORS = ["#4b5aa8", "#be185d", "#0f766e", "#b5651d"];

function fallbackColor(categoryId: string): string {
  let hash = 0;
  for (let i = 0; i < categoryId.length; i++) hash = (hash * 31 + categoryId.charCodeAt(i)) >>> 0;
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

export function categoryColor(categoryId: string): string {
  return CATEGORY_COLOR_BY_ID[categoryId] ?? fallbackColor(categoryId);
}

export function categoryIcon(categoryId: string): LucideIcon {
  return CATEGORY_ICON_BY_ID[categoryId] ?? MoreHorizontal;
}
