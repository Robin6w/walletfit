import { useState, type CSSProperties } from "react";
import { useBrands } from "@/domain/engine/walletEngine";
import { korWon } from "@/v1/format";
import { Link } from "@/v2/app/router";
import { CategoryIcon } from "@/v2/ui/icons";
import { BRAND_TABS, canonicalBrand, logoOf, pickedCount, type BrandPicks } from "@/v2/model/brands";
import { ChoiceQuestions } from "@/v2/make/ChoiceQuestions";
import { useChrome } from "@/v2/ui/chrome";

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
  /** 가진 카드(그 카드 혜택에 나오는 가게는 카드 1장에만 나와도 후보로 남긴다) */
  ownIds: number[];
  prev: string;
  next: string;
}

/** A3·B3 자주 가는 곳(선택). 고른 곳들이 그 카테고리 지출의 70%를 나눠 쓴다고 본다 */
export function StepBrands({ spending, picks, onPicks, brandIds, ownIds, prev, next }: Props) {
  const tabs = BRAND_TABS.filter((t) => (spending[t.cat] ?? 0) > 0);
  const [cur, setCur] = useState<string>(tabs[0]?.cat ?? "cafe");
  // 모바일 사이트: 브랜드 칸을 한 줄에 3개씩(스크롤 줄이기, 2026-11-07)
  const { compact } = useChrome();
  const [q, setQ] = useState("");
  const tab = tabs.find((t) => t.cat === cur) ?? tabs[0];
  const engine = useBrands(brandIds.length ? brandIds : null, ownIds);

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
  // 신재윤 PC 디자인: 목록 칸에는 정해 둔 브랜드만 두고, 검색해서 더한 곳은 '직접 추가한 곳' 줄에 따로 보인다
  const presetBrands = tab ? tab.brands : [];
  const addedBrands = tab ? curPick.brands.filter((b) => !tab.brands.includes(b)) : [];
  const engineRows = tab ? (engine.data?.categories?.[tab.cat] ?? engine.lastGood?.categories?.[tab.cat] ?? []) : [];
  const normQ = (s: string) => s.toLowerCase().replace(/\s+/g, "");
  const query = normQ(q.trim());
  const engineNames = Array.from(new Set(engineRows.map((r) => canonicalBrand(r.name)))).filter((n) => !presetBrands.includes(n));
  // 검색 결과: 정해 둔 브랜드 + 담은 카드 혜택에 나오는 다른 가게
  const hits = query ? [...presetBrands, ...engineNames].filter((n) => normQ(n).includes(query)) : [];

  const allChips = BRAND_TABS.flatMap((t) => (picks[t.cat]?.brands ?? []).map((b) => ({ cat: t.cat, brand: b })));
  const total = pickedCount(picks);
  const noneOn = !!curPick.none;

  return (
    <>
      <div style={{ flex: "999 1 620px", minWidth: 0, display: "flex", flexDirection: "column", gap: 18 }}>
        <header>
          <span style={{ display: "inline-flex", alignItems: "center", height: 28, padding: "0 12px", borderRadius: 14, background: "#E8EEFF", color: "#2457F5", fontSize: 13, fontWeight: 700 }}>마지막 질문 · 선택</span>
          <h1 style={{ margin: "14px 0 0", fontSize: 32, lineHeight: 1.3, fontWeight: 700, letterSpacing: "-0.03em" }}>평소 자주 가는 곳을 골라 주세요</h1>
          <p style={{ margin: "8px 0 0", fontSize: 16, lineHeight: 1.7, color: "#3A4A78" }}>스타벅스, 쿠팡 등 자주 이용하는 브랜드를 선택해 주세요. 해당 브랜드의 할인 혜택까지 반영해 계산해 드려요.</p>
        </header>

        {tabs.length === 0 || !tab ? (
          <section style={{ background: "#FFFFFF", borderRadius: 24, padding: 24, boxShadow: SHADOW, fontSize: 15, color: "#3A4A78" }}>
            고를 브랜드가 있는 지출({BRAND_TABS.map((t) => t.label.split("·")[0]).join("·")})이 없어요. 바로 추천 조합을 볼 수 있어요.
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
                  <span style={{ display: "block", marginTop: 2, fontSize: 14, color: "#5E6D96" }}>월 평균 {korWon(spending[tab.cat] ?? 0)} 소비 중</span>
                </div>
                <span style={{ fontSize: 14, color: "#5E6D96" }}>
                  <b style={{ fontFamily: "Outfit, sans-serif", color: "#2457F5" }}>{curPick.brands.length}</b>곳 선택
                </span>
              </div>
              {/* 신재윤 PC 디자인: 가게 이름 검색창은 늘 보이고, 검색 결과는 창 아래 목록으로 뜬다 */}
              <div style={{ position: "relative", marginTop: 18 }}>
                <label htmlFor="brand-q" style={{ display: "flex", alignItems: "center", gap: 10, height: 46, padding: "0 8px 0 16px", boxSizing: "border-box", borderRadius: 23, background: "#F3F7FF", border: "1.5px solid transparent" }}>
                  <input
                    id="brand-q"
                    type="text"
                    autoComplete="off"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={`${tab.label}에서 가게 이름으로 찾기`}
                    style={{ flex: 1, minWidth: 0, height: 40, border: "none", outline: "none", background: "transparent", fontFamily: "inherit", fontSize: 15, fontWeight: 500, color: "#0D1B4A" }}
                  />
                  {q && (
                    <button type="button" aria-label="검색어 지우기" onClick={() => setQ("")} style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 15, border: "none", background: "#E1E8F7", color: "#5E6D96", fontFamily: "inherit", fontSize: 16, lineHeight: 1, cursor: "pointer" }}>
                      ×
                    </button>
                  )}
                </label>
                {query && (
                  <div style={{ position: "absolute", left: 0, right: 0, top: 54, zIndex: 5, maxHeight: 300, overflow: "auto", boxSizing: "border-box", padding: 8, borderRadius: 18, background: "#FFFFFF", boxShadow: "0 2px 4px rgba(13, 40, 120, 0.06), 0 18px 40px rgba(13, 40, 120, 0.16)" }}>
                    {hits.length > 0 ? (
                      <>
                        <div style={{ padding: "6px 10px 8px", fontSize: 12, fontWeight: 600, color: "#5E6D96" }}>카드 혜택이 있는 곳 · {hits.length}곳</div>
                        {hits.slice(0, 12).map((n) => {
                          const inList = presetBrands.includes(n);
                          const picked = curPick.brands.includes(n);
                          const logo = logoOf(n);
                          const at = n.toLowerCase().indexOf(q.trim().toLowerCase());
                          const len = q.trim().length;
                          return (
                            <div key={n} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", borderRadius: 12 }}>
                              <span style={{ ...markStyle(false, !!logo), width: 40, height: 40, fontSize: 15 }}>{logo ? <img src={logo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : n.replace(/[^가-힣A-Za-z0-9]/g, "").slice(0, 1)}</span>
                              <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, color: "#0D1B4A" }}>
                                {at >= 0 ? (
                                  <>
                                    {n.slice(0, at)}
                                    <span style={{ color: "#2457F5" }}>{n.slice(at, at + len)}</span>
                                    {n.slice(at + len)}
                                  </>
                                ) : (
                                  n
                                )}
                                <span style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#5E6D96" }}>{inList ? "이미 목록에 있어요" : picked ? "직접 추가했어요" : "카드 할인 대상"}</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => toggle(tab.cat, n)}
                                style={{ flexShrink: 0, height: 36, padding: "0 14px", borderRadius: 18, border: "1px solid #C9D6F5", background: picked ? "#E8EEFF" : "#FFFFFF", color: "#2457F5", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                              >
                                {inList ? (picked ? "선택됨" : "목록에서 선택") : picked ? "추가됨" : "+ 추가"}
                              </button>
                            </div>
                          );
                        })}
                      </>
                    ) : (
                      <div style={{ padding: "16px 10px", fontSize: 14, lineHeight: 1.6, color: "#5E6D96", textAlign: "center" }}>
                        {engine.isComputing ? (
                          "카드 혜택에 나오는 가게를 찾고 있어요"
                        ) : (
                          <>
                            <b style={{ color: "#0D1B4A" }}>'{q.trim()}'</b>은(는) 카드 혜택이 있는 곳 목록에 없어요.
                            <br />
                            혜택이 없는 곳은 일반 할인으로 계산돼요.
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {addedBrands.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 10 }}>
                  <span style={{ marginRight: 2, fontSize: 13, fontWeight: 600, color: "#5E6D96" }}>직접 추가한 곳</span>
                  {addedBrands.map((b) => (
                    <span key={b} style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 30, padding: "0 4px 0 12px", boxSizing: "border-box", borderRadius: 15, background: "#E8EEFF", border: "1px solid #C9D6F5", fontSize: 13, fontWeight: 600, color: "#2457F5" }}>
                      {b}
                      <button type="button" aria-label={`${b} 빼기`} onClick={() => toggle(tab.cat, b)} style={{ width: 22, height: 22, borderRadius: 11, border: "none", background: "transparent", color: "#2457F5", fontFamily: "inherit", fontSize: 15, lineHeight: 1, cursor: "pointer" }}>
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: compact ? "repeat(3, minmax(0, 1fr))" : "repeat(auto-fill, minmax(132px, 1fr))", gap: compact ? 8 : 12 }}>
                {presetBrands.map((b) => {
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
              </div>

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
        <ChoiceQuestions spending={spending} />
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
