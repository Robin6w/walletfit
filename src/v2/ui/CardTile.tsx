import type { CSSProperties, MouseEvent, ReactNode } from "react";
import type { CatalogListing } from "@/domain/types/catalog";
import type { CardViewEntry } from "@/domain/types/cardView";
import { feeLabel, isDiscontinued, summaryChips } from "@/v1/catalog";
import { num } from "@/v1/format";
import { benefitChips, perfText } from "@/v2/model/cardView";
import { CardImage } from "@/v2/ui/CardImage";
import { useChrome } from "@/v2/ui/chrome";

/**
 * 카드 한 칸(2026-11-07). 전체 카드 목록과 혜택별 추천의 '금액 넣기 전' 목록이 같이 쓴다.
 * 카드 그림 · 카드사 · 이름 · 정보 줄 · 혜택 칩 · '혜택 보기'. 칸 어디를 눌러도 onOpen(카드 상세 창)이 불린다.
 * 모바일 사이트(compact)는 한 줄에 두 장 들어가는 작은 칸(칩 1개).
 */

const SHADOW = "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)";
const chip: CSSProperties = { padding: "3px 10px", borderRadius: 999, background: "#F3F7FF", border: "1px solid #E3EAF8", fontSize: 13, color: "#3A4A78" };
/** 긴 혜택 칩이 칸 밖으로 나가지 않게 한 줄로 자른다 */
const chipFit: CSSProperties = { maxWidth: "100%", boxSizing: "border-box", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12 };
const chipHit: CSSProperties = { background: "#E8EEFF", border: "1px solid #C9D6F5", color: "#1747D6", fontWeight: 700 };
/** 카드 이름 위 카드사(롯데카드·신한카드 등). 정보 줄에 섞여 있으면 잘 안 보여서 따로 올렸다(카드 상세 창 머리와 같은 모양) */
const issuerStyle = (small: boolean): CSSProperties => ({ fontSize: small ? 12 : 13, fontWeight: 700, lineHeight: 1.4, color: "#2457F5" });
const nameBtn: CSSProperties = { padding: 0, border: "none", background: "transparent", font: "inherit", color: "inherit", textAlign: "left", cursor: "pointer" };
/** 칸 맨 아래 '혜택 보기'(모바일은 작게) */
const benefitBtn = (small: boolean): CSSProperties => ({
  flex: 1,
  minWidth: 0,
  height: small ? 36 : 44,
  padding: small ? "0 6px" : "0 14px",
  borderRadius: small ? 10 : 12,
  border: "1px solid #C9D6F5",
  background: "#F3F7FF",
  fontFamily: "inherit",
  fontSize: small ? 13 : 14,
  fontWeight: 700,
  color: "#2457F5",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: small ? 4 : 6,
});

/** 카드 칸을 까는 격자. PC는 한 줄에 최대 4장(칸이 200px보다 좁아지면 3·2·1장), 모바일은 2장 */
export function CardGrid({ children }: { children: ReactNode }) {
  const { compact } = useChrome();
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: compact ? "repeat(2, minmax(0, 1fr))" : "repeat(auto-fill, minmax(min(100%, max(200px, calc((100% - 48px) / 4))), 1fr))",
        gap: compact ? 8 : 16,
      }}
    >
      {children}
    </div>
  );
}

function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

interface Props {
  card: CatalogListing;
  /** 원문 정제 혜택 표(받기 전이거나 없으면 카드고릴라 요약 칩) */
  view: CardViewEntry | undefined;
  /** 이 카테고리 혜택 칩을 맨 앞에 */
  focusCat?: string;
  /** 검색어에 걸린 혜택(맨 앞에 강조) */
  hit?: string | null;
  /** true면 맨 아래 '혜택 보기' 버튼을 숨긴다(혜택별 추천, 2026-11-07). 칸·카드 이름을 누르면 여전히 onOpen */
  hideBenefitBtn?: boolean;
  onOpen: () => void;
}

export function CardTile({ card: c, view: v, focusCat, hit, hideBenefitBtn, onOpen }: Props) {
  const { compact } = useChrome();
  const disc = isDiscontinued(c);
  const vChips = v ? benefitChips(v, 3, focusCat) : [];
  // 정리된 혜택이 없거나 크기를 못 읽은 카드는 카드고릴라 요약 칩으로
  const chips = vChips.length ? vChips : summaryChips(c);
  // 칸 어디를 눌러도 상세 창이 열린다. 키보드는 카드 이름 버튼이나 '혜택 보기'로
  const onClick = (e: MouseEvent) => {
    if (!(e.target as HTMLElement).closest("button, a, label, input")) onOpen();
  };

  if (compact) {
    const first = hit ?? chips[0];
    return (
      <article onClick={onClick} style={{ minWidth: 0, background: "#FFFFFF", border: "1px solid transparent", borderRadius: 14, boxShadow: SHADOW, padding: 10, display: "flex", flexDirection: "column", gap: 6, cursor: "pointer" }}>
        <CardImage sid={c.sourceId} width={88} />
        <div>
          <div style={issuerStyle(true)}>{c.issuer}</div>
          <h3 style={{ margin: "1px 0 0", fontSize: 14, fontWeight: 700, lineHeight: 1.3, wordBreak: "keep-all" }}>
            <button type="button" onClick={onOpen} style={nameBtn}>
              {c.name}
            </button>
          </h3>
        </div>
        <div style={{ fontSize: 11, lineHeight: 1.4, color: "#5E6D96" }}>
          {disc && <b style={{ color: "#A3420B" }}>발급 중단 · </b>}
          {c.annualFee ? `연 ${num(c.annualFee)}원` : feeLabel(c)}
        </div>
        {first && <span style={{ ...chip, ...chipFit, alignSelf: "flex-start", ...(hit ? chipHit : {}) }}>{first}</span>}
        {!hideBenefitBtn && (
          <div style={{ marginTop: "auto", display: "flex" }}>
            <button type="button" aria-label={`${c.name} 혜택 보기`} onClick={onOpen} style={benefitBtn(true)}>
              혜택 보기
              <Chevron />
            </button>
          </div>
        )}
      </article>
    );
  }

  return (
    <article onClick={onClick} style={{ minWidth: 0, background: "#FFFFFF", border: "1px solid transparent", borderRadius: 16, boxShadow: SHADOW, padding: 16, display: "flex", flexDirection: "column", gap: 10, cursor: "pointer" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <CardImage sid={c.sourceId} width={112} />
        {disc && <span style={{ display: "inline-flex", alignItems: "center", height: 24, padding: "0 8px", borderRadius: 12, background: "#FFF1E6", fontSize: 11, fontWeight: 700, color: "#A3420B", whiteSpace: "nowrap" }}>신규 발급 중단</span>}
      </div>
      <div>
        <div style={issuerStyle(false)}>{c.issuer}</div>
        <h3 style={{ margin: "2px 0 0", fontSize: 15, fontWeight: 700, lineHeight: 1.35, wordBreak: "keep-all" }}>
          <button type="button" onClick={onOpen} style={nameBtn}>
            {c.name}
          </button>
        </h3>
        <div style={{ marginTop: 2, fontSize: 12, lineHeight: 1.5, color: "#5E6D96" }}>
          {c.category} · {c.annualFee ? `연회비 ${num(c.annualFee)}원` : feeLabel(c)}
          {v && ` · ${perfText(v)}`}
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {hit && <span style={{ ...chip, ...chipFit, ...chipHit }}>{hit}</span>}
        {chips.slice(0, hit ? 2 : 3).map((s, i) => (
          <span key={`${i}-${s}`} style={{ ...chip, ...chipFit }}>
            {s}
          </span>
        ))}
      </div>
      {!hideBenefitBtn && (
        <div style={{ marginTop: "auto", display: "flex" }}>
          <button type="button" aria-label={`${c.name} 혜택 보기`} onClick={onOpen} style={benefitBtn(false)}>
            혜택 보기
            <Chevron />
          </button>
        </div>
      )}
    </article>
  );
}
