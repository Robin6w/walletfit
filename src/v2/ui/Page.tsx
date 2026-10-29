import { useEffect, type ReactNode } from "react";

/**
 * 화면 본문. 디자인 원본의 main·안쪽 칸 값을 그대로 받는다.
 * 기본: padding 28px clamp(16px, 3.5vw, 48px) 48px · 최대 폭 1180px · 세로 간격 28px
 * row: 자주 가는 곳처럼 본문과 오른쪽 칸을 가로로 놓는 화면(flex-wrap, align-items: flex-start)
 */
export function PageMain({
  children,
  width = 1180,
  gap = 28,
  padding = "28px clamp(16px, 3.5vw, 48px) 48px",
  row = false,
  title,
}: {
  children: ReactNode;
  width?: number;
  gap?: number;
  padding?: string;
  row?: boolean;
  title?: string;
}) {
  useEffect(() => {
    document.title = title ? `${title} · WalletFit` : "WalletFit";
  }, [title]);
  return (
    <main id="w-main" style={{ boxSizing: "border-box", padding, minWidth: 0 }}>
      <div
        style={{
          maxWidth: width,
          margin: "0 auto",
          width: "100%",
          display: "flex",
          ...(row ? { flexWrap: "wrap", alignItems: "flex-start" } : { flexDirection: "column" }),
          gap,
        }}
      >
        {children}
      </div>
    </main>
  );
}

/** 화면 머리(제목 + 설명 + 오른쪽 버튼) */
export function PageHeader({ title, desc, aside, eyebrow }: { title: ReactNode; desc?: ReactNode; aside?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        {eyebrow}
        <h1 className="m-0 text-[clamp(26px,2.6vw,32px)] font-bold leading-[1.25] tracking-[-0.02em]">{title}</h1>
        {desc && <p className="mt-1.5 text-[15px] leading-[1.6] text-w-ink-3">{desc}</p>}
      </div>
      {aside}
    </header>
  );
}
