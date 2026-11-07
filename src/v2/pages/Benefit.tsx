import { useCallback, useMemo, useState, type CSSProperties } from "react";
import type { CategoryRankRow } from "@/domain/engine/walletEngine";
import type { CatalogListing } from "@/domain/types/catalog";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { catalogCards, catLabel, categories, isDiscontinued, issuableCards, MAIN_CATEGORIES } from "@/v1/catalog";
import { num } from "@/v1/format";
import { useAppData } from "@/v2/app/AppData";
import { useCardView } from "@/v2/app/cardView";
import { useEngine } from "@/v2/app/engine";
import { paths } from "@/v2/app/paths";
import { Link, navigate, useRoute } from "@/v2/app/router";
import { dedupeRows, heroVM, rowsVM, type BenefitScope } from "@/v2/model/benefitView";
import { hasBenefit } from "@/v2/model/cardSearch";
import { SHADOW } from "@/v2/result/parts";
import { CardDetailSheet } from "@/v2/ui/CardDetailSheet";
import { CardImage } from "@/v2/ui/CardImage";
import { CardGrid, CardTile } from "@/v2/ui/CardTile";
import { PageGlyph } from "@/v2/ui/icons";
import { PageMain } from "@/v2/ui/Page";
import { MenuBar } from "@/v2/ui/TopBar";
import { useChrome } from "@/v2/ui/chrome";

/**
 * 혜택별 추천(디자인 F-D-Benefit, 2026-10-29 v2).
 * 카테고리 하나와 금액을 고르면 전체 카드마다 그 카테고리에서 받는 월 혜택을 계산해 줄 세운다(엔진 categoryRank).
 *
 * 2026-11-07 다른 기능과 분리한 독립 기능(팀 결정): 지출 입력·자주 가는 곳·저장한 지갑·추천 결과·
 * 통신사 같은 고르는 질문의 답을 읽지 않는다. 이 화면에서 고른 카테고리와 금액만으로 계산하고, 입력값은 이 화면 안에만 둔다.
 * 다만 '내 카드 중 / 전체 카드 중'으로 어느 카드 중에서 찾을지는 고른다(내 카드 = 전체 카드·지갑 만들기에서 담은 카드).
 * 자주 가는 곳(브랜드 비중)은 쓰지 않는다: 다른 화면의 입력이 이 화면 금액을 몰래 바꾸지 않게. 비중은 늘 '가정'으로 설명에 적는다.
 * 실적: '실적 채웠다고 가정'을 켜면 카드마다 그 혜택에 필요한 실적을 채웠다고 보고(필요한 실적을 함께 적음),
 * 끄면 입력한 금액만 이 카드로 쓴다고 보고 실적을 계산한다.
 *
 * 2026-11-07: 금액은 0원에서 시작한다. 금액을 넣기 전에는 계산하지 않고, 그 카테고리 혜택이 있는 카드를
 * 전체 카드 화면과 같은 칸으로 늘어놓는다(연회비 낮은 순, '혜택 보기' 버튼 없이 칸을 누르면 카드 상세 창). 금액을 넣으면 순위로 바뀐다.
 */

/** 계산 후보이자 금액 넣기 전 목록의 카드(발급 가능 · 원문 확인 카드) */
const ISSUABLE = issuableCards();
const ALL_IDS = ISSUABLE.map((c) => c.sourceId);
/** 금액 넣기 전 목록: 처음 24장, '더 보기'마다 48장 더(전체 카드와 같음) */
const BROWSE_PAGE = 24;
const OTHER_CATS = categories.map((c) => c.id).filter((id) => !MAIN_CATEGORIES.includes(id));
/** 처음 금액. 2026-11-07: 10만원을 미리 넣어 두지 않고 0원에서 사용자가 직접 넣게 했다 */
const DEFAULT_AMOUNT = 0;
/** 입력칸 글자: 0원이면 비워 두고 회색 '0'(placeholder)을 보여 준다. 앞의 0을 지우지 않고 바로 칠 수 있게 */
const toDraft = (v: number) => (v > 0 ? num(v) : "");
const LIST_MAX = 10;
/** '더 보기'로 펼치면 보이는 마지막 순위(2026-11-07) */
const MORE_MAX = 30;
/** 같은 이름 카드를 한 번만 남긴 뒤에도 30위까지 채우도록 넉넉히 받는다 */
const FETCH_LIMIT = 40;
const MORE_BTN =
  "flex h-12 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#D3DDF2] bg-white text-[15px] font-bold text-[#0D1B4A] transition-colors hover:border-w-primary hover:bg-w-primary hover:text-white focus-visible:border-w-primary focus-visible:bg-w-primary focus-visible:text-white";

const chipOn: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, height: 40, padding: "0 14px", borderRadius: 20, border: "1px solid #2457F5", background: "#2457F5", color: "#FFFFFF", fontWeight: 700, fontFamily: "inherit", fontSize: 14, cursor: "pointer", whiteSpace: "nowrap" };
const chipOff: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, height: 40, padding: "0 14px", borderRadius: 20, border: "1px solid #D3DDF2", background: "#FFFFFF", color: "#3A4A78", fontFamily: "inherit", fontSize: 14, cursor: "pointer", whiteSpace: "nowrap" };
const NUMF = "Outfit, 'IBM Plex Sans KR', sans-serif";
const segBase: CSSProperties = { height: 40, padding: "0 16px", borderRadius: 9, border: "none", fontFamily: "inherit", fontSize: 14, cursor: "pointer", whiteSpace: "nowrap" };
const segOn: CSSProperties = { ...segBase, background: "#FFFFFF", boxShadow: "0 1px 3px rgba(13, 40, 120, 0.12)", fontWeight: 700, color: "#0D1B4A" };
const segOff: CSSProperties = { ...segBase, background: "transparent", fontWeight: 400, color: "#3A4A78" };

export default function Benefit() {
  const route = useRoute();
  const { myCards } = useAppData();
  const owned = myCards.ids;
  const ownedSet = useMemo(() => new Set(owned), [owned]);
  // 담은 카드가 있으면 '내 카드 중'에서 시작한다
  const [scope, setScope] = useState<BenefitScope>(owned.length ? "mine" : "all");
  const mine = scope === "mine";
  // 모바일 사이트: 카드 그림을 작게(스크롤 줄이기, 2026-11-07)
  const { compact } = useChrome();
  // 어느 카테고리를 볼지만 주소(?cat=)로 받는다(상담 창 등에서 바로 열기). 금액은 받지 않는다
  const qCat = route.query.get("cat");
  const [cat, setCat] = useState<string>(qCat && categories.some((c) => c.id === qCat) ? qCat : "convenience");
  const [moreOpen, setMoreOpen] = useState(OTHER_CATS.includes(cat));
  // 카테고리마다 이 화면에서 입력한 금액(처음에는 모두 0원). 다른 화면의 지출 입력과 주고받지 않는다
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const amountFor = (id: string) => amounts[id] ?? DEFAULT_AMOUNT;
  const amount = amountFor(cat);
  // 입력칸 글자(쉼표 포함). 카테고리를 바꾸면 그 카테고리 금액으로 다시 채운다
  const [draft, setDraft] = useState<string>(toDraft(amount));
  const amountD = useDebounce(amount, 350);
  const [assumePerf, setAssumePerf] = useState(true);

  // spending은 비우고 choices도 빈 값으로 실어 보낸다: 엔진 호출이 다른 화면에서 답한 통신사 등을 자동으로 싣지 않게(withChoices)
  const ids = mine ? owned : ALL_IDS;
  const args = amountD > 0 && ids.length ? { category: cat, amount: amountD, spending: {}, choices: {}, assumePerf, ids, limit: mine ? Math.max(FETCH_LIMIT, ids.length) : FETCH_LIMIT } : null;
  const q = useEngine<{ ok: boolean; error?: string; rows: CategoryRankRow[]; total: number }>("categoryRank", args);
  const data = q.data ?? (q.isComputing ? q.lastGood : null);
  const rows = data ? (mine ? data.rows : dedupeRows(data.rows)) : [];
  const hero = heroVM(rows, cat, amountD, assumePerf, scope);
  const ranked = rowsVM(rows, cat);
  // 내 카드 중이면 담은 카드를 모두 보여 준다
  const list = ranked.slice(hero ? 1 : 0, mine ? undefined : LIST_MAX);
  // 11~30위: '더 보기'를 누르면 아래로 펼친다. 혜택이 0원인 카드는 넣지 않는다
  const more = hero && !mine ? ranked.slice(LIST_MAX, MORE_MAX).filter((r) => !r.zero) : [];
  const [showMore, setShowMore] = useState(false);
  const shown = showMore ? [...list, ...more] : list;

  // 금액 넣기 전 목록: 그 카테고리 혜택이 있는 카드(원문 정제 혜택 표 기준). 혜택 표를 받는 동안은 '불러오는 중'
  const views = useCardView();
  const browse = useMemo(
    () =>
      views
        ? (mine ? catalogCards.filter((c) => ownedSet.has(c.sourceId)) : ISSUABLE)
            .filter((c) => hasBenefit(c, cat, views.cards[String(c.sourceId)]))
            .sort((a, b) => (a.annualFee ?? 0) - (b.annualFee ?? 0))
        : [],
    [views, cat, mine, ownedSet],
  );
  const [browseLimit, setBrowseLimit] = useState(BROWSE_PAGE);
  const [detail, setDetail] = useState<CatalogListing | null>(null);
  const closeDetail = useCallback(() => setDetail(null), []);

  const setAmount = (v: number) => setAmounts((m) => ({ ...m, [cat]: v }));
  const pickScope = (s: BenefitScope) => {
    setScope(s);
    setShowMore(false);
    setBrowseLimit(BROWSE_PAGE);
  };
  const pickCat = (id: string) => {
    setCat(id);
    setShowMore(false);
    setBrowseLimit(BROWSE_PAGE);
    setDraft(toDraft(amountFor(id)));
    navigate(`${paths.benefit}?cat=${id}`, { replace: true });
  };

  return (
    <>
      <MenuBar active="benefit" />
      <PageMain title="혜택별 추천">
        <header style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "12px 20px" }}>
          <div style={{ flex: "1 1 420px", minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>혜택별 추천</h1>
            <p style={{ margin: "6px 0 0", fontSize: 15, lineHeight: 1.6, color: "#5E6D96" }}>한 카테고리만 골라 그 분야에서 가장 유리한 카드를 찾아요</p>
          </div>
        </header>

        <section aria-label="카테고리와 금액" style={{ background: "#FFFFFF", border: "1px solid transparent", boxShadow: SHADOW, borderRadius: 16, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          <div role="group" aria-label="어느 카드 중에서" style={{ alignSelf: "flex-start", display: "flex", flexWrap: "wrap", padding: 3, borderRadius: 12, background: "#F3F7FF" }}>
            {(["mine", "all"] as const).map((s) => (
              <button key={s} type="button" aria-pressed={scope === s} onClick={() => pickScope(s)} style={scope === s ? segOn : segOff}>
                {s === "mine" ? `내 카드 중 ${owned.length}` : "전체 카드 중"}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#5E6D96", marginRight: 4 }}>카테고리</span>
            {[...MAIN_CATEGORIES, ...(moreOpen ? OTHER_CATS : [])].map((id) => (
              <button key={id} type="button" aria-pressed={cat === id} onClick={() => pickCat(id)} style={cat === id ? chipOn : chipOff}>
                <PageGlyph cat={id} size={16} />
                {catLabel(id)}
              </button>
            ))}
            <button type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen((v) => !v)} style={{ height: 40, padding: "0 14px", borderRadius: 20, border: "1px dashed #B5C3E3", background: "#FFFFFF", fontFamily: "inherit", fontSize: 14, color: "#3A4A78", cursor: "pointer" }}>
              {moreOpen ? "접기" : `+ 더보기 ${OTHER_CATS.length}`}
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px 20px", paddingTop: 16, borderTop: "1px solid #EDF2FC" }}>
            <label htmlFor="b-amt" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, fontSize: 16, fontWeight: 700 }}>
              {catLabel(cat)}에 한 달
              <span className="w-field-strong" style={{ display: "flex", alignItems: "center", gap: 6, height: 52, padding: "0 16px", boxSizing: "border-box", border: "2px solid #2457F5", borderRadius: 14, background: "#FFFFFF" }}>
                <input
                  id="b-amt"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={draft}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^\d]/g, "").slice(0, 9);
                    const v = digits ? Number(digits) : 0;
                    setDraft(digits ? num(v) : "");
                    setAmount(v);
                  }}
                  style={{ width: 120, border: "none", outline: "none", background: "transparent", textAlign: "right", fontFamily: NUMF, fontVariantNumeric: "tabular-nums", fontSize: 22, fontWeight: 700, color: "#0D1B4A", padding: "1px 2px", boxSizing: "content-box" }}
                />
                <span style={{ fontSize: 16, fontWeight: 600, color: "#3A4A78" }}>원</span>
              </span>
            </label>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44, fontSize: 15, fontWeight: 600, color: "#0D1B4A", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={assumePerf}
                onChange={(e) => setAssumePerf(e.target.checked)}
                aria-describedby={assumePerf ? undefined : "b-perf-hint"}
                style={{ width: 20, height: 20, margin: 0, accentColor: "#2457F5", cursor: "pointer" }}
              />
              실적 채웠다고 가정
            </label>
          </div>
          {!assumePerf && (
            <p id="b-perf-hint" style={{ margin: "-6px 0 0", fontSize: 13, lineHeight: 1.6, color: "#5E6D96" }}>
              실적도 이 카테고리에 쓰는 {num(amount)}원만으로 계산해요. 실적 조건이 더 높은 카드는 혜택이 0원이 돼요.
            </p>
          )}
        </section>

        {mine && owned.length === 0 ? (
          <Notice text="담아 둔 내 카드가 없어요. 전체 카드나 지갑 만들기에서 카드를 담으면 그 카드들 중에서 찾아 드려요." action={{ label: "전체 카드 중에서 찾기", onClick: () => pickScope("all") }} />
        ) : amountD <= 0 ? (
          <section aria-labelledby="b-all" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <h2 id="b-all" style={{ margin: 0, padding: "0 4px", fontSize: 18, fontWeight: 700 }}>
              {catLabel(cat)} 혜택이 있는 카드
            </h2>
            {!views ? (
              <Notice text="카드를 불러오고 있어요" busy />
            ) : browse.length === 0 ? (
              <Notice text={mine ? `담은 카드 ${owned.length}장 중 ${catLabel(cat)} 혜택을 주는 카드가 없어요.` : `${catLabel(cat)} 혜택을 주는 카드가 없어요.`} action={mine ? { label: "전체 카드 중에서 찾기", onClick: () => pickScope("all") } : undefined} />
            ) : (
              <CardGrid>
                {browse.slice(0, browseLimit).map((c) => (
                  <CardTile key={c.sourceId} card={c} view={views.cards[String(c.sourceId)]} focusCat={cat} hideBenefitBtn onOpen={() => setDetail(c)} />
                ))}
              </CardGrid>
            )}
            {browse.length > browseLimit && (
              <button type="button" onClick={() => setBrowseLimit((l) => l + BROWSE_PAGE * 2)} className={MORE_BTN} style={{ fontFamily: "inherit" }}>
                더 보기
              </button>
            )}
          </section>
        ) : q.error && !data ? (
          <Notice text={`계산하지 못했어요 · ${q.error}`} />
        ) : !data ? (
          <Notice text={`${catLabel(cat)} 혜택을 계산하고 있어요`} busy />
        ) : (
          <div aria-busy={q.isComputing} style={{ display: "flex", flexDirection: "column", gap: 28, opacity: q.isComputing ? 0.55 : 1, transition: "opacity 0.15s" }}>
            {hero ? (
              <section aria-labelledby="b-top" style={{ background: "#FFFFFF", boxShadow: SHADOW, borderRadius: 24, border: "2px solid #2457F5", padding: "28px clamp(18px, 2.6vw, 32px)", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "20px 28px" }}>
                <CardImage sid={hero.sid} width={compact ? 112 : 176} />
                <div style={{ flex: "1 1 320px", minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", height: 28, padding: "0 12px", borderRadius: 14, background: "#2457F5", fontSize: 13, fontWeight: 700, color: "#FFFFFF" }}>{hero.badge}</span>
                  <h2 id="b-top" style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 700 }}>
                    {hero.name}
                  </h2>
                  <div style={{ fontSize: 15, color: "#3A4A78" }}>{hero.note}</div>
                  <p style={{ margin: "4px 0 0", fontSize: 14, lineHeight: 1.6, color: "#5E6D96" }}>{hero.lead}</p>
                </div>
                <div style={{ flexShrink: 0, textAlign: "right" }}>
                  <div style={{ fontSize: 14, color: "#5E6D96" }}>월 혜택</div>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "flex-end", gap: 4 }}>
                    {hero.approx && <span style={{ fontSize: 20, fontWeight: 700 }}>약</span>}
                    <span style={{ fontFamily: "Outfit, sans-serif", fontSize: 52, fontWeight: 700, lineHeight: 1.1, color: "#1747D6" }}>{hero.amountNum}</span>
                    <span style={{ fontSize: 20, fontWeight: 700 }}>원</span>
                  </div>
                </div>
              </section>
            ) : (
              <Notice
                text={
                  assumePerf
                    ? mine
                      ? `담은 카드 ${owned.length}장 중 ${catLabel(cat)} 혜택을 주는 카드가 없어요.`
                      : `${catLabel(cat)} 혜택을 주는 카드가 없어요.`
                    : `실적 ${num(amountD)}원으로는 ${catLabel(cat)} 혜택을 받는 카드가 없어요. '실적 채웠다고 가정'을 켜면 실적 조건이 있는 카드도 볼 수 있어요.`
                }
                action={assumePerf ? undefined : { label: "실적 채웠다고 가정하기", onClick: () => setAssumePerf(true) }}
              />
            )}

            {/* 1위가 없으면(모두 0원) 순위를 매기지 않는다 */}
            {list.length > 0 && hero && (
              <section aria-labelledby="b-rest" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <h2 id="b-rest" style={{ margin: 0, padding: "0 4px", fontSize: 18, fontWeight: 700 }}>
                  {mine ? "다른 내 카드는 이만큼 받아요" : `다음으로 많이 받는 카드 ${shown.length}장`}
                </h2>
                <ul id="b-rest-list" style={{ margin: 0, padding: 0, listStyle: "none", background: "#FFFFFF", border: "1px solid transparent", boxShadow: SHADOW, borderRadius: 16, overflow: "hidden" }}>
                  {shown.map((r, i) => (
                    <li key={r.sid} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px 18px", padding: "18px 20px", borderBottom: i < shown.length - 1 ? "1px solid #EDF2FC" : undefined }}>
                      <span style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 16, background: "#F3F7FF", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Outfit, sans-serif", fontSize: 15, fontWeight: 700, color: "#3A4A78" }}>{r.rank}</span>
                      <CardImage sid={r.sid} width={compact ? 64 : 80} />
                      <div style={{ flex: "1 1 260px", minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                        <div>
                          <span style={{ fontSize: 16, fontWeight: 700 }}>{r.name}</span>
                          {!mine && ownedSet.has(r.sid) && <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 10, background: "#E8EEFF", fontSize: 12, fontWeight: 700, color: "#1747D6" }}>내 카드</span>}
                          <span style={{ display: "block", marginTop: 2, fontSize: 14, color: "#5E6D96" }}>{r.note}</span>
                        </div>
                        <div aria-hidden="true" style={{ height: 8, borderRadius: 999, background: "#EDF2FC" }}>
                          <div style={{ width: `${r.pct}%`, height: 8, borderRadius: 999, background: "#2457F5" }} />
                        </div>
                      </div>
                      <span style={{ flexShrink: 0, minWidth: 120, textAlign: "right", fontSize: 18, fontWeight: 700, fontFamily: NUMF, fontVariantNumeric: "tabular-nums", color: r.zero ? "#5E6D96" : "#0D1B4A" }}>{r.amountText}</span>
                    </li>
                  ))}
                </ul>
                {more.length > 0 && (
                  <button type="button" aria-expanded={showMore} aria-controls="b-rest-list" onClick={() => setShowMore((v) => !v)} className={MORE_BTN} style={{ fontFamily: "inherit" }}>
                    {showMore ? "접기" : "더 보기"}
                    <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 18, height: 18, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", transform: showMore ? "rotate(180deg)" : undefined }}>
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                )}
              </section>
            )}
          </div>
        )}

      </PageMain>
      {detail && <CardDetailSheet entry={detail} view={views?.cards[String(detail.sourceId)]} loading={!views} mine={ownedSet.has(detail.sourceId)} discontinued={isDiscontinued(detail)} onClose={closeDetail} />}
    </>
  );
}

function Notice({ text, to, label, busy, action }: { text: string; to?: string; label?: string; busy?: boolean; action?: { label: string; onClick: () => void } }) {
  return (
    <section aria-busy={busy} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px 20px", padding: "22px 24px", borderRadius: 20, background: "#FFFFFF", border: "1px solid transparent", boxShadow: SHADOW }}>
      <span role={busy ? "status" : undefined} style={{ fontSize: 15, color: "#3A4A78" }}>
        {text}
      </span>
      {to && label && (
        <Link to={to} style={{ display: "flex", alignItems: "center", height: 44, padding: "0 18px", boxSizing: "border-box", borderRadius: 22, border: "1px solid #D3DDF2", background: "#FFFFFF", color: "#0D1B4A", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
          {label}
        </Link>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          style={{ display: "flex", alignItems: "center", height: 44, padding: "0 18px", boxSizing: "border-box", borderRadius: 22, border: "1px solid #2457F5", background: "#2457F5", color: "#FFFFFF", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
        >
          {action.label}
        </button>
      )}
    </section>
  );
}
