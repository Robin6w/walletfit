import { useCallback, useMemo, useState, type CSSProperties } from "react";
import type { CatalogListing } from "@/domain/types/catalog";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { catalogCards, catLabel, isDiscontinued } from "@/v1/catalog";
import { num } from "@/v1/format";
import { useCardView } from "@/v2/app/cardView";
import { hasBenefit, matchesCard } from "@/v2/model/cardSearch";
import { matchedChip, matchesBenefit } from "@/v2/model/cardView";
import { CardDetailSheet } from "@/v2/ui/CardDetailSheet";
import { CardGrid, CardTile } from "@/v2/ui/CardTile";
import { CategoryGlyph } from "@/v2/ui/icons";
import { PageMain } from "@/v2/ui/Page";
import { MenuBar } from "@/v2/ui/TopBar";
import { useChrome } from "@/v2/ui/chrome";

/* 디자인 원본 F-D-Gallery(전체 카드) 값을 그대로 옮김. 카드 그림은 실물 사진
 * 2026-11-07: 지갑 만들기(메인 흐름)와 따로 노는 둘러보기 기능. 카드마다 있던 '내 카드에 담기'·'비교' 칸과 비교함 바를 없애고
 * 그 자리에 '혜택 보기'(카드 상세 창)를 둔다. 여기서 담아도 내 지갑으로 가지 않아 담긴 곳이 불분명했기 때문.
 * 같은 이유로 '내 카드' 탭·표시도 없앴다(지갑 만들기에서 고른 카드를 여기서 보여 주지 않음).
 * 정렬은 연회비 순 두 가지만 남겼다('내 지출에 유리한 순'·'원문 확인 카드 먼저'·'최신순' 삭제). 그래서 이 화면은 지출 입력·계산 엔진을 쓰지 않는다 */

const SHADOW = "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)";
// 2026-10-31: OTT/구독·기차/고속버스를 영화/공연·여행에서 나누며 필터에도 넣었다(KTX 카드를 '여행'으로 찾을 수 없게 돼서)
const BENEFITS = ["cafe", "convenience", "transport", "mobile", "onlineShopping", "dining", "delivery", "mart", "gas", "travel", "intercity", "subscription"];
const SORTS = [
  { id: "feeLow", label: "연회비 낮은 순" },
  { id: "feeHigh", label: "연회비 높은 순" },
] as const;
type Sort = (typeof SORTS)[number]["id"];
const PAGE = 24;

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
const chipBtn = (on: boolean): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 40,
  padding: "0 14px",
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
const selectStyle: CSSProperties = { height: 44, padding: "0 12px", border: "1px solid #D3DDF2", borderRadius: 12, background: "#FFFFFF", fontFamily: "inherit", fontSize: 14, color: "#0D1B4A" };

export default function Cards() {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | "신용" | "체크">("all");
  const [issuer, setIssuer] = useState("");
  const [sort, setSort] = useState<Sort>("feeLow");
  const [benefit, setBenefit] = useState("");
  const [showDisc, setShowDisc] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [detail, setDetail] = useState<CatalogListing | null>(null);
  // 모바일 사이트: 필터를 한 줄씩으로 접고 카드를 가로 한 줄 목록으로(스크롤 줄이기, 2026-11-07)
  const { compact } = useChrome();
  const closeDetail = useCallback(() => setDetail(null), []);
  // 원문 정제 혜택 표 요약(혜택 칩·실적 조건·상세 창). 받는 동안은 카드고릴라 요약 칩을 보여 준다
  const views = useCardView();
  const viewOf = (sid: number) => views?.cards[String(sid)];
  const dq = useDebounce(q, 250);
  const issuers = useMemo(() => Array.from(new Set(catalogCards.map((c) => c.issuer).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ko")), []);

  const list = useMemo(() => {
    let l = catalogCards;
    if (!showDisc) l = l.filter((c) => !isDiscontinued(c));
    // 카드 이름·카드사·별명, 그리고 혜택 제목·가맹점('스타벅스')으로 찾는다
    if (dq.trim()) l = l.filter((c) => matchesCard(c, dq.trim()) || matchesBenefit(views?.cards[String(c.sourceId)], dq.trim()));
    if (kind !== "all") l = l.filter((c) => c.category === kind);
    if (issuer) l = l.filter((c) => c.issuer === issuer);
    if (benefit) l = l.filter((c) => hasBenefit(c, benefit, views?.cards[String(c.sourceId)]));
    const out = [...l];
    if (sort === "feeLow") out.sort((a, b) => (a.annualFee ?? 0) - (b.annualFee ?? 0));
    else out.sort((a, b) => (b.annualFee ?? 0) - (a.annualFee ?? 0));
    return out;
  }, [showDisc, dq, kind, issuer, benefit, sort, views]);

  const reset = () => setLimit(PAGE);

  return (
    <>
      <MenuBar active="cards" />
      <PageMain title="전체 카드">
        <header>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>전체 카드</h1>
        </header>


        <section aria-label="카드 찾기" style={{ background: "#FFFFFF", border: "1px solid transparent", boxShadow: SHADOW, borderRadius: 16, padding: compact ? 14 : 18, display: "flex", flexDirection: "column", gap: compact ? 10 : 14 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
            <div style={{ position: "relative", flex: "1 1 320px", minWidth: 0 }}>
              <label htmlFor="g-search" className="sr-only">
                카드 이름, 카드사, 별명으로 찾기
              </label>
              <span aria-hidden="true" style={{ position: "absolute", left: 16, top: 16, display: "flex", color: "#5E6D96" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
              </span>
              <input
                id="g-search"
                type="search"
                value={q}
                placeholder="카드 이름, 카드사, 혜택(스타벅스 등)으로 찾기"
                onChange={(e) => {
                  setQ(e.target.value);
                  reset();
                }}
                style={{ width: "100%", height: 52, boxSizing: "border-box", padding: "0 16px 0 48px", border: "1px solid #D3DDF2", borderRadius: 14, background: "#FFFFFF", fontFamily: "inherit", fontSize: 16, color: "#0D1B4A" }}
              />
            </div>
            <div role="group" aria-label="카드 종류" style={{ display: "flex", flexWrap: "wrap", padding: 3, borderRadius: 12, background: "#F3F7FF" }}>
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
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#3A4A78", ...(compact ? { flex: "1 1 140px", minWidth: 0 } : {}) }}>
              <span className={compact ? "sr-only" : undefined}>카드사</span>
              <select
                value={issuer}
                onChange={(e) => {
                  setIssuer(e.target.value);
                  reset();
                }}
                style={compact ? { ...selectStyle, width: "100%", minWidth: 0 } : selectStyle}
              >
                <option value="">전체 카드사</option>
                {issuers.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#3A4A78", ...(compact ? { flex: "1 1 140px", minWidth: 0 } : {}) }}>
              <span className={compact ? "sr-only" : undefined}>정렬</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} style={compact ? { ...selectStyle, width: "100%", minWidth: 0 } : selectStyle}>
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div
            role="group"
            aria-label="혜택으로 찾기"
            className={compact ? "w-hscroll" : undefined}
            style={compact ? { display: "flex", flexWrap: "nowrap", alignItems: "center", gap: 6, overflowX: "auto", margin: "0 -14px", padding: "2px 14px" } : { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}
          >
            <span aria-hidden="true" className={compact ? "sr-only" : undefined} style={{ fontSize: 13, fontWeight: 700, color: "#5E6D96", marginRight: 4 }}>
              혜택으로 찾기
            </span>
            <button
              type="button"
              aria-pressed={benefit === ""}
              onClick={() => {
                setBenefit("");
                reset();
              }}
              style={chipBtn(benefit === "")}
            >
              전체
            </button>
            {BENEFITS.map((b) => (
              <button
                key={b}
                type="button"
                aria-pressed={benefit === b}
                onClick={() => {
                  setBenefit(benefit === b ? "" : b);
                  reset();
                }}
                style={chipBtn(benefit === b)}
              >
                <CategoryGlyph cat={b} />
                {catLabel(b)}
              </button>
            ))}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: compact ? 28 : 32, fontSize: 14, color: "#3A4A78" }}>
            <input
              type="checkbox"
              checked={showDisc}
              onChange={(e) => {
                setShowDisc(e.target.checked);
                reset();
              }}
              style={{ width: 18, height: 18, margin: 0, accentColor: "#2457F5" }}
            />
            발급 중단 카드도 보기
          </label>
        </section>

        <section aria-labelledby="g-list" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 8, padding: "0 4px" }}>
            <h2 id="g-list" aria-live="polite" style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
              카드 {num(list.length)}장
            </h2>
          </div>
          <CardGrid>
            {list.slice(0, limit).map((c) => {
              const v = viewOf(c.sourceId);
              // 혜택으로 찾았으면 걸린 혜택을 맨 앞에 강조해서 보여 준다(이름으로 찾은 카드는 그대로)
              const hit = dq.trim() && !matchesCard(c, dq.trim()) ? matchedChip(v, dq.trim()) : null;
              return <CardTile key={c.sourceId} card={c} view={v} focusCat={benefit || undefined} hit={hit} onOpen={() => setDetail(c)} />;
            })}
          </CardGrid>
          {list.length === 0 && <p style={{ margin: 0, padding: "40px 0", textAlign: "center", fontSize: 15, color: "#5E6D96" }}>조건에 맞는 카드가 없어요. 검색어나 필터를 바꿔 보세요.</p>}
          {list.length > limit && (
            <button
              type="button"
              onClick={() => setLimit((l) => l + PAGE * 2)}
              style={{ alignSelf: "center", height: 44, padding: "0 20px", borderRadius: 22, border: "1px solid #D3DDF2", background: "#FFFFFF", fontFamily: "inherit", fontSize: 14, fontWeight: 700, color: "#3A4A78", cursor: "pointer" }}
            >
              더 보기
            </button>
          )}
        </section>
      </PageMain>
      {detail && (
        <CardDetailSheet
          entry={detail}
          view={viewOf(detail.sourceId)}
          loading={!views}
          discontinued={isDiscontinued(detail)}
          hideSource
          onClose={closeDetail}
        />
      )}
    </>
  );
}
