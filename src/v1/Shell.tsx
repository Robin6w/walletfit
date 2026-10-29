import type { ReactNode } from "react";
import { Check, FileText, Home, LayoutGrid, MessageCircle, Star, Wallet, X, ChevronLeft } from "lucide-react";

export type V1Tab = "home" | "wallet" | "gallery" | "benefit" | "statement" | "wizard" | "chat";

const NAV: { id: V1Tab; label: string; icon: typeof Home }[] = [
  { id: "home", label: "홈", icon: Home },
  { id: "wallet", label: "내 지갑", icon: Wallet },
  { id: "gallery", label: "전체 카드", icon: LayoutGrid },
  { id: "benefit", label: "혜택별 추천", icon: Star },
  { id: "statement", label: "명세서 분석", icon: FileText },
];

const MOBILE_TABS: V1Tab[] = ["home", "wallet", "gallery"];

export interface WizardStepPill {
  label: string;
  summary?: string;
  state: "done" | "current" | "todo";
}

interface ShellProps {
  tab: V1Tab;
  onNavigate: (tab: V1Tab) => void;
  children: ReactNode;
  /** 지갑 만들기 중이면 상단 바가 단계 알약으로 바뀝니다 */
  wizard?: { title: string; sub: string; steps: WizardStepPill[]; onClose: () => void; onBack?: () => void; mobileTitle: string };
  /** 화면 아래에 고정되는 바(지갑 만들기 단계 버튼 등) */
  bottomBar?: ReactNode;
}

export function Shell({ tab, onNavigate, children, wizard, bottomBar }: ShellProps) {
  return (
    <div className="v1-root min-h-screen bg-ground text-ink">
      <a href="#v1-main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        본문으로 건너뛰기
      </a>
      {/* 데스크톱 상단 글라스 바 */}
      <header className="sticky top-0 z-30 hidden px-[clamp(16px,3.5vw,48px)] pt-4 md:block">
        <div className="v1-glass mx-auto flex h-16 max-w-[1180px] items-center justify-between gap-4 rounded-full px-3">
          {wizard ? (
            <div className="flex min-w-0 items-center gap-3">
              <button type="button" onClick={wizard.onClose} aria-label="지갑 만들기 닫기" className="flex h-11 w-11 items-center justify-center rounded-full bg-line-soft text-ink-2 hover:bg-line">
                <X className="h-4 w-4" />
              </button>
              <div className="min-w-0 leading-tight">
                <div className="truncate text-[14px] font-bold">{wizard.title}</div>
                <div className="truncate text-[11.5px] text-ink-3">{wizard.sub}</div>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => onNavigate("home")} className="flex items-center gap-2 px-2" aria-label="WalletFit 홈">
              <img src="/logo-icon.png" alt="" className="h-8 w-8" />
              <span className="text-[17px] font-extrabold tracking-tight">
                Wallet<span className="text-primary">Fit</span>
              </span>
            </button>
          )}

          {wizard ? (
            <ol className="flex items-center gap-1 rounded-full bg-line-soft p-1" aria-label="진행 단계">
              {wizard.steps.map((s, i) => (
                <li
                  key={s.label}
                  aria-current={s.state === "current" ? "step" : undefined}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] ${
                    s.state === "current" ? "bg-surface font-bold text-ink shadow-sm" : "text-ink-3"
                  }`}
                >
                  {s.state === "done" ? (
                    <Check className="h-3.5 w-3.5 text-positive" aria-label="완료" />
                  ) : (
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${s.state === "current" ? "bg-primary text-white" : "border border-line-strong"}`}>
                      {i + 1}
                    </span>
                  )}
                  <span>{s.label}</span>
                  {s.summary && <span className="text-ink-3">· {s.summary}</span>}
                </li>
              ))}
            </ol>
          ) : (
            <nav aria-label="주 메뉴" className="flex items-center gap-1 rounded-full bg-line-soft p-1">
              {NAV.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onNavigate(id)}
                  aria-current={tab === id ? "page" : undefined}
                  className={`flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] ${tab === id ? "bg-surface font-bold text-primary shadow-sm" : "text-ink-2 hover:text-ink"}`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </nav>
          )}

          <button
            type="button"
            onClick={() => onNavigate("chat")}
            className={`flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-bold ${tab === "chat" ? "bg-primary text-white" : "border border-tint-line bg-tint text-primary"}`}
          >
            <MessageCircle className="h-4 w-4" />
            카드 상담
          </button>
        </div>
      </header>

      {/* 모바일 상단 */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-ground/90 px-4 backdrop-blur md:hidden">
        {wizard ? (
          <>
            <button type="button" onClick={wizard.onBack ?? wizard.onClose} aria-label="뒤로" className="flex h-11 w-11 items-center justify-center rounded-full bg-surface shadow-sm">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="text-center">
              <div className="text-[15px] font-bold">{wizard.mobileTitle}</div>
              <div className="mt-1 flex justify-center gap-1" aria-hidden="true">
                {wizard.steps.map((s) => (
                  <span key={s.label} className={`h-1 w-6 rounded-full ${s.state === "todo" ? "bg-line-strong" : "bg-primary"}`} />
                ))}
              </div>
            </div>
            <span className="w-11" />
          </>
        ) : (
          <>
            <button type="button" onClick={() => onNavigate("home")} className="flex items-center gap-2" aria-label="WalletFit 홈">
              <img src="/logo-icon.png" alt="" className="h-7 w-7" />
              <span className="text-[16px] font-extrabold">
                Wallet<span className="text-primary">Fit</span>
              </span>
            </button>
            <div className="flex gap-1">
              <button type="button" onClick={() => onNavigate("benefit")} className="min-h-11 rounded-full px-3 text-[13px] text-ink-2">
                혜택별
              </button>
              <button type="button" onClick={() => onNavigate("statement")} className="min-h-11 rounded-full px-3 text-[13px] text-ink-2">
                명세서
              </button>
            </div>
          </>
        )}
      </header>

      <main id="v1-main" className={`v1-wrap pb-36 pt-4 md:pt-8 ${wizard ? "" : "md:pb-16"}`}>
        {children}
      </main>

      {bottomBar && (
        <div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-3 md:px-[clamp(16px,3.5vw,48px)] md:pb-5">
          <div className="v1-glass mx-auto flex max-w-[1180px] items-center gap-2 rounded-[24px] px-3 py-2.5 md:rounded-full md:px-4">{bottomBar}</div>
        </div>
      )}

      {/* 모바일 탭 바: 마법사 단계에서는 하단 고정 버튼으로 바뀜 */}
      {!wizard && !bottomBar && (
        <nav aria-label="모바일 메뉴" className="fixed inset-x-0 bottom-3 z-30 flex justify-center px-3 md:hidden">
          <div className="v1-glass flex items-center gap-1 rounded-full p-1.5">
            {NAV.filter((n) => MOBILE_TABS.includes(n.id)).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => onNavigate(id)}
                aria-current={tab === id ? "page" : undefined}
                className={`flex min-h-11 flex-col items-center justify-center rounded-full px-4 text-[11px] ${tab === id ? "bg-surface font-bold text-primary" : "text-ink-2"}`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
            <button type="button" onClick={() => onNavigate("chat")} className="ml-1 flex min-h-11 items-center gap-1 rounded-full bg-primary px-4 text-[13px] font-bold text-white">
              <MessageCircle className="h-4 w-4" />
              상담
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
