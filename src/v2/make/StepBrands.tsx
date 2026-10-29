import { useState, type CSSProperties } from "react";
import { useBrands } from "@/domain/engine/walletEngine";
import { korWon } from "@/v1/format";
import { Link } from "@/v2/app/router";
import { CategoryIcon } from "@/v2/ui/icons";
import { BRAND_TABS, canonicalBrand, logoOf, pickedCount, type BrandPicks } from "@/v2/model/brands";

/* 디자인 원본 F-D-Brands(A3·B3) 값을 그대로 옮김 */

const SHADOW = "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)";

const tabStyle = (on: boolean): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  height: 44,
  padding: "0 16px 0 8px",
  borderRadius: 22,
  border: "none",
  fontFamily: "inherit",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
  ...(on ? { background: "#2457F5", color: "#FFFFFF", boxShadow: "0 8px 20px -8px rgba(36, 87, 245, 0.6)" } : { background: "#FFFFFF", color: "#3A4A78", boxShadow: SHADOW }),
});
const cntStyle = (on: boolean): CSSProperties => ({
  minWidth: 22,
  height: 22,
  boxSizing: "border-box",
  padding: "0 6px",
  borderRadius: 11,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "Outfit, sans-serif",
  fontSize: 12,
  fontWeight: 700,
  color: "#2457F5",
  background: on ? "#FFFFFF" : "#E8EEFF",
});
const tileStyle = (on: boolean): CSSProperties => ({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 10,
  padding: "18px 10px 14px",
  borderRadius: 18,
  fontFamily: "inherit",
  color: "#0D1B4A",
  cursor: "pointer",
  ...(on ? { border: "2px solid #2457F5", background: "#FFFFFF", boxShadow: "0 12px 26px -10px rgba(36, 87, 245, 0.45)" } : { border: "2px solid transparent", background: "#F3F7FF" }),
});
const ckStyle = (on: boolean): CSSProperties => ({
  position: "absolute",
  top: 10,
  right: 10,
  width: 24,
  height: 24,
  boxSizing: "border-box",
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  ...(on ? { background: "#2457F5", border: "2px solid #2457F5" } : { background: "#FFFFFF", border: "2px solid #C5D4F5" }),
});
const markStyle = (on: boolean, logo: boolean): CSSProperties => ({
  width: 52,
  height: 52,
  boxSizing: "border-box",
  overflow: "hidden",
  borderRadius: 26,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 18,
  fontWeight: 700,
  boxShadow: "0 2px 6px rgba(13, 40, 120, 0.08)",
  ...(logo ? { background: "transparent", padding: 0 } : on ? { background: "#2457F5", color: "#FFFFFF" } : { background: "#FFFFFF", color: "#3A4A78" }),
});

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12 5 5 9-10" />
    </svg>
  );
}

interface Props {
  spending: Record<string, number>;
  picks: BrandPicks;
  onPicks: (next: BrandPicks) => void;
  /** 브랜드 찾기 후보를 뽑을 카드(가진 카드 또는 새 카드 후보) */
  brandIds: number[];
  prev: string;
  next: string;
}

/** A3·B3 자주 가는 곳(선택). 고른 곳들이 그 카테고리 지출의 70%를 나눠 쓴다고 본다 */
export function StepBrands({ spending, picks, onPicks, brandIds, prev, next }: Props) {
  const tabs = BRAND_TABS.filter((t) => (spending[t.cat] ?? 0) > 0);
  const [cur, setCur] = useState<string>(tabs[0]?.cat ?? "cafe");
  const [finding, setFinding] = useState(false);
  const [q, setQ] = useState("");
  const tab = tabs.find((t) => t.cat === cur) ?? tabs[0];
  const engine = useBrands(brandIds.length ? brandIds : null);

  const pickOf = (cat: string) => picks[cat] ?? { brands: [] };
  const setPick = (cat: string, brands: string[], none = false) => {
    const nextPicks: BrandPicks = { ...picks };
    if (!brands.length && !none) delete nextPicks[cat];
    else nextPicks[cat] = none ? { brands: [], none: true } : { brands };
    onPicks(nextPicks);
  };
  const toggle = (cat: string, brand: string) => {
    const p = pickOf(cat);
    const on = p.brands.includes(brand);
    setPick(cat, on ? p.brands.filter((b) => b !== brand) : [...p.brands, brand]);
  };

  const curPick = tab ? pickOf(tab.cat) : { brands: [] as string[] };
  const tileBrands = tab ? [...tab.brands, ...curPick.brands.filter((b) => !tab.brands.includes(b))] : [];
  const engineRows = tab ? (engine.data?.categories?.[tab.cat] ?? engine.lastGood?.categories?.[tab.cat] ?? []) : [];
  const query = q.trim().toLowerCase().replace(/\s+/g, "");
  const candidates = Array.from(new Set(engineRows.map((r) => canonicalBrand(r.name))))
    .filter((n) => !tileBrands.includes(n))
    .filter((n) => !query || n.toLowerCase().replace(/\s+/g, "").includes(query));

  const allChips = BRAND_TABS.flatMap((t) => (picks[t.cat]?.brands ?? []).map((b) => ({ cat: t.cat, brand: b })));
  const total = pickedCount(picks);
  const noneOn = !!curPick.none;

  return (
    <>
      <div style={{ flex: "999 1 620px", minWidth: 0, display: "flex", flexDirection: "column", gap: 18 }}>
        <header>
          <span style={{ display: "inline-flex", alignItems: "center", height: 28, padding: "0 12px", borderRadius: 14, background: "#E8EEFF", color: "#2457F5", fontSize: 13, fontWeight: 700 }}>마지막 질문 · 선택</span>
          <h1 style={{ margin: "14px 0 0", fontSize: 32, lineHeight: 1.3, fontWeight: 700, letterSpacing: "-0.03em" }}>평소 자주 가는 곳을 골라 주세요</h1>
          <p style={{ margin: "8px 0 0", fontSize: 16, lineHeight: 1.7, color: "#3A4A78" }}>스타벅스·쿠팡처럼 특정 브랜드에서만 되는 할인이 있어요. 가는 곳만 눌러 주시면 그 할인까지 계산해요.</p>
        </header>

        {tabs.length === 0 || !tab ? (
          <section style={{ background: "#FFFFFF", borderRadius: 24, padding: 24, boxShadow: SHADOW, fontSize: 15, color: "#3A4A78" }}>
            고를 브랜드가 있는 지출(카페·편의점·외식·온라인쇼핑·주유)이 없어요. 바로 추천 조합을 볼 수 있어요.
          </section>
        ) : (
          <>
            <div role="tablist" aria-label="카테고리" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {tabs.map((t) => {
                const on = t.cat === tab.cat;
                const n = pickOf(t.cat).brands.length;
                return (
                  <button
                    key={t.cat}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    aria-controls="brand-panel"
                    onClick={() => {
                      setCur(t.cat);
                      setFinding(false);
                      setQ("");
                    }}
                    style={tabStyle(on)}
                  >
                    <CategoryIcon cat={t.cat} size={30} radius={10} glyph={16} />
                    {t.label}
                    {n > 0 && <span style={cntStyle(on)}>{n}</span>}
                  </button>
                );
              })}
            </div>

            <section id="brand-panel" role="tabpanel" aria-label={tab.label} style={{ background: "#FFFFFF", borderRadius: 24, padding: 24, boxShadow: SHADOW }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px 14px" }}>
                <CategoryIcon cat={tab.cat} size={48} radius={15} glyph={26} />
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>{tab.label}</h2>
                  <span style={{ display: "block", marginTop: 2, fontSize: 14, color: "#5E6D96" }}>지출 입력에서 월 {korWon(spending[tab.cat] ?? 0)}</span>
                </div>
                <span style={{ fontSize: 14, color: "#5E6D96" }}>
                  <b style={{ fontFamily: "Outfit, sans-serif", color: "#2457F5" }}>{curPick.brands.length}</b>곳 선택
                </span>
              </div>
              <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))", gap: 12 }}>
                {tileBrands.map((b) => {
                  const on = curPick.brands.includes(b);
                  const logo = logoOf(b);
                  return (
                    <button key={b} type="button" aria-pressed={on} onClick={() => toggle(tab.cat, b)} style={tileStyle(on)}>
                      <span style={ckStyle(on)}>{on && <CheckIcon />}</span>
                      <span style={markStyle(on, !!logo)}>{logo ? <img src={logo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : b.replace(/[^가-힣A-Za-z0-9]/g, "").slice(0, 1)}</span>
                      <span style={{ fontSize: 15, fontWeight: 600, textAlign: "center", lineHeight: 1.3 }}>{b}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  aria-expanded={finding}
                  aria-controls="brand-finder"
                  onClick={() => setFinding((v) => !v)}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "18px 10px 14px", borderRadius: 18, border: "2px dashed #C5D4F5", background: "transparent", fontFamily: "inherit", color: "#2457F5", cursor: "pointer" }}
                >
                  <span style={{ width: 52, height: 52, borderRadius: 26, background: "#E8EEFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700 }}>+</span>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>다른 곳 찾기</span>
                </button>
              </div>

              {finding && (
                <div id="brand-finder" style={{ marginTop: 14, padding: 14, borderRadius: 14, background: "#F3F7FF", display: "flex", flexDirection: "column", gap: 10 }}>
                  <label htmlFor="brand-q" style={{ fontSize: 14, fontWeight: 700, color: "#3A4A78" }}>
                    {tab.label}에서 자주 가는 곳 찾기
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      id="brand-q"
                      type="search"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="가게 이름"
                      style={{ flex: 1, minWidth: 0, height: 44, boxSizing: "border-box", padding: "0 14px", border: "1px solid #D3DDF2", borderRadius: 12, background: "#FFFFFF", fontFamily: "inherit", fontSize: 15, color: "#0D1B4A" }}
                    />
                    {q.trim() && !tileBrands.includes(q.trim()) && (
                      <button
                        type="button"
                        onClick={() => {
                          toggle(tab.cat, canonicalBrand(q.trim()));
                          setQ("");
                        }}
                        style={{ height: 44, padding: "0 16px", borderRadius: 12, border: "none", background: "#2457F5", color: "#FFFFFF", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                      >
                        '{q.trim()}' 추가
                      </button>
                    )}
                  </div>
                  {candidates.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {candidates.slice(0, 18).map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => toggle(tab.cat, n)}
                          style={{ height: 34, padding: "0 12px", borderRadius: 17, border: "1px solid #D3DDF2", background: "#FFFFFF", fontFamily: "inherit", fontSize: 14, color: "#3A4A78", cursor: "pointer" }}
                        >
                          + {n}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: 13, color: "#5E6D96" }}>{engine.isComputing ? "카드 혜택에 나오는 가게를 찾고 있어요" : "담은 카드의 할인에 나오는 다른 가게가 없어요. 이름을 적어 추가할 수 있어요."}</span>
                  )}
                </div>
              )}

              <button
                type="button"
                aria-pressed={noneOn}
                onClick={() => (noneOn ? setPick(tab.cat, []) : setPick(tab.cat, [], true))}
                style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 14px", borderRadius: 20, border: "none", fontFamily: "inherit", fontSize: 14, cursor: "pointer", ...(noneOn ? { background: "#E8EEFF", color: "#2457F5", fontWeight: 600 } : { background: "transparent", color: "#5E6D96" }) }}
              >
                이 중엔 자주 가는 곳이 없어요
              </button>
            </section>
          </>
        )}
      </div>

      <aside aria-label="고른 곳" style={{ flex: "1 1 300px", minWidth: 0, position: "sticky", top: 100 }}>
        <div style={{ background: "#FFFFFF", borderRadius: 24, padding: 22, boxShadow: SHADOW }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>고른 곳</h2>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 10 }}>
            <span style={{ fontFamily: "Outfit, sans-serif", fontSize: 44, fontWeight: 700, lineHeight: 1, color: "#2457F5" }}>{total}</span>
            <span style={{ fontSize: 18, fontWeight: 700 }}>곳</span>
          </div>
          <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {allChips.map(({ cat, brand }) => (
              <span key={`${cat}-${brand}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 6px 0 12px", borderRadius: 16, background: "#F3F7FF", fontSize: 13, fontWeight: 600, color: "#3A4A78" }}>
                {brand}
                <button
                  type="button"
                  aria-label={`${brand} 빼기`}
                  onClick={() => toggle(cat, brand)}
                  style={{ width: 22, height: 22, borderRadius: 11, border: "none", background: "#FFFFFF", color: "#5E6D96", fontFamily: "inherit", fontSize: 14, lineHeight: 1, cursor: "pointer" }}
                >
                  ×
                </button>
              </span>
            ))}
            {allChips.length === 0 && <span style={{ fontSize: 14, color: "#5E6D96" }}>아직 고른 곳이 없어요</span>}
          </div>
          <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 14, background: "#F3F7FF", fontSize: 13, lineHeight: 1.6, color: "#3A4A78" }}>
            고른 브랜드에 그 카테고리 지출이 쓰였다고 보고 할인을 계산해요. 안 고른 카테고리는 일반 할인만 계산해요.
          </div>
          <Link
            to={next}
            style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 54, borderRadius: 27, background: "#2457F5", color: "#FFFFFF", fontSize: 16, fontWeight: 700, textDecoration: "none", boxShadow: "0 12px 26px -10px rgba(36, 87, 245, 0.6)" }}
          >
            추천 조합 보기 →
          </Link>
          <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between" }}>
            <Link to={prev} style={{ display: "flex", alignItems: "center", height: 44, padding: "0 6px", fontSize: 14, color: "#5E6D96", textDecoration: "none" }}>
              ← 이전
            </Link>
            <Link to={next} style={{ display: "flex", alignItems: "center", height: 44, padding: "0 6px", fontSize: 14, color: "#5E6D96", textDecoration: "none" }}>
              건너뛰기
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
