import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Link } from "@/v2/app/router";

/* v2 공용 부품. 색·크기는 디자인(양준서 페이지) 값을 그대로 쓴다. */

export type BtnKind = "primary" | "outline" | "soft" | "ghost" | "white";
export type BtnSize = "sm" | "md" | "lg" | "xl";

const BTN_BASE =
  "inline-flex items-center justify-center gap-[7px] whitespace-nowrap rounded-full font-bold no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-45";
const BTN_SIZE: Record<BtnSize, string> = {
  sm: "h-10 px-[14px] text-[13px]",
  md: "h-11 px-[18px] text-[14px]",
  lg: "h-12 px-[22px] text-[15px]",
  xl: "h-14 px-7 text-[17px]",
};
const BTN_KIND: Record<BtnKind, string> = {
  primary: "bg-w-primary text-white hover:bg-w-primary-deep",
  outline: "border border-w-line-strong bg-white text-w-ink hover:bg-w-soft",
  soft: "bg-w-tint text-w-primary hover:bg-[#dde6ff]",
  ghost: "text-w-ink-2 hover:bg-w-tint/60",
  white: "bg-white text-w-primary hover:bg-w-soft",
};

export function btnClass(kind: BtnKind = "outline", size: BtnSize = "lg", extra = "") {
  return `${BTN_BASE} ${BTN_SIZE[size]} ${BTN_KIND[kind]} ${extra}`;
}

export function Btn({ kind = "outline", size = "lg", className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { kind?: BtnKind; size?: BtnSize }) {
  return <button type="button" className={btnClass(kind, size, className)} {...rest} />;
}

export function BtnLink({ to, kind = "outline", size = "lg", className = "", children, onClick, ...rest }: { to: string; kind?: BtnKind; size?: BtnSize; className?: string; children: ReactNode; onClick?: () => void; "aria-label"?: string }) {
  return (
    <Link to={to} className={btnClass(kind, size, className)} onClick={onClick} {...rest}>
      {children}
    </Link>
  );
}

/** 흰 카드 칸 */
export function Panel({ children, className = "", as = "section", ...rest }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" | "aside"; "aria-labelledby"?: string; "aria-label"?: string }) {
  const Tag = as;
  return (
    <Tag className={`rounded-[20px] bg-white w-shadow ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

/** 회색 둥근 칩(혜택 요약 등) */
export function Chip({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-full border border-w-line bg-w-bg px-[10px] py-[3px] text-[13px] text-w-ink-2 ${className}`}>{children}</span>;
}

/** 작은 표시(내 카드, 신규 발급 중단 등) */
export function Badge({ children, tone = "tint", className = "" }: { children: ReactNode; tone?: "tint" | "warn" | "ok" | "plain"; className?: string }) {
  const tones = {
    tint: "bg-w-tint text-w-primary-deep",
    warn: "bg-w-warn-bg text-w-warn border border-w-warn-line",
    ok: "bg-w-ok-bg text-w-ok",
    plain: "bg-w-bg text-w-ink-2 border border-w-line",
  };
  return <span className={`inline-flex h-[26px] items-center whitespace-nowrap rounded-[13px] px-[10px] text-[12px] font-bold ${tones[tone]} ${className}`}>{children}</span>;
}

/** 구분 버튼 묶음(전체·신용·체크 등) */
export function Segmented<T extends string>({ options, value, onChange, label, size = "md" }: { options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; label: string; size?: "sm" | "md" }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap rounded-[12px] bg-w-bg p-[3px]">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={`${size === "sm" ? "h-9 px-3 text-[13px]" : "h-10 px-4 text-[14px]"} whitespace-nowrap rounded-[9px] ${on ? "bg-white font-bold text-w-ink shadow-[0_1px_3px_rgba(13,40,120,0.12)]" : "text-w-ink-2"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** 고르기 칩(혜택으로 찾기 등): 켜지면 파란 바탕 */
export function ToggleChip({ on, onClick, children, className = "" }: { on: boolean; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-[20px] border px-[14px] text-[14px] ${on ? "border-w-primary bg-w-primary font-bold text-white" : "border-w-line-strong bg-white text-w-ink-2 hover:border-w-primary"} ${className}`}
    >
      {children}
    </button>
  );
}

/** 금액 입력 칸: 오른쪽 정렬 숫자 + '원' */
export function WonField({ id, value, onChange, label, width = 96, className = "" }: { id?: string; value: number; onChange: (v: number) => void; label: string; width?: number; className?: string }) {
  return (
    <div className={`flex h-11 items-center gap-1.5 rounded-[10px] border border-w-line-strong bg-white px-3 focus-within:border-w-primary ${className}`}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        inputMode="numeric"
        value={value ? value.toLocaleString("ko-KR") : ""}
        placeholder="0"
        aria-label={id ? undefined : label}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^0-9]/g, "");
          onChange(digits ? Math.min(Number(digits), 99_999_999) : 0);
        }}
        style={{ width }}
        className="w-num bg-transparent text-right text-[16px] font-bold text-w-ink outline-none placeholder:text-w-ink-3"
      />
      <span className="text-[14px] text-w-ink-3">원</span>
    </div>
  );
}

/** 켜고 끄는 스위치 */
export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="inline-flex h-11 items-center gap-2.5 rounded-full border border-w-line-strong bg-white pl-3 pr-4 text-[14px] font-bold text-w-ink">
      <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${on ? "bg-w-primary" : "bg-[#C3CEE6]"}`}>
        <span className={`absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(13,40,120,0.25)] transition-[left] ${on ? "left-[19px]" : "left-[3px]"}`} />
      </span>
      {label}
    </button>
  );
}

/** 접는 칸('더 자세히 보고 싶다면') */
export function Disclosure({ title, sub, children, defaultOpen, id }: { title: ReactNode; sub?: ReactNode; children: ReactNode; defaultOpen?: boolean; id?: string }) {
  return (
    <details id={id} open={defaultOpen} className="group rounded-[16px] bg-white w-shadow">
      <summary className="flex min-h-16 cursor-pointer items-center justify-between gap-3 px-5 py-3">
        <span>
          <span className="block text-[15px] font-bold">{title}</span>
          {sub && <span className="mt-0.5 block text-[13px] text-w-ink-3">{sub}</span>}
        </span>
        <ChevronDown aria-hidden="true" className="h-5 w-5 shrink-0 text-w-ink-3 transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-5 pb-[18px] text-[14px] leading-[1.7] text-w-ink-2">{children}</div>
    </details>
  );
}

export function Spinner({ label = "계산하고 있어요" }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-[14px] text-w-ink-3">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-w-primary border-t-transparent" aria-hidden="true" />
      {label}
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`v1-skeleton rounded-[16px] ${className}`} />;
}

/** 경고 칸(실적 여유 없음 등) */
export function WarnBox({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[18px] border border-w-warn-line bg-w-warn-bg ${className}`}>{children}</div>;
}
