import type { CSSProperties } from "react";
import type { CardKind } from "@/domain/types/card";
import { paths } from "@/v2/app/paths";
import { Link } from "@/v2/app/router";

/* 디자인 원본 F-D-NewType(B1) 값을 그대로 옮김 */

const SHADOW = "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)";

const TYPES: { kind: CardKind; title: string; desc: string; points: string[]; color: string }[] = [
  { kind: "credit", title: "신용카드", desc: "실적을 채우면 할인·적립 폭이 커요", points: ["카드사별 혜택 한도와 할인율이 높은 편", "연회비와 전월 실적 조건을 함께 따져요"], color: "#2457F5" },
  { kind: "check", title: "체크카드", desc: "통장 잔액 안에서만 쓰여 지출 관리가 쉬워요", points: ["연회비가 없거나 낮아요", "소득공제율이 신용카드보다 높아요"], color: "#3E8BFF" },
];

function Check({ size = 14, color = "#FFFFFF", width = 3, style }: { size?: number; color?: string; width?: number; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>
      <path d="m5 12 5 5 9-10" />
    </svg>
  );
}

/** 디자인의 작은 색 카드(신용카드·체크카드). 특정 카드가 아니라서 실물 사진 대신 디자인 그림 */
function MiniFace({ label, color }: { label: string; color: string }) {
  return (
    <div
      aria-hidden="true"
      style={{ position: "relative", width: 96, height: 60, boxSizing: "border-box", flexShrink: 0, overflow: "hidden", borderRadius: 7, background: color, padding: 7, display: "flex", flexDirection: "column", justifyContent: "space-between", color: "#FFFFFF", boxShadow: "0 2px 4px rgba(13, 40, 120, 0.12), 0 14px 30px -8px rgba(13, 40, 120, 0.38)" }}
    >
      <span style={{ position: "absolute", width: 86, height: 86, borderRadius: "50%", right: -36, top: -40, background: "rgba(255, 255, 255, 0.14)" }} />
      <span style={{ position: "absolute", width: 53, height: 53, borderRadius: "50%", right: 12, bottom: -35, background: "rgba(255, 255, 255, 0.09)" }} />
      <span style={{ position: "relative", zIndex: 1, width: 14, height: 11, borderRadius: 2, background: "linear-gradient(135deg, #F2F6FF, #B7C8EC)" }} />
      <span style={{ position: "relative", zIndex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 10, fontWeight: 700, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
      </span>
    </div>
  );
}

/** B1 새 카드 종류(복수 선택) */
export function StepType({ value, onChange }: { value: CardKind[]; onChange: (v: CardKind[]) => void }) {
  const has = (k: CardKind) => value.includes(k);
  const toggle = (k: CardKind) => onChange(has(k) ? value.filter((x) => x !== k) : [...value, k]);
  const nextLabel = has("credit") && has("check") ? "신용·체크카드 모두로 계속하기" : has("check") ? "체크카드로 계속하기" : "신용카드로 계속하기";
  return (
    <>
      <header style={{ textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", height: 28, padding: "0 12px", borderRadius: 14, background: "#E8EEFF", fontSize: 13, fontWeight: 700, color: "#2457F5" }}>새 카드까지 포함해서 내 지갑 만들기</div>
        <h1 style={{ margin: "16px 0 0", fontSize: "clamp(26px, 2.6vw, 32px)", lineHeight: 1.4, fontWeight: 700, letterSpacing: "-0.02em" }}>어떤 종류의 새 카드를 찾고 계세요?</h1>
        <p style={{ margin: "8px 0 0", fontSize: 15, lineHeight: 1.6, color: "#5E6D96" }}>고른 종류의 카드 중에서 내 소비에 맞는 카드를 함께 비교해 드려요.</p>
        <p style={{ margin: "14px 0 0", display: "inline-flex", alignItems: "center", gap: 6, height: 32, boxSizing: "content-box", padding: "0 14px", borderRadius: 16, background: "#FFFFFF", border: "1px solid transparent", fontSize: 14, fontWeight: 500, color: "#3A4A78", boxShadow: SHADOW }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2457F5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="4" />
            <path d="m8 12 3 3 5-6" />
          </svg>
          <strong style={{ color: "#2457F5", fontWeight: 700 }}>복수 선택 가능</strong> · 둘 다 고르면 신용·체크카드를 함께 비교해요
        </p>
      </header>

      <div role="group" aria-label="새 카드 종류 (복수 선택 가능)" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: 20 }}>
        {TYPES.map((t) => {
          const on = has(t.kind);
          return (
            <button
              key={t.kind}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(t.kind)}
              style={{
                display: "block",
                width: "100%",
                boxSizing: "border-box",
                padding: 28,
                borderRadius: 24,
                background: "#FFFFFF",
                textAlign: "left",
                fontFamily: "inherit",
                color: "#0D1B4A",
                cursor: "pointer",
                border: on ? "2px solid #2457F5" : "2px solid transparent",
                boxShadow: on ? "0 16px 36px -8px rgba(36, 87, 245, 0.35)" : SHADOW,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <MiniFace label={t.title} color={t.color} />
                <span
                  style={{ width: 26, height: 26, boxSizing: "border-box", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", ...(on ? { background: "#2457F5", border: "none" } : { border: "2px solid #C5D4F5" }) }}
                >
                  {on && <Check />}
                </span>
              </span>
              <span style={{ display: "block", marginTop: 22, fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>{t.title}</span>
              <span style={{ display: "block", marginTop: 8, fontSize: 15, lineHeight: 1.6, color: "#5E6D96" }}>{t.desc}</span>
              <ul style={{ margin: "20px 0 0", padding: "18px 0 0", borderTop: "1px solid #E3EAF8", listStyle: "none", display: "flex", flexDirection: "column", gap: 10, fontSize: 14, lineHeight: 1.5, color: "#3A4A78" }}>
                {t.points.map((p) => (
                  <li key={p} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <Check size={16} color="#2457F5" width={2.4} style={{ flexShrink: 0, marginTop: 3 }} />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        {value.length > 0 ? (
          <Link
            to={paths.make("new", "spend")}
            style={{ width: "min(400px, 100%)", height: 56, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 28, background: "#2457F5", color: "#FFFFFF", fontSize: 17, fontWeight: 700, textDecoration: "none", boxShadow: "0 12px 28px rgba(36, 87, 245, 0.22)" }}
          >
            {nextLabel}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" />
              <path d="m13 6 6 6-6 6" />
            </svg>
          </Link>
        ) : (
          <button type="button" disabled style={{ width: "min(400px, 100%)", height: 56, border: "none", borderRadius: 28, background: "#DDE5F5", color: "#5E6D96", fontFamily: "inherit", fontSize: 17, fontWeight: 700 }}>
            카드 종류를 하나 이상 골라 주세요
          </button>
        )}
        <span style={{ fontSize: 13, color: "#5E6D96" }}>다음 단계에서 한 달 지출을 입력해요</span>
      </div>
    </>
  );
}
