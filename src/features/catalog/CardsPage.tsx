import { useState } from "react";
import { CatalogGallery } from "@/features/catalog/CatalogGallery";
import { MyCardsPage } from "@/features/catalog/MyCardsPage";
import type { useSavedCards } from "@/domain/state/useSavedCards";
import type { SpendCategory, MonthlySpend } from "@/domain/types/card";

interface CardsPageProps {
  myCards: ReturnType<typeof useSavedCards>;
  categories: SpendCategory[];
  spending: MonthlySpend;
}

export function CardsPage({ myCards, categories, spending }: CardsPageProps) {
  const [tab, setTab] = useState<"all" | "mine">("all");

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-[#14192f]">전체 카드 보기</h1>
          <p className="mt-1 text-[12.5px] text-slate-500">국내 카드를 조건별로 검색하고 비교해보세요</p>
        </div>
        <div className="glass-panel flex gap-1 rounded-xl border border-slate-200/80 p-1">
          <button
            type="button"
            onClick={() => setTab("all")}
            className={`rounded-lg px-4 py-2 text-[12.5px] font-semibold transition ${
              tab === "all" ? "brand-gradient-select text-white shadow-sm" : "text-slate-500 hover:text-brand-blue"
            }`}
          >
            전체 카드
          </button>
          <button
            type="button"
            onClick={() => setTab("mine")}
            className={`rounded-lg px-4 py-2 text-[12.5px] font-semibold transition ${
              tab === "mine" ? "brand-gradient-select text-white shadow-sm" : "text-slate-500 hover:text-brand-blue"
            }`}
          >
            내 카드
            {myCards.ids.length > 0 && (
              <span
                className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                  tab === "mine" ? "bg-white/25 text-white" : "bg-brand-blue/10 text-brand-blue"
                }`}
              >
                {myCards.ids.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {tab === "all" ? (
        <CatalogGallery myCards={myCards} categories={categories} spending={spending} />
      ) : (
        <MyCardsPage myCards={myCards} />
      )}
    </div>
  );
}
