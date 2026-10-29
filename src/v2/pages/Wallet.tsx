import type { CSSProperties } from "react";
import { toBrandShare } from "@/domain/engine/walletEngine";
import { catalogBySourceId } from "@/v1/catalog";
import { approxWon, korWon } from "@/v1/format";
import { useAppData } from "@/v2/app/AppData";
import { paths, type Flow } from "@/v2/app/paths";
import { Link } from "@/v2/app/router";
import type { SavedWalletV2 } from "@/v2/app/state";
import { chatStore } from "@/v2/chat/chatStore";
import { monotoneBar, type BarItem } from "@/v2/model/guards";
import { guideRows, heroVM, perfCards, unusedOwned, walletCard, type ViewCtx } from "@/v2/model/resultView";
import { cardNick, countWord, josa } from "@/v2/model/text";
import { HeroAmount, HeroCardStack, NUM, SHADOW } from "@/v2/result/parts";
import { CardImage } from "@/v2/ui/CardImage";
import { CategoryIcon } from "@/v2/ui/icons";
import { PageMain } from "@/v2/ui/Page";
import { MenuBar } from "@/v2/ui/TopBar";
import { WalletEmpty } from "@/v2/pages/WalletEmpty";

/* 디자인 원본 F-D-Wallet(저장한 조합), F-D-Wallet-iDON(실적 여유 없이 저장), F-D-Wallet-Empty 값을 그대로 옮김. 카드 그림은 실물 사진 */

const outlineLink: CSSProperties = { display: "flex", alignItems: "center", height: 46, padding: "0 20px", boxSizing: "border-box", borderRadius: 23, background: "#FFFFFF", color: "#0D1B4A", border: "1px solid #D3DDF2", fontSize: 15, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" };

function InfoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1747D6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 3 }}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
  );
}

function savedDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function SavedWallet({ w, owned, toggleTodo }: { w: SavedWalletV2; owned: number[]; toggleTodo: (id: string) => void }) {
  const pack = w.pack;
  const flow: Flow = w.flow ?? (w.scope === "all" ? "new" : "own");
  const brandShare = w.brandShare ?? toBrandShare(w.spending, w.brandSpend ?? {});
  const newSids = w.newSids ?? [];
  const bar: BarItem[] = w.bar ? monotoneBar(w.bar, pack) : w.singleNet !== null ? [{ k: 1, net: w.singleNet, cards: 1, same: false }] : [];
  const ctx: ViewCtx = { spending: w.spending, brandShare, margin: w.margin, ownedIds: owned, newSids, source: w.source ?? "manual" };
  const hero = heroVM({ pack, bar, flow, ownedCount: owned.length, newSids, ownedOnly: null, place: "wallet" });
  const cards = pack.cards.map((c) => walletCard(c, pack, ctx));
  const rows = guideRows(pack, w.spending, brandShare);
  const unused = unusedOwned(owned, pack);
  const total = Object.values(w.spending).reduce((s, v) => s + v, 0);
  const resultTo = paths.make(flow, "result", { from: w.source === "statement" ? "statement" : undefined, margin: w.margin === 0 && flow === "own" ? 0 : undefined });
  const baseTo = paths.make(flow, "result", { from: w.source === "statement" ? "statement" : undefined });
  const tight = w.margin === 0 ? perfCards(pack).filter((p) => p.tight).sort((a, b) => (a.room ?? 0) - (b.room ?? 0))[0] : undefined;
  const todos = w.todos ?? [];

  return (
    <>
      <header style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "12px 20px" }}>
        <div style={{ flex: "1 1 420px", minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>내 지갑</h1>
          <p style={{ margin: "6px 0 0", fontSize: 15, lineHeight: 1.6, color: "#5E6D96" }}>
            {savedDate(w.savedAt)}에 저장한 조합 · 월 지출 {korWon(total)} · {w.margin > 0 ? `실적 여유 ${korWon(w.margin)} 기준` : "실적 여유 없이 계산"}
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Link to={paths.make(flow, w.source === "statement" ? "statement" : "spend")} style={outlineLink}>
            지출 다시 입력
          </Link>
          <Link to={resultTo} style={outlineLink}>
            카드 바꿔보기
          </Link>
        </div>
      </header>

      {w.margin === 0 && (
        <section aria-labelledby="wi-warn" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "14px 20px", padding: "18px 22px", borderRadius: 18, background: "#FFF6EE", border: "1px solid #F3D6BF" }}>
          <span aria-hidden="true" style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 13, background: "#FFFFFF", color: "#A3420B", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3 2 20h20z" />
              <path d="M12 10v4" />
              <path d="M12 17h.01" />
            </svg>
          </span>
          <div style={{ flex: "1 1 420px", minWidth: 0 }}>
            <h2 id="wi-warn" style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
              실적 여유가 없는 조합이에요
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: 14, lineHeight: 1.6, color: "#0D1B4A" }}>
              {tight ? `${tight.nick} 실적이 기준 ${korWon(tight.threshold ?? 0)}에 딱 맞아요. ` : "지출이 조금만 줄어도 다음 달 혜택이 끊길 수 있어요. "}
              {w.baseline
                ? (() => {
                    const names = w.baseline.names.map(cardNick).join(" + ");
                    return `이번 달 지출이 줄 것 같으면 여유 ${josa(korWon(w.baseline.margin), "을/를")} 둔 ${names}(월 ${approxWon(w.baseline.net)})${josa(names, "으로/로").slice(names.length)} 바꿔 두세요.`;
                  })()
                : "이번 달 지출이 줄 것 같으면 실적 여유를 두고 다시 계산해 보세요."}
            </p>
          </div>
          <Link to={baseTo} style={{ ...outlineLink, display: "inline-flex", gap: 7, height: 44, borderRadius: 22 }}>
            여유 {korWon(w.baseline?.margin ?? 20000)} 조합 보기
          </Link>
        </section>
      )}

      <section
        aria-labelledby="w-hero"
        style={{ background: "#FFFFFF", border: "1px solid transparent", boxShadow: SHADOW, borderRadius: 24, padding: "32px clamp(18px, 2.6vw, 36px)", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px 24px" }}
      >
        <div style={{ flex: "1 1 460px", minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#2457F5" }}>{hero.eyebrow}</div>
          <HeroAmount id="w-hero" title={hero.title} amount={hero.amount} as="h2" />
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: "#3A4A78" }}>{hero.lead}</p>
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 10 }}>
            <Link to={resultTo} style={{ ...outlineLink, height: 48, borderRadius: 24, background: "#2457F5", color: "#FFFFFF", border: "1px solid #2457F5" }}>
              계산 근거 보기
            </Link>
            <button type="button" onClick={() => chatStore.ask("내 지갑에 저장한 조합을 설명해 줘")} style={{ ...outlineLink, height: 48, borderRadius: 24, fontFamily: "inherit", cursor: "pointer" }}>
              이 지갑 물어보기
            </button>
          </div>
        </div>
        <HeroCardStack sids={hero.sids} newSids={newSids} bubble={false} />
      </section>

      <section aria-labelledby="w-cards" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 id="w-cards" style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em" }}>
          지갑에 넣고 다닐 카드 {pack.cards.length}장
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))", gap: 16 }}>
          {cards.map((c) => {
            const t = c.perf.threshold;
            const max = t ? Math.max(t * (7 / 6), c.perf.q * 1.02) : 1;
            const fullName = catalogBySourceId.get(c.sid)?.name ?? c.short;
            return (
              <article key={c.sid} style={{ background: "#FFFFFF", border: "1px solid transparent", borderRadius: 20, boxShadow: SHADOW, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "16px 20px" }}>
                  <CardImage sid={c.sid} width={144} badge={c.isNew ? "NEW" : undefined} />
                  <div style={{ flex: "1 1 160px", minWidth: 0 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", height: 24, padding: "0 10px", borderRadius: 12, fontSize: 12, fontWeight: 700, background: "#F3F7FF", color: "#3A4A78" }}>
                      {c.isNew ? "새로 발급할 카드" : "지갑에 넣을 카드"}
                    </span>
                    <h3 style={{ margin: "8px 0 0", fontSize: 20, fontWeight: 700 }}>{fullName}</h3>
                    <div style={{ marginTop: 2, fontSize: 14, color: "#5E6D96" }}>{c.meta}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 13, color: "#5E6D96" }}>월 혜택</div>
                    <div style={{ fontSize: 22, fontWeight: 700, ...NUM }}>{c.amountText}</div>
                  </div>
                </div>
                {c.chips.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#5E6D96", marginRight: 4 }}>맡는 일</span>
                    {c.chips.map((chip) => (
                      <span key={chip} style={{ padding: "3px 10px", borderRadius: 999, background: "#F3F7FF", border: "1px solid #E3EAF8", fontSize: 13, color: "#3A4A78" }}>
                        {chip}
                      </span>
                    ))}
                  </div>
                )}
                {t ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "4px 12px", fontSize: 14 }}>
                      <span style={{ color: "#3A4A78" }}>
                        전월실적 <b style={{ color: "#0D1B4A", ...NUM }}>{korWon(c.perf.q)}</b> · 기준 {korWon(t)}
                      </span>
                      <span style={{ fontWeight: 700, color: c.perf.tight ? "#A3420B" : "#1747D6" }}>여유 {korWon(Math.max(0, c.perf.room ?? 0))}</span>
                    </div>
                    <div style={{ position: "relative", height: 10, borderRadius: 999, background: "#EDF2FC" }}>
                      <div style={{ width: `${Math.min(100, Math.round((c.perf.q / max) * 100))}%`, height: 10, borderRadius: 999, background: "#2457F5" }} />
                      <span aria-hidden="true" style={{ position: "absolute", left: `${Math.round((t / max) * 100)}%`, top: -4, width: 2, height: 18, borderRadius: 1, background: "#0D1B4A" }} />
                    </div>
                    <div style={{ fontSize: 12, color: "#5E6D96" }}>
                      세로선 = 실적 기준 {korWon(t)}
                      {pack.cards.find((x) => x.sid === c.sid)?.perf.excludesDiscounted || (c.perf.q < (pack.cards.find((x) => x.sid === c.sid)?.perf.qRaw ?? 0) - 1) ? " · 할인받은 결제는 실적에서 빠져요" : ""}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 14, color: "#3A4A78" }}>전월실적 조건이 없는 카드예요</div>
                )}
                {c.walletNote && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderRadius: 12, background: "#E8EEFF", fontSize: 14, lineHeight: 1.6, color: "#1747D6" }}>
                    <InfoIcon />
                    <span>{c.walletNote}</span>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
        <section aria-labelledby="w-guide" style={{ flex: "2 1 520px", minWidth: 0, background: "#FFFFFF", border: "1px solid transparent", borderRadius: 20, boxShadow: SHADOW, padding: 24, display: "flex", flexDirection: "column", gap: 4, boxSizing: "content-box" }}>
          <h2 id="w-guide" style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
            결제할 때 이 순서로
          </h2>
          <p style={{ margin: "0 0 6px", fontSize: 14, color: "#5E6D96" }}>계산대에서 이 카드로 결제하면 돼요</p>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
            {rows.map((r) => (
              <li key={r.key} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 14px", padding: 14, borderRadius: 14, background: "#F3F7FF" }}>
                <CategoryIcon cat={r.cat} size={40} radius={13} />
                <span style={{ flex: "1 1 260px", minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 15, fontWeight: 700 }}>
                    {r.title} <span style={{ fontWeight: 500, color: "#5E6D96" }}>· 월 {korWon(r.spend)}</span>
                  </span>
                  <span style={{ display: "block", marginTop: 2, fontSize: 14, lineHeight: 1.6, color: "#3A4A78" }}>{r.text}</span>
                </span>
                {/* 사진: 계산대에서 어느 카드를 꺼낼지 바로 알아보게 이름 옆에 실물 사진을 둔다 */}
                <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px 4px 4px", borderRadius: 999, background: "#FFFFFF", border: "1px solid #D3DDF2", fontSize: 13, fontWeight: 700, color: "#0D1B4A" }}>
                  <span aria-hidden="true" style={{ display: "flex" }}>
                    {r.badge.sids.slice(0, 3).map((sid, i) => (
                      <CardImage key={sid} sid={sid} width={34} shadow={false} style={i ? { marginLeft: -14 } : undefined} />
                    ))}
                  </span>
                  {r.badge.sids.length > 1 ? "나눠서" : newSids.includes(r.badge.sids[0]) ? "새 카드" : r.badge.label}
                </span>
              </li>
            ))}
          </ul>
        </section>
        {todos.length > 0 && (
          <section aria-labelledby="w-todo" style={{ flex: "1 1 300px", minWidth: 0, background: "#E8EEFF", border: "1px solid #C9D6F5", borderRadius: 20, padding: 24, display: "flex", flexDirection: "column", gap: 6, boxSizing: "content-box" }}>
            <h2 id="w-todo" style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 700 }}>
              카드사 앱에서 할 일 {todos.length}가지
            </h2>
            {todos.map((t) => (
              <label key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 48, fontSize: 15, lineHeight: 1.5, color: "#0D1B4A", cursor: "pointer" }}>
                <input type="checkbox" checked={t.done} onChange={() => toggleTodo(t.id)} style={{ flexShrink: 0, width: 20, height: 20, margin: 0, accentColor: "#2457F5" }} />
                <span style={t.done ? { textDecoration: "line-through", color: "#5E6D96" } : undefined}>{t.text}</span>
              </label>
            ))}
            <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.6, color: "#3A4A78" }}>
              {todos.length === 1 ? "이 일을" : `${countWord(todos.length)} 가지를`} 해야 위 금액을 그대로 받아요.
            </p>
          </section>
        )}
      </div>

      {unused.length > 0 && (
        <section aria-labelledby="w-out" style={{ background: "#FFFFFF", border: "1px solid transparent", borderRadius: 20, boxShadow: SHADOW, padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 id="w-out" style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
            이 조합에서 쓰지 않는 카드 {unused.length}장
          </h2>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "#5E6D96" }}>
            가진 카드 {owned.length}장 중 {unused.length}장은 이번 조합에서 결제에 쓰지 않아요. 해지나 정리를 고민한다면 카드사 실적·약관을 먼저 확인하세요.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {unused.map((u) => (
              <span key={u.sid} style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 14px 8px 8px", borderRadius: 12, background: "#F3F7FF", fontSize: 14, color: "#3A4A78" }}>
                <CardImage sid={u.sid} width={48} />
                {u.name} · {u.fee}
              </span>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/** 내 지갑: 저장한 조합이 있으면 그 조합, 없으면 안내 */
export default function Wallet() {
  const { wallet, myCards, toggleTodo } = useAppData();
  const ok = wallet && wallet.pack && Array.isArray(wallet.pack.cards) && wallet.pack.cards.length > 0;
  return (
    <>
      <MenuBar active="wallet" />
      <PageMain title="내 지갑">{ok ? <SavedWallet w={wallet} owned={myCards.ids} toggleTodo={toggleTodo} /> : <WalletEmpty />}</PageMain>
    </>
  );
}
