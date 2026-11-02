import { useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * 상담 창의 이동 버튼을 눌렀을 때 화면 전체에 1.5초 동안 띄우는 장면(2026-11-01).
 * 카드가 위에서 내려와 지갑에 꽂히고 → 얼굴이 나타나고 → 체크 배지가 튀어나와 핏핏이 완성된다.
 * 아래에는 '입력 중' 점 3개와 '○○ 화면으로 이동하고 있어요'. 뒤 화면은 흐리게.
 * 장면이 뜬 직후(NAVIGATE_AT) 뒤에서 화면을 바꾸고, 끝나면(MOVE_MS) 사라지며 새 화면이 드러난다. 상담 창은 그대로 둔다
 */

export const MOVE_MS = 1500;
const NAVIGATE_AT = 300;

const CSS = `@keyframes nt-fade{0%{opacity:0}8%,85%{opacity:1}100%{opacity:0}}
@keyframes nt-card{0%{transform:translateY(-60px);opacity:0}8%{opacity:1}30%,100%{transform:translateY(0);opacity:1}}
@keyframes nt-face{0%,30%{opacity:0}47%,100%{opacity:1}}
@keyframes nt-badge{0%,47%{transform:scale(0)}57%{transform:scale(1.2)}63%,100%{transform:scale(1)}}
@keyframes nt-dot{0%,80%,100%{opacity:.3;transform:translateY(0)}40%{opacity:1;transform:translateY(-4px)}}
.nt-card{animation:nt-card ${MOVE_MS}ms ease-out both}
.nt-face{animation:nt-face ${MOVE_MS}ms ease-out both}
.nt-badge{transform-box:fill-box;transform-origin:center;animation:nt-badge ${MOVE_MS}ms ease-out both}`;

export function NavTransition({ screen, onNavigate, onDone }: { screen: string; onNavigate: () => void; onDone: () => void }) {
  useEffect(() => {
    const go = setTimeout(onNavigate, NAVIGATE_AT);
    const end = setTimeout(onDone, MOVE_MS);
    return () => {
      clearTimeout(go);
      clearTimeout(end);
    };
    // 한 번 뜰 때 한 번만 이동한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(13, 27, 74, 0.25)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", animation: `nt-fade ${MOVE_MS}ms ease both` }}>
      <style>{CSS}</style>
      <div style={{ width: "min(260px, 100%)", boxSizing: "border-box", padding: "24px 20px 20px", borderRadius: 20, background: "#FFFFFF", boxShadow: "0 24px 60px -12px rgba(13, 40, 120, 0.35)", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, fontFamily: "'IBM Plex Sans KR', system-ui, sans-serif", wordBreak: "keep-all" }}>
        <svg width={132} height={132} viewBox="0 0 200 200" aria-hidden="true" style={{ overflow: "visible" }}>
          <g className="nt-card">
            <rect x="64" y="22" width="72" height="44" rx="8" fill="#FFFFFF" stroke="#C9D6F5" strokeWidth="2" transform="rotate(6 100 44)" />
            <rect x="74" y="30" width="15" height="11" rx="3" fill="#2457F5" transform="rotate(6 100 44)" />
          </g>
          <ellipse cx="80" cy="172" rx="16" ry="7" fill="#1747D6" />
          <ellipse cx="120" cy="172" rx="16" ry="7" fill="#1747D6" />
          <rect x="48" y="64" width="104" height="104" rx="32" fill="#2457F5" />
          <g className="nt-face">
            <ellipse cx="80" cy="110" rx="10" ry="12" fill="#FFFFFF" />
            <ellipse cx="120" cy="110" rx="10" ry="12" fill="#FFFFFF" />
            <circle cx="81" cy="112" r="6" fill="#0D1B4A" />
            <circle cx="121" cy="112" r="6" fill="#0D1B4A" />
            <circle cx="83" cy="109" r="2" fill="#FFFFFF" />
            <circle cx="123" cy="109" r="2" fill="#FFFFFF" />
            <ellipse cx="64" cy="132" rx="7" ry="4.5" fill="#FF9DB0" opacity="0.85" />
            <ellipse cx="136" cy="132" rx="7" ry="4.5" fill="#FF9DB0" opacity="0.85" />
            <path d="M90 134 Q100 144 110 134" fill="none" stroke="#0D1B4A" strokeWidth="3.5" strokeLinecap="round" />
          </g>
          <g className="nt-badge">
            <circle cx="144" cy="158" r="13" fill="#FFFFFF" stroke="#E3EAF8" strokeWidth="1" />
            <path d="M137 158 L142 163 L151 153" fill="none" stroke="#2457F5" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </svg>
        <span aria-hidden="true" style={{ display: "inline-flex", gap: 5, height: 14, alignItems: "center" }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: 7, height: 7, borderRadius: 4, background: "#5E6D96", animation: `nt-dot 1s ease-in-out ${i * 0.15}s infinite` }} />
          ))}
        </span>
        <output style={{ fontSize: 14, fontWeight: 600, color: "#0D1B4A", textAlign: "center" }}>{screen} 화면으로 이동하고 있어요</output>
      </div>
    </div>,
    document.body,
  );
}
