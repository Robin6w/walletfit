import { useEffect, useRef, type ReactNode } from "react";
import { Check, ChevronRight } from "lucide-react";
import { Link } from "@/v2/app/router";
import { paths } from "@/v2/app/paths";
import { chatStore, useChatState } from "@/v2/chat/chatStore";
import { ChatBubbleIcon } from "@/v2/ui/icons";

const HEADER = "sticky top-0 z-20 w-full px-[clamp(16px,3.5vw,48px)] pt-4";
const NAV = "mx-auto flex max-w-[1180px] flex-wrap items-center gap-x-3 gap-y-2 rounded-[30px] bg-white p-[7px] w-shadow w-glass";

export type MenuId = "home" | "wallet" | "cards" | "benefit" | null;

const MENU: { id: Exclude<MenuId, null>; label: string; to: string; icon: ReactNode }[] = [
  {
    id: "home",
    label: "홈",
    to: paths.home,
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V20h14V9.5" />
      </svg>
    ),
  },
  {
    id: "wallet",
    label: "내 지갑",
    to: paths.wallet,
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
        <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
      </svg>
    ),
  },
  {
    id: "cards",
    label: "전체 카드",
    to: paths.cards,
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    id: "benefit",
    label: "혜택별 추천",
    to: paths.benefit,
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
      </svg>
    ),
  },
];

function ChatToggle() {
  const { open } = useChatState();
  return (
    <button
      type="button"
      onClick={() => chatStore.toggle()}
      aria-expanded={open}
      aria-controls="w-chat-panel"
      className={`flex h-11 shrink-0 items-center gap-[7px] rounded-[22px] border px-4 text-[14px] font-bold ${open ? "border-w-primary bg-w-primary text-white" : "border-[rgba(36,87,245,0.14)] bg-[rgba(36,87,245,0.10)] text-w-primary"}`}
    >
      <ChatBubbleIcon />
      카드 상담
    </button>
  );
}

export function Logo() {
  return (
    <Link to={paths.home} aria-label="WalletFit 홈" className="flex h-11 shrink-0 items-center gap-2 px-2 text-w-ink no-underline">
      <img src={`${import.meta.env.BASE_URL}logo-icon.png`} alt="" className="h-[30px] w-[30px] object-contain" />
      <span className="text-[17px] font-bold">
        Wallet<span className="text-w-primary">Fit</span>
      </span>
    </Link>
  );
}

/** 메뉴형 상단 바: 홈·내 지갑·전체 카드·혜택별 추천 + 카드 상담 */
export function MenuBar({ active }: { active: MenuId }) {
  return (
    <header className={HEADER}>
      <nav aria-label="주 메뉴" className={`${NAV} pl-[10px]`}>
        <Logo />
        <div className="order-3 mx-auto flex w-full min-w-0 items-center gap-0.5 overflow-x-auto rounded-[24px] bg-w-bg p-1 sm:order-none sm:w-auto">
          {MENU.map((m) => {
            const on = m.id === active;
            return (
              <Link
                key={m.id}
                to={m.to}
                aria-current={on ? "page" : undefined}
                className={`flex h-10 shrink-0 items-center gap-[7px] whitespace-nowrap rounded-[20px] px-4 text-[15px] no-underline ${on ? "bg-w-primary font-semibold text-white w-shadow-primary" : "font-medium text-w-ink-2 hover:text-w-ink"}`}
              >
                {m.icon}
                {m.label}
              </Link>
            );
          })}
        </div>
        <div className="ml-auto sm:ml-0">
          <ChatToggle />
        </div>
      </nav>
    </header>
  );
}

export interface StepPill {
  label: string;
  /** 끝난 단계 옆 요약(· 6장, · 83만 5천원) */
  summary?: string;
  state: "done" | "current" | "todo";
  /** 끝난 단계로 돌아가는 주소 */
  to?: string;
}

/** 지갑 만들기 단계형 상단 바 */
export function WizardBar({ sub, steps }: { sub: string; steps: StepPill[] }) {
  const { open } = useChatState();
  const olRef = useRef<HTMLOListElement>(null);
  const current = steps.findIndex((s) => s.state === "current");
  // 좁은 화면에서 단계 줄이 넘치면 현재 단계가 보이게 가로로 옮긴다(2026-10-29)
  useEffect(() => {
    const ol = olRef.current;
    const cur = ol?.querySelector<HTMLElement>("[aria-current='step']");
    if (!ol || !cur || ol.scrollWidth <= ol.clientWidth) return;
    const left = cur.getBoundingClientRect().left - ol.getBoundingClientRect().left + ol.scrollLeft - (ol.clientWidth - cur.offsetWidth) / 2;
    ol.scrollLeft = Math.max(0, left);
  }, [current, steps.length, open]);
  return (
    <header className={HEADER}>
      <nav aria-label="지갑 만들기" className={NAV}>
        <Link to={paths.home} className="flex h-11 shrink-0 items-center gap-1.5 rounded-[22px] bg-w-bg pl-[13px] pr-4 text-[14px] font-semibold text-w-ink-2 no-underline">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5 9.5V20h14V9.5" />
          </svg>
          홈으로
        </Link>
        <div className="flex shrink-0 flex-col px-1 leading-[1.25]">
          <span className="text-[15px] font-bold text-w-ink">지갑 만들기</span>
          <span className="text-[12px] text-w-ink-3">{sub}</span>
        </div>
        <ol ref={olRef} aria-label="진행 단계" className="order-3 mx-auto flex w-full min-w-0 list-none items-center gap-0.5 overflow-x-auto rounded-[24px] bg-w-bg p-1 lg:order-none lg:w-auto">
          {steps.map((s, i) => {
            const num = i + 1;
            const pill =
              s.state === "current" ? (
                <span aria-current="step" className="flex h-10 shrink-0 items-center gap-[7px] whitespace-nowrap rounded-[20px] bg-w-primary px-4 text-[14px] font-bold text-white w-shadow-primary">
                  <span className="w-num flex h-[22px] w-[22px] items-center justify-center rounded-full bg-white text-[12px] text-w-primary">{num}</span>
                  {s.label}
                </span>
              ) : s.state === "done" ? (
                <Link to={s.to ?? "#"} className="flex h-10 shrink-0 items-center gap-[7px] whitespace-nowrap rounded-[20px] px-[14px] text-[14px] font-semibold text-w-ink-2 no-underline hover:bg-white">
                  <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#E6EEFF]">
                    <Check className="h-3 w-3 text-w-primary" strokeWidth={3} aria-hidden="true" />
                  </span>
                  {s.label}
                  {/* 요약(· 6장)은 좁은 화면과 상담 창을 연 화면에서 줄을 짧게 하려고 숨긴다 */}
                  {s.summary && <span className={`font-medium text-w-ink-3 ${open ? "hidden 2xl:inline" : "hidden sm:inline"}`}>· {s.summary}</span>}
                </Link>
              ) : (
                <span className="flex h-10 shrink-0 items-center gap-[7px] whitespace-nowrap px-[14px] text-[14px] font-medium text-w-ink-3">
                  <span className="w-num flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px] border-w-mute text-[12px]">{num}</span>
                  {s.label}
                </span>
              );
            return (
              <li key={s.label} className="flex shrink-0 items-center">
                {i > 0 && <ChevronRight aria-hidden="true" className="mx-0.5 h-3.5 w-3.5 text-w-mute" strokeWidth={2.4} />}
                {pill}
              </li>
            );
          })}
        </ol>
        <div className="ml-auto lg:ml-0">
          <ChatToggle />
        </div>
      </nav>
    </header>
  );
}

/** 화면 아래에 붙는 흰 바(이전·합계·다음) */
export function BottomBar({ children, padding = "14px 16px 14px 20px" }: { children: ReactNode; padding?: string }) {
  return (
    <div
      data-glass=""
      className="w-shadow w-glass"
      style={{ position: "sticky", bottom: 16, zIndex: 10, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px 20px", padding, borderRadius: 28, background: "#FFFFFF", border: "1px solid transparent" }}
    >
      {children}
    </div>
  );
}
