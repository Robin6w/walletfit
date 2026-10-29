/** 화면 주소 모음. 화면끼리 이동할 때는 여기 함수만 쓴다 */
export type Flow = "own" | "new";
export type MakeStep = "cards" | "type" | "spend" | "brands" | "statement" | "result";

function withQuery(path: string, q?: Record<string, string | number | undefined | null>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(q ?? {})) if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  const s = params.toString();
  return s ? `${path}?${s}` : path;
}

export const paths = {
  home: "/",
  guide: "/guide",
  wallet: "/wallet",
  cards: "/cards",
  benefit: "/benefit",
  compare: (ids: number[]) => withQuery("/compare", { ids: ids.join(",") }),
  make: (flow: Flow, step: MakeStep, q?: Record<string, string | number | undefined | null>) => withQuery(`/make/${flow}/${step}`, q),
  /** 지갑 만들기 첫 단계: 보유 카드는 카드 선택, 새 카드 포함은 카드 종류 선택 */
  start: (flow: Flow) => (flow === "own" ? "/make/own/cards" : "/make/new/type"),
};

export function isFlow(v: string | undefined): v is Flow {
  return v === "own" || v === "new";
}

export const FLOW_LABEL: Record<Flow, string> = {
  own: "보유한 카드로",
  new: "새 카드까지 포함",
};
