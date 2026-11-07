import type { CategoryRankRow } from "@/domain/engine/walletEngine";
import { catLabel, catalogBySourceId } from "@/v1/catalog";
import { korWon, num, won } from "@/v1/format";
import { benefitTitle, sharedShort } from "@/v2/model/compareView";
import { cardNick, catShort, korAmount, pctText } from "@/v2/model/text";

/**
 * 혜택별 추천 화면(디자인 F-D-Benefit, 2026-10-29 v2)의 문장.
 * 금액은 엔진 categoryRank(그 카테고리 지출을 각 카드로 낼 때 그 카테고리에서 받는 월 혜택) 결과다.
 * 2026-11-07: 다른 기능과 분리된 독립 기능. 지출 입력·자주 가는 곳·내 카드·지갑을 쓰지 않고 전체 카드만 비교한다.
 */

/** '전월실적 40만원 이상' (perfMin이 0이거나 실적을 가정하지 않았으면 null) */
export function perfText(r: CategoryRankRow): string | null {
  if (!r.perfMin) return null;
  const word = r.perfBasis === "prev_month" ? "전월실적" : r.perfBasis === "this_month" ? "당월실적" : "실적";
  return `${word} ${korAmount(r.perfMin)}원 이상`;
}

export interface BenefitRowVM {
  sid: number;
  rank: number;
  name: string;
  nick: string;
  note: string;
  value: number;
  /** '월 3,300원' / '월 약 2,700원' / '월 0원' */
  amountText: string;
  /** 막대 길이(%) */
  pct: number;
  zero: boolean;
}

export interface BenefitHeroVM extends BenefitRowVM {
  badge: string;
  /** 숫자만(한도에 걸려 확정이면 원 단위, 아니면 백 원 단위) */
  amountNum: string;
  approx: boolean;
  lead: string;
}

/** 한도에 걸린 금액은 확정, 아니면 '약' + 백 원 단위(1천원 미만은 그대로) */
function exactOf(r: CategoryRankRow): boolean {
  const d = r.detail;
  return r.value < 1000 || !!d?.capHit || !!d?.shared;
}

export function amountText(r: CategoryRankRow): string {
  if (r.value < 0.5) return "월 0원";
  return exactOf(r) ? `월 ${won(r.value)}` : `월 약 ${num(Math.round(r.value / 100) * 100)}원`;
}

/** 한 줄 설명: '트렌디숍(편의점) 7% · 전월실적 40만원 이상 · 쇼핑 업종 한도 5천원에 걸림 · 패키지 ‘스타벅스 50% + 트렌디숍 7%’' */
export function noteText(r: CategoryRankRow, cat: string): string {
  if (r.value < 0.5) return `${catLabel(cat)} 혜택이 없어요`;
  const d = r.detail;
  const perf = perfText(r);
  if (!d?.title) return `모든 가맹점 혜택 중 ${catShort(cat)} 몫이에요${perf ? ` · ${perf}` : ""}`;
  const parts: string[] = [benefitTitle({ title: d.title, specificity: d.specificity ?? "category", merchants: d.merchants ?? [] })];
  if (perf) parts.push(perf);
  if (d.capHit) parts.push(`월 한도 ${won(d.capHit)}에 걸림`);
  else if (d.shared) parts.push(`${sharedShort(d.shared.label)} 한도 ${korWon(d.shared.cap)}에 걸림`);
  if (d.maxCountedTxn) parts.push(`1회 ${korWon(d.maxCountedTxn)}까지`);
  else if (d.perTxnCap && !d.capHit) parts.push(`건당 ${won(d.perTxnCap)}`);
  if (d.countLimits?.per_month) parts.push(`월 ${d.countLimits.per_month}회`);
  else if (d.countLimits?.per_day) parts.push(`하루 ${d.countLimits.per_day}회`);
  if (d.minTxn) parts.push(`${won(d.minTxn)} 이상 결제`);
  if ((d.specificity === "brand" || d.specificity === "merchant_group") && d.share !== null && d.share !== undefined && d.share < 0.999)
    parts.push(`대상 가맹점 비중 ${pctText(d.share)} 가정`);
  if (r.switched && d.options.length) parts.push(`패키지 ‘${d.options.map((o) => o.label).join(" + ")}’`);
  if (r.status === "auto") parts.push("원문 확인 전");
  return parts.slice(0, 5).join(" · ");
}

function nameOf(r: CategoryRankRow): string {
  return catalogBySourceId.get(r.sid)?.name ?? r.name;
}

/** 같은 이름·같은 금액 카드(카드고릴라에 디자인별로 따로 올라온 카드)는 한 번만 */
export function dedupeRows(rows: CategoryRankRow[]): CategoryRankRow[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const k = `${nameOf(r)}|${Math.round(r.value)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function rowsVM(rows: CategoryRankRow[], cat: string): BenefitRowVM[] {
  const top = Math.max(0, ...rows.map((r) => r.value));
  return rows.map((r, i) => ({
    sid: r.sid,
    rank: i + 1,
    name: nameOf(r),
    nick: cardNick(nameOf(r)),
    note: noteText(r, cat),
    value: r.value,
    amountText: amountText(r),
    pct: top > 0 ? Math.round((r.value / top) * 100) : 0,
    zero: r.value < 0.5,
  }));
}

/** 어느 카드 중에서 찾았나(내 카드 중 / 전체 카드 중, 2026-11-07) */
export type BenefitScope = "mine" | "all";

/** assumePerf: '실적 채웠다고 가정'을 켰는지 */
export function heroVM(rows: CategoryRankRow[], cat: string, amount: number, assumePerf: boolean, scope: BenefitScope = "all"): BenefitHeroVM | null {
  const r = rows[0];
  if (!r || r.value < 0.5) return null;
  const base = rowsVM(rows, cat)[0];
  const exact = exactOf(r);
  const kind = r.detail?.kind;
  const word = !kind || kind === "discount" ? "할인" : "혜택";
  const perf = perfText(r);
  return {
    ...base,
    badge: `1위 · ${scope === "mine" ? "내 카드" : "전체 카드"} 중 ${catLabel(cat)} 혜택이 가장 커요`,
    amountNum: exact ? num(r.value) : num(Math.round(r.value / 100) * 100),
    approx: !exact,
    lead:
      `${catShort(cat)} ${korAmount(amount)}원을 이 카드로 낼 때 받는 ${word}이에요. ` +
      (!assumePerf ? `실적도 이 ${korAmount(amount)}원만으로 계산했어요.` : perf ? `${perf}일 때예요.` : "실적 조건 없이 받아요."),
  };
}
