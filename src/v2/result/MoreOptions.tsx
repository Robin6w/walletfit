import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { CardKind, MonthlySpend } from "@/domain/types/card";
import type { BrandShare, EnginePack } from "@/domain/types/engine";
import { catalogBySourceId, isUnread } from "@/v1/catalog";
import { approxWon, korWon } from "@/v1/format";
import { useEngine } from "@/v2/app/engine";
import { navigate } from "@/v2/app/router";
import type { Conditions } from "@/v2/make/flow";
import { conditionsSummary } from "@/v2/model/conditionsView";
import { shortOf } from "@/v2/model/resultView";
import { cardShort, josa } from "@/v2/model/text";
import { IncomeFill } from "@/v2/result/IncomeFill";
import { SHADOW } from "@/v2/result/parts";
import { CardImage } from "@/v2/ui/CardImage";

/*
 * 결과 화면 '계산 조건'(2026-10-29). 디자인에 없는 기능이라 디자인의 전체 카드 화면 필터와 같은 모양
 * (칩 40px·반지름 20·고르면 파란 채움, 세그먼트 바탕 #F3F7FF, 셀렉트 44px)으로 그린다.
 * 예전에는 '더 자세히 보고 싶다면' 맨 아래에 있었는데, 히어로 바로 아래로 올려 지금 조건을 한 줄로 보여 주고 그 자리에서 펼친다.
 */

const fieldLabel: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "#0D1B4A",
};
const hint: CSSProperties = {
  margin: "8px 0 0",
  fontSize: 13,
  lineHeight: 1.6,
  color: "#5E6D96",
};
const chip = (on: boolean): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 40,
  padding: "0 14px",
  boxSizing: "border-box",
  borderRadius: 20,
  border: on ? "1px solid #2457F5" : "1px solid #D3DDF2",
  background: on ? "#2457F5" : "#FFFFFF",
  color: on ? "#FFFFFF" : "#3A4A78",
  fontWeight: on ? 700 : 400,
  fontFamily: "inherit",
  fontSize: 14,
  cursor: "pointer",
  whiteSpace: "nowrap",
});
const segBtn = (on: boolean): CSSProperties => ({
  height: 40,
  padding: "0 16px",
  borderRadius: 9,
  border: "none",
  background: on ? "#FFFFFF" : "transparent",
  boxShadow: on ? "0 1px 3px rgba(13, 40, 120, 0.12)" : undefined,
  fontFamily: "inherit",
  fontSize: 14,
  fontWeight: on ? 700 : 400,
  color: on ? "#0D1B4A" : "#3A4A78",
  cursor: "pointer",
  whiteSpace: "nowrap",
});
const roundBtn: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 20,
  border: "1px solid #D3DDF2",
  background: "#FFFFFF",
  fontFamily: "inherit",
  fontSize: 18,
  color: "#3A4A78",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const selectStyle: CSSProperties = {
  height: 44,
  padding: "0 12px",
  border: "1px solid #D3DDF2",
  borderRadius: 12,
  background: "#FFFFFF",
  fontFamily: "inherit",
  fontSize: 14,
  color: "#0D1B4A",
  maxWidth: "100%",
};
const toolBox: CSSProperties = {
  flex: "1 1 360px",
  minWidth: 0,
  padding: 18,
  borderRadius: 16,
  background: "#F3F7FF",
};

function Field({ title, children, note }: { title: string; children: ReactNode; note?: ReactNode }) {
  return (
    <div role="group" aria-label={title} style={{ minWidth: 0 }}>
      <div style={fieldLabel}>{title}</div>
      <div style={{ marginTop: 10 }}>{children}</div>
      {note && <p style={hint}>{note}</p>}
    </div>
  );
}

const FEE_CAPS: { label: string; value: number | null }[] = [
  { label: "제한 없음", value: null },
  { label: "연 3만원", value: 30000 },
  { label: "연 5만원", value: 50000 },
  { label: "연 10만원", value: 100000 },
];

export interface ConditionsBarProps {
  flow: "own" | "new";
  conditions: Conditions;
  setConditions: (p: Partial<Conditions>) => void;
  margin: number;
  /** 여유 없이 계산 화면이면 여유를 고를 때 기본 결과로 돌아간다(StepResult에서 처리) */
  setMargin: (m: number) => void;
  noMargin: boolean;
  /** 실적 여유 없이 다시 계산하는 주소(보유한 카드로 흐름만) */
  noMarginTo: string;
  /** 카드사 목록·카드 바꿔보기·소득으로 카드 수 계산 후보 */
  candidateIds: number[];
  pack: EnginePack | null;
  spending: Record<string, number>;
  brandShare: BrandShare;
  efficientCeiling: number | null;
  onApplySpending: (s: MonthlySpend) => void;
  /** 소득으로 채운 지출로 카드 수를 계산할 때 쓰는 추천 인자(결과 화면과 같은 조건) */
  countArgs: ((spending: Record<string, number>) => { ids: number[] } & Record<string, unknown>) | null;
  /** 처음부터 펼쳐 둔다(조건 때문에 결과가 없을 때) */
  defaultOpen?: boolean;
}

export function ConditionsBar(p: ConditionsBarProps) {
  const c = p.conditions;
  const [open, setOpen] = useState(!!p.defaultOpen);
  const issuers = useMemo(() => Array.from(new Set(p.candidateIds.map((s) => catalogBySourceId.get(s)?.issuer ?? "").filter(Boolean))).sort((a, b) => a.localeCompare(b, "ko")), [p.candidateIds]);
  const excludedHere = c.excludedIssuers.filter((i) => issuers.includes(i));
  const summary = conditionsSummary({
    mode: c.mode,
    maxCards: c.maxCards,
    kinds: c.kinds,
    margin: p.margin,
    noMargin: p.noMargin,
    feeCap: c.feeCap,
    excludedIssuers: excludedHere.length,
    pinned: p.flow === "new" ? c.pinned.length : 0,
  });
  const toggleKind = (k: CardKind) =>
    p.setConditions({
      kinds: c.kinds.includes(k) ? c.kinds.filter((x) => x !== k) : [...c.kinds, k],
    });
  const toggleIssuer = (i: string) =>
    p.setConditions({
      excludedIssuers: c.excludedIssuers.includes(i) ? c.excludedIssuers.filter((x) => x !== i) : [...c.excludedIssuers, i],
    });

  return (
    <section
      aria-labelledby="cond-h"
      style={{
        background: "#FFFFFF",
        border: "1px solid transparent",
        borderRadius: 20,
        padding: "18px clamp(18px, 2.4vw, 28px)",
        boxShadow: SHADOW,
        scrollMarginTop: 110,
      }}
      id="conditions"
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "12px 16px",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            flexShrink: 0,
            width: 40,
            height: 40,
            borderRadius: 12,
            background: "#E8EEFF",
            color: "#2457F5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
            <circle cx="16" cy="6" r="2" />
            <circle cx="10" cy="12" r="2" />
            <circle cx="18" cy="18" r="2" />
          </svg>
        </span>
        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          <h2
            id="cond-h"
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              color: "#0D1B4A",
            }}
          >
            계산 조건
          </h2>
          <p
            style={{
              margin: "3px 0 0",
              fontSize: 14,
              lineHeight: 1.5,
              color: "#3A4A78",
            }}
          >
            {summary.join(" · ")}
          </p>
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="cond-body"
          onClick={() => setOpen((v) => !v)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: 44,
            padding: "0 18px",
            boxSizing: "border-box",
            borderRadius: 22,
            border: open ? "1px solid #2457F5" : "1px solid #D3DDF2",
            background: open ? "#E8EEFF" : "#FFFFFF",
            fontFamily: "inherit",
            fontSize: 15,
            fontWeight: 700,
            color: open ? "#1747D6" : "#0D1B4A",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          조건 바꾸기
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{
              transform: open ? "rotate(180deg)" : undefined,
              transition: "transform 150ms",
            }}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

      {open && (
        <div
          id="cond-body"
          style={{
            marginTop: 18,
            paddingTop: 20,
            borderTop: "1px solid #EDF2FC",
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(250px, 100%), 1fr))",
              gap: "22px 28px",
            }}
          >
            <Field
              title="계산 방식"
              note={
                c.mode === "maxBenefit"
                  ? "최대 카드 수 안에서 순혜택이 가장 큰 조합을 골라요."
                  : `1등 카드 순혜택의 30%도 못 버는 카드는 빼요.${p.efficientCeiling ? ` 이 지출에서는 ${p.efficientCeiling}장까지가 이득이에요.` : ""}`
              }
            >
              <div
                style={{
                  display: "inline-flex",
                  padding: 3,
                  borderRadius: 12,
                  background: "#F3F7FF",
                }}
              >
                <button type="button" aria-pressed={c.mode === "maxBenefit"} onClick={() => p.setConditions({ mode: "maxBenefit" })} style={segBtn(c.mode === "maxBenefit")}>
                  혜택 최대화
                </button>
                <button type="button" aria-pressed={c.mode === "efficient"} onClick={() => p.setConditions({ mode: "efficient" })} style={segBtn(c.mode === "efficient")}>
                  효율적
                </button>
              </div>
            </Field>
            <Field title="최대 카드 수">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  aria-label="최대 카드 수 줄이기"
                  disabled={c.maxCards <= 1}
                  onClick={() => p.setConditions({ maxCards: Math.max(1, c.maxCards - 1) })}
                  style={{ ...roundBtn, opacity: c.maxCards <= 1 ? 0.4 : 1 }}
                >
                  −
                </button>
                <span
                  aria-live="polite"
                  style={{
                    minWidth: 28,
                    textAlign: "center",
                    fontFamily: "Outfit, sans-serif",
                    fontSize: 22,
                    fontWeight: 700,
                    color: "#0D1B4A",
                  }}
                >
                  {c.maxCards}
                </span>
                <button
                  type="button"
                  aria-label="최대 카드 수 늘리기"
                  disabled={c.maxCards >= 8}
                  onClick={() => p.setConditions({ maxCards: Math.min(8, c.maxCards + 1) })}
                  style={{ ...roundBtn, opacity: c.maxCards >= 8 ? 0.4 : 1 }}
                >
                  +
                </button>
                <span style={{ fontSize: 14, color: "#5E6D96" }}>장까지</span>
              </div>
            </Field>
            <Field title="카드 종류">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(["credit", "check"] as CardKind[]).map((k) => (
                  <button key={k} type="button" aria-pressed={c.kinds.includes(k)} onClick={() => toggleKind(k)} style={chip(c.kinds.includes(k))}>
                    {k === "credit" ? "신용카드" : "체크카드"}
                  </button>
                ))}
              </div>
            </Field>
            <Field title="실적 여유" note="카드마다 실적 기준보다 이만큼 더 쓰도록 맞춰요. 지출이 조금 줄어도 다음 달 혜택이 이어지게 하려는 값이에요.">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {[20000, 50000].map((m) => (
                  <button key={m} type="button" aria-pressed={!p.noMargin && p.margin === m} onClick={() => p.setMargin(m)} style={chip(!p.noMargin && p.margin === m)}>
                    {korWon(m)}
                  </button>
                ))}
                {p.flow === "own" && (
                  <button type="button" aria-pressed={p.noMargin} onClick={() => !p.noMargin && navigate(p.noMarginTo)} style={chip(p.noMargin)}>
                    여유 없음
                  </button>
                )}
              </div>
            </Field>
          </div>

          {/* 2행: 연회비 상한과 카드사를 반씩 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(420px, 100%), 1fr))",
              gap: "22px 28px",
            }}
          >
            <Field title="연회비 상한" note="조합에 넣는 카드들의 연회비를 더한 금액이에요.">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {FEE_CAPS.map((f) => (
                  <button key={f.label} type="button" aria-pressed={c.feeCap === f.value} onClick={() => p.setConditions({ feeCap: f.value })} style={chip(c.feeCap === f.value)}>
                    {f.label}
                  </button>
                ))}
              </div>
            </Field>

            {issuers.length > 0 && (
              <Field
                title={excludedHere.length ? `카드사 · ${issuers.length}곳 중 ${issuers.length - excludedHere.length}곳 계산` : `카드사 · ${issuers.length}곳 모두 계산`}
                note="누르면 그 카드사의 카드를 계산에서 빼요. 다시 누르면 넣어요."
              >
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {issuers.map((i) => {
                    const out = c.excludedIssuers.includes(i);
                    return (
                      <button
                        key={i}
                        type="button"
                        aria-pressed={!out}
                        aria-label={`${i} ${out ? "다시 넣기" : "빼기"}`}
                        onClick={() => toggleIssuer(i)}
                        style={
                          out
                            ? {
                                ...chip(false),
                                background: "#F3F6FD",
                                borderStyle: "dashed",
                                color: "#8A98BD",
                                textDecoration: "line-through",
                              }
                            : chip(false)
                        }
                      >
                        {i.replace(/카드$/, "")}
                      </button>
                    );
                  })}
                  {excludedHere.length > 0 && (
                    <button
                      type="button"
                      onClick={() => p.setConditions({ excludedIssuers: [] })}
                      style={{
                        ...chip(false),
                        color: "#2457F5",
                        fontWeight: 700,
                      }}
                    >
                      모두 넣기
                    </button>
                  )}
                </div>
              </Field>
            )}
          </div>

          {p.flow === "new" && c.pinned.length > 0 && (
            <Field title="꼭 넣을 카드" note="카드 비교에서 고른 카드예요. 빼면 새 카드를 처음부터 다시 골라요.">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {c.pinned.map((sid) => {
                  const nm = cardShort(catalogBySourceId.get(sid)?.name ?? String(sid));
                  return (
                    <button
                      key={sid}
                      type="button"
                      aria-label={`${nm} 빼고 다시 계산`}
                      onClick={() =>
                        p.setConditions({
                          pinned: c.pinned.filter((x) => x !== sid),
                        })
                      }
                      style={{ ...chip(true), paddingLeft: 6 }}
                    >
                      <CardImage sid={sid} width={40} shadow={false} />
                      {nm}
                      <span aria-hidden="true" style={{ fontWeight: 400 }}>
                        ×
                      </span>
                    </button>
                  );
                })}
              </div>
            </Field>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            <div style={toolBox}>
              <IncomeFill countArgs={p.countArgs} maxCards={c.maxCards} onApplySpending={p.onApplySpending} onApplyMaxCards={(n) => p.setConditions({ maxCards: n })} />
            </div>
            {p.pack && p.pack.cards.length > 0 && (
              <div style={toolBox}>
                <SwapCard pack={p.pack} candidates={p.candidateIds} spending={p.spending} brandShare={p.brandShare} margin={p.noMargin ? 0 : p.margin} />
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/** 카드 바꿔보기: 조합의 카드 한 장을 다른 카드로 바꾸면 순혜택이 어떻게 되는지 */
function SwapCard({ pack, candidates, spending, brandShare, margin }: { pack: EnginePack; candidates: number[]; spending: Record<string, number>; brandShare: BrandShare; margin: number }) {
  const [outPick, setOut] = useState<number>(pack.cards[0].sid);
  const [inPick, setIn] = useState<number | null>(null);
  const out = pack.sids.includes(outPick) ? outPick : pack.cards[0].sid;
  const inId = inPick !== null && !pack.sids.includes(inPick) ? inPick : null;
  const options = useMemo(() => candidates.filter((s) => !pack.sids.includes(s) && catalogBySourceId.has(s)).slice(0, 200), [candidates, pack.sids]);
  const ids = inId ? pack.sids.map((s) => (s === out ? inId : s)) : null;
  const res = useEngine<{ ok: boolean; error?: string; result: EnginePack }>("explain", ids ? { ids, spending, margin, brandShare } : null);
  const after = res.data?.result;
  const idle = after?.cards.filter((c) => (c.pay ?? 0) <= 0 && !isUnread(c.sid)) ?? [];
  const unread = after?.cards.filter((c) => isUnread(c.sid)) ?? [];
  const inName = inId ? (catalogBySourceId.get(inId)?.name ?? "") : "";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#0D1B4A" }}>카드 바꿔보기</div>
      <p style={{ ...hint, margin: 0 }}>조합의 카드 한 장을 다른 카드로 바꾸면 순혜택이 어떻게 달라지는지 계산해요.</p>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          fontSize: 14,
          color: "#3A4A78",
        }}
      >
        <select aria-label="뺄 카드" value={out} onChange={(e) => setOut(Number(e.target.value))} style={selectStyle}>
          {pack.cards.map((c) => (
            <option key={c.sid} value={c.sid}>
              {shortOf(c)}
            </option>
          ))}
        </select>
        대신
        <select aria-label="넣을 카드" value={inId ?? ""} onChange={(e) => setIn(e.target.value ? Number(e.target.value) : null)} style={{ ...selectStyle, flex: "1 1 180px" }}>
          <option value="">카드 고르기</option>
          {options.map((s) => (
            <option key={s} value={s}>
              {catalogBySourceId.get(s)?.name}
            </option>
          ))}
        </select>
        {inId && `${josa(inName, "을/를").slice(inName.length)} 넣으면`}
      </div>
      {!options.length && <p style={{ ...hint, margin: 0 }}>바꿔 넣을 다른 카드가 없어요. 카드 선택에서 카드를 더 담으면 비교할 수 있어요.</p>}
      {inId && (
        <div aria-hidden="true" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <CardImage sid={out} width={72} style={{ opacity: 0.55 }} />
          <span style={{ fontSize: 18, color: "#5E6D96" }}>→</span>
          <CardImage sid={inId} width={72} />
        </div>
      )}
      {res.isComputing && (
        <p role="status" style={{ ...hint, margin: 0 }}>
          계산하고 있어요
        </p>
      )}
      {after && !res.isComputing && (
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "#3A4A78" }}>
          순혜택 {approxWon(pack.net)} → <strong style={{ color: "#0D1B4A" }}>{approxWon(after.net)}</strong>{" "}
          <span
            style={{
              fontWeight: 700,
              color: after.net >= pack.net ? "#0F6B3D" : "#A3420B",
            }}
          >
            ({after.net >= pack.net ? "+" : "−"}
            {korWon(Math.abs(after.net - pack.net))})
          </span>
          . 배분은 바꾼 카드에 맞춰 다시 골랐어요.
          {idle.length > 0 && <span style={{ display: "block", marginTop: 4, color: "#A3420B" }}>{idle.map((c) => cardShort(c.name)).join(", ")}에 맡길 지출이 없어서 연회비만 나가요.</span>}
          {unread.length > 0 && (
            <span style={{ display: "block", marginTop: 4, color: "#A3420B" }}>{unread.map((c) => cardShort(c.name)).join(", ")}의 혜택 정보를 아직 못 읽어서 0원으로 계산했어요.</span>
          )}
        </p>
      )}
    </div>
  );
}
