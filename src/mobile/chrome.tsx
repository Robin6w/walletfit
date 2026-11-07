import type { ReactNode } from "react";
import { ChevronLeft, CircleHelp, House, LayoutGrid, MessageCircle, Star, Wallet } from "lucide-react";
import { Link } from "@/v2/app/router";
import { paths } from "@/v2/app/paths";
import { chatStore, useChatState } from "@/v2/chat/chatStore";
import { Logo, type MenuId, type StepPill } from "@/v2/ui/TopBar";
import { TAB_H } from "@/mobile/tabs";

/**
 * 모바일 사이트 틀(2026-11-07).
 *  - 위: 얇은 머리줄(로고 + 이용 가이드). 메뉴는 아래 탭으로 옮겼다
 *  - 아래: 고정 탭(홈·내 지갑·전체 카드·혜택별·상담). 지갑 만들기 중에는 숨긴다
 *  - 지갑 만들기: 한 줄 머리줄(뒤로 · n/전체 단계 · 상담) + 진행 막대
 */

const TOP = "sticky top-0 z-20 w-full border-b border-[rgba(13,27,74,0.06)] bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur-md";

function IconButton({ label, onClick, children, pressed }: { label: string; onClick: () => void; children: ReactNode; pressed?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={`flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 ${pressed ? "bg-w-primary text-white" : "bg-w-bg text-w-ink-2"}`}
    >
      {children}
    </button>
  );
}

/** 메뉴 화면 머리줄. 지금 메뉴(active)는 아래 탭이 대신 보여 주므로 받지 않는다 */
export function MobileTopBar() {
  return (
    <header className={TOP}>
      <div className="flex h-14 items-center justify-between px-3">
        <Logo />
        <Link to={paths.guide} aria-label="이용 가이드" className="flex h-11 w-11 items-center justify-center rounded-full text-w-ink-2 no-underline">
          <CircleHelp className="h-[22px] w-[22px]" aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}

/** 지갑 만들기 머리줄: 뒤로(앞 단계, 첫 단계면 홈) · 지금 단계 · 상담 + 진행 막대 */
export function MobileWizardBar({ sub, steps }: { sub: string; steps: StepPill[] }) {
  const { open } = useChatState();
  const cur = Math.max(0, steps.findIndex((s) => s.state === "current"));
  const prev = [...steps.slice(0, cur)].reverse().find((s) => s.to);
  const back = prev?.to ?? paths.home;
  return (
    <header className={TOP}>
      <nav aria-label="지갑 만들기" className="flex h-14 items-center gap-2 px-2">
        <Link to={back} aria-label={prev ? `${prev.label}(으)로 돌아가기` : "홈으로"} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-w-ink no-underline">
          <ChevronLeft className="h-6 w-6" aria-hidden="true" />
        </Link>
        <div className="min-w-0 flex-1 text-center leading-[1.2]">
          <div className="truncate text-[12px] text-w-ink-3">지갑 만들기 · {sub}</div>
          <div className="truncate text-[16px] font-bold text-w-ink">
            <span className="w-num text-w-primary">
              {cur + 1}/{steps.length}
            </span>{" "}
            {steps[cur]?.label}
          </div>
        </div>
        <IconButton label="카드 상담" pressed={open} onClick={() => chatStore.toggle()}>
          <MessageCircle className="h-5 w-5" aria-hidden="true" />
        </IconButton>
      </nav>
      <ol aria-label="진행 단계" className="m-0 flex list-none gap-1 px-4 pb-2">
        {steps.map((s, i) => (
          <li key={s.label + i} className="flex-1">
            <span className="sr-only">
              {i + 1}단계 {s.label} {s.state === "done" ? "(끝남)" : s.state === "current" ? "(지금)" : ""}
            </span>
            <span aria-hidden="true" className={`block h-1 rounded-full ${s.state === "todo" ? "bg-[#E1E8F7]" : "bg-w-primary"}`} />
          </li>
        ))}
      </ol>
    </header>
  );
}

type TabId = Exclude<MenuId, null>;

const TABS: { id: TabId; label: string; to: string; icon: ReactNode }[] = [
  { id: "home", label: "홈", to: paths.home, icon: <House className="h-[22px] w-[22px]" aria-hidden="true" /> },
  { id: "wallet", label: "내 지갑", to: paths.wallet, icon: <Wallet className="h-[22px] w-[22px]" aria-hidden="true" /> },
  { id: "cards", label: "전체 카드", to: paths.cards, icon: <LayoutGrid className="h-[22px] w-[22px]" aria-hidden="true" /> },
  { id: "benefit", label: "혜택별", to: paths.benefit, icon: <Star className="h-[22px] w-[22px]" aria-hidden="true" /> },
];


export function TabBar({ active }: { active: TabId | null }) {
  const { open } = useChatState();
  const item = "flex min-w-0 flex-1 flex-col items-center justify-center gap-[3px] text-[11px] no-underline";
  return (
    <nav
      aria-label="주 메뉴"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[rgba(13,27,74,0.08)] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
      style={{ height: `calc(${TAB_H}px + env(safe-area-inset-bottom))` }}
    >
      {TABS.map((t) => {
        const on = t.id === active && !open;
        return (
          <Link key={t.id} to={t.to} aria-current={on ? "page" : undefined} onClick={() => open && chatStore.setOpen(false)} className={`${item} ${on ? "font-bold text-w-primary" : "font-medium text-w-ink-3"}`}>
            {t.icon}
            {t.label}
          </Link>
        );
      })}
      <button type="button" onClick={() => chatStore.toggle()} aria-expanded={open} aria-controls="w-chat-panel" className={`${item} cursor-pointer border-0 bg-transparent ${open ? "font-bold text-w-primary" : "font-medium text-w-ink-3"}`}>
        <MessageCircle className="h-[22px] w-[22px]" aria-hidden="true" />
        상담
      </button>
    </nav>
  );
}
