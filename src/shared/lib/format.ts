export const formatWon = (value: number) => `${Math.round(value).toLocaleString()}원`;

/** 0~1 사이의 rate를 "3%"/"1.5%" 같은 표시용 문자열로 바꾼다 (정수면 소수점 생략). */
export const formatRatePercent = (rate: number) => {
  const pct = rate * 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
};
