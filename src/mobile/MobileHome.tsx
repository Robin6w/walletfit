import { useEffect, type ReactNode } from "react";
import { ArrowRight, ChevronRight, CircleHelp, LayoutGrid, Star } from "lucide-react";
import { Link } from "@/v2/app/router";
import { paths } from "@/v2/app/paths";
import { CardImage } from "@/v2/ui/CardImage";
import { MobileTopBar } from "@/mobile/chrome";

/** 모바일 홈(2026-11-07). PC 홈과 같은 두 갈래(보유 카드로 / 새 카드까지)를 세로로 쌓고, 나머지 메뉴는 목록으로 */

function StartCard({ to, eyebrow, title, primary, art }: { to: string; eyebrow: string; title: ReactNode; primary?: boolean; art: ReactNode }) {
  return (
    <Link
      to={to}
      className={`relative flex min-h-[188px] flex-col overflow-hidden rounded-[24px] p-[22px] no-underline active:scale-[0.99] ${primary ? "bg-w-primary text-white shadow-[0_14px_32px_-12px_rgba(36,87,245,0.55)]" : "bg-white text-w-ink w-shadow"}`}
    >
      <span className={`relative z-[1] text-[14px] font-semibold ${primary ? "text-[#E3EAFF]" : "text-w-ink-3"}`}>{eyebrow}</span>
      <span className="relative z-[1] mt-1.5 text-[22px] font-bold leading-[1.35] tracking-[-0.03em]">{title}</span>
      <span className={`relative z-[1] mt-auto inline-flex items-center gap-2 pt-4 text-[15px] font-bold ${primary ? "" : "text-w-primary"}`}>
        <span className={`flex h-9 w-9 items-center justify-center rounded-full ${primary ? "bg-white/[0.18]" : "bg-w-tint"}`}>
          <ArrowRight className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        시작하기
      </span>
      <span aria-hidden="true" className="absolute -right-3 bottom-3 h-[124px] w-[170px]">
        {art}
      </span>
    </Link>
  );
}

function Row({ to, icon, title, desc }: { to: string; icon: ReactNode; title: string; desc: string }) {
  return (
    <li>
      <Link to={to} className="flex min-h-[64px] items-center gap-3 px-4 py-3 text-w-ink no-underline active:bg-w-bg">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-w-tint text-w-primary">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold">{title}</span>
          <span className="block truncate text-[14px] text-w-ink-3">{desc}</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-w-mute" aria-hidden="true" />
      </Link>
    </li>
  );
}

export default function MobileHome() {
  useEffect(() => {
    document.title = "walletfit";
  }, []);
  return (
    <>
      <MobileTopBar />
      <main id="w-main" className="flex flex-col gap-4 px-5 pb-8 pt-5">
        <header className="px-1">
          <h1 className="m-0 text-[26px] font-bold leading-[1.3] tracking-[-0.035em] text-[#121a3e]">
            내 소비에 가장 유리한
            <br />
            <span className="text-w-primary">카드 조합을 찾아보세요</span>
          </h1>
          <p className="mt-2 text-[15px] leading-[1.6] text-w-ink-2">어느 카드로 어디서 결제할지까지 한번에 알려 드려요.</p>
        </header>

        <StartCard
          primary
          to={paths.start("own")}
          eyebrow="이미 쓰는 카드의 조합만 보고 싶다면"
          title={
            <>
              보유한 카드로
              <br />내 지갑 만들기
            </>
          }
          art={
            <>
              <CardImage sid={51} faceOnly color="#0E1F5C" label="taptap O" width={112} rotate={-10} style={{ position: "absolute", left: 8, top: 14 }} />
              <CardImage sid={13} faceOnly color="#6E97EE" label="Mr.Life" width={112} rotate={4} style={{ position: "absolute", left: 46, top: 34 }} />
            </>
          }
        />
        <StartCard
          to={paths.start("new")}
          eyebrow="새 카드 발급도 생각 중이라면"
          title={
            <>
              새 카드까지 포함해서
              <br />내 지갑 만들기
            </>
          }
          art={
            <>
              <CardImage sid={2686} faceOnly color="#0E1F5C" label="D4카드의정석Ⅱ" width={112} rotate={-8} style={{ position: "absolute", left: 4, top: 20 }} />
              <CardImage sid={-1} faceOnly color="#2457F5" label="추천 새 카드" badge="NEW" width={112} rotate={6} style={{ position: "absolute", left: 50, top: 32 }} />
            </>
          }
        />

        <section aria-labelledby="m-more" className="mt-2">
          <h2 id="m-more" className="mb-2 px-1 text-[15px] font-bold text-w-ink-2">
            둘러보기
          </h2>
          <ul className="m-0 list-none divide-y divide-[rgba(13,27,74,0.06)] overflow-hidden rounded-[20px] bg-white p-0 w-shadow">
            <Row to={paths.cards} icon={<LayoutGrid className="h-5 w-5" aria-hidden="true" />} title="전체 카드" desc="발급 중인 카드 1,180장을 찾아보고 비교해요" />
            <Row to={paths.benefit} icon={<Star className="h-5 w-5" aria-hidden="true" />} title="혜택별 추천" desc="편의점·카페처럼 한 곳에 가장 좋은 카드" />
            <Row to={paths.guide} icon={<CircleHelp className="h-5 w-5" aria-hidden="true" />} title="이용 가이드" desc="처음이라면 4단계로 살펴보세요" />
          </ul>
        </section>
      </main>
    </>
  );
}
