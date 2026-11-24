import type { CardKind } from "@/domain/types/card";
import { korWon } from "@/v1/format";

/**
 * 결과 화면 '계산 조건' 띠의 한 줄 요약(2026-10-29).
 * 디자인에 없는 기능이라, 결과 화면 맨 아래(더 자세히)에 있던 조건 바꾸기를 히어로 바로 아래로 올리면서
 * 지금 어떤 조건으로 계산했는지 펼치지 않아도 보이게 한다.
 */
export interface ConditionsSummaryInput {
  maxCards: number;
  kinds: CardKind[];
  margin: number;
  noMargin: boolean;
  feeCap: number | null;
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
  // 계산 방식(혜택 최대화/효율적) 선택은 2026-11-23에 뺐다. 늘 최대 카드 수 안에서 순혜택이 가장 큰 조합
  const out = [`최대 ${c.maxCards}장`, kindsText(c.kinds), c.noMargin ? "실적 여유 없음" : `실적 여유 ${korWon(c.margin)}`, feeCapText(c.feeCap)];
  if (c.pinned > 0) out.push(`꼭 넣을 카드 ${c.pinned}장`);
  return out;
}
