import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { CatalogListing } from "@/domain/types/catalog";
import type { CardViewBenefit, CardViewEntry } from "@/domain/types/cardView";
import { catLabel } from "@/v1/catalog";
import { approxWon, num } from "@/v1/format";
import { conditionTexts, feeDetailText, groupBenefits, perfText, rewardText, sourceText, tierText, wonShort } from "@/v2/model/cardView";
import { CardImage } from "@/v2/ui/CardImage";

/**
 * 카드 상세 창(2026-10-30). 원문 정제 혜택 표(card-view.json)로 혜택·실적 조건·묶음 한도를 보여 준다.
 * 예전 v1 창은 카드 종류·연회비·카드고릴라 요약 한 줄만 보여 줬다.
 */

const SHADOW = "0 24px 64px rgba(13, 40, 120, 0.28)";
const PERIOD: Record<string, string> = { day: "일", month: "월", year: "연", half_year: "반기", card_year: "카드 연도" };
const tag: CSSProperties = { display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 999, background: "#F3F7FF", border: "1px solid #E3EAF8", fontSize: 12, color: "#3A4A78" };
const h3: CSSProperties = { margin: 0, fontSize: 16, fontWeight: 700, color: "#0D1B4A" };
const muted: CSSProperties = { fontSize: 13, lineHeight: 1.6, color: "#5E6D96" };

function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 20, borderTop: "1px solid #E3EAF8" }}>
      <div>
        <h3 style={h3}>{title}</h3>
        {sub && <div style={{ ...muted, marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </section>
  );
}

/** 계약형 혜택이 어떤 계약을 뜻하는지(benefit-conditions.json asks 키) */
const CONTRACT_WORD: Record<string, string> = {
  insurance: "보험료를 이 카드로 내는",
  rental: "정수기·가전 렌탈료를 이 카드로 내는",
  installment: "장기 할부로 큰 물건을 사는",
  apt_fee: "아파트 관리비를 이 카드로 자동이체하는",
  bank_account: "카드사 은행 계좌·금융상품을 쓰는",
  paid_membership: "유료 멤버십에 가입하는",
};

/** 추천 계산에서 뺀 이유 한 줄(장소 한정·계약형만 알림). 알릴 게 없으면 null. review·no_calc 상태는 아래 칩이 따로 말한다 */
function excludeNote(b: CardViewBenefit): string | null {
  switch (b.ex) {
    case "place":
      return "경기장·공항처럼 장소가 정해진 혜택이라 추천 계산에서 뺐어요";
    case "contract":
      return `${b.ct && CONTRACT_WORD[b.ct] ? `${CONTRACT_WORD[b.ct]} 경우에만` : "통신사 결합 같은 계약이 있어야"} 받는 혜택이라 기본 계산에서 뺐어요`;
    default:
      // overseas·nocat은 사용자에게 알릴 필요가 없어 글을 달지 않는다(2026-11-05 결정). 계산에서는 빠지고 금액만 회색으로 둔다
      return null;
  }
}

function BenefitRow({ b }: { b: CardViewBenefit }) {
  const conds = conditionTexts(b);
  const note = excludeNote(b);
  const counted = b.st === "auto" && !b.ex;
  return (
    <li style={{ listStyle: "none", padding: "12px 14px", borderRadius: 12, background: counted ? "#FFFFFF" : "#FAFAFC", border: "1px solid #E3EAF8", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: "4px 12px" }}>
        <span style={{ fontSize: 14, lineHeight: 1.5, color: "#0D1B4A", flex: "1 1 240px" }}>{b.t}</span>
        <strong style={{ fontSize: 15, color: counted ? "#1747D6" : "#5E6D96", whiteSpace: "nowrap" }}>{rewardText(b)}</strong>
      </div>
      {(conds.length > 0 || !counted || b.m.length > 0) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {b.st === "review" && <span style={{ ...tag, background: "#FFF6E5", border: "1px solid #F5DDB0", color: "#8A5300" }}>사람 확인 중 · 추천 계산에서 뺌</span>}
          {b.st === "no_calc" && (
            <span style={{ ...tag, background: "#F1F1F4", border: "1px solid #E1E1E8", color: "#55556A" }}>
              {note ?? "계산하지 않는 혜택"}
            </span>
          )}
          {b.st === "auto" && note && <span style={{ ...tag, background: "#F1F1F4", border: "1px solid #E1E1E8", color: "#55556A" }}>{note}</span>}
          {conds.map((c) => (
            <span key={c} style={tag}>
              {c}
            </span>
          ))}
          {b.m.length > 0 && <span style={{ ...tag, background: "transparent" }}>{b.m.slice(0, 5).join("·")}{b.m.length > 5 ? " 등" : ""}</span>}
        </div>
      )}
      {b.q && (
        <details>
          <summary style={{ ...muted, cursor: "pointer" }}>원문 보기</summary>
          <p style={{ ...muted, margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{b.q}</p>
        </details>
      )}
    </li>
  );
}

interface Props {
  entry: CatalogListing;
  view: CardViewEntry | undefined;
  /** 받기 전이면 true(혜택 칸에 '불러오는 중') */
  loading: boolean;
  mine: boolean;
  discontinued: boolean;
  inCompare: boolean;
  /** 내 지출 전부를 이 카드로 냈을 때 연회비를 뺀 월 혜택(지출을 넣었을 때만) */
  net?: number;
  onToggleMine: () => void;
  onToggleCompare: () => void;
  onClose: () => void;
  /** 결과 화면에서 열 때 맨 위에 보여 줄 '이 조합에서 이 카드가 하는 일'(2026-11-03). 있으면 전체 혜택 목록은 접어 둔다 */
  plan?: ReactNode;
}

/** 결과 화면에서 열면 접어 두는 목록(처음엔 '이 조합에서' 칸만 보이게) */
function Collapse({ open, label, children }: { open: boolean; label: string; children: ReactNode }) {
  if (open) return <>{children}</>;
  return (
    <details>
      <summary style={{ fontSize: 14, fontWeight: 700, color: "#2457F5", cursor: "pointer" }}>{label}</summary>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>{children}</div>
    </details>
  );
}

/**
 * 고르는 혜택 한 묶음(2026-11-03). 순위형('대형할인점 > 편의점' 같은 순서쌍 42가지)은 대상 업종만 한 번씩 보여 주고,
 * 옵션이 많으면 앞 몇 개만 보이고 펼치게 한다. 제목의 정제용 내부 표기('(순위별 요율 [0.1, 0.1]: …)')는 지운다
 */
function ChoiceGroup({ label, options }: { label: string; options: string[] }) {
  const name = label.replace(/\s*\([^()]*\[[^\]]*\][^()]*\)/g, "").trim() || "고르는 혜택";
  const line: CSSProperties = { fontSize: 14, lineHeight: 1.7, color: "#3A4A78" };
  if (options.length > 1 && options.every((o) => o.includes(" > "))) {
    const areas = Array.from(new Set(options.flatMap((o) => o.split(" > ").map((x) => x.trim()))));
    return (
      <div style={line}>
        <strong>{name}</strong>: {areas.join(" · ")} 가운데 그달 많이 쓴 순서대로 높은 할인율이 자동으로 붙어요
        <span style={{ color: "#5E6D96" }}> (순서 조합 {options.length}가지)</span>
      </div>
    );
  }
  if (options.length <= 6) {
    return (
      <div style={line}>
        <strong>{name}</strong>: {options.join(" / ")}
      </div>
    );
  }
  return (
    <details style={line}>
      <summary style={{ cursor: "pointer" }}>
        <strong>{name}</strong>: {options.slice(0, 4).join(" / ")} 외 {options.length - 4}가지
      </summary>
      <div style={{ marginTop: 4 }}>{options.join(" / ")}</div>
    </details>
  );
}

export function CardDetailSheet({ entry, view, loading, mine, discontinued, inCompare, net, onToggleMine, onToggleCompare, onClose, plan }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus();
    };
  }, [onClose]);

  const groups = view ? groupBenefits(view) : [];
  const counted = view ? view.b.filter((b) => b.st === "auto" && !b.ex).length : 0;

  return createPortal(
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(13, 27, 74, 0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-detail-h"
        tabIndex={-1}
        style={{ position: "relative", width: "min(760px, 100%)", maxHeight: "min(88vh, 100%)", overflowY: "auto", background: "#FFFFFF", borderRadius: 24, boxShadow: SHADOW, padding: "28px clamp(18px, 3vw, 32px)", display: "flex", flexDirection: "column", gap: 20, outline: "none" }}
      >
        <button type="button" onClick={onClose} aria-label="닫기" style={{ position: "absolute", top: 14, right: 14, width: 40, height: 40, borderRadius: 20, border: "none", background: "#F3F7FF", fontSize: 18, color: "#3A4A78", cursor: "pointer" }}>
          ✕
        </button>

        <header style={{ display: "flex", flexWrap: "wrap", gap: "16px 24px", alignItems: "center" }}>
          <CardImage sid={entry.sourceId} width={150} />
          <div style={{ flex: "1 1 260px", minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#2457F5" }}>{entry.issuer}</div>
            <h2 id="card-detail-h" style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#0D1B4A", paddingRight: 40 }}>
              {entry.name}
            </h2>
            <div style={{ fontSize: 14, color: "#3A4A78" }}>
              {entry.category} · {entry.annualFee ? `연회비 ${num(entry.annualFee)}원` : "연회비 없음"}
              {feeDetailText(entry.annualFeeText, entry.annualFee) && <span style={{ color: "#5E6D96" }}> ({feeDetailText(entry.annualFeeText, entry.annualFee)})</span>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {view && <span style={{ ...tag, background: "#E8EEFF", border: "1px solid #C9D6F5", color: "#1747D6", fontWeight: 700 }}>{perfText(view)}</span>}
              {mine && <span style={{ ...tag, background: "#E8EEFF", border: "1px solid #C9D6F5", color: "#1747D6" }}>내 카드</span>}
              {discontinued && <span style={{ ...tag, background: "#FFF1E6", border: "1px solid #F5D3B8", color: "#A3420B" }}>신규 발급 중단</span>}
            </div>
            {net !== undefined && (
              <div style={{ fontSize: 14, color: "#3A4A78" }}>
                {net > 0 ? (
                  <>
                    내 지출 전부를 이 카드로 내면 연회비 빼고 <strong style={{ color: "#1747D6" }}>월 {approxWon(net)}</strong>
                  </>
                ) : (
                  "내 지출로는 연회비를 빼면 남는 혜택이 없어요"
                )}
              </div>
            )}
          </div>
        </header>

        {plan}

        {loading && !view && <p style={muted}>혜택 정보를 불러오고 있어요…</p>}
        {!loading && (!view || view.b.length === 0) && (
          <Section title="혜택" sub="원문에서 계산할 수 있는 혜택을 찾지 못한 카드예요">
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: "#3A4A78" }}>카드고릴라 요약: {(entry.benefitSummary ?? "").replace(/[\s,|]+$/, "") || "없음"}</p>
          </Section>
        )}

        {view && view.b.length > 0 && (
          <Section title={`${plan ? "카드 전체 혜택" : "혜택"} ${view.b.length}개`} sub={`${sourceText(view)}${counted < view.b.length ? ` 추천 계산에는 ${counted}개를 써요.` : ""}`}>
            <Collapse open={!plan} label={`혜택 ${view.b.length}개 모두 보기`}>
            {groups.map((g) => (
              <div key={g.key} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#3A4A78" }}>
                  {g.name} <span style={{ fontWeight: 400, color: "#5E6D96" }}>{g.items.length}</span>
                </div>
                <ul style={{ margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  {g.items.map((b, i) => (
                    <BenefitRow key={`${b.id}-${i}`} b={b} />
                  ))}
                </ul>
              </div>
            ))}
            </Collapse>
          </Section>
        )}

        {view && (view.tiers.length > 0 || view.exItems.length > 0 || view.grace || view.disc || view.exCats.length > 0) && (
          <Section title="실적 조건" sub={perfText(view)}>
            {view.tiers.filter((t) => t.min > 0).length > 1 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {view.tiers.map((t) => (
                  <span key={t.id} style={tag}>
                    {tierText(t)}
                  </span>
                ))}
              </div>
            )}
            <ul style={{ margin: 0, paddingLeft: 18, ...muted, color: "#3A4A78" }}>
              {view.disc && <li>이 카드로 할인받은 결제는 실적에 넣지 않아요.</li>}
              {view.grace && <li>새로 발급하면 {view.grace}개월 동안은 실적이 모자라도 혜택을 줘요.</li>}
              {view.exCats.length > 0 && <li>실적에서 빠지는 지출: {view.exCats.map((c) => catLabel(c)).join(", ")}</li>}
            </ul>
            {view.exItems.length > 0 && (
              <details>
                <summary style={{ fontSize: 14, color: "#3A4A78", cursor: "pointer" }}>실적에서 빠지는 항목 {view.exItems.length}개</summary>
                <p style={{ ...muted, margin: "6px 0 0" }}>{view.exItems.join(" · ")}</p>
              </details>
            )}
          </Section>
        )}

        {view && view.shared.length > 0 && (
          <Section title="묶음 한도" sub="여러 혜택이 함께 쓰는 한도예요">
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.7, color: "#3A4A78" }}>
              {view.shared.map((s) => {
                const ws = s.amounts.map((a) => a.won).sort((a, b) => a - b);
                const amt = ws.length ? (ws[0] === ws[ws.length - 1] ? wonShort(ws[0]) : `${wonShort(ws[0]).replace(/원$/, "")}~${wonShort(ws[ws.length - 1])}`) : "";
                return (
                  <li key={s.id}>
                    {/* '(카테고리 나눔)'은 정제 조립 때 붙인 내부 표시라 뺀다 */}
                    {s.label.replace(/\s*\(카테고리 나눔\)/, "") || "묶음 한도"} {amt && <strong>{`${PERIOD[s.period] ?? ""} ${amt}`.trim()}</strong>}
                  </li>
                );
              })}
            </ul>
          </Section>
        )}

        {view && view.choice.length > 0 && (
          <Section title="고르는 혜택" sub="이 가운데 하나를 골라 쓰는 혜택이에요">
            {view.choice.map((g) => (
              <ChoiceGroup key={g.label} label={g.label} options={g.options} />
            ))}
          </Section>
        )}

        <footer style={{ display: "flex", flexWrap: "wrap", gap: 10, paddingTop: 20, borderTop: "1px solid #E3EAF8" }}>
          {!(discontinued && !mine) && (
            <button type="button" onClick={onToggleMine} style={{ flex: "1 1 160px", height: 48, borderRadius: 24, border: "none", background: mine ? "#E8EEFF" : "#2457F5", fontFamily: "inherit", fontSize: 15, fontWeight: 700, color: mine ? "#1747D6" : "#FFFFFF", cursor: "pointer" }}>
              {mine ? "내 카드에서 빼기" : "내 카드에 담기"}
            </button>
          )}
          <button type="button" onClick={onToggleCompare} aria-pressed={inCompare} style={{ flex: "1 1 160px", height: 48, borderRadius: 24, border: "1px solid #D3DDF2", background: "#FFFFFF", fontFamily: "inherit", fontSize: 15, fontWeight: 700, color: "#0D1B4A", cursor: "pointer" }}>
            {inCompare ? "비교함에서 빼기" : "비교함에 담기"}
          </button>
          <a href={entry.sourceUrl} target="_blank" rel="noreferrer" style={{ flex: "1 1 160px", display: "flex", alignItems: "center", justifyContent: "center", height: 48, borderRadius: 24, border: "1px solid #D3DDF2", fontSize: 15, fontWeight: 700, color: "#3A4A78", textDecoration: "none" }}>
            카드고릴라 원문 ↗
          </a>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
