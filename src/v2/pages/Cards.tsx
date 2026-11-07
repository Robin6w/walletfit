import { useCallback, useMemo, useState, type CSSProperties } from "react";
import type { CatalogListing } from "@/domain/types/catalog";
import type { RankRow } from "@/domain/types/engine";
import { useMonthlySpend } from "@/domain/state/useMonthlySpend";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { useToast } from "@/shared/hooks/useToast";
import { catalogCards, categories, catLabel, feeLabel, isDiscontinued, isRestricted, isUnread, isVerified, summaryChips } from "@/v1/catalog";
import { approxWon, num } from "@/v1/format";
import { useAppData } from "@/v2/app/AppData";
import { useCardView } from "@/v2/app/cardView";
import { compareStore, COMPARE_MAX, useCompare } from "@/v2/app/compareStore";
import { useEngine } from "@/v2/app/engine";
import { paths } from "@/v2/app/paths";
import { Link } from "@/v2/app/router";
import { useBrandPicks } from "@/v2/app/state";
import { hasBenefit, matchesCard } from "@/v2/model/cardSearch";
import { benefitChips, matchedChip, matchesBenefit, perfText } from "@/v2/model/cardView";
import { picksToBrandShare } from "@/v2/model/brands";
import { CardDetailSheet } from "@/v2/ui/CardDetailSheet";
import { CardImage } from "@/v2/ui/CardImage";
import { CategoryGlyph } from "@/v2/ui/icons";
import { PageMain } from "@/v2/ui/Page";
import { MenuBar } from "@/v2/ui/TopBar";
import { useChrome } from "@/v2/ui/chrome";

/* 디자인 원본 F-D-Gallery(전체 카드) 값을 그대로 옮김. 카드 그림은 실물 사진 */

const SHADOW = "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)";
// 2026-10-31: OTT/구독·기차/고속버스를 영화/공연·여행에서 나누며 필터에도 넣었다(KTX 카드를 '여행'으로 찾을 수 없게 돼서)
const BENEFITS = ["cafe", "convenience", "transport", "mobile", "onlineShopping", "dining", "delivery", "mart", "gas", "travel", "intercity", "subscription"];
const SORTS = [
  { id: "fit", label: "내 지출에 유리한 순" },
  { id: "feeLow", label: "연회비 낮은 순" },
  { id: "feeHigh", label: "연회비 높은 순" },
  { id: "new", label: "최신순" },
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
const chip: CSSProperties = { padding: "3px 10px", borderRadius: 999, background: "#F3F7FF", border: "1px solid #E3EAF8", fontSize: 13, color: "#3A4A78" };
const compareLabel: CSSProperties = { display: "flex", alignItems: "center", gap: 8, height: 44, boxSizing: "content-box", padding: "0 12px", borderRadius: 12, border: "1px solid #D3DDF2", fontSize: 14, color: "#0D1B4A", cursor: "pointer" };

function Icon({ d }: { d: string[] }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.map((p) => (
        <path key={p} d={p} />
      ))}
    </svg>
  );
}

/** '내 지출에 유리한 순'의 근거: 지출 전부를 이 카드 한 장으로 냈을 때 연회비를 뺀 월 혜택(2026-10-29) */
function NetLine({ sid, net, verified }: { sid: number; net: number | undefined; verified: boolean }) {
  const line: CSSProperties = { marginTop: 6, fontSize: 13, lineHeight: 1.5, color: "#3A4A78" };
  if (net === undefined || isUnread(sid)) return <div style={line}>혜택 정보를 아직 읽지 못한 카드예요</div>;
  return (
    <div style={line}>
      {net > 0 ? (
        <>
          내 지출로 연회비 빼고 <strong style={{ color: "#1747D6" }}>월 {approxWon(net)}</strong>
        </>
      ) : (
        "내 지출로는 연회비를 빼면 남는 혜택이 없어요"
      )}
      {!verified && <span style={{ color: "#5E6D96" }}> · 혜택 요약으로 낸 추정값</span>}
    </div>
  );
}

export default function Cards() {
  const { myCards } = useAppData();
  const { showToast } = useToast();
  const { spending } = useMonthlySpend(categories);
  const [picks] = useBrandPicks();
  const compare = useCompare();
  const [tab, setTab] = useState<"all" | "mine">("all");
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | "신용" | "체크">("all");
  const [issuer, setIssuer] = useState("");
  // 기본은 '내 지출에 유리한 순'. 지출을 넣지 않았으면 최신순으로 보여 준다(2026-11-07, '원문 확인 카드 먼저' 정렬 삭제)
  const [sort, setSort] = useState<Sort>("fit");
  const [benefit, setBenefit] = useState("");
  const [showDisc, setShowDisc] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [detail, setDetail] = useState<CatalogListing | null>(null);
  // 모바일 사이트: 필터를 한 줄씩으로 접고 카드를 가로 한 줄 목록으로(스크롤 줄이기, 2026-11-07)
  const { compact } = useChrome();
  const closeDetail = useCallback(() => setDetail(null), []);
  // 원문 정제 혜택 표 요약(혜택 칩·실적 조건·상세 창). 받는 동안은 혜택 요약 칩을 보여 준다
  const views = useCardView();
  const viewOf = (sid: number) => views?.cards[String(sid)];
  const dq = useDebounce(q, 250);
  const owned = useMemo(() => new Set(myCards.ids), [myCards.ids]);
  const spend = useMemo(() => Object.fromEntries(Object.entries(spending).filter(([, v]) => v > 0)), [spending]);
  const hasSpend = Object.keys(spend).length > 0;
  const rank = useEngine<{ ok: boolean; error?: string; rows: RankRow[] }>("rank", sort === "fit" && hasSpend ? { spending: spend, brandShare: picksToBrandShare(spend, picks) } : null);
  const netBy = useMemo(() => new Map(((rank.data ?? rank.lastGood)?.rows ?? []).map((r) => [r.sid, r.net])), [rank.data, rank.lastGood]);
  const issuers = useMemo(() => Array.from(new Set(catalogCards.map((c) => c.issuer).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ko")), []);

  const list = useMemo(() => {
    let l = catalogCards;
    if (tab === "mine") l = l.filter((c) => owned.has(c.sourceId));
    else if (!showDisc) l = l.filter((c) => !isDiscontinued(c) || owned.has(c.sourceId));
    // 카드 이름·카드사·별명, 그리고 혜택 제목·가맹점('스타벅스')으로 찾는다
    if (dq.trim()) l = l.filter((c) => matchesCard(c, dq.trim()) || matchesBenefit(views?.cards[String(c.sourceId)], dq.trim()));
    if (kind !== "all") l = l.filter((c) => c.category === kind);
    if (issuer) l = l.filter((c) => c.issuer === issuer);
    if (benefit) l = l.filter((c) => hasBenefit(c, benefit, views?.cards[String(c.sourceId)]));
    // 발급 대상이 정해진 카드(정부 바우처·청소년 등)는 같은 순위면 뒤로, 그다음 최신순(2026-11-07: 연회비 순에서 국민행복카드가 맨 앞에 오던 것)
    const tie = (a: CatalogListing, b: CatalogListing) => Number(isRestricted(a)) - Number(isRestricted(b)) || b.sourceId - a.sourceId;
    const out = [...l];
    if (sort === "feeLow") out.sort((a, b) => (a.annualFee ?? 0) - (b.annualFee ?? 0) || tie(a, b));
    else if (sort === "feeHigh") out.sort((a, b) => (b.annualFee ?? 0) - (a.annualFee ?? 0) || tie(a, b));
    else if (sort === "fit" && netBy.size) out.sort((a, b) => (netBy.get(b.sourceId) ?? -1e9) - (netBy.get(a.sourceId) ?? -1e9) || tie(a, b));
    // 최신순(지출이 없을 때의 '유리한 순'도 같은 순서)
    else out.sort(tie);
    return out;
  }, [tab, owned, showDisc, dq, kind, issuer, benefit, sort, netBy, views]);

  const sortLabel =
    sort === "fit" && !hasSpend
      ? "지출을 넣으면 내 지출에 유리한 순으로 보여요. 지금은 최신순"
      : SORTS.find((s) => s.id === sort)!.label;
  const showNet = sort === "fit" && hasSpend && netBy.size > 0;
  const toggleCompare = (sid: number) => {
    if (!compareStore.toggle(sid)) showToast(`비교함에는 ${COMPARE_MAX}장까지 담을 수 있어요`, "info");
  };
  const reset = () => setLimit(PAGE);

  return (
    <>
      <MenuBar active="cards" />
      <PageMain title="전체 카드">
        <header style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "12px 20px" }}>
          <div style={{ flex: "1 1 420px", minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>전체 카드</h1>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <div role="group" aria-label="보기" style={{ display: "flex", flexWrap: "wrap", padding: 3, borderRadius: 12, background: "#F3F7FF" }}>
              <button
                type="button"
                aria-pressed={tab === "all"}
                onClick={() => {
                  setTab("all");
                  reset();
                }}
                style={segBtn(tab === "all")}
              >
                전체 카드
              </button>
              <button
                type="button"
                aria-pressed={tab === "mine"}
                onClick={() => {
                  setTab("mine");
                  reset();
                }}
                style={segBtn(tab === "mine")}
              >
                내 카드 {myCards.ids.length}
              </button>
            </div>
          </div>
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
              카드 {num(list.length)}장 <span style={{ fontSize: 14, fontWeight: 500, color: "#5E6D96" }}>· {sortLabel}</span>
            </h2>
            {!compact && <span style={{ fontSize: 13, color: "#5E6D96" }}>'내 카드'는 지갑 만들기에서 담은 {myCards.ids.length}장이에요</span>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: compact ? "repeat(2, minmax(0, 1fr))" : "repeat(auto-fill, minmax(min(320px, 100%), 1fr))", gap: compact ? 8 : 16 }}>
            {list.slice(0, limit).map((c) => {
              const mine = owned.has(c.sourceId);
              const disc = isDiscontinued(c);
              const inCompare = compare.includes(c.sourceId);
              const v = viewOf(c.sourceId);
              const vChips = v ? benefitChips(v, 3, benefit || undefined) : [];
              // 정리된 혜택이 없거나 크기를 못 읽은 카드는 혜택 요약 칩으로
              const chips = vChips.length ? vChips : summaryChips(c);
              // 혜택으로 찾았으면 걸린 혜택을 맨 앞에 강조해서 보여 준다(이름으로 찾은 카드는 그대로)
              const hit = dq.trim() && !matchesCard(c, dq.trim()) ? matchedChip(v, dq.trim()) : null;
              return (
                // 모바일: 한 줄에 두 장씩 작은 칸(그림 · 이름 · 정보 · 칩 1개 · 담기/비교). 세로 길이 줄이기(2026-11-07)
                compact ? (
                  <article
                    key={c.sourceId}
                    onClick={(e) => {
                      if (!(e.target as HTMLElement).closest("button, a, label, input")) setDetail(c);
                    }}
                    style={{ minWidth: 0, background: "#FFFFFF", border: "1px solid transparent", borderRadius: 14, boxShadow: SHADOW, padding: 10, display: "flex", flexDirection: "column", gap: 6, cursor: "pointer" }}
                  >
                    <CardImage sid={c.sourceId} width={88} />
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, lineHeight: 1.3, wordBreak: "keep-all" }}>
                      <button type="button" onClick={() => setDetail(c)} style={{ padding: 0, border: "none", background: "transparent", font: "inherit", color: "inherit", textAlign: "left", cursor: "pointer" }}>
                        {c.name}
                      </button>
                    </h3>
                    <div style={{ fontSize: 14, lineHeight: 1.4, color: "#5E6D96" }}>
                      {mine && <b style={{ color: "#1747D6" }}>내 카드 · </b>}
                      {disc && !mine && <b style={{ color: "#A3420B" }}>발급 중단 · </b>}
                      {c.issuer} · {c.annualFee ? `연 ${num(c.annualFee)}원` : feeLabel(c)}
                    </div>
                    {showNet && <NetLine sid={c.sourceId} net={netBy.get(c.sourceId)} verified={isVerified(c)} />}
                    {(hit || chips[0]) && (
                      <span style={{ ...chip, alignSelf: "flex-start", maxWidth: "100%", boxSizing: "border-box", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 14, ...(hit ? { background: "#E8EEFF", border: "1px solid #C9D6F5", color: "#1747D6", fontWeight: 700 } : {}) }}>{hit ?? chips[0]}</span>
                    )}
                    <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                      {disc && !mine ? (
                        <span style={{ flex: 1, fontSize: 14, lineHeight: 1.4, color: "#5E6D96" }}>가진 경우만 담기</span>
                      ) : (
                        <button
                          type="button"
                          aria-pressed={mine}
                          aria-label={`${c.name} ${mine ? "내 카드에서 빼기" : "내 카드에 담기"}`}
                          onClick={() => myCards.toggle(c.sourceId)}
                          style={{ flex: 1, minWidth: 0, height: 36, padding: "0 6px", borderRadius: 10, border: mine ? "1px solid #C9D6F5" : "1px solid #D3DDF2", background: mine ? "#E8EEFF" : "#FFFFFF", fontFamily: "inherit", fontSize: 14, fontWeight: 700, color: mine ? "#2457F5" : "#0D1B4A", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
                        >
                          {mine ? <Icon d={["M20 6 9 17l-5-5"]} /> : <Icon d={["M12 5v14", "M5 12h14"]} />}
                          {mine ? "담음" : "담기"}
                        </button>
                      )}
                      <label style={{ ...compareLabel, height: 36, padding: "0 8px", gap: 4, borderRadius: 10, fontSize: 14 }}>
                        <input type="checkbox" checked={inCompare} onChange={() => toggleCompare(c.sourceId)} aria-label={`${c.name} 비교함에 담기`} style={{ width: 16, height: 16, margin: 0, accentColor: "#2457F5" }} />
                        비교
                      </label>
                    </div>
                  </article>
                ) : (
                  <article
                    key={c.sourceId}
                    // 카드 칸 어디를 눌러도 상세 창이 열린다(담기·비교 버튼은 제외). 키보드는 카드 이름 버튼으로
                    onClick={(e) => {
                      if (!(e.target as HTMLElement).closest("button, a, label, input")) setDetail(c);
                    }}
                    style={{ background: "#FFFFFF", border: "1px solid transparent", borderRadius: 20, boxShadow: SHADOW, padding: 20, display: "flex", flexDirection: "column", gap: 14, cursor: "pointer" }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                      <CardImage sid={c.sourceId} width={128} />
                      {mine ? (
                        <span style={{ display: "inline-flex", alignItems: "center", height: 26, padding: "0 10px", borderRadius: 13, background: "#E8EEFF", fontSize: 12, fontWeight: 700, color: "#1747D6" }}>내 카드</span>
                      ) : disc ? (
                        <span style={{ display: "inline-flex", alignItems: "center", height: 26, padding: "0 10px", borderRadius: 13, background: "#FFF1E6", fontSize: 12, fontWeight: 700, color: "#A3420B" }}>신규 발급 중단</span>
                      ) : null}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                        <button type="button" onClick={() => setDetail(c)} style={{ padding: 0, border: "none", background: "transparent", font: "inherit", color: "inherit", textAlign: "left", cursor: "pointer" }}>
                          {c.name}
                        </button>
                      </h3>
                      <div style={{ marginTop: 2, fontSize: 13, color: "#5E6D96" }}>
                        {c.issuer} · {c.category} · {c.annualFee ? `연회비 ${num(c.annualFee)}원` : feeLabel(c)}
                        {v && ` · ${perfText(v)}`}
                      </div>
                      {showNet && <NetLine sid={c.sourceId} net={netBy.get(c.sourceId)} verified={isVerified(c)} />}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {hit && <span style={{ ...chip, background: "#E8EEFF", border: "1px solid #C9D6F5", color: "#1747D6", fontWeight: 700 }}>{hit}</span>}
                      {chips.slice(0, hit ? 2 : 3).map((s, i) => (
                        <span key={`${i}-${s}`} style={chip}>
                          {s}
                        </span>
                      ))}
                      {v && vChips.length > 0 && v.b.length > chips.length && <span style={{ ...chip, background: "transparent", border: "none", color: "#2457F5", fontWeight: 700 }}>혜택 {v.b.length}개 보기</span>}
                    </div>
                    <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                      {disc && !mine ? (
                        <span style={{ flex: 1, display: "flex", alignItems: "center", minHeight: 44, fontSize: 13, lineHeight: 1.5, color: "#5E6D96" }}>이미 가진 경우에만 담을 수 있어요</span>
                      ) : (
                        <button
                          type="button"
                          aria-pressed={mine}
                          aria-label={`${c.name} ${mine ? "내 카드에서 빼기" : "내 카드에 담기"}`}
                          onClick={() => myCards.toggle(c.sourceId)}
                          style={
                            mine
                              ? { flex: 1, height: 44, padding: "0 14px", borderRadius: 12, border: "1px solid #C9D6F5", background: "#E8EEFF", fontFamily: "inherit", fontSize: 14, fontWeight: 700, color: "#2457F5", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }
                              : { flex: 1, height: 44, padding: "0 14px", borderRadius: 12, border: "1px solid #D3DDF2", background: "#FFFFFF", fontFamily: "inherit", fontSize: 14, fontWeight: 700, color: "#0D1B4A", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }
                          }
                        >
                          {mine ? <Icon d={["M20 6 9 17l-5-5"]} /> : <Icon d={["M12 5v14", "M5 12h14"]} />}
                          {mine ? "내 카드" : "내 카드에 담기"}
                        </button>
                      )}
                      <label style={compareLabel}>
                        <input type="checkbox" checked={inCompare} onChange={() => toggleCompare(c.sourceId)} aria-label={`${c.name} 비교함에 담기`} style={{ width: 18, height: 18, margin: 0, accentColor: "#2457F5" }} />
                        비교
                      </label>
                    </div>
                  </article>
                )
              );
            })}
          </div>
          {list.length === 0 && <p style={{ margin: 0, padding: "40px 0", textAlign: "center", fontSize: 15, color: "#5E6D96" }}>조건에 맞는 카드가 없어요. 검색어나 필터를 바꿔 보세요.</p>}
          {list.length > limit && (
            <button
              type="button"
              onClick={() => setLimit((l) => l + PAGE * 2)}
              style={{ alignSelf: "center", height: 44, padding: "0 20px", borderRadius: 22, border: "1px solid #D3DDF2", background: "#FFFFFF", fontFamily: "inherit", fontSize: 14, fontWeight: 700, color: "#3A4A78", cursor: "pointer" }}
            >
              {num(list.length - limit)}장 더 보기
            </button>
          )}
        </section>

        {compare.length > 0 && (
          <section aria-label="비교함" data-stickybar="" style={{ position: "sticky", bottom: 16, zIndex: 10, display: "flex", flexWrap: "wrap", alignItems: "center", gap: compact ? "10px 12px" : "12px 20px", padding: compact ? "12px 14px" : "16px 20px", borderRadius: 20, background: "#0D1B4A", color: "#FFFFFF", boxShadow: "0 14px 30px -10px rgba(13, 27, 74, 0.5)" }}>
            <div aria-hidden="true" style={{ display: "flex", alignItems: "center" }}>
              {compare.map((sid, i) => (
                <span key={sid} style={{ marginLeft: i ? -18 : 0, display: "flex" }}>
                  <CardImage sid={sid} width={56} />
                </span>
              ))}
            </div>
            <div style={{ flex: compact ? "1 1 auto" : "1 1 260px", minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>비교함 {compare.length}장</div>
              {!compact && (
                <div style={{ fontSize: 14, color: "#C9D6F5" }}>
                  {compare.map((sid) => catalogCards.find((c) => c.sourceId === sid)?.name ?? sid).join(" · ")} · 최대 {COMPARE_MAX}장
                </div>
              )}
            </div>
            <button type="button" onClick={() => compareStore.clear()} style={{ height: 44, padding: "0 16px", borderRadius: 22, border: "1px solid rgba(255, 255, 255, 0.4)", background: "transparent", fontFamily: "inherit", fontSize: 14, fontWeight: 700, color: "#FFFFFF", cursor: "pointer" }}>
              비우기
            </button>
            {compare.length >= 2 ? (
              <Link
                to={paths.compare(compare)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 44, padding: "0 20px", boxSizing: "border-box", borderRadius: 22, background: "#FFFFFF", fontSize: 15, fontWeight: 700, color: "#2457F5", textDecoration: "none", whiteSpace: "nowrap" }}
              >
                나란히 비교하기
                <Icon d={["M5 12h14", "m13 6 6 6-6 6"]} />
              </Link>
            ) : (
              <span style={{ display: "inline-flex", alignItems: "center", height: 44, padding: "0 20px", boxSizing: "border-box", borderRadius: 22, background: "rgba(255,255,255,0.16)", fontSize: 15, fontWeight: 700, color: "#C9D6F5", whiteSpace: "nowrap" }}>
                1장 더 담으면 비교할 수 있어요
              </span>
            )}
          </section>
        )}
      </PageMain>
      {detail && (
        <CardDetailSheet
          entry={detail}
          view={viewOf(detail.sourceId)}
          loading={!views}
          mine={owned.has(detail.sourceId)}
          discontinued={isDiscontinued(detail)}
          inCompare={compare.includes(detail.sourceId)}
          net={showNet ? netBy.get(detail.sourceId) : undefined}
          onToggleMine={() => myCards.toggle(detail.sourceId)}
          onToggleCompare={() => toggleCompare(detail.sourceId)}
          onClose={closeDetail}
        />
      )}
    </>
  );
}
