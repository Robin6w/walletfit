import { useMemo, useState, type CSSProperties } from "react";
import type { MonthlySpend } from "@/domain/types/card";
import type { RecommendResponse } from "@/domain/types/engine";
import {
  ASSUMED_CARD_SPEND_RATIO,
  CARD_SPEND_RATIO_BASIS,
  DISCOVERY_MAX_CARDS_CEILING,
  MAX_CARD_SPEND_RATIO,
  MIN_CARD_SPEND_RATIO,
  estimateSpendingFromIncome,
} from "@/domain/engine/incomeEstimate";
import { categories, catLabel } from "@/v1/catalog";
import { approxWon, korWon } from "@/v1/format";
import { cachedEngineCall } from "@/v2/app/engine";

/**
 * 월 소득으로 지출 채우기(2026-10-29, v1 IncomeCardCountEstimator를 v2 결과 화면 모양으로 다시 그림).
 * 소득 × 카드 지출 비율(기본 40%)을 카테고리 비중으로 나눠 지출 입력에 채우고, 같은 지출로 몇 장이 맞는지 따로 계산한다.
 */
const hint: CSSProperties = { margin: 0, fontSize: 13, lineHeight: 1.6, color: "#5E6D96" };
const textBtn: CSSProperties = { padding: 0, border: "none", background: "transparent", fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: "#2457F5", cursor: "pointer" };
const outlineBtn: CSSProperties = { display: "inline-flex", alignItems: "center", height: 44, padding: "0 18px", boxSizing: "border-box", borderRadius: 22, border: "1px solid #D3DDF2", background: "#FFFFFF", fontFamily: "inherit", fontSize: 14, fontWeight: 700, color: "#0D1B4A", cursor: "pointer", whiteSpace: "nowrap" };
const primaryBtn: CSSProperties = { ...outlineBtn, border: "1px solid #2457F5", background: "#2457F5", color: "#FFFFFF" };

const round1000 = (v: number) => Math.round(v / 1000) * 1000;

export function IncomeFill({
  countArgs,
  maxCards,
  onApplySpending,
  onApplyMaxCards,
}: {
  /** 결과 화면 추천과 같은 인자(카드·실적 여유·계산 방식·연회비 상한·브랜드 비중). 지출만 바꿔 카드 수를 계산한다 */
  countArgs: ((spending: Record<string, number>) => { ids: number[] } & Record<string, unknown>) | null;
  /** 지금 최대 카드 수 */
  maxCards: number;
  onApplySpending: (s: MonthlySpend) => void;
  onApplyMaxCards: (n: number) => void;
}) {
  const [income, setIncome] = useState(0);
  const [ratio, setRatio] = useState(ASSUMED_CARD_SPEND_RATIO);
  const [basis, setBasis] = useState(false);
  const [state, setState] = useState<{ status: "idle" | "loading" | "done" | "error"; count?: number; net?: number }>({ status: "idle" });
  const pct = Math.round(ratio * 100);

  const preview = useMemo(() => {
    if (!income) return null;
    const raw = estimateSpendingFromIncome(income, categories, ratio);
    const spend = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, round1000(v)])) as MonthlySpend;
    const top = Object.entries(spend)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
    return { spend, total: top.reduce((s, [, v]) => s + v, 0), top };
  }, [income, ratio]);

  const nIds = countArgs ? countArgs({}).ids.length : 0;
  const apply = async () => {
    if (!preview || !countArgs || !nIds) return;
    onApplySpending(preview.spend);
    setState({ status: "loading" });
    // 결과 화면과 같은 조건으로, 최대 카드 수만 넉넉히(8장) 열어 이 지출에 맞는 카드 수를 본다
    const args = countArgs(preview.spend);
    const res = await cachedEngineCall<RecommendResponse>("recommend", { ...args, maxCards: Math.max(maxCards, Math.min(DISCOVERY_MAX_CARDS_CEILING, args.ids.length)) });
    if (!res.ok || res.empty) setState({ status: "error" });
    else setState({ status: "done", count: res.result.cards.length, net: res.result.net });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#0D1B4A" }}>월 소득으로 지출 채우기</div>
      <p style={hint}>
        카테고리별로 넣기 번거로우면 월 소득만 넣어도 대략 채워요. 소득의 {pct}%를 카드로 쓴다고 보고 나눠요.{" "}
        <button type="button" aria-expanded={basis} onClick={() => setBasis((v) => !v)} style={textBtn}>
          {pct}%는 어떻게 나왔나요?
        </button>
      </p>
      {basis && (
        <div style={{ padding: "12px 14px", borderRadius: 12, background: "#FFFFFF", border: "1px solid #E3EAF8", display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={hint}>
            소득 중 소비에 쓰는 비중 약 {Math.round(CARD_SPEND_RATIO_BASIS.consumptionPropensity * 100)}% × 소비 중 카드로 내는 비중 약{" "}
            {Math.round(CARD_SPEND_RATIO_BASIS.cardPaymentShare * 100)}%(통계청 가계동향조사 등에서 흔히 보이는 수준)를 곱한 출발값이에요. 저축률과 현금 사용이 사람마다 달라서 직접 바꿀 수 있어요.
          </p>
          <label style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: "#3A4A78" }}>
            카드로 쓰는 비중
            <input
              type="range"
              min={Math.round(MIN_CARD_SPEND_RATIO * 100)}
              max={Math.round(MAX_CARD_SPEND_RATIO * 100)}
              step={5}
              value={pct}
              onChange={(e) => setRatio(Number(e.target.value) / 100)}
              style={{ flex: 1, minWidth: 120, accentColor: "#2457F5" }}
            />
            <strong style={{ width: 40, textAlign: "right", color: "#1747D6" }}>{pct}%</strong>
          </label>
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <div className="w-field" style={{ display: "flex", alignItems: "center", gap: 6, height: 44, padding: "0 12px", boxSizing: "border-box", border: "1px solid #D3DDF2", borderRadius: 12, background: "#FFFFFF" }}>
          <input
            inputMode="numeric"
            autoComplete="off"
            aria-label="월 소득(세전, 원)"
            placeholder="월 소득(세전)"
            className="placeholder:font-normal placeholder:text-[#8A98BD]"
            value={income ? income.toLocaleString("ko-KR") : ""}
            onChange={(e) => {
              const d = e.target.value.replace(/[^0-9]/g, "");
              setIncome(d ? Math.min(Number(d), 999_999_999) : 0);
              setState({ status: "idle" });
            }}
            style={{ width: 140, border: "none", outline: "none", textAlign: "right", fontSize: 16, fontWeight: 700, color: "#0D1B4A", fontFamily: "Outfit, 'IBM Plex Sans KR', sans-serif", fontVariantNumeric: "tabular-nums", background: "transparent" }}
          />
          <span style={{ fontSize: 14, color: "#5E6D96" }}>원</span>
        </div>
        <button type="button" onClick={apply} disabled={!preview || !nIds || state.status === "loading"} style={{ ...primaryBtn, opacity: !preview || state.status === "loading" ? 0.45 : 1, cursor: preview ? "pointer" : "default" }}>
          {state.status === "loading" ? "계산하고 있어요" : "지출 채우고 다시 계산"}
        </button>
      </div>
      {preview && (
        <p style={hint}>
          카드 지출 월 {korWon(preview.total)}으로 보고 {preview.top.slice(0, 3).map(([k, v]) => `${catLabel(k)} ${korWon(v)}`).join(" · ")} 등 {preview.top.length}개 항목에 나눠요.
        </p>
      )}
      {!nIds && <p style={{ ...hint, color: "#A3420B" }}>계산할 카드가 없어요. 카드 선택에서 카드를 담거나 조건에서 뺀 카드 종류·카드사를 다시 넣어 주세요.</p>}
      {state.status === "error" && <p style={{ ...hint, color: "#A3420B" }}>카드 수를 계산하지 못했어요. 지출은 채웠으니 결과는 다시 계산돼요.</p>}
      {state.status === "done" && state.count !== undefined && (
        <div role="status" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 14px", borderRadius: 12, background: "#FFFFFF", border: "1px solid #E3EAF8" }}>
          <span style={{ fontSize: 14, color: "#3A4A78" }}>
            {state.count > 0 ? (
              state.count > maxCards ? (
                <>
                  지출을 채웠어요. 이 지출이면 <strong style={{ color: "#1747D6" }}>{state.count}장</strong> 조합이 가장 유리해요(월 순혜택 {approxWon(state.net ?? 0)}). 지금은 최대 {maxCards}장으로 계산하고 있어요.
                </>
              ) : (
                <>
                  지출을 채우고 다시 계산했어요. 이 지출이면 <strong style={{ color: "#1747D6" }}>{state.count}장</strong> 조합이 가장 유리해요(월 순혜택 {approxWon(state.net ?? 0)}).
                </>
              )
            ) : (
              "지출을 채웠어요. 이 지출로는 연회비를 빼고 남는 혜택이 있는 카드가 없어요."
            )}
          </span>
          {state.count > maxCards && (
            <button type="button" onClick={() => onApplyMaxCards(state.count!)} style={outlineBtn}>
              최대 카드 수를 {state.count}장으로
            </button>
          )}
        </div>
      )}
    </div>
  );
}
