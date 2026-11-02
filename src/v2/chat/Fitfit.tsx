/**
 * 카드 상담 캐릭터 '핏핏'(2026-10-31). 파란 지갑 몸통 + 머리처럼 꽂힌 카드(로고 모양).
 *  - variant "full": 몸 전체(상담 창 제목 옆). wave면 왼팔을 3번 흔들고 멈춘다
 *  - variant "face": 얼굴만 크게(상담 답 말풍선 모서리 배지). 작은 크기에서도 표정이 보이게
 *  - mood: hello(인사) · happy(답을 찾음) · thinking(대기, 입 자리 점이 깜빡임) · sorry(답을 못 함)
 * 장식용 그림이라 스크린리더에는 숨긴다
 */

export type FitfitMood = "hello" | "happy" | "thinking" | "sorry";

const BLUE = "#2457F5";
const DEEP = "#1747D6";
const INK = "#0D1B4A";
const WHITE = "#FFFFFF";

const CSS = `@keyframes ff-wave{0%,100%{transform:rotate(0deg)}30%{transform:rotate(-24deg)}70%{transform:rotate(16deg)}}
@keyframes ff-dot{0%,100%{opacity:.3}50%{opacity:1}}
.ff-wave{transform-box:view-box;transform-origin:20px 58px;animation:ff-wave .9s ease-in-out 3}
.ff-dot{animation:ff-dot 1.2s ease-in-out infinite}`;

/** 얼굴 배치(viewBox 0~100 기준) */
interface FaceBox {
  cx: number;
  ey: number;
  dx: number;
  erx: number;
  ery: number;
  pr: number;
  cheekDx: number;
  cheekY: number;
  my: number;
  mw: number;
  sw: number;
}

const FACE_SMALL: FaceBox = { cx: 50, ey: 54, dx: 11, erx: 6, ery: 7, pr: 3.6, cheekDx: 20, cheekY: 66, my: 66, mw: 6, sw: 3 };
const FACE_BIG: FaceBox = { cx: 50, ey: 52, dx: 16, erx: 8.5, ery: 10, pr: 5, cheekDx: 31, cheekY: 69, my: 69, mw: 9, sw: 4 };

function Face({ mood, f }: { mood: FitfitMood; f: FaceBox }) {
  const eyeX = [f.cx - f.dx, f.cx + f.dx];
  const pupilDy = mood === "thinking" ? -f.ery * 0.35 : mood === "sorry" ? f.ery * 0.3 : f.ery * 0.15;
  const pupilDx = mood === "thinking" ? f.erx * 0.3 : 0;
  return (
    <>
      {mood === "happy"
        ? eyeX.map((x) => <path key={x} d={`M${x - f.erx} ${f.ey + 2} Q${x} ${f.ey - f.ery} ${x + f.erx} ${f.ey + 2}`} fill="none" stroke={WHITE} strokeWidth={f.sw} strokeLinecap="round" />)
        : eyeX.map((x) => (
            <g key={x}>
              <ellipse cx={x} cy={f.ey} rx={f.erx} ry={mood === "sorry" ? f.ery * 0.85 : f.ery} fill={WHITE} />
              <circle cx={x + pupilDx} cy={f.ey + pupilDy} r={f.pr} fill={INK} />
              {mood === "hello" && <circle cx={x + f.pr * 0.4} cy={f.ey - f.pr * 0.2} r={f.pr * 0.35} fill={WHITE} />}
            </g>
          ))}
      {mood === "sorry" && (
        <>
          <path d={`M${eyeX[0] - f.erx} ${f.ey - f.ery - f.sw * 0.6} L${eyeX[0] + f.erx * 0.7} ${f.ey - f.ery * 0.75}`} stroke={WHITE} strokeWidth={f.sw * 0.85} strokeLinecap="round" />
          <path d={`M${eyeX[1] + f.erx} ${f.ey - f.ery - f.sw * 0.6} L${eyeX[1] - f.erx * 0.7} ${f.ey - f.ery * 0.75}`} stroke={WHITE} strokeWidth={f.sw * 0.85} strokeLinecap="round" />
          <path d={`M${eyeX[1] + f.erx + 2} ${f.ey + f.ery * 0.4} q${f.sw} ${f.sw * 2} 0 ${f.sw * 2.6} q${-f.sw} ${-f.sw * 0.6} 0 ${-f.sw * 2.6}z`} fill="#8EC5FF" />
        </>
      )}
      {[-1, 1].map((s) => (
        <ellipse key={s} cx={f.cx + s * f.cheekDx} cy={f.cheekY} rx={f.erx * 0.75} ry={f.erx * 0.48} fill="#FF9DB0" opacity={mood === "sorry" ? 0.55 : 0.85} />
      ))}
      {mood === "hello" && <path d={`M${f.cx - f.mw} ${f.my} Q${f.cx} ${f.my + f.mw} ${f.cx + f.mw} ${f.my}`} fill="none" stroke={INK} strokeWidth={f.sw} strokeLinecap="round" />}
      {mood === "happy" && <path d={`M${f.cx - f.mw} ${f.my - 1} Q${f.cx} ${f.my + f.mw * 1.7} ${f.cx + f.mw} ${f.my - 1}Z`} fill={INK} />}
      {mood === "sorry" && <path d={`M${f.cx - f.mw * 0.9} ${f.my + f.mw * 0.6} Q${f.cx} ${f.my - f.mw * 0.3} ${f.cx + f.mw * 0.9} ${f.my + f.mw * 0.6}`} fill="none" stroke={INK} strokeWidth={f.sw} strokeLinecap="round" />}
      {mood === "thinking" &&
        [-1, 0, 1].map((s) => <circle key={s} className="ff-dot" cx={f.cx + s * f.mw * 0.75} cy={f.my + f.mw * 0.2} r={f.sw * 0.6} fill={WHITE} style={{ animationDelay: `${(s + 1) * 0.2}s` }} />)}
    </>
  );
}

export function Fitfit({ mood, variant = "face", size, wave = false }: { mood: FitfitMood; variant?: "full" | "face"; size: number; wave?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" style={{ display: "block", overflow: "visible" }}>
      <style>{CSS}</style>
      {variant === "face" ? (
        <>
          <rect x="24" y="2" width="52" height="30" rx="7" fill={WHITE} stroke="#C9D6F5" strokeWidth="2" transform="rotate(6 50 17)" />
          <rect x="31" y="8" width="11" height="8" rx="2" fill={BLUE} transform="rotate(6 50 17)" />
          <rect x="8" y="18" width="84" height="78" rx="26" fill={BLUE} />
          <Face mood={mood} f={FACE_BIG} />
        </>
      ) : (
        <>
          <rect x="22" y="8" width="56" height="34" rx="7" fill={WHITE} stroke="#C9D6F5" strokeWidth="1.5" transform="rotate(6 50 25)" />
          <rect x="30" y="14" width="12" height="9" rx="2" fill={BLUE} transform="rotate(6 50 25)" />
          <ellipse cx="38" cy="92" rx="10" ry="5" fill={DEEP} />
          <ellipse cx="62" cy="92" rx="10" ry="5" fill={DEEP} />
          <g className={wave ? "ff-wave" : undefined}>
            <path d="M21 58 Q8 52 7 38" fill="none" stroke={DEEP} strokeWidth="8" strokeLinecap="round" />
          </g>
          <path d="M79 60 Q90 66 90 76" fill="none" stroke={DEEP} strokeWidth="8" strokeLinecap="round" />
          <rect x="18" y="28" width="64" height="62" rx="20" fill={BLUE} />
          <Face mood={mood} f={FACE_SMALL} />
        </>
      )}
    </svg>
  );
}
