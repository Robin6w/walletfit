import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { RankRow } from "@/domain/types/engine";
import { useMonthlySpend } from "@/domain/state/useMonthlySpend";
import { catalogBySourceId, categories } from "@/v1/catalog";
import { useAppData } from "@/v2/app/AppData";
import { compareStore, COMPARE_MAX, useCompare } from "@/v2/app/compareStore";
import { useEngine } from "@/v2/app/engine";
import { paths } from "@/v2/app/paths";
import { Link, navigate, useRoute } from "@/v2/app/router";
import { useBrandPicks } from "@/v2/app/state";
import { chatStore } from "@/v2/chat/chatStore";
import { conditionsStore } from "@/v2/make/flow";
import { picksToBrandShare } from "@/v2/model/brands";
import {
  actionVM,
  basisText,
  headVM,
  insightsVM,
  nameOf,
  sameText,
  sumNote,
  sumVM,
  tableVM,
  tightCard,
  type CardMeta,
  type CellVM,
  type CmpCardInput,
  type CmpCtx,
  type InsightVM,
  type RowVM,
} from "@/v2/model/compareView";
import { CATALOG_DATE_TEXT, shortOf } from "@/v2/model/resultView";
import { josa, korAmount } from "@/v2/model/text";
import { NUM, SHADOW } from "@/v2/result/parts";
import { CardImage } from "@/v2/ui/CardImage";
import { PageIconBox } from "@/v2/ui/icons";
import { PageMain } from "@/v2/ui/Page";
import { MenuBar } from "@/v2/ui/TopBar";
import cardMetaFile from "@data/catalog/card-meta.json";

/**
 * 카드 비교(디자인 F-D-Compare, 2026-10-29 v2).
 * 비교함(최대 3장)의 카드를 카드 한 장으로 지출 전부를 냈을 때 기준으로 나란히 놓는다.
 * 카드 사진을 빼면 디자인 원본의 크기·색·글꼴을 그대로 옮겼다.
 */

const CARD_META = (cardMetaFile as { fetchedAt: string; cards: Record<string, CardMeta> }).cards;
/** 출시일·유지 기간(card-meta.json)을 모은 날. 혜택 정보 수집일(CATALOG_DATE_TEXT, 결과 화면과 같은 값)과 따로 적는다 */
const META_DATE = (() => {
  const d = new Date((cardMetaFile as { fetchedAt: string }).fetchedAt);
  return Number.isNaN(d.getTime()) ? "" : `${d.getMonth() + 1}월 ${d.getDate()}일`;
})();

const svgProps = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
const Check = ({ size }: { size: number }) => (
  <svg width={size} height={size} {...svgProps}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
const Plus = () => (
  <svg width={17} height={17} {...svgProps}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </svg>
);

function CmpIcon({ cat }: { cat: string }) {
  return <PageIconBox cat={cat === "all" ? "etc" : cat === "misc" ? "other" : cat} />;
}

/* ---------- 디자인 스타일 ---------- */

const cardBox: CSSProperties = { background: "#FFFFFF", border: "1px solid transparent", borderRadius: 20, boxShadow: SHADOW };
const pillLink: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, height: 46, padding: "0 18px", boxSizing: "border-box", borderRadius: 23, background: "#FFFFFF", color: "#0D1B4A", border: "1px solid #D3DDF2", fontSize: 15, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" };
const chipStyle: CSSProperties = { padding: "3px 10px", borderRadius: 999, background: "#F3F7FF", border: "1px solid #E3EAF8", fontSize: 13, color: "#3A4A78" };
const sideNote: CSSProperties = { flex: "1 1 200px", minWidth: 0, fontSize: 13, lineHeight: 1.5, color: "#5E6D96" };
const groupHead: CSSProperties = { padding: "14px 20px 10px", borderTop: "1px solid #EDF2FC", background: "#F7FAFF", fontSize: 13, fontWeight: 700, letterSpacing: "0.02em", color: "#5E6D96" };
const rowStyle: CSSProperties = { padding: "16px 20px", borderTop: "1px solid #EDF2FC" };
const mainText: CSSProperties = { display: "block", fontSize: 15, lineHeight: 1.55, color: "#0D1B4A" };
const subText: CSSProperties = { display: "block", marginTop: 2, fontSize: 13, lineHeight: 1.55, color: "#5E6D96" };

function addStyle(added: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 46,
    padding: "0 18px",
    boxSizing: "border-box",
    borderRadius: 23,
    fontFamily: "inherit",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
    ...(added ? { border: "1px solid #C9D6F5", background: "#E8EEFF", color: "#2457F5" } : { border: "1px solid #2457F5", background: "#2457F5", color: "#FFFFFF" }),
  };
}

const INSIGHT_TONE: Record<InsightVM["tone"], { bg: string; fg: string; icon: ReactNode }> = {
  info: {
    bg: "#F3F7FF",
    fg: "#2457F5",
    icon: (
      <svg width={17} height={17} {...svgProps}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5" />
        <path d="M12 8h.01" />
      </svg>
    ),
  },
  warn: {
    bg: "#FFF6EE",
    fg: "#A3420B",
    icon: (
      <svg width={17} height={17} {...svgProps}>
        <path d="M12 3 2 20h20z" />
        <path d="M12 10v4" />
        <path d="M12 17h.01" />
      </svg>
    ),
  },
  calendar: {
    bg: "#F3F7FF",
    fg: "#1747D6",
    icon: (
      <svg width={17} height={17} {...svgProps}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18" />
        <path d="M8 3v4M16 3v4" />
      </svg>
    ),
  },
};

function parseIds(raw: string | null): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && catalogBySourceId.has(n));
}

export default function Compare() {
  const route = useRoute();
  const stored = useCompare();
  const fromUrl = parseIds(route.query.get("ids"));
  const ids = (fromUrl.length ? fromUrl : stored.filter((s) => catalogBySourceId.has(s))).slice(0, COMPARE_MAX);
  const { myCards, wallet } = useAppData();
  const { spending } = useMonthlySpend(categories);
  const [picks] = useBrandPicks();
  const [diffOnly, setDiffOnly] = useState(false);

  const spend = useMemo(() => Object.fromEntries(Object.entries(spending).filter(([, v]) => v > 0)), [spending]);
  const total = Object.values(spend).reduce((s, v) => s + v, 0);
  const brandShare = useMemo(() => picksToBrandShare(spend, picks), [spend, picks]);
  const rank = useEngine<{ ok: boolean; error?: string; rows: RankRow[] }>("rank", ids.length >= 2 && total > 0 ? { ids, spending: spend, brandShare, detail: true } : null);

  const inputs: CmpCardInput[] = ids.map((sid) => ({
    sid,
    entry: catalogBySourceId.get(sid),
    view: rank.data?.rows.find((r) => r.sid === sid)?.view ?? null,
    meta: CARD_META[String(sid)],
  }));

  // 실적 구간 경계에 걸린 카드: 실적 기준 아래로 내려갔을 때 금액을 한 번 더 계산한다
  const tight = tightCard(inputs);
  const lowArgs = tight ? { ids: [tight.sid], spending: Object.fromEntries(Object.entries(spend).map(([k, v]) => [k, Math.floor(v * tight.scale)])), brandShare } : null;
  const low = useEngine<{ ok: boolean; error?: string; rows: RankRow[] }>("rank", lowArgs);
  const tightView = tight ? inputs.find((x) => x.sid === tight.sid)?.view : null;
  const lowRow = low.data?.rows[0];
  const lowTotal = tight && lowRow && lowRow.tier !== tightView?.perf.tier ? lowRow.total : null;

  const ctx: CmpCtx = {
    spending: spend,
    brandShare,
    ownedIds: myCards.ids,
    wallet: wallet?.pack?.cards?.length
      ? {
          sids: wallet.pack.cards.map((c) => c.sid),
          alloc: Object.fromEntries(wallet.pack.cards.map((c) => [c.sid, c.alloc])),
          names: wallet.pack.cards.map((c) => shortOf(c)),
          net: wallet.pack.net,
        }
      : null,
    today: new Date(),
  };

  const n = inputs.length;
  const hasSpend = total > 0;
  const computed = inputs.some((x) => x.view);
  const heads = inputs.map((x) => headVM(x, ctx));
  const sums = computed ? sumVM(inputs) : [];
  const insights = computed ? insightsVM(inputs, tight ? { sid: tight.sid, lowTotal } : null) : [];
  const action = actionVM(inputs, ctx);
  const sections = tableVM(inputs, ctx);
  const brandsPicked = Object.keys(brandShare).length > 0;

  const rebuild = () => {
    if (action.target) {
      conditionsStore.set({ pinned: [action.target.sid] });
      navigate(paths.start("new"));
    } else navigate(paths.start("own"));
  };
  const askChat = () => {
    const names = heads.map((h) => h.nick);
    const list = names.length === 2 ? `${josa(names[0], "과/와")} ${names[1]}` : names.join(", ");
    chatStore.ask(`${list} 중 내 지출에는 어떤 카드가 더 나아?`);
  };

  return (
    <>
      <MenuBar active="cards" />
      <PageMain title="카드 비교">
        <header style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "14px 20px" }}>
          <div style={{ flex: "1 1 420px", minWidth: 0 }}>
            <Link to={paths.cards} style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 32, fontSize: 14, fontWeight: 600, color: "#3A4A78", textDecoration: "none" }}>
              <svg width={16} height={16} {...svgProps}>
                <path d="M19 12H5" />
                <path d="m11 18-6-6 6-6" />
              </svg>
              전체 카드
            </Link>
            <h1 style={{ margin: "6px 0 0", fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>카드 비교</h1>
            <p style={{ margin: "6px 0 0", fontSize: 15, lineHeight: 1.6, color: "#5E6D96" }}>
              {n < 2
                ? "전체 카드에서 비교할 카드를 2장 이상 담으면 나란히 놓아 드려요."
                : `비교함에 담은 ${n}장을 나란히 놓았어요. ${
                    hasSpend ? `금액은 지출 입력(월 ${korAmount(total)}원)${brandsPicked ? "과 자주 가는 곳을" : "을"} 기준으로 계산했어요.` : "지출을 입력하면 내 지출로 받는 금액까지 비교해 드려요."
                  }`}
            </p>
          </div>
          {n >= 2 && (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
              <button
                type="button"
                onClick={() => setDiffOnly((v) => !v)}
                aria-pressed={diffOnly}
                style={{ display: "inline-flex", alignItems: "center", gap: 10, height: 46, padding: "0 16px", boxSizing: "border-box", borderRadius: 23, border: "1px solid #D3DDF2", background: "#FFFFFF", fontFamily: "inherit", fontSize: 15, fontWeight: 600, color: "#0D1B4A", cursor: "pointer", whiteSpace: "nowrap" }}
              >
                <span aria-hidden="true" style={{ position: "relative", flexShrink: 0, width: 40, height: 24, borderRadius: 12, transition: "background 0.15s", background: diffOnly ? "#2457F5" : "#C3CEE6" }}>
                  <span style={{ position: "absolute", top: 3, width: 18, height: 18, borderRadius: 9, background: "#FFFFFF", boxShadow: "0 1px 2px rgba(13, 40, 120, 0.25)", transition: "left 0.15s", left: diffOnly ? 19 : 3 }} />
                </span>
                다른 점만 보기
              </button>
              <Link to={paths.cards} style={pillLink}>
                <Plus />
                {n < COMPARE_MAX ? `카드 더 담기 · 최대 ${COMPARE_MAX}장` : "다른 카드로 바꾸기"}
              </Link>
            </div>
          )}
        </header>

        {n < 2 ? (
          <EmptyCompare ids={ids} />
        ) : (
          <>
            <section aria-label="비교하는 카드" style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(min(${n > 2 ? 320 : 420}px, 100%), 1fr))`, gap: 16 }}>
              {heads.map((h) => (
                <article key={h.sid} style={{ ...cardBox, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "16px 20px" }}>
                    <CardImage sid={h.sid} width={168} />
                    <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                      <span
                        style={
                          h.badge.mine
                            ? { display: "inline-flex", alignItems: "center", height: 26, padding: "0 10px", borderRadius: 13, background: "#E8EEFF", fontSize: 12, fontWeight: 700, color: "#1747D6" }
                            : { display: "inline-flex", alignItems: "center", height: 26, padding: "0 10px", boxSizing: "content-box", borderRadius: 13, background: "#F3F7FF", border: "1px solid #E3EAF8", fontSize: 12, fontWeight: 700, color: "#3A4A78" }
                        }
                      >
                        {h.badge.text}
                      </span>
                      <h2 style={{ margin: "8px 0 0", fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em" }}>{h.name}</h2>
                      <div style={{ marginTop: 2, fontSize: 14, color: "#5E6D96" }}>{h.meta}</div>
                    </div>
                  </div>
                  {h.chips.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {h.chips.map((c) => (
                        <span key={c} style={chipStyle}>
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ marginTop: "auto", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 14px" }}>
                    {h.inWallet ? (
                      <Link to={paths.wallet} style={pillLink}>
                        내 지갑에서 보기
                      </Link>
                    ) : (
                      <button type="button" onClick={() => myCards.toggle(h.sid)} aria-pressed={h.owned} style={addStyle(h.owned)}>
                        {h.owned ? <Check size={17} /> : <Plus />}
                        {h.owned ? "내 카드에 담았어요" : "내 카드에 담기"}
                      </button>
                    )}
                    <span style={sideNote}>{h.inWallet ? h.roleText : h.owned ? "'보유한 카드로 추천받기'에서 함께 계산해요" : "담으면 '보유한 카드로 추천받기'에서 함께 계산해요"}</span>
                  </div>
                </article>
              ))}
            </section>

            <section aria-labelledby="c-sum" style={{ ...cardBox, borderRadius: 24, padding: "28px clamp(18px, 2.6vw, 32px)", display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <h2 id="c-sum" style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em" }}>
                  내 지출로 계산하면
                </h2>
                <p style={{ margin: "4px 0 0", fontSize: 14, lineHeight: 1.6, color: "#5E6D96" }}>
                  {!hasSpend
                    ? "지출을 입력하면 카드마다 내 지출로 받는 금액을 계산해요"
                    : rank.error
                      ? `계산하지 못했어요 · ${rank.error}`
                      : computed
                        ? sumNote(inputs, total)
                        : "내 지출로 계산하고 있어요"}
                </p>
              </div>
              {!hasSpend ? (
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                  <Link to={paths.make("own", "spend")} style={{ ...pillLink, height: 48, borderRadius: 24, background: "#2457F5", color: "#FFFFFF", border: "1px solid #2457F5" }}>
                    지출 입력하기
                  </Link>
                </div>
              ) : (
                <>
                  <div aria-busy={rank.isComputing} style={{ display: "flex", flexWrap: "wrap", gap: 14, opacity: computed ? 1 : 0.5 }}>
                    {(computed ? sums : inputs.map((x) => ({ sid: x.sid, name: nameOf(x), total: 0, net: 0, pct: 0, winner: false, more: null, feeLine: { lead: "", value: "" } }))).map((s) => (
                      <div key={s.sid} style={{ flex: "1 1 280px", minWidth: 0, padding: 20, borderRadius: 16, background: "#F3F7FF", display: "flex", flexDirection: "column", gap: 10, boxSizing: "content-box" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 16, fontWeight: 700 }}>
                            <CardImage sid={s.sid} width={48} shadow={false} />
                            {s.name}
                          </span>
                          {s.more && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 24, padding: "0 10px", borderRadius: 12, background: "#2457F5", fontSize: 12, fontWeight: 700, color: "#FFFFFF" }}>
                              <Check size={13} />
                              {s.more}
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                          <span style={{ fontSize: 15, fontWeight: 600, color: "#3A4A78" }}>월</span>
                          <span style={{ fontFamily: "Outfit, sans-serif", fontSize: 48, fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.01em", color: s.winner ? "#1747D6" : "#0D1B4A" }}>{computed ? s.total.toLocaleString("ko-KR") : "—"}</span>
                          <span style={{ fontSize: 20, fontWeight: 700 }}>원</span>
                        </div>
                        <div aria-hidden="true" style={{ height: 8, borderRadius: 999, background: "#E3EAF8" }}>
                          <div style={{ width: `${s.pct}%`, height: 8, borderRadius: 999, background: s.winner ? "#2457F5" : "#8FA6D9" }} />
                        </div>
                        {computed && (
                          <div style={{ fontSize: 14, color: "#3A4A78" }}>
                            {s.feeLine.lead}
                            <b style={{ color: "#0D1B4A", ...NUM }}>{s.feeLine.value}</b>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {insights.length > 0 && (
                    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: 10 }}>
                      {insights.map((it) => {
                        const tone = INSIGHT_TONE[it.tone];
                        return (
                          <li key={it.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", borderRadius: 14, background: tone.bg }}>
                            <span aria-hidden="true" style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 10, background: "#FFFFFF", color: tone.fg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {tone.icon}
                            </span>
                            <span style={{ minWidth: 0 }}>
                              <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: "#0D1B4A" }}>{it.title}</span>
                              <span style={{ display: "block", marginTop: 2, fontSize: 14, lineHeight: 1.6, color: "#3A4A78" }}>{it.text}</span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  onClick={rebuild}
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 48, padding: "0 18px", boxSizing: "border-box", borderRadius: 24, background: "#2457F5", color: "#FFFFFF", border: "1px solid #2457F5", fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  <svg width={17} height={17} {...svgProps}>
                    <path d="M5 12h14" />
                    <path d="m13 6 6 6-6 6" />
                  </svg>
                  {action.label}
                </button>
                <button
                  type="button"
                  onClick={askChat}
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 48, padding: "0 18px", boxSizing: "border-box", borderRadius: 24, border: "1px solid #D3DDF2", background: "#FFFFFF", fontFamily: "inherit", fontSize: 15, fontWeight: 700, color: "#0D1B4A", cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#2457F5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
                  </svg>
                  이 비교 물어보기
                </button>
                <span style={{ flex: "1 1 240px", minWidth: 0, fontSize: 13, lineHeight: 1.6, color: "#5E6D96" }}>{action.text}</span>
              </div>
            </section>

            <section aria-labelledby="c-table" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: "6px 12px", padding: "0 4px" }}>
                <h2 id="c-table" style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
                  항목별로 보기
                </h2>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#5E6D96" }}>
                  <span style={{ display: "inline-flex", color: "#1747D6" }}>
                    <Check size={14} />
                  </span>
                  파란 표시는 내 지출로 더 많이 받는 카드예요
                </span>
              </div>
              <div style={{ ...cardBox, ["--cmp-n" as string]: String(n) } as CSSProperties}>
                <div className="cmp-row cmp-head" style={{ position: "sticky", top: 84, zIndex: 5, padding: "12px 20px", background: "#FFFFFF", borderRadius: "20px 20px 0 0", boxShadow: "0 6px 12px -10px rgba(13, 40, 120, 0.35)" }}>
                  <div className="cmp-k" style={{ display: "flex", alignItems: "center", fontSize: 14, fontWeight: 700, color: "#5E6D96" }}>
                    항목
                  </div>
                  {heads.map((h) => (
                    <div key={h.sid} style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <CardImage sid={h.sid} width={52} shadow={false} />
                      <span style={{ fontSize: 15, fontWeight: 700 }}>{h.name}</span>
                    </div>
                  ))}
                </div>
                {sections.map((sec) => {
                  const rows = sec.rows.filter((r) => !(diffOnly && r.same));
                  if (!rows.length) return null;
                  return (
                    <div key={sec.id}>
                      <div style={groupHead}>{sec.title}</div>
                      {rows.map((r) => (
                        <TableRow key={r.id} row={r} n={n} />
                      ))}
                    </div>
                  );
                })}
                {diffOnly && sections.every((s) => s.rows.every((r) => r.same)) && <div style={{ ...rowStyle, fontSize: 14, color: "#5E6D96" }}>다른 점이 없어요.</div>}
              </div>
            </section>

            <section aria-label="계산 기준과 출처" style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: "12px 24px", padding: "18px 22px", borderRadius: 16, background: "#E8EEFF", border: "1px solid #C9D6F5" }}>
              <div style={{ flex: "1 1 520px", minWidth: 0, fontSize: 13, lineHeight: 1.7, color: "#3A4A78" }}>
                <b style={{ color: "#0D1B4A" }}>계산 기준</b> · {basisText(ctx)}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px", fontSize: 13 }}>
                {inputs.map((x) => {
                  const url = x.entry?.sourceUrl ?? x.view?.url;
                  if (!url) return null;
                  return (
                    <a key={x.sid} href={url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, minHeight: 32, fontWeight: 600 }}>
                      <svg width={14} height={14} {...svgProps}>
                        <path d="M14 4h6v6" />
                        <path d="M20 4 11 13" />
                        <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
                      </svg>
                      {nameOf(x)} 원문
                    </a>
                  );
                })}
                {(CATALOG_DATE_TEXT || META_DATE) && (
                  <span style={{ display: "inline-flex", alignItems: "center", minHeight: 32, color: "#56658E" }}>
                    카드고릴라 · {CATALOG_DATE_TEXT ? `혜택 ${CATALOG_DATE_TEXT}` : ""}
                    {CATALOG_DATE_TEXT && META_DATE && META_DATE !== CATALOG_DATE_TEXT ? `, 출시일 ${META_DATE}` : !CATALOG_DATE_TEXT ? META_DATE : ""} 수집
                  </span>
                )}
              </div>
            </section>
          </>
        )}
      </PageMain>
    </>
  );
}

function Cell({ cell }: { cell: CellVM }) {
  const chip = cell.chip;
  return (
    <div style={{ minWidth: 0 }}>
      <span style={{ ...mainText, ...(cell.muted ? { color: "#5E6D96" } : {}) }}>{cell.strong ? <b style={{ color: "#1747D6", fontWeight: 700 }}>{cell.main}</b> : cell.main}</span>
      {cell.sub && <span style={subText}>{cell.sub}</span>}
      {chip &&
        (chip.tone === "win" ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 8, padding: "4px 10px", borderRadius: 999, background: "#E8EEFF", fontSize: 14, color: "#1747D6", fontWeight: 700, ...NUM }}>
            <Check size={14} />
            {chip.text}
          </span>
        ) : (
          <span style={{ display: "inline-flex", alignItems: "center", marginTop: 8, padding: "4px 10px", borderRadius: 999, background: "#F3F7FF", fontSize: 14, fontWeight: 600, color: chip.tone === "zero" ? "#5E6D96" : "#0D1B4A", ...NUM }}>{chip.text}</span>
        ))}
    </div>
  );
}

function TableRow({ row, n }: { row: RowVM; n: number }) {
  return (
    <div className="cmp-row" style={rowStyle}>
      <div className="cmp-k" style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        {row.cat && <CmpIcon cat={row.cat} />}
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: "#0D1B4A" }}>{row.label}</span>
          {row.sub && <span style={{ display: "block", marginTop: 2, fontSize: 13, fontWeight: 500, color: "#5E6D96" }}>{row.sub}</span>}
          {row.same && (
            <span style={{ display: "block" }}>
              <span style={{ display: "inline-flex", alignItems: "center", height: 22, marginTop: 6, padding: "0 8px", boxSizing: "content-box", borderRadius: 11, background: "#F3F7FF", border: "1px solid #E3EAF8", fontSize: 12, fontWeight: 500, color: "#5E6D96" }}>{sameText(n)}</span>
            </span>
          )}
        </span>
      </div>
      {row.cells.map((c, i) => (
        <Cell key={i} cell={c} />
      ))}
    </div>
  );
}

function EmptyCompare({ ids }: { ids: number[] }) {
  return (
    <section style={{ ...cardBox, padding: 28, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "16px 24px" }}>
      {ids.map((sid) => (
        <CardImage key={sid} sid={sid} width={120} />
      ))}
      <div style={{ flex: "1 1 280px", minWidth: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{ids.length ? "1장 더 담으면 비교할 수 있어요" : "비교함이 비어 있어요"}</div>
        <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.6, color: "#5E6D96" }}>전체 카드에서 카드마다 있는 '비교' 칸을 눌러 담아 주세요. 최대 {COMPARE_MAX}장까지 담을 수 있어요.</p>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        {ids.length > 0 && (
          <button type="button" onClick={() => compareStore.clear()} style={{ ...pillLink, fontFamily: "inherit", cursor: "pointer" }}>
            비교함 비우기
          </button>
        )}
        <Link to={paths.cards} style={{ ...pillLink, background: "#2457F5", color: "#FFFFFF", border: "1px solid #2457F5" }}>
          전체 카드 보기
        </Link>
      </div>
    </section>
  );
}
