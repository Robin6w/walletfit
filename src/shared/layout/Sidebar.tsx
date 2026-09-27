import { Home, LayoutGrid, Receipt, Tag, Wallet, RotateCcw, MessageCircle, X } from "lucide-react";
import type { AppTab } from "@/App";

interface NavItemDef {
  id: AppTab;
  label: string;
  sub?: string;
  icon: typeof Home;
  group?: string;
}

const NAV_ITEMS: NavItemDef[] = [
  { id: "home", label: "홈", icon: Home },
  { id: "gallery", label: "전체 카드 보기", icon: LayoutGrid, group: "둘러보기" },
  {
    id: "statement",
    label: "명세서로 소비 분석",
    sub: "명세서 업로드로 분석",
    icon: Receipt,
    group: "추천받기",
  },
  {
    id: "benefit",
    label: "혜택별 카드 추천",
    sub: "카테고리로 바로 찾기",
    icon: Tag,
  },
  {
    id: "wizard",
    label: "내 지갑 만들기",
    sub: "직접 입력 · 단계별 진행",
    icon: Wallet,
  },
];

interface SidebarProps {
  active: AppTab;
  onNavigate: (tab: AppTab) => void;
  onRestart: () => void;
  onOpenChat: () => void;
  /** 좁은 화면(모바일)에서 사이드바를 오버레이로 열어둔 상태인지. sm 이상에서는 항상 무시하고 고정 표시합니다. */
  mobileOpen?: boolean;
  /** 모바일 오버레이를 닫을 때(배경 클릭, 닫기 버튼, 메뉴 항목 선택) 호출합니다. */
  onMobileClose?: () => void;
}

export function Sidebar({ active, onNavigate, onRestart, onOpenChat, mobileOpen = false, onMobileClose }: SidebarProps) {
  let lastGroup: string | undefined;

  const handleNavigate = (tab: AppTab) => {
    onNavigate(tab);
    onMobileClose?.();
  };

  return (
    <>
      {/* 모바일 오버레이 배경 — sm 이상에서는 사이드바가 원래 자리에 고정 표시되므로 필요 없습니다. */}
      {mobileOpen && (
        <div
          aria-hidden="true"
          onClick={onMobileClose}
          className="fixed inset-0 z-30 bg-black/40 sm:hidden"
        />
      )}
      {/* 2026-09 UI 고도화: 블러를 20px로 올리고 오른쪽 경계를 옅은 화이트 보더로 그어서
          "벤토 그리드 + 리파인드 글래스" 방향의 유리 내비게이션 레일 느낌을 낸다. */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[250px] shrink-0 flex-col border-r border-white/70 bg-white/70 px-4.5 py-6.5 text-[#14192f] backdrop-blur-[20px] transition-transform duration-200 ease-out sm:static sm:z-auto sm:translate-x-0 sm:border-white/60 sm:bg-white/45 ${
          mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        <button
          type="button"
          onClick={onMobileClose}
          aria-label="메뉴 닫기"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#14192f]/8 text-[#14192f]/60 sm:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      <div className="flex items-center gap-3.5 px-1">
        <img src="/logo-icon.png" alt="walletfit" className="h-14 w-14 rounded-[13px] object-contain" />
        <span className="text-[30px] font-bold tracking-tight">
          <span>wallet</span>
          <span className="text-brand-blue">fit</span>
        </span>
      </div>
      <p className="mt-2 px-1 text-[11px] leading-relaxed text-[#14192f]">
        내 지출 패턴에 맞는
        <br />
        카드 조합을 찾아드려요
      </p>

      <nav className="mt-7 flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const showGroupLabel = item.group && item.group !== lastGroup;
          lastGroup = item.group ?? lastGroup;
          const Icon = item.icon;
          const isActive = active === item.id;

          return (
            <div key={item.id}>
              {showGroupLabel && (
                <div className="mt-3.5 mb-1.5 px-1.5 text-[10px] font-bold uppercase tracking-wide text-[#14192f]/45">
                  {item.group}
                </div>
              )}
              <button
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`tap-press group relative flex w-full items-center gap-2.5 overflow-hidden rounded-xl py-2.5 pl-3.5 pr-3 text-left text-[13px] font-semibold transition ${
                  isActive ? "glass-panel text-[#14192f] shadow-sm" : "text-[#14192f]/80 hover:bg-white/40"
                }`}
              >
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="brand-gradient-select absolute inset-y-1.5 left-0 w-1 rounded-full"
                  />
                )}
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] transition ${
                    isActive
                      ? "brand-gradient-select text-white shadow-sm"
                      : "bg-white/50 text-[#14192f]/60 group-hover:bg-white/75"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span>
                  {item.label}
                  {item.sub && <span className="mt-0.5 block text-[10px] font-medium text-[#3a3f57]">{item.sub}</span>}
                </span>
              </button>
            </div>
          );
        })}
      </nav>

      <div className="flex-1" />

      <button
        type="button"
        onClick={onRestart}
        className="tap-press mb-2.5 flex items-center justify-center gap-1.5 rounded-[10px] bg-[#14192f]/8 px-3 py-2.5 text-[11.5px] font-semibold text-[#14192f] transition hover:bg-[#14192f]/14"
      >
        <RotateCcw className="h-3.5 w-3.5" /> 처음부터 다시 하기
      </button>
      <button
        type="button"
        onClick={onOpenChat}
        className="tap-press cta-btn brand-gradient-soft flex items-center justify-center gap-2 rounded-xl border border-brand-blue/40 px-3.5 py-3 text-[12.5px] font-bold text-white shadow-[0_8px_20px_rgba(107,70,193,0.35)]"
      >
        <MessageCircle className="h-4 w-4" /> 카드 상담 챗봇
      </button>
      </aside>
    </>
  );
}
