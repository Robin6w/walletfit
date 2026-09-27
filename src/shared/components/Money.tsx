import type { CSSProperties } from "react";

interface MoneyProps {
  /** 표시할 금액(원 단위 숫자). 반올림해서 천 단위 콤마와 함께 보여줍니다. */
  amount: number;
  /** 숫자 전체에 적용할 추가 클래스(크기·굵기·색 등은 부모 요소의 font-size를 그대로 물려받습니다). */
  className?: string;
  /** "원" 단위 글자에만 별도로 더할 클래스. */
  unitClassName?: string;
  style?: CSSProperties;
}

/**
 * 금액을 "12,345" + "원"으로 나눠서, 단위 글자("원")를 숫자보다 작고 옅게 보여주는
 * 컴포넌트. 스트라이프·로빈후드 등 핀테크 UI에서 흔히 쓰는 방식으로, 숫자 자체가
 * 가장 눈에 띄는 정보가 되도록 통화 단위의 존재감을 낮춥니다. 숫자에는 tabular-nums를
 * 적용해서 자릿수가 바뀌어도(예: 슬라이더로 지출을 조정할 때) 폭이 들쭉날쭉 흔들리지
 * 않게 합니다.
 *
 * 화면에 있는 모든 금액에 쓰기보다는, 그 화면에서 가장 크고 중요한 "핵심 숫자"
 * (이번 달 순혜택, 카드별 순혜택 등)에 우선 적용하는 걸 권장합니다.
 */
export function Money({ amount, className = "", unitClassName = "", style }: MoneyProps) {
  const digits = Math.round(amount).toLocaleString();
  return (
    <span className={`tabular-nums ${className}`} style={style}>
      {digits}
      <span className={`ml-[0.05em] text-[0.62em] font-medium opacity-65 ${unitClassName}`}>원</span>
    </span>
  );
}
