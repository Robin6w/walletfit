/**
 * 숫자 표기 규칙 (v1_최종디자인/구현명세.md '숫자·문구 규칙')
 *  - 헤드라인: 천 원 단위, 한글 단위 + '약'      → 약 3만 3천원
 *  - 요약 줄·하단 바: 천 원 단위, 쉼표 + '약'     → 약 33,000원
 *  - 카드별 월 혜택: 모두 한도에 걸려 확정이면 원 단위, 아니면 백 원 단위 + '약'
 *  - 계산 근거: 원 단위 그대로                     → 20,895원
 *  - 연간: 만 원 단위                              → 약 40만원
 *  - 실적·지출 금액: 천 원 단위, 한글 단위          → 32만 4천원
 */
export function won(n: number): string {
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

export function num(n: number): string {
  return Math.round(n).toLocaleString("ko-KR");
}

/** 32만 4천원 / 3천원 / 100만원 (천 원 단위로 반올림) */
export function korWon(n: number): string {
  const v = Math.round(n / 1000) * 1000;
  if (v === 0) return Math.round(n) === 0 ? "0원" : `${num(n)}원`;
  const sign = v < 0 ? "-" : "";
  const a = Math.abs(v);
  const man = Math.floor(a / 10000);
  const cheon = Math.round((a % 10000) / 1000);
  if (man === 0) return `${sign}${cheon}천원`;
  return `${sign}${man.toLocaleString("ko-KR")}만${cheon ? ` ${cheon}천` : ""}원`;
}

/** 헤드라인용: 약 3만 3천원 */
export function approxKor(n: number): string {
  return `약 ${korWon(n)}`;
}

/** 요약 줄용: 약 33,000원 */
export function approxWon(n: number): string {
  return `약 ${num(Math.round(n / 1000) * 1000)}원`;
}

/** 카드별 월 혜택: 한도에 모두 걸려 확정이면 원 단위, 아니면 '약' + 백 원 단위 */
export function cardMonthly(total: number, exact: boolean): string {
  return exact ? `월 ${won(total)}` : `월 약 ${num(Math.round(total / 100) * 100)}원`;
}

/** 연간: 약 40만원 */
export function annualMan(monthly: number): string {
  const v = Math.round((monthly * 12) / 10000);
  return `약 ${v.toLocaleString("ko-KR")}만원`;
}

export function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

export const CARD_COLORS = ["#1B4FD8", "#EB6834", "#1BAF7A", "#EDA100", "#7A4CC2"];

export function cardColor(index: number): string {
  return CARD_COLORS[index % CARD_COLORS.length];
}
