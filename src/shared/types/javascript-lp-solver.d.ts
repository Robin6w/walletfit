/**
 * javascript-lp-solver는 타입 정의를 제공하지 않는 순수 JS 라이브러리라서,
 * walletfit에서 실제로 쓰는 부분(정수/이진 변수를 포함한 MILP 모델과 Solve 결과)만
 * 최소한으로 선언해 둡니다.
 *
 * 참고: https://github.com/JWally/jsLPSolver
 */
declare module "javascript-lp-solver" {
  export interface LpConstraint {
    max?: number;
    min?: number;
    equal?: number;
  }

  export interface LpModel {
    optimize: string;
    opType: "max" | "min";
    constraints: Record<string, LpConstraint>;
    /** variables[변수명][제약/목적함수 이름] = 계수 */
    variables: Record<string, Record<string, number>>;
    /** 정수 제약을 걸 변수 목록 (예: { x: 1 }) */
    ints?: Record<string, 1>;
    /** 0/1 이진 제약을 걸 변수 목록 (예: { y: 1 }) */
    binaries?: Record<string, 1>;
  }

  export interface LpSolution {
    feasible: boolean;
    /** 목적함수 값 */
    result: number;
    bounded?: boolean;
    isIntegral?: boolean;
    /** 그 외 키는 각 변수명 -> 해(0이면 결과 객체에 아예 포함되지 않음) */
    [variableName: string]: number | boolean | undefined;
  }

  interface Solver {
    Solve(model: LpModel, precision?: number, full?: boolean, validate?: boolean): LpSolution;
  }

  const solver: Solver;
  export default solver;
}
