import type { MenuId } from "@/v2/ui/TopBar";

/** 아래 탭 높이(안전 영역 제외). 본문 아래 여백도 이 값으로 맞춘다 */
export const TAB_H = 64;

/** 주소 첫 칸 → 켜질 아래 탭 */
export function tabOf(first: string | undefined): Exclude<MenuId, null> | null {
  if (!first) return "home";
  if (first === "wallet") return "wallet";
  if (first === "cards" || first === "compare") return "cards";
  if (first === "benefit") return "benefit";
  return null;
}
