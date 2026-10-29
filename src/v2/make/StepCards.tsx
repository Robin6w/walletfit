import { useMemo, useState, type CSSProperties } from "react";
import { catalogBySourceId, catalogCards, feeLabel, isDiscontinued, summaryChips } from "@/v1/catalog";
import { num } from "@/v1/format";
import { paths } from "@/v2/app/paths";
import { Link } from "@/v2/app/router";
import { CardImage } from "@/v2/ui/CardImage";
import { BottomBar } from "@/v2/ui/TopBar";
import { issuerChip, searchCards, splitHighlight } from "@/v2/model/cardSearch";

/* 디자인 원본 F-D-Cards(A1) 값을 그대로 옮김. 카드 그림만 실물 사진 */

const PAGE = 20;
/** 디자인의 카드사 칩(나머지는 '+ 더보기') */
const DESIGN_ISSUERS = ["신한카드", "KB국민카드", "현대카드", "우리카드", "롯데카드"];

const SHADOW = "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)";
const segBtn = (on: boolean): CSSProperties => ({
  height: 38,
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
});
const issuerBtn = (on: boolean, dashed = false): CSSProperties => ({
  height: 38,
  padding: "0 12px",
  borderRadius: 19,
  border: dashed ? "1px dashed #B5C3E3" : on ? "1px solid #2457F5" : "1px solid #D3DDF2",
  background: on ? "#E8EEFF" : "#FFFFFF",
  fontFamily: "inherit",
  fontSize: 14,
  fontWeight: on ? 700 : 400,
  color: on ? "#2457F5" : "#3A4A78",
  cursor: "pointer",
});
const chipStyle: CSSProperties = { padding: "2px 9px", borderRadius: 999, background: "#F3F7FF", border: "1px solid #E3EAF8", fontSize: 13, color: "#3A4A78" };

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5E6D96" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ position: "absolute", left: 16, top: 18 }}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function XIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#5E6D96" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

/** A1 카드 선택: 가진 카드를 담는다(담은 카드만으로 조합을 계산) */
export function StepCards({ ids, onToggle }: { ids: number[]; onToggle: (sid: number) => void }) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | "신용" | "체크">("all");
  const [issuer, setIssuer] = useState<string | null>(null);
  const [moreIssuers, setMoreIssuers] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const owned = useMemo(() => new Set(ids), [ids]);
  const results = useMemo(() => searchCards({ q, kind, issuer, pinned: owned }), [q, kind, issuer, owned]);
  const discCount = results.filter((c) => isDiscontinued(c)).length;
  const issuers = moreIssuers
    ? Array.from(new Set(catalogCards.map((c) => c.issuer).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ko"))
    : DESIGN_ISSUERS;
  const feeTotal = ids.reduce((s, sid) => s + (catalogBySourceId.get(sid)?.annualFee ?? 0), 0);
  const reset = () => setLimit(PAGE);

  return (
    <>
      <header>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>가지고 있는 카드를 담아 주세요</h1>
        <p style={{ margin: "6px 0 0", fontSize: 15, lineHeight: 1.6, color: "#5E6D96" }}>담은 카드만으로 조합을 계산해요. 오른쪽에서 카드마다 계산에 쓰는 혜택을 바로 확인할 수 있어요.</p>
      </header>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 24 }}>
        <section aria-label="카드 찾기" style={{ flex: "999 1 460px", minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: "#FFFFFF", border: "1px solid transparent", borderRadius: 16, padding: 18, display: "flex", flexDirection: "column", gap: 14, boxShadow: SHADOW }}>
            <div style={{ position: "relative" }}>
              <label htmlFor="card-search" className="sr-only">
                카드 이름, 카드사, 별명으로 찾기
              </label>
              <SearchIcon />
              <input
                id="card-search"
                type="search"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  reset();
                }}
                className="w-field-strong [&::-webkit-search-cancel-button]:hidden"
                style={{ width: "100%", height: 56, boxSizing: "border-box", padding: "0 52px 0 48px", border: "2px solid #2457F5", borderRadius: 14, background: "#FFFFFF", fontFamily: "inherit", fontSize: 17, color: "#0D1B4A", outline: "none" }}
              />
              {q && (
                <button
                  type="button"
                  aria-label="검색어 지우기"
                  onClick={() => setQ("")}
                  style={{ position: "absolute", right: 6, top: 6, width: 44, height: 44, border: "none", borderRadius: 22, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                >
                  <XIcon />
                </button>
              )}
            </div>
            <div style={{ fontSize: 13, color: "#5E6D96" }}>영문 카드명은 한글 별명으로도 찾아요 · 예: 탭탭오, 미스터라이프, 로카</div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              <div role="group" aria-label="카드 종류" style={{ display: "flex", padding: 3, borderRadius: 12, background: "#F3F7FF" }}>
                {(["all", "신용", "체크"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={kind === k}
                    onClick={() => {
                      setKind(k);
                      reset();
                    }}
                    style={segBtn(kind === k)}
                  >
                    {k === "all" ? "전체" : k}
                  </button>
                ))}
              </div>
              <span aria-hidden="true" style={{ width: 1, height: 24, background: "#E3EAF8", margin: "0 4px" }} />
              <span style={{ fontSize: 13, color: "#5E6D96" }}>카드사</span>
              {issuers.map((i) => (
                <button
                  key={i}
                  type="button"
                  aria-pressed={issuer === i}
                  onClick={() => {
                    setIssuer(issuer === i ? null : i);
                    reset();
                  }}
                  style={issuerBtn(issuer === i)}
                >
                  {issuerChip(i)}
                </button>
              ))}
              <button type="button" aria-expanded={moreIssuers} onClick={() => setMoreIssuers((v) => !v)} style={issuerBtn(false, true)}>
                {moreIssuers ? "접기" : "+ 더보기"}
              </button>
            </div>
          </div>

          <div aria-live="polite" style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 8, padding: "0 4px" }}>
            <div style={{ fontSize: 15, color: "#3A4A78" }}>
              {q.trim() && <strong style={{ color: "#0D1B4A" }}>'{q.trim()}'</strong>} 검색 결과 {num(results.length)}장{" "}
              {discCount > 0 && <span style={{ color: "#5E6D96" }}>· 발급 중단 {num(discCount)}장 포함</span>}
            </div>
            <div style={{ fontSize: 13, color: "#5E6D96" }}>이미 가진 카드라면 발급이 끝났어도 담을 수 있어요</div>
          </div>

          <ul style={{ margin: 0, padding: 0, listStyle: "none", background: "#FFFFFF", border: "1px solid transparent", borderRadius: 16, overflow: "hidden", boxShadow: SHADOW }}>
            {results.slice(0, limit).map((c, idx, arr) => {
              const on = owned.has(c.sourceId);
              const disc = isDiscontinued(c);
              const nameEl = (
                <span style={{ fontSize: 16, fontWeight: 700 }}>
                  {splitHighlight(c.name, q).map((p, i) =>
                    p.hit ? (
                      <mark key={i} style={{ background: "#DCE8FF", color: "inherit", borderRadius: 3 }}>
                        {p.text}
                      </mark>
                    ) : (
                      <span key={i}>{p.text}</span>
                    ),
                  )}
                </span>
              );
              const meta = `${c.issuer} · ${c.category} · ${feeLabel(c)}`;
              return (
                <li
                  key={c.sourceId}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "12px 16px",
                    padding: "16px 18px",
                    borderBottom: idx === arr.length - 1 ? undefined : "1px solid #EDF2FC",
                    background: on ? "#F7FAFF" : undefined,
                  }}
                >
                  <CardImage sid={c.sourceId} width={112} />
                  <div style={{ flex: "1 1 260px", minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                    {disc ? (
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 8px" }}>
                        {nameEl}
                        <span style={{ padding: "2px 8px", borderRadius: 6, background: "#EDF2FC", fontSize: 12, fontWeight: 700, color: "#3A4A78" }}>신규 발급 중단</span>
                        <span style={{ fontSize: 13, color: "#5E6D96" }}>{meta}</span>
                      </div>
                    ) : (
                      <div>
                        {nameEl}
                        <span style={{ marginLeft: 8, fontSize: 13, color: "#5E6D96" }}>{meta}</span>
                      </div>
                    )}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {summaryChips(c).map((chip, ci) => (
                        <span key={`${ci}-${chip}`} style={chipStyle}>
                          {chip}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-pressed={on}
                    aria-label={`${c.name} ${on ? "빼기" : "담기"}`}
                    onClick={() => onToggle(c.sourceId)}
                    style={
                      on
                        ? { height: 44, minWidth: 96, padding: "0 14px", borderRadius: 12, border: "1px solid #C9D6F5", background: "#E8EEFF", fontFamily: "inherit", fontSize: 14, fontWeight: 700, color: "#2457F5", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }
                        : { height: 44, minWidth: 96, padding: "0 14px", borderRadius: 12, border: "1px solid #D3DDF2", background: "#FFFFFF", fontFamily: "inherit", fontSize: 14, fontWeight: 700, color: "#0D1B4A", cursor: "pointer" }
                    }
                  >
                    {on ? (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2457F5" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                        담음
                      </>
                    ) : (
                      "+ 담기"
                    )}
                  </button>
                </li>
              );
            })}
            {results.length === 0 && <li style={{ padding: "40px 18px", textAlign: "center", fontSize: 15, color: "#5E6D96" }}>찾는 카드가 없어요. 카드사 이름으로도 찾아보세요.</li>}
          </ul>
          {results.length > limit && (
            <button
              type="button"
              onClick={() => setLimit((l) => l + PAGE * 3)}
              style={{ alignSelf: "center", height: 44, padding: "0 20px", borderRadius: 22, border: "1px solid #D3DDF2", background: "#FFFFFF", fontFamily: "inherit", fontSize: 14, fontWeight: 700, color: "#3A4A78", cursor: "pointer" }}
            >
              {num(results.length - limit)}장 더 보기
            </button>
          )}
        </section>

        <aside
          aria-labelledby="wallet-h"
          style={{ flex: "1 1 360px", minWidth: 0, maxWidth: "100%", position: "sticky", top: 96, background: "#FFFFFF", border: "1px solid transparent", borderRadius: 16, display: "flex", flexDirection: "column", boxShadow: SHADOW, boxSizing: "content-box" }}
        >
          <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #EDF2FC", display: "flex", flexDirection: "column", gap: 14 }}>
            {ids.length > 0 && (
              <div aria-hidden="true" style={{ display: "flex", paddingLeft: 2, overflow: "hidden" }}>
                {ids.map((sid, i) => (
                  <CardImage key={sid} sid={sid} width={104} style={i ? { marginLeft: -62 } : undefined} />
                ))}
              </div>
            )}
            <div>
              <h2 id="wallet-h" style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>
                담은 카드 {ids.length}장
              </h2>
              <div className="w-num" style={{ marginTop: 2, fontSize: 14, color: "#5E6D96" }}>
                연회비 합계 연 {num(feeTotal)}원 · 월 약 {num(Math.round(feeTotal / 12 / 100) * 100)}원
              </div>
            </div>
          </div>

          <ul style={{ margin: 0, padding: "4px 20px", listStyle: "none" }}>
            {ids.map((sid, i) => {
              const c = catalogBySourceId.get(sid);
              return (
                <li key={sid} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: i === ids.length - 1 ? undefined : "1px solid #EDF2FC" }}>
                  <CardImage sid={sid} width={80} />
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{c?.name ?? sid}</div>
                      <div style={{ fontSize: 13, color: "#5E6D96", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {c?.issuer} · {c?.category} · {c?.annualFee ? `연회비 ${num(c.annualFee)}원` : "연회비 없음"}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={`${c?.name ?? sid} 빼기`}
                    onClick={() => onToggle(sid)}
                    style={{ width: 44, height: 44, margin: "0 -10px 0 0", border: "none", borderRadius: 22, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                  >
                    <XIcon size={16} />
                  </button>
                </li>
              );
            })}
            {ids.length === 0 && <li style={{ padding: "24px 0", textAlign: "center", fontSize: 14, color: "#5E6D96" }}>왼쪽에서 카드를 담아 주세요</li>}
          </ul>
          <div style={{ padding: "14px 20px 18px", borderTop: "1px solid #EDF2FC" }}>
            <Link to={paths.start("new")} style={{ fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
              새 카드까지 포함해서 추천받기 →
            </Link>
          </div>
        </aside>
      </div>

      <BottomBar>
        <Link to={paths.home} style={{ fontSize: 15, fontWeight: 500, color: "#3A4A78", textDecoration: "none" }}>
          ← 홈으로
        </Link>
        <span style={{ marginLeft: "auto", fontSize: 15, color: "#3A4A78" }}>
          <strong style={{ color: "#0D1B4A" }}>{ids.length}장</strong> 담았어요 · 연회비 연 {num(feeTotal)}원
        </span>
        {ids.length > 0 ? (
          <Link to={paths.make("own", "spend")} style={{ padding: "14px 26px", borderRadius: 24, background: "#2457F5", fontSize: 15, fontWeight: 700, color: "#FFFFFF", textDecoration: "none" }}>
            다음: 지출 입력
          </Link>
        ) : (
          <span aria-disabled="true" style={{ padding: "14px 26px", borderRadius: 24, background: "#DFE6F5", fontSize: 15, fontWeight: 700, color: "#5E6D96" }}>
            다음: 지출 입력
          </span>
        )}
      </BottomBar>
    </>
  );
}
