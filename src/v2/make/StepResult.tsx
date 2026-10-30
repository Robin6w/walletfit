import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { EnginePack, RecommendResponse } from "@/domain/types/engine";
import { CardDetailModal } from "@/features/catalog/CardDetailModal";
import { catalogBySourceId } from "@/v1/catalog";
import { useToast } from "@/shared/hooks/useToast";
import { useEngine, useEngineProgressive } from "@/v2/app/engine";
import { useEngineState } from "@/domain/engine/walletEngine";
import { useAppData } from "@/v2/app/AppData";
import { paths, type Flow } from "@/v2/app/paths";
import { Link, navigate } from "@/v2/app/router";
import type { SavedWalletV2 } from "@/v2/app/state";
import { chatStore } from "@/v2/chat/chatStore";
import type { FlowInputs } from "@/v2/make/flow";
import { monotoneBar, pickNewFlow, pickNoMargin, type BarItem } from "@/v2/model/guards";
import {
  barVM,
  guideRows,
  heroVM,
  noMarginVM,
  perfVM,
  roleCard,
  shortOf,
  todoList,
  usedValuesVM,
  type ViewCtx,
} from "@/v2/model/resultView";
import { DetailsItem, GuideRows, HeroAmount, HeroCardStack, HeroTiles, RoleCardArticle, SHADOW, NUM } from "@/v2/result/parts";
import { ConditionsBar } from "@/v2/result/MoreOptions";
import { ProofPanel, reportNumbers } from "@/v2/result/ProofPanel";
import { CardImage } from "@/v2/ui/CardImage";

/* 디자인 원본 F-D-Result(A4), F-D-Result-NoMargin, F-D-Result-B(B4), 명세서 경로 결과 값을 그대로 옮김 */

type Explain = { ok: boolean; error?: string; result: EnginePack };

interface View {
  pack: EnginePack;
  bar: BarItem[];
  newSids: number[];
  ownedOnly: EnginePack | null;
  keptOwned: boolean;
  /** 실적 여유 없음: 기본 추천(여유 있는 조합) */
  base: EnginePack | null;
  /** 이 결과를 낸 추천 응답(상담 맥락·저장용) */
  rec: RecommendResponse;
}

const primaryBtn: CSSProperties = { display: "flex", alignItems: "center", height: 48, padding: "0 22px", boxSizing: "border-box", border: "none", borderRadius: 24, background: "#2457F5", fontFamily: "inherit", fontSize: 15, fontWeight: 700, color: "#FFFFFF", cursor: "pointer" };
const outlineBtn: CSSProperties = { display: "flex", alignItems: "center", height: 48, padding: "0 18px", boxSizing: "border-box", borderRadius: 24, border: "1px solid #D3DDF2", background: "#FFFFFF", fontFamily: "inherit", fontSize: 15, fontWeight: 700, color: "#0D1B4A", cursor: "pointer" };

function settled(q: { data: unknown; error: string | null }, asked: boolean) {
  return !asked || q.data !== null || q.error !== null;
}

/**
 * 계산 기다리는 동안의 안내(2026-10-29). 엔진 준비(처음 한 번)와 조합 계산을 나눠 보여 주고,
 * 오래 걸리면 경과 시간을 덧붙인다. 측정: 엔진 준비 약 9초, 조합 계산 3~8초(카드·지출 항목이 많으면 더 걸림)
 */
function LoadingStatus({ task }: { task: string }) {
  const engine = useEngineState();
  const [sec, setSec] = useState(0);
  useEffect(() => {
    const t0 = Date.now();
    const id = window.setInterval(() => setSec(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);
  const booting = engine === "booting";
  const steps: { label: string; state: "done" | "now" | "todo" }[] = [
    { label: "계산 엔진 준비", state: booting ? "now" : "done" },
    { label: "조합 계산", state: booting ? "todo" : "now" },
  ];
  return (
    <div role="status" aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 10, fontSize: 15, color: "#3A4A78" }}>
        <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-[#2457F5] border-t-transparent" />
        {booting ? "계산 엔진을 준비하고 있어요. 처음 한 번만 10초 안팎 걸려요" : `${task}. 보통 10초 안에 끝나요`}
      </p>
      <ol aria-label="진행 단계" style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: 8, fontSize: 13 }}>
        {steps.map((st, i) => (
          <li
            key={st.label}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 28, padding: "0 12px", boxSizing: "border-box", borderRadius: 14, background: st.state === "todo" ? "#F3F6FD" : "#E8EEFF", color: st.state === "todo" ? "#5E6D96" : "#1747D6", fontWeight: st.state === "now" ? 700 : 500 }}
          >
            <span aria-hidden="true">{st.state === "done" ? "✓" : `${i + 1}`}</span>
            {st.label}
            <span className="sr-only">{st.state === "done" ? " 완료" : st.state === "now" ? " 진행 중" : " 대기"}</span>
          </li>
        ))}
        {sec >= 5 && <li style={{ display: "inline-flex", alignItems: "center", height: 28, color: "#5E6D96" }}>{sec}초 지났어요</li>}
      </ol>
      {sec >= 20 && <p style={{ margin: 0, fontSize: 13, color: "#5E6D96" }}>카드와 지출 항목이 많으면 조금 더 걸려요. 화면을 닫지 않으면 계산은 이어져요.</p>}
    </div>
  );
}

export function StepResult({ flow, inp, source, noMarginParam }: { flow: Flow; inp: FlowInputs; source: "manual" | "statement"; noMarginParam: boolean }) {
  const { setWallet, wallet, setLastRun } = useAppData();
  const { showToast } = useToast();
  const [proof, setProof] = useState<number | null>(null);
  const [issueSid, setIssueSid] = useState<number | null>(null);
  const [retry, setRetry] = useState(0);

  const viaStatement = source === "statement" && !!inp.statement;
  const effSource: "manual" | "statement" = viaStatement ? "statement" : "manual";
  const noMargin = flow === "own" && noMarginParam;
  const c = inp.conditions;
  const margin = inp.margin;
  const spending = inp.spending;
  const brandShare = useMemo(
    () => inp.brandShareFor(effSource),
    // 지출·고른 곳·명세서가 바뀔 때만
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(spending), JSON.stringify(inp.picks), JSON.stringify(inp.statement?.brands ?? null), effSource],
  );
  const extra = retry ? { retry } : {};
  const common = { spending, mode: c.mode, maxCards: c.maxCards, ...(c.feeCap !== null ? { feeCap: c.feeCap } : {}), brandShare };
  // 대안 조합(여유 없이)은 첫 결과를 늦추므로(약 4초) '여유 없이 다시 계산' 화면에서만 따로 계산한다(2026-10-29)
  const ownArgs = inp.ownIds.length && inp.total ? { ids: inp.ownIds, margin, withAlt: false, ...common, ...extra } : null;
  const newIds = useMemo(() => Array.from(new Set([...inp.ownIds, ...inp.newPool])), [inp.ownIds, inp.newPool]);
  // 꼭 넣을 카드(카드 비교에서 고른 카드)는 고정하고, 최대 카드 수가 모자라면 그만큼 늘린다
  const pinned = flow === "new" ? inp.pinned.filter((s) => newIds.includes(s)) : [];
  const pinArgs = pinned.length ? { fixed: pinned, maxCards: Math.max(c.maxCards, pinned.length) } : {};
  const newArgs = flow === "new" && inp.total && inp.newTypes.length && newIds.length ? { ids: newIds, margin, withAlt: false, ...common, ...pinArgs, ...extra } : null;

  // 점진적 결과: 2장까지 빠른 계산을 먼저 보여 주고 3장 이상은 이어서 계산한다(3장 이상은 장수마다 최대 8초)
  const quickOf = (a: { maxCards: number } | null) => (a && a.maxCards > 2 ? { ...a, kLimit: 2 } : null);
  const recOwn = useEngineProgressive<RecommendResponse>("recommend", ownArgs, quickOf(ownArgs));
  const base = recOwn.data && !recOwn.data.empty ? recOwn.data : null;
  const rec0Args = noMargin && ownArgs ? { ...ownArgs, margin: 0, withAlt: false } : null;
  const rec0 = useEngine<RecommendResponse>("recommend", rec0Args);
  const altQArgs = noMargin && base && base.margin > 0 ? { ids: base.pool, k: base.k, spending, brandShare, ...(c.feeCap !== null ? { feeCap: c.feeCap } : {}), ...extra } : null;
  const altQ = useEngine<{ ok: boolean; error?: string; alt: RecommendResponse["alt"] }>("alt", altQArgs);
  const alt = base?.alt ?? altQ.data?.alt ?? null;
  const altArgs = noMargin && alt ? { ids: alt.sids, spending, margin: 0, brandShare, ...extra } : null;
  const altEx = useEngine<Explain>("explain", altArgs);
  const baseExArgs = noMargin && base ? { ids: base.result.sids, spending, margin: 0, brandShare, ...extra } : null;
  const baseEx = useEngine<Explain>("explain", baseExArgs);
  const recNew = useEngineProgressive<RecommendResponse>("recommend", newArgs, quickOf(newArgs));

  // 화면에 그릴 결과(보호 장치 적용). 계산이 끝나지 않았으면 null
  const view: View | null = useMemo(() => {
    if (flow === "own") {
      if (!base) return null;
      if (!noMargin) return { pack: base.result, bar: monotoneBar(base.bar, base.result), newSids: [], ownedOnly: null, keptOwned: false, base: null, rec: base };
      if (!settled(rec0, !!rec0Args) || !settled(altQ, !!altQArgs) || !settled(altEx, !!altArgs) || !settled(baseEx, !!baseExArgs)) return null;
      const pick = pickNoMargin(rec0.data && !rec0.data.empty ? rec0.data : null, altEx.data?.result, baseEx.data?.result);
      if (!pick) return null;
      return { pack: pick.pack, bar: pick.bar, newSids: [], ownedOnly: null, keptOwned: false, base: base.result, rec: { ...(rec0.data ?? base), result: pick.pack, bar: pick.bar, margin: 0 } };
    }
    if (!recNew.data || recNew.data.empty || !settled(recOwn, !!ownArgs)) return null;
    const pick = pickNewFlow(recNew.data, base, inp.owned, pinned);
    if (!pick) return null;
    const rec = pick.keptOwned && base ? base : recNew.data;
    return { pack: pick.pack, bar: pick.bar, newSids: pick.newSids, ownedOnly: pick.ownedOnly, keptOwned: pick.keptOwned, base: null, rec: { ...rec, result: pick.pack, bar: pick.bar } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow, noMargin, base, rec0.data, rec0.error, altQ.data, altQ.error, altEx.data, altEx.error, baseEx.data, baseEx.error, recNew.data, recOwn.error, inp.owned, pinned.join(",")]);

  const refining = (flow === "new" ? recNew.refining : recOwn.refining) && !noMargin;
  const busy = recOwn.isComputing || rec0.isComputing || altQ.isComputing || altEx.isComputing || baseEx.isComputing || recNew.isComputing;
  const error = (flow === "own" ? recOwn.error ?? rec0.error : recNew.error ?? recOwn.error) ?? null;
  const effMargin = noMargin ? 0 : margin;

  // 조건을 바꿔 다시 계산하는 동안에는 같은 화면의 직전 결과를 흐리게 보여 준다
  const viewKey = `${flow}|${noMargin}|${effSource}`;
  const [lastView, setLastView] = useState<{ key: string; view: View } | null>(null);
  useEffect(() => {
    if (view) setLastView({ key: viewKey, view });
  }, [view, viewKey]);
  const shown = view ?? (busy && lastView?.key === viewKey ? lastView.view : null);

  useEffect(() => {
    if (!view) return;
    setLastRun({ flow, source: effSource, rec: view.rec, spending: view.rec.spending ?? spending, margin: effMargin, brandShare, at: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // 계산할 수 없는 경우
  const blocked =
    inp.total === 0
      ? { text: "넣은 지출이 없어요. 지출 입력에서 금액을 넣어 주세요.", to: paths.make(flow, "spend"), label: "지출 입력으로" }
      : flow === "own" && inp.owned.length === 0
        ? { text: "담은 카드가 없어요. 카드 선택에서 가진 카드를 담아 주세요.", to: paths.make("own", "cards"), label: "카드 선택으로" }
        : flow === "own" && inp.ownIds.length === 0
          ? { text: "조건에 맞는 카드가 없어요. 아래 조건 바꾸기에서 카드 종류나 카드사 제외를 풀어 주세요.", to: null, label: "" }
          : flow === "new" && inp.newTypes.length === 0
            ? { text: "새 카드 종류를 먼저 골라 주세요.", to: paths.make("new", "type"), label: "카드 종류 선택으로" }
            : null;

  const ctx: ViewCtx = {
    spending: shown?.rec.spending ?? spending,
    brandShare,
    margin: effMargin,
    ownedIds: inp.owned,
    newSids: shown?.newSids ?? [],
    source: effSource,
    picks: inp.picks,
    statementBrands: inp.statement?.brands,
  };

  const save = (stay: boolean) => {
    // 3장 이상 조합을 찾는 중에는 저장하지 않는다(빠른 2장 결과를 저장하면 더 좋은 조합을 놓친다)
    if (!view || refining) return;
    const todos = todoList(view.pack, view.newSids).map((t) => ({ ...t, done: wallet?.todos.find((x) => x.id === t.id)?.done ?? false }));
    const w: SavedWalletV2 = {
      savedAt: new Date().toISOString(),
      scope: flow === "own" ? "myCards" : "all",
      spending: ctx.spending,
      brandSpend: viaStatement ? (inp.statement?.brands ?? {}) : {},
      margin: effMargin,
      pack: view.pack,
      singleNet: view.bar.find((b) => b.k === 1)?.net ?? null,
      todos,
      v: 2,
      flow,
      source: effSource,
      brandShare,
      bar: view.bar,
      baseline: view.base ? { names: view.base.cards.map((x) => shortOf(x)), net: view.base.net, margin } : null,
      newSids: view.newSids,
      ownedOnlyNet: view.ownedOnly?.net ?? null,
    };
    setWallet(w);
    if (stay) showToast("할 일을 내 지갑에 저장했어요. 내 지갑에서 하나씩 체크할 수 있어요.", "success");
    else {
      showToast("내 지갑에 저장했어요", "success");
      navigate(paths.wallet);
    }
  };

  const backTo = viaStatement ? paths.make(flow, "statement") : paths.make(flow, "spend");
  const backLabel = viaStatement ? "← 명세서 다시 올리기" : "← 지출 다시 입력";
  const resultQ = (q: Record<string, string | number | undefined>) => paths.make(flow, "result", { from: viaStatement ? "statement" : undefined, ...q });
  const saveLabel = refining ? "더 좋은 조합을 찾는 중…" : noMargin ? "이 조합으로 내 지갑에 저장" : "내 지갑에 저장";
  // 소득으로 채운 지출의 카드 수: 결과 화면 추천과 같은 카드·조건·브랜드 비중으로 계산한다
  const calcIds = flow === "own" ? inp.ownIds : newIds;
  const countArgs = calcIds.length
    ? (s: Record<string, number>) => ({
        ids: calcIds,
        ...(flow === "new" && pinned.length ? { fixed: pinned } : {}),
        spending: s,
        mode: c.mode,
        ...(c.feeCap !== null ? { feeCap: c.feeCap } : {}),
        margin: noMargin ? 0 : margin,
        withAlt: false,
        brandShare: inp.brandShareWith(s, effSource),
      })
    : null;
  // 여유 없이 계산 화면에서 여유(2만원·5만원)를 고르면 기본 결과로 돌아간다
  const setMarginBack = (m: number) => {
    inp.setMargin(m);
    if (noMargin) navigate(resultQ({}));
  };

  if (blocked) {
    return (
      <>
        <section style={{ background: "#FFFFFF", borderRadius: 24, padding: "32px clamp(18px, 2.6vw, 36px)", boxShadow: SHADOW, display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-start" }}>
          <p role="status" style={{ margin: 0, fontSize: 17, lineHeight: 1.6, color: "#0D1B4A" }}>
            {blocked.text}
          </p>
          {blocked.to && (
            <Link to={blocked.to} style={{ ...primaryBtn, textDecoration: "none" }}>
              {blocked.label}
            </Link>
          )}
        </section>
        {!blocked.to && (
          <ConditionsBar
            defaultOpen
            flow={flow}
            conditions={c}
            setConditions={inp.setConditions}
            margin={margin}
            setMargin={setMarginBack}
            noMargin={noMargin}
            noMarginTo={resultQ({ margin: 0 })}
            candidateIds={flow === "own" ? inp.owned : newIds}
            pack={null}
            spending={spending}
            brandShare={brandShare}
            efficientCeiling={null}
            onApplySpending={(s) => inp.spend.setSpending(s)}
            countArgs={countArgs}
          />
        )}
      </>
    );
  }

  if (!shown) {
    return (
      <section aria-busy="true" style={{ background: "#FFFFFF", border: "1px solid transparent", borderRadius: 24, padding: "32px clamp(18px, 2.6vw, 36px)", display: "flex", flexDirection: "column", gap: 20, boxShadow: SHADOW }}>
        {error ? (
          <div role="alert" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: 15, color: "#0D1B4A" }}>
            <span>계산하지 못했어요. {error.split("\n")[0].slice(0, 120)}</span>
            <button type="button" onClick={() => setRetry((r) => r + 1)} style={outlineBtn}>
              다시 계산
            </button>
          </div>
        ) : (
          <LoadingStatus task={noMargin ? "실적 여유 없이 다시 계산하고 있어요" : flow === "new" ? "새 카드 후보와 가진 카드를 함께 비교하고 있어요" : "카드사 원문 기준으로 조합을 계산하고 있어요"} />
        )}
        <div className="v1-skeleton" style={{ height: 120, borderRadius: 16 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))", gap: 12 }}>
          <div className="v1-skeleton" style={{ height: 96, borderRadius: 16 }} />
          <div className="v1-skeleton" style={{ height: 96, borderRadius: 16 }} />
        </div>
      </section>
    );
  }

  const { pack, bar, newSids } = shown;
  const hero = heroVM({ pack, bar, flow, noMargin, ownedCount: inp.owned.length, newSids, ownedOnly: shown.ownedOnly, keptOwned: shown.keptOwned, pinned });
  const cards = [...pack.cards].sort((a, b) => Number(newSids.includes(b.sid)) - Number(newSids.includes(a.sid)));
  const roles = cards.map((card) => roleCard(card, ctx));
  const rows = guideRows(pack, ctx.spending, brandShare);
  const todos = todoList(pack, newSids);
  const perf = perfVM(pack);
  const barV = barVM(bar, pack);
  const used = usedValuesVM(pack, ctx);
  const nm = noMargin && shown.base ? noMarginVM(shown.base, pack, margin) : null;
  const proofCard = proof !== null ? pack.cards.find((x) => x.sid === proof) : undefined;
  const scrollToMore = () => document.getElementById("more-h")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <>
      {!busy && refining && (
        <div role="status" style={{ position: "sticky", top: 96, zIndex: 15, alignSelf: "center", display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 999, background: "#FFFFFF", boxShadow: SHADOW, fontSize: 14, color: "#3A4A78" }}>
          <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-[#2457F5] border-t-transparent" />
          2장까지 본 결과예요. 3장 이상 조합을 더 찾고 있어요
        </div>
      )}
      {busy && (
        <div role="status" style={{ position: "sticky", top: 96, zIndex: 15, alignSelf: "center", display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 999, background: "#FFFFFF", boxShadow: SHADOW, fontSize: 14, color: "#3A4A78" }}>
          <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-[#2457F5] border-t-transparent" />
          바뀐 조건으로 다시 계산하고 있어요
        </div>
      )}

      <section aria-labelledby="hero-h" style={{ background: "#FFFFFF", border: "1px solid transparent", borderRadius: 24, padding: "32px clamp(18px, 2.6vw, 36px)", display: "flex", flexDirection: "column", gap: 24, boxShadow: SHADOW, opacity: busy ? 0.6 : 1 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "16px 24px" }}>
          <div style={{ flex: "1 1 460px", minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#2457F5" }}>{hero.eyebrow}</div>
            <HeroAmount id="hero-h" title={hero.title} amount={hero.amount} />
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: "#3A4A78" }}>{hero.lead}</p>
            {hero.notice && <p style={{ margin: 0, padding: "10px 14px", borderRadius: 12, background: "#E8EEFF", fontSize: 14, fontWeight: 600, color: "#1747D6" }}>{hero.notice}</p>}
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 10 }}>
              <button type="button" onClick={() => save(false)} disabled={!view || refining} style={primaryBtn}>
                {saveLabel}
              </button>
              <button type="button" onClick={scrollToMore} style={outlineBtn}>
                계산 자세히 보기
              </button>
            </div>
          </div>
          <HeroCardStack sids={hero.sids} newSids={newSids} />
        </div>
        {hero.tiles && <HeroTiles tiles={hero.tiles} newSids={newSids} />}
      </section>

      {/* 계산 조건: 디자인에 없는 기능이라 '더 자세히' 맨 아래에 있던 것을 히어로 바로 아래로 올림(2026-10-29) */}
      <ConditionsBar
        flow={flow}
        conditions={c}
        setConditions={inp.setConditions}
        margin={margin}
        setMargin={setMarginBack}
        noMargin={noMargin}
        noMarginTo={resultQ({ margin: 0 })}
        candidateIds={flow === "own" ? inp.owned : newIds}
        pack={pack}
        spending={ctx.spending}
        brandShare={brandShare}
        efficientCeiling={shown.rec.efficientCeiling ?? null}
        onApplySpending={(s) => inp.spend.setSpending(s)}
        countArgs={countArgs}
      />

      {nm && (
        <section aria-labelledby="nm-cmp" style={{ display: "flex", flexWrap: "wrap", alignItems: "stretch", gap: "16px 24px", padding: 24, borderRadius: 20, background: "#FFF6EE", border: "1px solid #F3D6BF" }}>
          <div style={{ flex: "1 1 340px", minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span aria-hidden="true" style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 12, background: "#FFFFFF", color: "#A3420B", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3 2 20h20z" />
                  <path d="M12 10v4" />
                  <path d="M12 17h.01" />
                </svg>
              </span>
              <h2 id="nm-cmp" style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
                {nm.title}
              </h2>
            </div>
            {nm.lines[0] && <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: "#0D1B4A" }}>{nm.lines[0]}</p>}
            {nm.lines[1] && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "#3A4A78" }}>{nm.lines[1]}</p>}
            <div style={{ marginTop: "auto", display: "flex", flexWrap: "wrap", gap: 10 }}>
              <Link
                to={resultQ({})}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 46, padding: "0 20px", boxSizing: "border-box", borderRadius: 23, background: "#FFFFFF", color: "#0D1B4A", border: "1px solid #D3DDF2", fontSize: 15, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19 12H5" />
                  <path d="m11 18-6-6 6-6" />
                </svg>
                {nm.backLabel}
              </Link>
              <button
                type="button"
                onClick={() => chatStore.ask("실적 여유 없이 계산한 이 결과와 기본 추천의 차이를 설명해 줘")}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 46, padding: "0 18px", boxSizing: "border-box", borderRadius: 23, border: "1px solid #D3DDF2", background: "#FFFFFF", fontFamily: "inherit", fontSize: 15, fontWeight: 700, color: "#0D1B4A", cursor: "pointer", whiteSpace: "nowrap" }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#2457F5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
                </svg>
                이 결과 물어보기
              </button>
            </div>
          </div>
          <div style={{ flex: "1 1 500px", minWidth: 0, display: "flex", flexWrap: "wrap", gap: 12 }}>
            {[
              { t: nm.base, pick: false },
              { t: nm.pick, pick: true },
            ].map(({ t, pick }) => (
              <div key={t.label} style={{ flex: "1 1 240px", minWidth: 0, padding: 18, borderRadius: 16, background: "#FFFFFF", border: pick ? "2px solid #2457F5" : "1px solid #E3EAF8", display: "flex", flexDirection: "column", gap: 10, boxSizing: "content-box" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span aria-hidden="true" style={{ display: "flex", flexShrink: 0 }}>
                    {t.sids.slice(0, 3).map((sid, i) => (
                      <CardImage key={sid} sid={sid} width={52} style={i ? { marginLeft: -26, marginTop: 8 } : undefined} />
                    ))}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: pick ? "#1747D6" : "#5E6D96" }}>{t.label}</div>
                    <div style={{ marginTop: 2, fontSize: 17, fontWeight: 700 }}>{t.names}</div>
                  </div>
                </div>
                <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 14px", fontSize: 14 }}>
                  {t.rows.map(([k, v], i) => (
                    <div key={k} style={{ display: "contents" }}>
                      <dt style={{ color: "#5E6D96" }}>{k}</dt>
                      <dd style={{ margin: 0, textAlign: "right", fontWeight: 700, ...(i === 1 ? { color: pick ? "#A3420B" : "#0D1B4A" } : {}), ...NUM }}>{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="cards-h" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 id="cards-h" style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em" }}>
          카드 {pack.cards.length}장이 맡는 일
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))", gap: 16 }}>
          {roles.map((vm) => (
            <RoleCardArticle key={vm.sid} vm={vm} onIssueInfo={vm.isNew ? () => setIssueSid(vm.sid) : undefined} />
          ))}
        </div>
      </section>

      <section aria-labelledby="guide-h" style={{ background: "#FFFFFF", border: "1px solid transparent", borderRadius: 20, padding: "24px clamp(18px, 2.4vw, 28px)", boxShadow: SHADOW }}>
        <h2 id="guide-h" style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em" }}>
          이렇게 쓰세요
        </h2>
        <p style={{ margin: "6px 0 8px", fontSize: 14, color: "#5E6D96" }}>계산대에서 이 카드로 결제하면 돼요</p>
        <GuideRows rows={rows} newSids={newSids} />
        {todos.length > 0 && (
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "14px 18px", borderRadius: 14, background: "#F3F7FF" }}>
            <span style={{ fontSize: 15, color: "#3A4A78" }}>
              <strong style={{ color: "#0D1B4A" }}>할 일 {todos.length}가지</strong> · {todos.map((t) => t.text).join(", ")}
            </span>
            <button
              type="button"
              onClick={() => save(true)}
              disabled={!view || refining}
              style={{ height: 44, padding: "0 16px", borderRadius: 22, border: "1px solid #D3DDF2", background: "#FFFFFF", fontFamily: "inherit", fontSize: 14, fontWeight: 700, color: "#0D1B4A", cursor: "pointer" }}
            >
              할 일 저장
            </button>
          </div>
        )}
      </section>

      <section aria-labelledby="more-h" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 id="more-h" style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#3A4A78", scrollMarginTop: 110 }}>
          더 자세히 보고 싶다면
        </h2>
        <DetailsItem title="전월실적 충족 확인" sub={perf.summary}>
          {perf.lines.map((l, i) => (
            <span key={i}>
              {i > 0 && <br />}
              {l}
            </span>
          ))}
        </DetailsItem>
        <DetailsItem title="카드를 몇 장 쓸까요?" sub={barV.summary}>
          {barV.parts.map((p, i) => (
            <span key={p.k}>
              {i > 0 && " · "}
              {p.strong ? <strong>{p.text}</strong> : p.text}
            </span>
          ))}
          .{barV.note && (
            <>
              <br />
              {barV.note}
            </>
          )}
        </DetailsItem>
        <DetailsItem title="계산에 쓴 값" sub="내가 넣은 값과 가정한 값">
          {used.user}
          <br />
          {used.assumed}
        </DetailsItem>
        <DetailsItem title="카드별 계산 근거" sub="혜택을 어떤 금액과 한도로 계산했는지">
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 2 }}>
            {pack.cards.map((card) => (
              <button
                key={card.sid}
                type="button"
                onClick={() => setProof(card.sid)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 14, border: "none", background: "#F3F7FF", fontFamily: "inherit", textAlign: "left", cursor: "pointer", color: "#0D1B4A" }}
              >
                <CardImage sid={card.sid} width={56} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700 }}>{shortOf(card)}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#2457F5" }}>계산 근거 보기 →</span>
              </button>
            ))}
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 4 }}>
              <span>결과 숫자가 카드사 안내와 다르면 알려 주세요. 그 카드의 혜택 표부터 다시 확인해요.</span>
              <button
                type="button"
                onClick={() => {
                  pack.cards.forEach((card) => reportNumbers(card));
                  showToast("검수 목록에 올렸어요. 이 조합의 혜택 표를 먼저 다시 확인할게요.", "success");
                }}
                style={{ height: 40, padding: "0 16px", borderRadius: 20, border: "1px solid #D3DDF2", background: "#FFFFFF", fontFamily: "inherit", fontSize: 14, fontWeight: 600, color: "#0D1B4A", cursor: "pointer" }}
              >
                숫자가 이상해요
              </button>
            </div>
          </div>
        </DetailsItem>
      </section>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 8 }}>
        <Link to={backTo} style={{ display: "flex", alignItems: "center", height: 44, fontSize: 15, fontWeight: 500, color: "#3A4A78", textDecoration: "none" }}>
          {backLabel}
        </Link>
        <button type="button" onClick={() => save(false)} disabled={!view || refining} style={{ ...primaryBtn, height: 52, padding: "0 28px", borderRadius: 26, fontSize: 16 }}>
          {saveLabel}
        </button>
      </div>

      {proofCard && <ProofPanel card={proofCard} onClose={() => setProof(null)} />}
      {issueSid !== null && <CardDetailModal entry={catalogBySourceId.get(issueSid) ?? null} onClose={() => setIssueSid(null)} />}
    </>
  );
}

