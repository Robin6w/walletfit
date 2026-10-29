/**
 * 계산 엔진 버전(2026-10-29). 저장해 둔 계산 결과를 다시 써도 되는지 가리는 데 쓴다.
 * 빌드하면 파일 이름에 내용 해시가 붙으므로, 엔진 코드(py)나 혜택 표가 바뀌면 이 값도 바뀐다.
 * 개발 서버에서는 해시가 없어 null(저장한 결과를 쓰지 않음).
 */
import calcUrl from "./py/calc.py?url";
import milpUrl from "./py/milp.py?url";
import engineUrl from "./py/wf_engine.py?url";
import benefitCatalogUrl from "@data/catalog/cards-benefit.json?url";
import assumptionsUrl from "@data/catalog/assumptions.json?url";

export const ENGINE_VERSION: string | null = import.meta.env.DEV ? null : [calcUrl, milpUrl, engineUrl, benefitCatalogUrl, assumptionsUrl].map((u) => u.slice(-40)).join("|");
