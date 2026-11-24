import { useState, type CSSProperties, type ReactNode } from "react";
import type { CardKind } from "@/domain/types/card";
import { catalogBySourceId } from "@/v1/catalog";
import { korWon } from "@/v1/format";
import { navigate } from "@/v2/app/router";
import type { Conditions } from "@/v2/make/flow";
import { cardShort } from "@/v2/model/text";
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
  /** 처음부터 펼쳐 둔다(조건 때문에 결과가 없을 때) */
  defaultOpen?: boolean;
}

/** 실적 여유 선택: 금액 또는 '여유 없음' */
type MarginPick = number | "none";

/** 패널에서 고르고 아직 계산하지 않은 조건(바꾼 칸만) */
interface Draft {
  maxCards?: number;
  kinds?: CardKind[];
  feeCap?: number | null;
  pinned?: number[];
  margin?: MarginPick;
}

const sameList = (a: readonly (string | number)[], b: readonly (string | number)[]) => [...a].sort().join(",") === [...b].sort().join(",");

/**
 * 2026-11-24: 조건 버튼은 고르기만 하고, 아래 '이 조건으로 다시 계산하기'를 눌러야 그 조건으로 다시 계산한다.
 * 예전에는 버튼을 누를 때마다 바로 다시 계산해서, 조건을 여러 개 바꾸는 동안 계산이 계속 다시 돌았다.
 * 카드 바꿔보기와 카드사 골라 빼기는 같은 날 뺐고, 접힌 띠의 조건 요약 줄('최대 2장 · 신용·체크 · …')도 뺐다
 */
export function ConditionsBar(p: ConditionsBarProps) {
  const c = p.conditions;
  const [open, setOpen] = useState(!!p.defaultOpen);
  const [draft, setDraft] = useState<Draft>({});

  // 화면에 보이는 값 = 고른 값(없으면 지금 계산에 쓴 값)
  const curMargin: MarginPick = p.noMargin ? "none" : p.margin;
  const d = {
    maxCards: draft.maxCards ?? c.maxCards,
    kinds: draft.kinds ?? c.kinds,
    feeCap: draft.feeCap !== undefined ? draft.feeCap : c.feeCap,
    pinned: draft.pinned ?? c.pinned,
    margin: draft.margin ?? curMargin,
  };
  const changed = {
    maxCards: d.maxCards !== c.maxCards,
    kinds: !sameList(d.kinds, c.kinds),
    feeCap: d.feeCap !== c.feeCap,
    pinned: !sameList(d.pinned, c.pinned),
    margin: d.margin !== curMargin,
  };
  const dirty = Object.values(changed).some(Boolean);
  const noKind = d.kinds.length === 0;
  const pick = (patch: Draft) => setDraft((x) => ({ ...x, ...patch }));
  const toggleKind = (k: CardKind) => pick({ kinds: d.kinds.includes(k) ? d.kinds.filter((x) => x !== k) : [...d.kinds, k] });

  const apply = () => {
    if (!dirty || noKind) return;
    const patch: Partial<Conditions> = {};
    if (changed.maxCards) patch.maxCards = d.maxCards;
    if (changed.kinds) patch.kinds = d.kinds;
    if (changed.feeCap) patch.feeCap = d.feeCap;
    if (changed.pinned) patch.pinned = d.pinned;
    if (Object.keys(patch).length) p.setConditions(patch);
    if (changed.margin) {
      if (d.margin === "none") navigate(p.noMarginTo);
      else p.setMargin(d.margin);
    }
    setDraft({});
    setOpen(false);
  };

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
            <Field title="최대 카드 수">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  aria-label="최대 카드 수 줄이기"
                  disabled={d.maxCards <= 1}
                  onClick={() => pick({ maxCards: Math.max(1, d.maxCards - 1) })}
                  style={{ ...roundBtn, opacity: d.maxCards <= 1 ? 0.4 : 1 }}
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
                  {d.maxCards}
                </span>
                <button
                  type="button"
                  aria-label="최대 카드 수 늘리기"
                  disabled={d.maxCards >= 8}
                  onClick={() => pick({ maxCards: Math.min(8, d.maxCards + 1) })}
                  style={{ ...roundBtn, opacity: d.maxCards >= 8 ? 0.4 : 1 }}
                >
                  +
                </button>
                <span style={{ fontSize: 14, color: "#5E6D96" }}>장까지</span>
              </div>
            </Field>
            <Field title="카드 종류">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(["credit", "check"] as CardKind[]).map((k) => (
                  <button key={k} type="button" aria-pressed={d.kinds.includes(k)} onClick={() => toggleKind(k)} style={chip(d.kinds.includes(k))}>
                    {k === "credit" ? "신용카드" : "체크카드"}
                  </button>
                ))}
              </div>
            </Field>
            <Field
              title="실적 여유"
              note={
                <>
                  카드마다 실적 기준보다 이만큼 더 쓰도록 맞춰요.
                  <br />
                  지출이 조금 줄어도 다음 달 혜택이 이어지게 하려는 값이에요.
                </>
              }
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {[20000, 50000].map((m) => (
                  <button key={m} type="button" aria-pressed={d.margin === m} onClick={() => pick({ margin: m })} style={chip(d.margin === m)}>
                    {korWon(m)}
                  </button>
                ))}
                {p.flow === "own" && (
                  <button type="button" aria-pressed={d.margin === "none"} onClick={() => pick({ margin: "none" })} style={chip(d.margin === "none")}>
                    여유 없음
                  </button>
                )}
              </div>
            </Field>
          </div>

          {/* 2행: 연회비 상한 */}
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
                  <button key={f.label} type="button" aria-pressed={d.feeCap === f.value} onClick={() => pick({ feeCap: f.value })} style={chip(d.feeCap === f.value)}>
                    {f.label}
                  </button>
                ))}
              </div>
            </Field>

          </div>

          {p.flow === "new" && c.pinned.length > 0 && (
            <Field
              title="꼭 넣을 카드"
              note={
                <>
                  카드 비교에서 고른 카드예요.
                  <br />
                  빼면 새 카드를 처음부터 다시 골라요.
                </>
              }
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {c.pinned.map((sid) => {
                  const nm = cardShort(catalogBySourceId.get(sid)?.name ?? String(sid));
                  const on = d.pinned.includes(sid);
                  return (
                    <button
                      key={sid}
                      type="button"
                      aria-pressed={on}
                      aria-label={`${nm} ${on ? "빼기" : "다시 넣기"}`}
                      onClick={() => pick({ pinned: on ? d.pinned.filter((x) => x !== sid) : [...d.pinned, sid] })}
                      style={on ? { ...chip(true), paddingLeft: 6 } : { ...chip(false), paddingLeft: 6, borderStyle: "dashed", color: "#8A98BD", textDecoration: "line-through" }}
                    >
                      <CardImage sid={sid} width={40} shadow={false} />
                      {nm}
                      <span aria-hidden="true" style={{ fontWeight: 400, textDecoration: "none" }}>
                        {on ? "×" : "+"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Field>
          )}

          {/* 조건을 고른 뒤 이 버튼을 눌러야 다시 계산한다(2026-11-24, 카드 바꿔보기 자리) */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 16px", paddingTop: 20, borderTop: "1px solid #EDF2FC" }}>
            <button
              type="button"
              onClick={apply}
              disabled={!dirty || noKind}
              style={{
                height: 48,
                padding: "0 24px",
                borderRadius: 24,
                border: "none",
                background: dirty && !noKind ? "#2457F5" : "#DDE5F5",
                color: dirty && !noKind ? "#FFFFFF" : "#5E6D96",
                fontFamily: "inherit",
                fontSize: 15,
                fontWeight: 700,
                cursor: dirty && !noKind ? "pointer" : "default",
                whiteSpace: "nowrap",
              }}
            >
              이 조건으로 다시 계산하기
            </button>
            <span role="status" style={{ fontSize: 13, lineHeight: 1.6, color: "#C62828" }}>
              {noKind ? "카드 종류를 하나 이상 골라 주세요." : ""}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
