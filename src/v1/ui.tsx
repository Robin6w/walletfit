import { useState, type ReactNode, type ButtonHTMLAttributes } from "react";
import { catalogBySourceId } from "@/v1/catalog";

/* v1 공통 부품. 색·간격은 index.css의 v1 토큰(ground, ink, primary …)을 씁니다. */

type BtnKind = "primary" | "secondary" | "ghost" | "tint";

export function Btn({
  kind = "secondary",
  size = "md",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { kind?: BtnKind; size?: "sm" | "md" | "lg" }) {
  const base = "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-bold transition disabled:cursor-not-allowed disabled:opacity-40";
  const sizes = { sm: "min-h-9 px-3.5 text-[13px]", md: "min-h-11 px-5 text-[14px]", lg: "min-h-12 px-6 text-[15px]" };
  const kinds: Record<BtnKind, string> = {
    primary: "bg-primary text-white shadow-[0_6px_16px_rgba(27,79,216,0.28)] hover:bg-[#1744bd]",
    secondary: "border border-line-strong bg-surface text-ink hover:bg-ground",
    ghost: "text-ink-2 hover:bg-line-soft",
    tint: "border border-tint-line bg-tint text-primary hover:bg-[#dde8ff]",
  };
  return <button type="button" className={`${base} ${sizes[size]} ${kinds[kind]} ${className}`} {...rest} />;
}

export function Pill({ tone = "tint", children, className = "" }: { tone?: "tint" | "caution" | "positive" | "plain"; children: ReactNode; className?: string }) {
  const tones = {
    tint: "bg-tint text-primary border border-tint-line",
    caution: "bg-caution-bg text-caution border border-[#F3D9B5]",
    positive: "bg-positive-bg text-positive border border-[#BFE3D2]",
    plain: "bg-line-soft text-ink-2 border border-line",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${tones[tone]} ${className}`}>{children}</span>;
}

export function Section({ title, aside, children, className = "" }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[20px] border border-line bg-surface p-5 sm:p-6 ${className}`}>
      {(title || aside) && (
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          {title && <h2 className="text-[18px] font-extrabold text-ink sm:text-[20px]">{title}</h2>}
          {aside && <div className="text-[12.5px] text-ink-3">{aside}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** 카드 앞면 썸네일(가로:세로 1.586). 이미지를 못 불러오면 색 상자 + 카드 이름. 왼쪽 위 점은 조합 안의 카드 식별색. */
export function CardFace({ sid, width = 112, dot, label }: { sid: number; width?: number; dot?: string; label?: string }) {
  const entry = catalogBySourceId.get(sid);
  const [failed, setFailed] = useState(false);
  const h = Math.round(width / 1.586);
  const name = label ?? shortName(entry?.name ?? "");
  const showImg = entry?.imageUrl && !failed;
  return (
    <div className="relative shrink-0" style={{ width, height: h }} aria-hidden="true">
      {showImg ? (
        <img
          src={entry!.imageUrl}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full rounded-[8px] object-contain shadow-[0_2px_8px_rgba(18,26,62,0.16)]"
        />
      ) : (
        <div
          className="flex h-full w-full flex-col justify-between rounded-[8px] p-2 text-white shadow-[0_2px_8px_rgba(18,26,62,0.16)]"
          style={{ background: faceColor(sid) }}
        >
          <span className="h-[18%] w-[17%] rounded-[3px] bg-white/40" />
          {width >= 88 && <span className="truncate text-[11px] font-bold leading-tight">{name}</span>}
        </div>
      )}
      {dot && <span className="absolute -left-1 -top-1 h-3 w-3 rounded-full border-2 border-white" style={{ background: dot }} />}
    </div>
  );
}

const FACE = ["#26315F", "#3D4F86", "#5C6789", "#2E3A4F", "#5B4E7A", "#55657A", "#2F5E4E", "#7A4A3A"];
function faceColor(sid: number) {
  return FACE[sid % FACE.length];
}

export function shortName(n: string): string {
  return n
    .replace(/^(삼성카드|신한카드|삼성페이 삼성카드|삼성|뱅크샐러드|KB국민카드|현대카드|우리카드|롯데카드|하나카드|NH농협카드|BC카드|IBK기업은행)\s+/, "")
    .replace(/\s*카드$/, "")
    .trim();
}

export function Spinner({ label = "계산하고 있어요" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-ink-3" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      {label}
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`v1-skeleton rounded-[12px] ${className}`} />;
}

/** 단계 번호 원 */
export function StepDot({ n, tone = "primary" }: { n: ReactNode; tone?: "primary" | "positive" }) {
  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold text-white ${tone === "positive" ? "bg-positive" : "bg-primary"}`}
    >
      {n}
    </span>
  );
}

export function Money({ value, className = "" }: { value: string; className?: string }) {
  return <span className={`tnum ${className}`}>{value}</span>;
}

/** 원문 인용 접기 */
export function QuoteToggle({ quote, label = "원문 보기" }: { quote: string; label?: string }) {
  const [open, setOpen] = useState(false);
  if (!quote) return null;
  return (
    <div className="mt-2 rounded-[10px] bg-ground">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="w-full px-3 py-2 text-left text-[12.5px] font-semibold text-ink-2">
        {open ? "원문 접기" : label}
      </button>
      {open && <p className="px-3 pb-3 text-[12.5px] leading-relaxed text-ink-2">“{quote}”</p>}
    </div>
  );
}

export function WonInput({
  value,
  onChange,
  label,
  className = "",
  widthClass = "w-32",
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  className?: string;
  widthClass?: string;
}) {
  return (
    <label className={`inline-flex items-center gap-1.5 rounded-[12px] border border-line-strong bg-surface px-3 py-2 focus-within:border-primary ${className}`}>
      <span className="sr-only">{label}</span>
      <input
        inputMode="numeric"
        value={value ? value.toLocaleString("ko-KR") : ""}
        placeholder="0"
        onChange={(e) => {
          const digits = e.target.value.replace(/[^0-9]/g, "");
          onChange(digits ? Math.min(Number(digits), 99_999_999) : 0);
        }}
        className={`tnum ${widthClass} bg-transparent text-right text-[15px] font-bold text-ink outline-none`}
      />
      <span className="text-[13px] text-ink-3">원</span>
    </label>
  );
}
