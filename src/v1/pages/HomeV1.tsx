import { useState } from "react";
import { ArrowRight, Wallet } from "lucide-react";
import type { SavedWallet } from "@/v1/state";
import { approxWon } from "@/v1/format";

interface Props {
  onStart: (scope: "myCards" | "all") => void;
  saved: SavedWallet | null;
  onOpenWallet: () => void;
}

export function HomeV1({ onStart, saved, onOpenWallet }: Props) {
  const [guide, setGuide] = useState(false);
  return (
    <div className="mx-auto max-w-[760px] py-6 text-center md:py-12">
      <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] text-ink-2 shadow-sm">
        처음이신가요?
        <button type="button" onClick={() => setGuide((v) => !v)} aria-expanded={guide} className="rounded-full bg-tint px-2.5 py-0.5 font-bold text-primary">
          이용 가이드 보기 →
        </button>
      </div>
      {guide && (
        <ol className="mx-auto mt-4 max-w-[520px] rounded-[18px] border border-line bg-surface p-4 text-left text-[14px] leading-relaxed text-ink-2">
          <li>1. 가지고 있는 카드를 담아요. 새 카드까지 보려면 오른쪽 갈래를 고르세요.</li>
          <li>2. 한 달 지출을 카테고리별로 대략 넣어요. 명세서를 올리면 대신 채워 드려요.</li>
          <li>3. 스타벅스처럼 특정 브랜드 할인이 있으면 그 브랜드에 쓰는 금액을 물어봐요(건너뛰어도 돼요).</li>
          <li>4. 카드 조합, 카드별 결제 배분, 카드사 원문 기준 계산 근거를 보여 드려요.</li>
        </ol>
      )}
      <h1 className="mt-6 text-[30px] font-extrabold leading-tight tracking-tight md:text-[44px]">
        내 소비에 가장 유리한
        <br />
        <span className="text-primary">카드 조합</span>을 찾아보세요
      </h1>

      <div className="mt-8 grid gap-3 text-left md:mt-10 md:grid-cols-2 md:gap-4">
        <button
          type="button"
          onClick={() => onStart("myCards")}
          className="group flex min-h-[180px] flex-col justify-between rounded-[22px] bg-primary p-6 text-white shadow-[0_14px_30px_rgba(27,79,216,0.3)] transition hover:bg-[#1744bd] md:min-h-[230px] md:p-7"
        >
          <div>
            <div className="text-[13px] text-white/80">이미 가지고 있는 카드가 있다면</div>
            <div className="mt-3 text-[22px] font-extrabold leading-snug">
              보유한 카드로
              <br />내 지갑 만들기
            </div>
            <div className="mt-2 text-[13.5px] text-white/85">내 카드의 혜택을 가장 잘 활용하는 방법</div>
          </div>
          <span className="mt-5 flex h-11 w-11 items-center justify-center rounded-full bg-white/20">
            <ArrowRight className="h-4 w-4" />
          </span>
        </button>
        <button
          type="button"
          onClick={() => onStart("all")}
          className="group flex min-h-[180px] flex-col justify-between rounded-[22px] border border-line bg-surface p-6 transition hover:border-tint-line md:min-h-[230px] md:p-7"
        >
          <div>
            <div className="text-[13px] text-ink-3">새 카드 발급도 고려 중이라면</div>
            <div className="mt-3 text-[22px] font-extrabold leading-snug text-ink">
              새 카드까지 포함해서
              <br />내 지갑 만들기
            </div>
            <div className="mt-2 text-[13.5px] text-ink-2">내 소비에 더 유리한 카드까지 함께 비교</div>
          </div>
          <span className="mt-5 flex h-11 w-11 items-center justify-center rounded-full bg-tint text-primary">
            <ArrowRight className="h-4 w-4" />
          </span>
        </button>
      </div>

      {saved && (
        <button
          type="button"
          onClick={onOpenWallet}
          className="mt-4 flex w-full items-center gap-4 rounded-[18px] border border-line bg-surface p-4 text-left hover:border-tint-line"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-tint text-primary">
            <Wallet className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold">저장한 내 지갑이 있어요 · 카드 {saved.pack.cards.length}장 조합</span>
            <span className="block text-[13px] text-ink-3">
              이번 달 예상 순혜택 {approxWon(saved.pack.net)} · {new Date(saved.savedAt).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} 저장
            </span>
          </span>
          <span className="hidden shrink-0 text-[14px] font-bold text-primary sm:inline">내 지갑 보기 →</span>
        </button>
      )}
    </div>
  );
}
