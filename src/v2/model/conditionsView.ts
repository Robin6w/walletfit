import type { CardKind } from "@/domain/types/card";
import { korWon } from "@/v1/format";

/**
 * 결과 화면 '계산 조건' 띠의 한 줄 요약(2026-10-29).
 * 디자인에 없는 기능이라, 결과 화면 맨 아래(더 자세히)에 있던 조건 바꾸기를 히어로 바로 아래로 올리면서
 * 지금 어떤 조건으로 계산했는지 펼치지 않아도 보이게 한다.
 */
export interface ConditionsSummaryInput {
  mode: "maxBenefit" | "efficient";
  maxCards: number;
  kinds: CardKind[];
  margin: number;
  noMargin: boolean;
  feeCap: number | null;
  /** 계산에서 뺀 카드사 수(후보 카드의 카드사 중) */
  excludedIssuers: number;
  pinned: number;
}

export function kindsText(kinds: CardKind[]): string {
  const credit = kinds.includes("credit");
  const check = kinds.includes("check");
  if (credit && check) return "신용·체크";
  if (credit) return "신용카드만";
  if (check) return "체크카드만";
  return "카드 종류 없음";
}

export function feeCapText(feeCap: number | null): string {
  return feeCap === null ? "연회비 제한 없음" : `연회비 합계 연 ${korWon(feeCap)}까지`;
}

export function conditionsSummary(c: ConditionsSummaryInput): string[] {
  const out = [c.mode === "maxBenefit" ? "혜택 최대화" : "효율적", `최대 ${c.maxCards}장`, kindsText(c.kinds), c.noMargin ? "실적 여유 없음" : `실적 여유 ${korWon(c.margin)}`, feeCapText(c.feeCap)];
  if (c.excludedIssuers > 0) out.push(`카드사 ${c.excludedIssuers}곳 제외`);
  if (c.pinned > 0) out.push(`꼭 넣을 카드 ${c.pinned}장`);
  return out;
}
