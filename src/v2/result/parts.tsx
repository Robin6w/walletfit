import type { CSSProperties, ReactNode } from "react";
import { korWon } from "@/v1/format";
import { CardImage } from "@/v2/ui/CardImage";
import { CategoryIcon } from "@/v2/ui/icons";
import type { BenefitRowVM, GuideRowVM, RoleCardVM, TileVM } from "@/v2/model/resultView";

/* 추천 결과·내 지갑이 같이 쓰는 표시 부품. 값은 디자인 원본(F-D-Result, F-D-Wallet) 그대로 */

export const SHADOW = "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)";
export const NUM: CSSProperties = { fontVariantNumeric: "tabular-nums", fontFamily: "Outfit, 'IBM Plex Sans KR', sans-serif" };

/** 히어로 오른쪽 카드 겹침(360×220). 2장 배치는 디자인 값, 다른 장수는 같은 규칙으로 늘림 */
const STACK: Record<number, { w: number; pos: [number, number, number][] }> = {
  1: { w: 220, pos: [[70, 40, -6]] },
  2: { w: 220, pos: [[40, 30, -8], [120, 62, 6]] },
  3: { w: 200, pos: [[12, 22, -10], [78, 46, -2], [144, 70, 6]] },
  4: { w: 180, pos: [[0, 16, -10], [56, 38, -4], [112, 60, 2], [168, 82, 8]] },
  5: { w: 168, pos: [[0, 12, -10], [46, 32, -5], [92, 52, 0], [138, 72, 5], [184, 92, 10]] },
};

export function HeroCardStack({ sids, newSids = [], bubble = true }: { sids: number[]; newSids?: number[]; bubble?: boolean }) {
  const k = Math.min(5, Math.max(1, sids.length));
  const s = STACK[k];
  return (
    <div aria-hidden="true" style={{ flex: "0 1 360px", minWidth: 0, height: 220, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {sids.slice(0, 5).map((sid, i) => (
        <CardImage
          key={sid}
          sid={sid}
          width={s.w}
          rotate={s.pos[i][2]}
          badge={newSids.includes(sid) ? "NEW" : undefined}
          style={{ position: "absolute", left: s.pos[i][0], top: s.pos[i][1] }}
        />
      ))}
      {bubble && k >= 2 && (
        <span
          style={{ position: "absolute", left: s.pos[0][0] + 56, top: 6, width: 40, height: 40, boxSizing: "content-box", borderRadius: 20, background: "#FFFFFF", border: "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: "#2457F5", boxShadow: SHADOW, zIndex: 3 }}
        >
          +
        </span>
      )}
    </div>
  );
}

/** 타일 왼쪽 작은 카드(64px, 두 번째 카드는 -36px 겹침) */
export function TileCards({ sids, newSids = [] }: { sids: number[]; newSids?: number[] }) {
  return (
    <div aria-hidden="true" style={{ display: "flex", flexShrink: 0, width: 92 }}>
      {sids.slice(0, 2).map((sid, i) =>
        i === 0 ? (
          <CardImage key={sid} sid={sid} width={64} badge={newSids.includes(sid) ? "NEW" : undefined} />
        ) : (
          <span key={sid} style={{ marginLeft: -36, marginTop: 10 }}>
            <CardImage sid={sid} width={64} badge={newSids.includes(sid) ? "NEW" : undefined} />
          </span>
        ),
      )}
    </div>
  );
}

export function HeroTiles({ tiles, newSids = [] }: { tiles: TileVM[]; newSids?: number[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))", gap: 12, ...NUM }}>
      {tiles.map((t) =>
        t.highlight ? (
          <div key={t.label} style={{ padding: "18px 20px", borderRadius: 16, background: "#E8EEFF", border: "2px solid #2457F5", display: "flex", alignItems: "center", gap: 16 }}>
            <TileCards sids={t.sids} newSids={newSids} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#2457F5" }}>{t.label}</div>
              <div style={{ marginTop: 4, fontSize: 24, fontWeight: 700 }}>{t.value}</div>
              <div style={{ marginTop: 2, fontSize: 13, color: "#3A4A78" }}>{t.names}</div>
            </div>
          </div>
        ) : (
          <div key={t.label} style={{ padding: "18px 20px", borderRadius: 16, background: "#F3F7FF", display: "flex", alignItems: "center", gap: 16 }}>
            <TileCards sids={t.sids} newSids={newSids} />
            <div>
              <div style={{ fontSize: 14, color: "#5E6D96" }}>{t.label}</div>
              <div style={{ marginTop: 4, fontSize: 24, fontWeight: 700, color: "#3A4A78" }}>{t.value}</div>
              <div style={{ marginTop: 2, fontSize: 13, color: "#5E6D96" }}>{t.names}</div>
            </div>
          </div>
        ),
      )}
    </div>
  );
}

/** 히어로 금액: 작은 제목 + 72px 숫자 + 원 */
export function HeroAmount({ id, title, amount, as = "h1" }: { id: string; title: string; amount: number; as?: "h1" | "h2" }) {
  const H = as;
  return (
    <H id={id} style={{ margin: 0, fontSize: 34, lineHeight: 1.2, fontWeight: 700, letterSpacing: "-0.02em" }}>
      <span style={{ display: "block", fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em", color: "#3A4A78" }}>{title}</span>
      <span style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 12 }}>
        <span className="max-[480px]:!text-[56px]" style={{ fontFamily: "Outfit, sans-serif", fontSize: 72, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.02em", color: "#1747D6" }}>
          {amount.toLocaleString("ko-KR")}
        </span>
        <span style={{ fontSize: 26, fontWeight: 700 }}>원</span>
      </span>
    </H>
  );
}

export function BenefitRow({ row }: { row: BenefitRowVM }) {
  return (
    <li style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", marginTop: 8, borderRadius: 14, background: "#F3F7FF" }}>
      <CategoryIcon cat={row.cat} size={40} radius={13} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 15, fontWeight: 700 }}>{row.label}</span>
        <span style={{ display: "block", marginTop: 2, fontSize: 13, color: "#5E6D96" }}>{row.sub}</span>
      </span>
      <span style={{ flexShrink: 0, fontSize: 18, fontWeight: 700, ...NUM }}>{row.amountText}</span>
    </li>
  );
}

/** '카드 N장이 맡는 일'의 카드 한 장 */
export function RoleCardArticle({ vm, onIssueInfo }: { vm: RoleCardVM; onIssueInfo?: () => void }) {
  const isNew = vm.isNew;
  return (
    <article
      style={{
        background: "#FFFFFF",
        border: isNew ? "2px solid #2457F5" : "1px solid transparent",
        borderRadius: 20,
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        boxShadow: isNew ? undefined : SHADOW,
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "16px 20px" }}>
        <CardImage sid={vm.sid} width={144} badge={isNew ? "NEW" : undefined} />
        <div style={{ flex: "1 1 160px", minWidth: 0 }}>
          <span
            style={{ display: "inline-flex", alignItems: "center", height: 24, padding: "0 10px", borderRadius: 12, fontSize: 12, fontWeight: 700, ...(isNew ? { background: "#2457F5", color: "#FFFFFF" } : { background: "#F3F7FF", color: "#3A4A78" }) }}
          >
            {isNew ? "신규 발급" : "가진 카드"}
          </span>
          <h3 style={{ margin: "8px 0 0", fontSize: 20, fontWeight: 700 }}>{vm.short}</h3>
          <div style={{ marginTop: 2, fontSize: 14, color: "#5E6D96" }}>{vm.meta}</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 13, color: "#5E6D96" }}>월 혜택</div>
          <div style={{ fontSize: 20, fontWeight: 700, ...NUM }}>{vm.amountText}</div>
        </div>
      </div>
      {vm.rows.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {vm.rows.map((r) => (
            <BenefitRow key={r.id} row={r} />
          ))}
        </ul>
      )}
      {isNew && onIssueInfo ? (
        <button
          type="button"
          onClick={onIssueInfo}
          style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", height: 44, padding: "0 16px", boxSizing: "border-box", border: "none", borderRadius: 22, background: "#E8EEFF", color: "#2457F5", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
        >
          발급 정보 보기 →
        </button>
      ) : (
        vm.note && <span style={{ fontSize: 13, color: "#5E6D96" }}>{vm.note}</span>
      )}
    </article>
  );
}

/** '이렇게 쓰세요' 줄의 오른쪽 작은 카드(44px) */
function GuideBadge({ badge, newSids = [] }: { badge: GuideRowVM["badge"]; newSids?: number[] }) {
  const split = badge.sids.length > 1;
  return (
    <span style={{ justifySelf: "end", display: "inline-flex", alignItems: "center", gap: split ? 4 : 8, fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", color: "#0D1B4A" }}>
      {badge.sids.slice(0, 3).map((sid) => (
        <CardImage key={sid} sid={sid} width={44} />
      ))}
      {split ? "나눠서" : newSids.includes(badge.sids[0]) ? "새 카드" : badge.label}
    </span>
  );
}

export function GuideRows({ rows, newSids = [] }: { rows: GuideRowVM[]; newSids?: number[] }) {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
      {rows.map((r) => (
        <li key={r.key} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px 16px", padding: 16, marginTop: 10, borderRadius: 18, background: "#F3F7FF" }}>
          <CategoryIcon cat={r.cat} size={44} radius={14} glyph={22} />
          <span style={{ flex: "1 1 260px", minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 16, fontWeight: 700 }}>
              {r.title} <span style={{ fontWeight: 500, color: "#5E6D96" }}>· 월 {korWon(r.spend)}</span>
            </span>
            <span style={{ display: "block", marginTop: 2, fontSize: 14, lineHeight: 1.5, color: "#3A4A78" }}>{r.text}</span>
          </span>
          <GuideBadge badge={r.badge} newSids={newSids} />
        </li>
      ))}
    </ul>
  );
}

function Chevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5E6D96" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-180">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/** '더 자세히 보고 싶다면'의 접는 칸 */
export function DetailsItem({ title, sub, children, open, id }: { title: ReactNode; sub: ReactNode; children: ReactNode; open?: boolean; id?: string }) {
  return (
    <details id={id} open={open} className="group" style={{ borderRadius: 16, border: "1px solid transparent", background: "#FFFFFF", boxShadow: SHADOW }}>
      <summary style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 64, padding: "12px 20px", boxSizing: "border-box", cursor: "pointer", listStyle: "none" }}>
        <span>
          <span style={{ display: "block", fontSize: 15, fontWeight: 700 }}>{title}</span>
          <span style={{ display: "block", marginTop: 2, fontSize: 13, color: "#5E6D96" }}>{sub}</span>
        </span>
        <Chevron />
      </summary>
      <div style={{ padding: "0 20px 18px", fontSize: 14, lineHeight: 1.7, color: "#3A4A78" }}>{children}</div>
    </details>
  );
}
