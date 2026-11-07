import { useState, type CSSProperties } from "react";
import { categories, catLabel, MAIN_CATEGORIES } from "@/v1/catalog";
import { num } from "@/v1/format";
import { paths, type Flow } from "@/v2/app/paths";
import { Link } from "@/v2/app/router";
import { CategoryIcon } from "@/v2/ui/icons";
import { BottomBar } from "@/v2/ui/TopBar";
import { useChrome } from "@/v2/ui/chrome";

/* 디자인 원본 F-D-Spend(A2·B2) 값을 그대로 옮김 */

const EXTRA = categories.map((c) => c.id).filter((id) => !MAIN_CATEGORIES.includes(id));
const SHADOW = "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)";
const plusBtn: CSSProperties = { height: 36, padding: "0 10px", borderRadius: 8, border: "1px solid #E3EAF8", background: "#F3F7FF", fontFamily: "inherit", fontSize: 13, color: "#3A4A78", cursor: "pointer" };

const label = (c: string) => (c === "etc" ? "그 외 가맹점" : catLabel(c));

/** 금액 칸: 디자인의 숫자 입력(오른쪽 정렬, Outfit 16 bold) + '원' */
function AmountInput({ id, value, onChange, name, narrow }: { id: string; value: number; onChange: (v: number) => void; name: string; narrow?: boolean }) {
  return (
    <div className="w-field" style={{ display: "flex", alignItems: "center", gap: 6, padding: narrow ? "0 10px" : "0 12px", height: 44, flexShrink: 0, boxSizing: "content-box", border: "1px solid #D3DDF2", borderRadius: 10, background: "#FFFFFF" }}>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        value={value ? value.toLocaleString("ko-KR") : ""}
        placeholder="0"
        aria-label={`${name} 월 지출(원)`}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^0-9]/g, "");
          onChange(digits ? Math.min(Number(digits), 99_999_999) : 0);
        }}
        style={{ width: narrow ? 76 : 96, boxSizing: "content-box", padding: "1px 2px", border: "none", outline: "none", textAlign: "right", fontSize: 16, fontWeight: 700, color: "#0D1B4A", fontVariantNumeric: "tabular-nums", fontFamily: "Outfit, 'IBM Plex Sans KR', sans-serif", background: "transparent" }}
      />
      <span style={{ fontSize: 14, color: "#5E6D96" }}>원</span>
    </div>
  );
}

/** A2·B2 지출 입력 */
export function StepSpend({
  flow,
  spending,
  onChange,
  onClear,
  total,
  prev,
  next,
}: {
  flow: Flow;
  spending: Record<string, number>;
  onChange: (cat: string, value: number) => void;
  /** 모든 칸을 0원으로(2026-10-31). 넣어 둔 값은 브라우저에 남아 다음에 다시 들어와도 보이므로 */
  onClear: () => void;
  total: number;
  prev: string;
  /** 다음 단계 주소와 이름(자주 가는 곳 또는 추천 결과) */
  next: { to: string; label: string };
}) {
  const { compact } = useChrome();
  const [added, setAdded] = useState<string[]>([]);
  // '모두 지우기'는 한 번 더 확인한다(실수로 누르면 넣은 금액이 모두 사라진다)
  const [confirmClear, setConfirmClear] = useState(false);
  const shown = [...MAIN_CATEGORIES, ...EXTRA.filter((c) => (spending[c] ?? 0) > 0 || added.includes(c))];
  const rest = EXTRA.filter((c) => !shown.includes(c));
  const count = Object.values(spending).filter((v) => v > 0).length;

  return (
    <>
      <header style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.35, fontWeight: 700, letterSpacing: "-0.02em" }}>한 달에 어디에 얼마를 쓰나요?</h1>
          <p style={{ margin: 0, fontSize: 16, color: "#3A4A78" }}>대략적인 금액이면 충분해요. 안 쓰는 항목은 비워 두세요.</p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          {total > 0 &&
            (confirmClear ? (
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: "#3A4A78" }}>
                넣은 금액을 모두 지울까요?
                <button
                  type="button"
                  onClick={() => {
                    onClear();
                    setAdded([]);
                    setConfirmClear(false);
                  }}
                  style={{ padding: "10px 14px", borderRadius: 10, border: "none", background: "#C62828", fontFamily: "inherit", fontSize: 14, fontWeight: 700, color: "#FFFFFF", cursor: "pointer" }}
                >
                  지우기
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #D3DDF2", background: "#FFFFFF", fontFamily: "inherit", fontSize: 14, fontWeight: 700, color: "#3A4A78", cursor: "pointer" }}
                >
                  취소
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #D3DDF2", background: "#FFFFFF", fontFamily: "inherit", fontSize: 14, fontWeight: 700, color: "#3A4A78", cursor: "pointer" }}
              >
                모두 지우기
              </button>
            ))}
          <Link
            to={paths.make(flow, "statement")}
            style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #D3DDF2", background: "#FFFFFF", fontSize: 14, fontWeight: 700, color: "#2457F5", textDecoration: "none" }}
          >
            명세서로 채우기
          </Link>
        </div>
      </header>

      <section
        aria-label="카테고리별 월 지출"
        style={{ background: "#FFFFFF", border: "1px solid transparent", borderRadius: 16, padding: compact ? "4px 14px" : "8px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(420px, 100%), 1fr))", columnGap: 40, boxShadow: SHADOW }}
      >
        {shown.map((c) => {
          const id = `d-${c}`;
          const v = spending[c] ?? 0;
          return (
            // 모바일 사이트: 이름 · +1만 +5만 · 금액을 한 줄에(스크롤 줄이기, 2026-11-07)
            <div key={c} style={{ display: "flex", flexWrap: compact ? "nowrap" : "wrap", alignItems: "center", gap: compact ? 8 : "10px 14px", padding: compact ? "10px 0" : "16px 0", borderBottom: "1px solid #EDF2FC" }}>
              <label htmlFor={id} style={{ flex: compact ? "1 1 auto" : "1 1 110px", minWidth: 0, display: "flex", alignItems: "center", gap: compact ? 8 : 12, fontSize: compact ? 15 : 16, fontWeight: 700, wordBreak: "keep-all" }}>
                <CategoryIcon cat={c} size={compact ? 32 : 40} radius={compact ? 10 : 13} />
                {label(c)}
              </label>
              {!compact && <AmountInput id={id} value={v} onChange={(x) => onChange(c, x)} name={label(c)} />}
              <div style={{ display: "flex", gap: compact ? 4 : 6, flexShrink: 0 }}>
                <button type="button" aria-label={`${label(c)} 1만원 더하기`} onClick={() => onChange(c, v + 10000)} style={plusBtn}>
                  +1만
                </button>
                <button type="button" aria-label={`${label(c)} 5만원 더하기`} onClick={() => onChange(c, v + 50000)} style={plusBtn}>
                  +5만
                </button>
              </div>
              {compact && <AmountInput id={id} value={v} onChange={(x) => onChange(c, x)} name={label(c)} narrow />}
            </div>
          );
        })}
      </section>

      {rest.length > 0 && (
        <section aria-labelledby="more-h" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <h2 id="more-h" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#3A4A78" }}>
            다른 데도 쓰나요? 눌러서 추가
          </h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {rest.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setAdded((a) => [...a, c])}
                style={{ height: 40, padding: "0 14px", borderRadius: 999, border: "1px dashed #B5C3E3", background: "#FFFFFF", fontFamily: "inherit", fontSize: 14, color: "#3A4A78", cursor: "pointer" }}
              >
                + {label(c)}
              </button>
            ))}
          </div>
        </section>
      )}

      <BottomBar padding="16px 20px">
        <Link to={prev} style={{ fontSize: 15, fontWeight: 500, color: "#3A4A78", textDecoration: "none" }}>
          ← 이전
        </Link>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 14, color: "#5E6D96" }}>월 합계 · {count}개 항목</span>
          <span style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums", fontFamily: "Outfit, 'IBM Plex Sans KR', sans-serif" }}>{num(total)}원</span>
        </div>
        {total > 0 ? (
          <Link to={next.to} style={{ padding: "14px 26px", borderRadius: 24, background: "#2457F5", fontSize: 15, fontWeight: 700, color: "#FFFFFF", textDecoration: "none" }}>
            {next.label}
          </Link>
        ) : (
          <span aria-disabled="true" style={{ padding: "14px 26px", borderRadius: 24, background: "#DFE6F5", fontSize: 15, fontWeight: 700, color: "#5E6D96" }}>
            {next.label}
          </span>
        )}
      </BottomBar>
    </>
  );
}
