import { useEffect, useMemo } from "react";
import { useBrands } from "@/domain/engine/walletEngine";
import { categories } from "@/v1/catalog";
import { useAppData } from "@/v2/app/AppData";
import { FLOW_LABEL, paths, type Flow, type MakeStep } from "@/v2/app/paths";
import { navigate, useRoute } from "@/v2/app/router";
import { stepPills, useFlowInputs } from "@/v2/make/flow";
import { StepBrands } from "@/v2/make/StepBrands";
import { StepCards } from "@/v2/make/StepCards";
import { StepResult } from "@/v2/make/StepResult";
import { StepSpend } from "@/v2/make/StepSpend";
import { StepStatement } from "@/v2/make/StepStatement";
import { StepType } from "@/v2/make/StepType";
import { PageMain } from "@/v2/ui/Page";
import { WizardBar } from "@/v2/ui/TopBar";

const STEPS: MakeStep[] = ["cards", "type", "spend", "brands", "statement", "result"];
const TITLES: Record<MakeStep, string> = {
  cards: "카드 선택",
  type: "카드 종류 선택",
  spend: "지출 입력",
  brands: "자주 가는 곳",
  statement: "명세서로 지출 채우기",
  result: "추천 결과",
};

/** 지갑 만들기(보유한 카드로 / 새 카드까지 포함). 단계는 주소(#/make/own/spend 등)로 나눈다 */
export default function MakeFlow({ flow, step }: { flow: Flow; step?: string }) {
  const route = useRoute();
  const { myCards } = useAppData();
  const inp = useFlowInputs();
  const valid = (STEPS as string[]).includes(step ?? "") && !(flow === "own" && step === "type") && !(flow === "new" && step === "cards");
  const cur = (valid ? step : flow === "own" ? "cards" : "type") as MakeStep;
  useEffect(() => {
    if (!valid) navigate(paths.start(flow), { replace: true });
  }, [valid, flow]);

  const source: "manual" | "statement" = route.query.get("from") === "statement" ? "statement" : "manual";
  const noMarginParam = route.query.get("margin") === "0";

  // 자주 가는 곳·명세서에서 브랜드를 찾을 카드: 보유 흐름은 가진 카드, 새 카드 흐름은 새 카드 후보까지
  const brandIds = useMemo(() => (flow === "own" ? inp.ownIds : Array.from(new Set([...inp.ownIds, ...inp.newPool]))), [flow, inp.ownIds, inp.newPool]);
  const needBrands = cur === "brands" || cur === "statement";
  const engineBrands = useBrands(needBrands && brandIds.length ? brandIds : null);
  const extraBrands = useMemo(
    () => Object.values(engineBrands.data?.categories ?? engineBrands.lastGood?.categories ?? {}).flatMap((rows) => rows.map((r) => r.name)),
    [engineBrands.data, engineBrands.lastGood],
  );

  const pills = stepPills(flow, cur, inp, source);
  const first = flow === "own" ? paths.make("own", "cards") : paths.make("new", "type");

  let body;
  let layout: { padding?: string; width?: number; gap?: number; row?: boolean } = {};
  switch (cur) {
    case "cards":
      layout = { padding: "28px clamp(16px, 3.5vw, 48px) 32px", gap: 24 };
      body = <StepCards ids={myCards.ids} onToggle={myCards.toggle} />;
      break;
    case "type":
      layout = { padding: "28px clamp(16px, 3.5vw, 48px) 32px", width: 860, gap: 28 };
      body = <StepType value={inp.newTypes} onChange={inp.setNewTypes} />;
      break;
    case "spend":
      layout = { padding: "28px clamp(16px, 3.5vw, 48px) 40px", gap: 26 };
      body = (
        <StepSpend
          flow={flow}
          spending={inp.spend.spending}
          onChange={inp.spend.updateCategory}
          total={inp.total}
          prev={first}
          next={{ to: paths.make(flow, "brands"), label: "다음: 자주 가는 곳" }}
        />
      );
      break;
    case "brands":
      layout = { row: true, gap: 24 };
      body = (
        <StepBrands
          spending={inp.spending}
          picks={inp.picks}
          onPicks={inp.setPicks}
          brandIds={brandIds}
          prev={paths.make(flow, "spend")}
          next={paths.make(flow, "result")}
        />
      );
      break;
    case "statement":
      layout = { width: 860, gap: 22 };
      body = (
        <StepStatement
          back={paths.make(flow, "spend")}
          extraBrands={extraBrands}
          onApply={(s, fileName) => {
            // 명세서 금액으로 지출을 덮어쓴다(없는 카테고리는 0)
            inp.spend.setSpending(Object.fromEntries(categories.map((c) => [c.id, s.spending[c.id] ?? 0])));
            inp.setStatement({ brands: s.brands, fileName, period: s.period, itemCount: s.itemCount, readAt: new Date().toISOString() });
            navigate(paths.make(flow, "result", { from: "statement" }));
          }}
        />
      );
      break;
    default:
      layout = {};
      body = <StepResult flow={flow} inp={inp} source={source} noMarginParam={noMarginParam} />;
  }

  return (
    <>
      <WizardBar sub={FLOW_LABEL[flow]} steps={pills} />
      <PageMain title={TITLES[cur]} {...layout}>
        {body}
      </PageMain>
    </>
  );
}
