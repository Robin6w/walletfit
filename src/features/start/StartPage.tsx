import { useState } from "react";
import { ArrowRight, HelpCircle, X, CreditCard, SlidersHorizontal, Sparkles } from "lucide-react";
import type { SimulatorScope } from "@/features/wallet/WalletWizardPage";

interface StartPageProps {
  onSelectScope: (scope: SimulatorScope) => void;
}

const TUTORIAL_STEPS = [
  {
    icon: CreditCard,
    title: "카드 선택",
    desc: "지금 가지고 있는 카드 중에서 고르거나, 전체 카드 중에서 추천받을 범위를 정해요",
  },
  {
    icon: SlidersHorizontal,
    title: "지출 입력",
    desc: "카테고리별로 한 달 지출을 입력하면 실적 조건까지 반영해서 계산해요",
  },
  {
    icon: Sparkles,
    title: "추천 결과",
    desc: "내 지출에 가장 유리한 카드 조합과 예상 순혜택을 바로 확인해요",
  },
];

/**
 * 앱 진입 직후 보여주는 시작 화면입니다. 사이드바 없이 "내 지갑 만들기" 두 갈래
 * 선택지만 두고, 처음 쓰는 사람을 위한 튜토리얼은 별도 버튼으로 옆에 빼뒀습니다
 * (필요한 사람만 눌러서 보고, 나머지는 바로 다음 단계로 넘어갈 수 있게).
 */
export function StartPage({ onSelectScope }: StartPageProps) {
  const [tutorialOpen, setTutorialOpen] = useState(false);

  return (
    <div className="mesh-bg relative flex min-h-screen w-full flex-col px-8 py-10 sm:px-16 sm:py-14">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <img src="/logo-icon.png" alt="walletfit" className="h-9 w-9 rounded-[10px] object-contain" />
          <span className="text-xl font-bold tracking-tight text-[#14192f]">
            wallet<span className="text-brand-blue">fit</span>
          </span>
        </div>

        <button
          type="button"
          onClick={() => setTutorialOpen(true)}
          className="glass-panel flex flex-col items-start gap-0.5 rounded-2xl border border-[#e6ecf8] px-4.5 py-2.5 text-left shadow-sm transition hover:border-brand-blue/40"
        >
          <span className="text-[11px] font-medium text-slate-400">처음이신가요?</span>
          <span className="flex items-center gap-1.5 text-[13px] font-bold text-[#14192f]">
            <HelpCircle className="h-3.5 w-3.5 text-brand-blue" />
            이용 가이드 보기
          </span>
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-14">
        <h1 className="text-center text-[32px] font-extrabold leading-[1.4] tracking-tight text-[#14192f] sm:text-[40px]">
          내 소비에 가장 유리한
          <br />
          <span className="text-brand-blue">카드 조합</span>을 찾아보세요
        </h1>

        <div className="flex flex-wrap justify-center gap-5">
          <button
            type="button"
            onClick={() => onSelectScope("myCards")}
            className="brand-gradient group relative w-[340px] rounded-[28px] p-8 text-left text-white shadow-[0_18px_40px_rgba(27,63,196,0.25)] transition hover:-translate-y-1 hover:shadow-[0_22px_48px_rgba(27,63,196,0.32)] sm:w-[400px]"
          >
            <div className="text-[12.5px] font-semibold text-white/80">이미 가지고 있는 카드가 있다면</div>
            <div className="mt-3.5 text-[22px] font-extrabold leading-snug">
              보유한 카드로
              <br />
              내 지갑 만들기
            </div>
            <div className="mt-3.5 text-[12.5px] text-white/75">내 카드의 혜택을 가장 잘 활용하는 방법</div>
            <div className="mt-6 flex h-11 w-11 items-center justify-center rounded-full bg-white/18 transition group-hover:bg-white/28">
              <ArrowRight className="h-4.5 w-4.5" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSelectScope("all")}
            className="glass-panel group relative w-[340px] rounded-[28px] border border-[#e6ecf8] p-8 text-left shadow-[0_8px_24px_rgba(23,27,77,0.06)] transition hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(23,27,77,0.1)] sm:w-[400px]"
          >
            <div className="text-[12.5px] font-semibold text-slate-400">새 카드 발급도 고려 중이라면</div>
            <div className="mt-3.5 text-[22px] font-extrabold leading-snug text-[#14192f]">
              새 카드까지 포함해서
              <br />
              내 지갑 만들기
            </div>
            <div className="mt-3.5 text-[12.5px] text-slate-400">내 소비에 더 유리한 카드까지 함께 비교</div>
            <div className="mt-6 flex h-11 w-11 items-center justify-center rounded-full bg-brand-sky/40 transition group-hover:bg-brand-sky/70">
              <ArrowRight className="h-4.5 w-4.5 text-brand-blue" />
            </div>
          </button>
        </div>
      </div>

      {tutorialOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0f2b]/40 p-6"
          style={{ animation: "fadeIn .15s ease" }}
          onClick={() => setTutorialOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-7 shadow-[0_24px_60px_rgba(20,26,69,0.28)]"
            style={{ animation: "popIn .18s ease" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-[16px] font-extrabold text-[#14192f]">이렇게 사용해요</h2>
              <button
                type="button"
                onClick={() => setTutorialOpen(false)}
                aria-label="닫기"
                className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            <div className="flex flex-col gap-4">
              {TUTORIAL_STEPS.map((s, i) => (
                <div key={s.title} className="flex items-start gap-3.5">
                  <div className="brand-gradient-soft flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-white">
                    <s.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-[13px] font-bold text-[#14192f]">
                      {i + 1}. {s.title}
                    </div>
                    <div className="mt-0.5 text-[12px] leading-relaxed text-slate-500">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setTutorialOpen(false)}
              className="brand-gradient mt-6 w-full rounded-xl py-3 text-[13px] font-bold text-white"
            >
              시작하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
