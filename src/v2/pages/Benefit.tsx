import { useMemo, useState, type CSSProperties } from "react";
import type { CategoryRankRow } from "@/domain/engine/walletEngine";
import { useMonthlySpend } from "@/domain/state/useMonthlySpend";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { catLabel, categories, issuableCards, MAIN_CATEGORIES } from "@/v1/catalog";
import { num } from "@/v1/format";
import { useAppData } from "@/v2/app/AppData";
import { useEngine } from "@/v2/app/engine";
import { paths } from "@/v2/app/paths";
import { Link, navigate, useRoute } from "@/v2/app/router";
import { useBrandPicks } from "@/v2/app/state";
import { dedupeRows, comboText, heroVM, rowsVM, type BenefitScope } from "@/v2/model/benefitView";
import { picksToBrandShare } from "@/v2/model/brands";
import { shortOf } from "@/v2/model/resultView";
import { SHADOW } from "@/v2/result/parts";
import { CardImage } from "@/v2/ui/CardImage";
import { PageGlyph } from "@/v2/ui/icons";
import { PageMain } from "@/v2/ui/Page";
import { MenuBar } from "@/v2/ui/TopBar";

/**
 * 혜택별 추천(디자인 F-D-Benefit, 2026-10-29 v2).
 * 카테고리 하나와 금액을 고르면 카드마다 그 카테고리에서 받는 월 혜택을 계산해 줄 세운다.
 * 실적은 지출 입력 전체(그 카테고리만 입력한 금액으로 바꿈)를 그 카드로 낸다고 보고 계산한다(엔진 categoryRank).
 */

const ALL_IDS = issuableCards().map((c) => c.sourceId);
const ALL_COUNT = issuableCards({ includeUnverified: true }).length;
const OTHER_CATS = categories.map((c) => c.id).filter((id) => !MAIN_CATEGORIES.includes(id));
const DEFAULT_AMOUNT = 100000;
const LIST_MAX = 10;

const chipOn: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, height: 40, padding: "0 14px", borderRadius: 20, border: "1px solid #2457F5", background: "#2457F5", color: "#FFFFFF", fontWeight: 700, fontFamily: "inherit", fontSize: 14, cursor: "pointer", whiteSpace: "nowrap" };
const chipOff: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, height: 40, padding: "0 14px", borderRadius: 20, border: "1px solid #D3DDF2", background: "#FFFFFF", color: "#3A4A78", fontFamily: "inherit", fontSize: 14, cursor: "pointer", whiteSpace: "nowrap" };
const segOn: CSSProperties = { height: 40, padding: "0 16px", borderRadius: 9, border: "none", background: "#FFFFFF", boxShadow: "0 1px 3px rgba(13, 40, 120, 0.12)", fontFamily: "inherit", fontSize: 14, fontWeight: 700, color: "#0D1B4A", cursor: "pointer", whiteSpace: "nowrap" };
const segOff: CSSProperties = { height: 40, padding: "0 16px", borderRadius: 9, border: "none", background: "transparent", fontFamily: "inherit", fontSize: 14, color: "#3A4A78", cursor: "pointer", whiteSpace: "nowrap" };
const NUMF = "Outfit, 'IBM Plex Sans KR', sans-serif";

export default function Benefit() {
  const route = useRoute();
  const { myCards, wallet, lastRun } = useAppData();
  const { spending } = useMonthlySpend(categories);
  const [picks] = useBrandPicks();
  const qCat = route.query.get("cat");
  const [cat, setCat] = useState<string>(qCat && categories.some((c) => c.id === qCat) ? qCat : "convenience");
  const [moreOpen, setMoreOpen] = useState(OTHER_CATS.includes(cat));
  const owned = myCards.ids;
  const [scope, setScope] = useState<BenefitScope>(owned.length ? "mine" : "all");
  // 카테고리마다 입력한 금액(처음에는 지출 입력 값). 지출 입력 자체는 바꾸지 않는다
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const amountFor = (id: string) => amounts[id] ?? (spending[id] > 0 ? spending[id] : DEFAULT_AMOUNT);
  const amount = amountFor(cat);
  // 입력칸 글자(쉼표 포함). 카테고리를 바꾸면 그 카테고리 금액으로 다시 채운다
  const [draft, setDraft] = useState<string>(num(amount));
  const amountD = useDebounce(amount, 350);

  const spend = useMemo(() => Object.fromEntries(Object.entries(spending).filter(([, v]) => v > 0)), [spending]);
  const base = useMemo(() => ({ ...spend, [cat]: amountD }), [spend, cat, amountD]);
  const total = Object.values(base).reduce((s, v) => s + v, 0);
  const brandShare = useMemo(() => picksToBrandShare(base, picks), [base, picks]);
  const ids = scope === "mine" ? owned : ALL_IDS;
  const args = ids.length && amountD > 0 ? { category: cat, amount: amountD, spending: spend, brandShare, ids, limit: scope === "mine" ? Math.max(20, ids.length) : 30 } : null;
  const q = useEngine<{ ok: boolean; error?: string; rows: CategoryRankRow[]; total: number }>("categoryRank", args);
  const data = q.data ?? (q.isComputing ? q.lastGood : null);
  const rows = useMemo(() => (data ? (scope === "all" ? dedupeRows(data.rows) : data.rows) : []), [data, scope]);
  const picked = Object.values(brandShare[cat] ?? {}).some((v) => v > 0);
  const hero = heroVM(rows, cat, amountD, total, scope, picked);
  const list = rowsVM(rows, cat, picked).slice(hero ? 1 : 0, scope === "mine" ? undefined : LIST_MAX);

  // 지갑 전체 추천: 이번에 계산한 결과가 있으면 그것, 없으면 저장한 지갑
  const combo = lastRun?.rec?.result?.cards?.length
    ? { names: lastRun.rec.result.cards.map((c) => shortOf(c)), net: lastRun.rec.result.net, to: paths.make(lastRun.flow, "result", lastRun.source === "statement" ? { from: "statement" } : undefined) }
    : wallet?.pack?.cards?.length
      ? { names: wallet.pack.cards.map((c) => shortOf(c)), net: wallet.pack.net, to: paths.wallet }
      : null;
  const band = comboText(hero?.nick ?? null, cat, combo);

  const setAmount = (v: number) => setAmounts((m) => ({ ...m, [cat]: v }));
  const pickCat = (id: string) => {
    setCat(id);
    setDraft(num(amountFor(id)));
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
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#5E6D96", marginRight: 4 }}>카테고리</span>
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
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px 20px", paddingTop: 16, borderTop: "1px solid #EDF2FC" }}>
            <label htmlFor="b-amt" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, fontSize: 16, fontWeight: 700 }}>
              {catLabel(cat)}에 한 달
              <span className="w-field-strong" style={{ display: "flex", alignItems: "center", gap: 6, height: 52, padding: "0 16px", boxSizing: "border-box", border: "2px solid #2457F5", borderRadius: 14, background: "#FFFFFF" }}>
                <input
                  id="b-amt"
                  type="text"
                  inputMode="numeric"
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
            <div role="group" aria-label="비교할 카드" style={{ display: "flex", flexWrap: "wrap", padding: 3, borderRadius: 12, background: "#F3F7FF" }}>
              <button type="button" aria-pressed={scope === "mine"} onClick={() => setScope("mine")} style={scope === "mine" ? segOn : segOff}>
                내 카드 {owned.length}장
              </button>
              <button type="button" aria-pressed={scope === "all"} onClick={() => setScope("all")} style={scope === "all" ? segOn : segOff}>
                발급 가능한 전체 카드
              </button>
            </div>
          </div>
        </section>

        {scope === "mine" && owned.length === 0 ? (
          <Notice text="담은 카드가 없어요. 카드 선택에서 가진 카드를 담거나 '발급 가능한 전체 카드'로 찾아보세요." to={paths.make("own", "cards")} label="카드 선택으로" />
        ) : amountD <= 0 ? (
          <Notice text={`${catLabel(cat)}에 한 달 쓰는 금액을 넣으면 계산해요.`} />
        ) : q.error && !data ? (
          <Notice text={`계산하지 못했어요 · ${q.error}`} />
        ) : !data ? (
          <Notice text={`${catLabel(cat)} 혜택을 계산하고 있어요`} busy />
        ) : (
          <div aria-busy={q.isComputing} style={{ display: "flex", flexDirection: "column", gap: 28, opacity: q.isComputing ? 0.55 : 1, transition: "opacity 0.15s" }}>
            {hero ? (
              <section aria-labelledby="b-top" style={{ background: "#FFFFFF", boxShadow: SHADOW, borderRadius: 24, border: "2px solid #2457F5", padding: "28px clamp(18px, 2.6vw, 32px)", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "20px 28px" }}>
                <CardImage sid={hero.sid} width={176} />
                <div style={{ flex: "1 1 320px", minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", height: 28, padding: "0 12px", borderRadius: 14, background: "#2457F5", fontSize: 13, fontWeight: 700, color: "#FFFFFF" }}>{hero.badge}</span>
                  <h2 id="b-top" style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 700 }}>
                    {hero.name}
                    {scope === "all" && owned.includes(hero.sid) && <MineTag />}
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
                text={scope === "mine" ? `담은 카드 ${owned.length}장 중 ${catLabel(cat)} 혜택을 주는 카드가 없어요. 발급 가능한 카드에서 찾아볼 수 있어요.` : `발급 가능한 카드 중 ${catLabel(cat)} 혜택을 주는 카드가 없어요.`}
                action={scope === "mine" ? { label: "발급 가능한 전체 카드 보기", onClick: () => setScope("all") } : undefined}
              />
            )}

            {/* 내 카드가 모두 0원이면 순위를 매기지 않는다(2026-10-29) */}
            {list.length > 0 && (hero || scope === "all") && (
              <section aria-labelledby="b-rest" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <h2 id="b-rest" style={{ margin: 0, padding: "0 4px", fontSize: 18, fontWeight: 700 }}>
                  {scope === "mine" ? "다른 내 카드는 이만큼 받아요" : `다음으로 많이 받는 카드 ${list.length}장`}
                </h2>
                <ul style={{ margin: 0, padding: 0, listStyle: "none", background: "#FFFFFF", border: "1px solid transparent", boxShadow: SHADOW, borderRadius: 16, overflow: "hidden" }}>
                  {list.map((r, i) => (
                    <li key={r.sid} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px 18px", padding: "18px 20px", borderBottom: i < list.length - 1 ? "1px solid #EDF2FC" : undefined }}>
                      <span style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 16, background: "#F3F7FF", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Outfit, sans-serif", fontSize: 15, fontWeight: 700, color: "#3A4A78" }}>{r.rank}</span>
                      <CardImage sid={r.sid} width={80} />
                      <div style={{ flex: "1 1 260px", minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                        <div>
                          <span style={{ fontSize: 16, fontWeight: 700 }}>{r.name}</span>
                          {scope === "all" && owned.includes(r.sid) && <MineTag />}
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
              </section>
            )}
          </div>
        )}

        <section style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "14px 24px", padding: "22px 24px", borderRadius: 20, background: "#E8EEFF", border: "1px solid #C9D6F5" }}>
          <div style={{ flex: "1 1 420px", minWidth: 0, fontSize: 16, lineHeight: 1.6, color: "#0D1B4A" }}>
            {band.lead}
            {band.strong1 && <b>{band.strong1}</b>}
            {band.mid}
            {band.strong2 && <b>{band.strong2}</b>}
            {band.tail}
          </div>
          <Link
            to={combo?.to ?? paths.start(owned.length ? "own" : "new")}
            style={{ display: "flex", alignItems: "center", height: 48, padding: "0 20px", boxSizing: "border-box", borderRadius: 24, background: "#2457F5", color: "#FFFFFF", border: "1px solid #2457F5", fontSize: 15, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}
          >
            {combo ? "추천 조합 보기" : "지갑 만들기"}
          </Link>
        </section>
        <p style={{ margin: 0, padding: "0 4px", fontSize: 13, lineHeight: 1.6, color: "#5E6D96" }}>
          '발급 가능한 전체 카드'는 혜택 표를 카드사 원문과 대조한 {num(ALL_IDS.length)}장으로 계산해요. 판매 중인 카드 {num(ALL_COUNT)}장의 혜택 표가 준비되면 늘어나요.
        </p>
      </PageMain>
    </>
  );
}

/** '발급 가능한 전체 카드'에서 내가 가진 카드 표시 */
function MineTag() {
  return <span style={{ display: "inline-flex", alignItems: "center", height: 22, marginLeft: 8, padding: "0 8px", borderRadius: 11, background: "#E8EEFF", fontSize: 12, fontWeight: 700, color: "#1747D6", verticalAlign: "3px" }}>내 카드</span>;
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
