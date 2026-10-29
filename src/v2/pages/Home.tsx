import { MenuBar } from "@/v2/ui/TopBar";
import { PageMain } from "@/v2/ui/Page";
import { Link } from "@/v2/app/router";
import { paths } from "@/v2/app/paths";
import { CardImage } from "@/v2/ui/CardImage";

/** 홈의 카드 그림은 사진 없이 디자인 그대로 그린다(2026-10-28 사용자 요청). 다른 화면은 실제 카드 사진 */

function Arrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

export default function Home() {
  return (
    <>
      <MenuBar active="home" />
      <PageMain gap={24} padding="24px clamp(16px, 4.5vw, 64px) 48px">
        <section className="flex flex-wrap items-center gap-x-10 gap-y-6 pb-2 pt-4">
          <div className="min-w-0 flex-[1_1_440px]">
            <Link to={paths.guide} className="inline-flex h-10 items-center gap-2 rounded-[20px] bg-white pl-[14px] pr-2 text-[14px] text-w-ink-2 no-underline w-shadow">
              <span>처음이신가요?</span>
              <span className="flex h-7 items-center rounded-[14px] bg-w-tint px-[10px] font-bold text-w-primary">이용 가이드 보기 →</span>
            </Link>
            <h1 className="mt-5 text-center text-[clamp(32px,3.4vw,48px)] font-bold leading-[1.28] tracking-[-0.035em] text-[#121a3e]">
              내 소비에 가장 유리한
              <br />
              <span className="text-w-primary">카드 혜택을 찾아보세요</span>
            </h1>
            <p className="mt-[18px] text-center text-[17px] leading-[1.7] text-w-ink-2">
              내 소비에 가장 유리한 카드 조합을 찾아 드려요.
              <br />
              어느 카드로 어디서 결제할지까지 한번에!
            </p>
          </div>
        </section>

        <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(340px,100%),1fr))]">
          <Link
            to={paths.start("own")}
            className="relative flex min-h-[300px] flex-col overflow-hidden rounded-[28px] bg-w-primary p-[30px] text-white no-underline shadow-[0_18px_40px_-12px_rgba(36,87,245,0.55)] transition-transform hover:-translate-y-0.5"
          >
            <span className="relative z-[1] text-[14px] font-semibold text-[#E3EAFF]">이미 사용중인 카드의 조합만 추천 받고 싶다면</span>
            <span className="relative z-[1] mt-2.5 text-[28px] font-bold leading-[1.35] tracking-[-0.03em]">
              보유한 카드로
              <br />내 지갑 만들기
            </span>
            <span className="relative z-[1] mt-auto inline-flex items-center gap-2.5 text-[15px] font-bold">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.18]">
                <Arrow />
              </span>
              시작하기
            </span>
            <span aria-hidden="true" className="absolute bottom-7 right-6 h-[170px] w-[230px] origin-bottom-right max-[420px]:scale-[0.72]">
              <CardImage sid={51} faceOnly color="#0E1F5C" label="taptap O" width={160} rotate={-10} style={{ position: "absolute", left: 10, top: 20 }} />
              <CardImage sid={13} faceOnly color="#6E97EE" label="Mr.Life" width={160} rotate={4} style={{ position: "absolute", left: 62, top: 46 }} />
            </span>
          </Link>

          <Link
            to={paths.start("new")}
            className="relative flex min-h-[300px] flex-col overflow-hidden rounded-[28px] bg-white p-[30px] text-w-ink no-underline w-shadow transition-transform hover:-translate-y-0.5"
          >
            <span className="relative z-[1] text-[14px] font-semibold text-w-ink-3">새 카드 발급도 고려 중이라면</span>
            <span className="relative z-[1] mt-2.5 text-[28px] font-bold leading-[1.35] tracking-[-0.03em]">
              새 카드까지 포함해서
              <br />내 지갑 만들기
            </span>
            <span className="relative z-[1] mt-auto inline-flex items-center gap-2.5 text-[15px] font-bold text-w-primary">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-w-tint">
                <Arrow />
              </span>
              시작하기
            </span>
            <span aria-hidden="true" className="absolute bottom-7 right-6 h-[170px] w-[230px] origin-bottom-right max-[420px]:scale-[0.72]">
              <CardImage sid={2686} faceOnly color="#0E1F5C" label="D4카드의정석Ⅱ" width={160} rotate={-8} style={{ position: "absolute", left: 0, top: 28 }} />
              <CardImage sid={-1} faceOnly color="#2457F5" label="추천 새 카드" badge="NEW" width={160} rotate={6} style={{ position: "absolute", left: 66, top: 42 }} />
            </span>
          </Link>
        </div>
      </PageMain>
    </>
  );
}
