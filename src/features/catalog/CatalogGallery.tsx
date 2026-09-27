import { useMemo, useState, useEffect, useRef } from "react";
import type { CatalogListing } from "@/domain/types/catalog";
import type { SpendCategory, MonthlySpend } from "@/domain/types/card";
import { catalogCards, catalogIssuers, catalogTypes, isInfoInsufficient, isDiscontinued } from "@/domain/engine/loadCatalog";
import { cardSupportsCategory, findBestCardForCategory } from "@/domain/engine/catalogCategoryIndex";
import type { useSavedCards } from "@/domain/state/useSavedCards";
import { useRecentlyViewedCards } from "@/domain/state/useRecentlyViewedCards";
import { CatalogCardTile } from "@/features/catalog/CatalogCardTile";
import { CardDetailModal } from "@/features/catalog/CardDetailModal";
import { CardCompareModal } from "@/features/catalog/CardCompareModal";
import { CardThumb } from "@/shared/components/CardThumb";
import { formatRatePercent } from "@/shared/lib/format";
import { useDebounce } from "@/shared/hooks/useDebounce";

const PAGE_SIZE = 24;
const MAX_COMPARE = 3;

/** 갤러리 상단 "혜택 빠른 필터" 칩으로 노출할 카테고리 (실제 categories.json에 있는 id만). */
const FEATURED_FILTER_CATEGORY_IDS = ["cafe", "gas", "onlineShopping", "transport", "dining"];

interface CatalogGalleryProps {
  myCards: ReturnType<typeof useSavedCards>;
  categories?: SpendCategory[];
  spending?: MonthlySpend;
}

export type CatalogSortOption = "default" | "fee-asc" | "fee-desc" | "name-asc" | "newest";

export function CatalogGallery({ myCards, categories = [], spending = {} }: CatalogGalleryProps) {
  const [query, setQuery] = useState("");
  const [issuer, setIssuer] = useState<string>("");
  const [type, setType] = useState<string>("");
  const [sortOption, setSortOption] = useState<CatalogSortOption>("default");
  const [hideInsufficient, setHideInsufficient] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<CatalogListing | null>(null);
  const [activeCategoryFilters, setActiveCategoryFilters] = useState<Set<string>>(new Set());
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const topRef = useRef<HTMLElement | null>(null);
  const recentlyViewed = useRecentlyViewedCards();

  const debouncedQuery = useDebounce(query, 250);

  const featuredFilterCategories = useMemo(
    () => FEATURED_FILTER_CATEGORY_IDS.map((id) => categories.find((c) => c.id === id)).filter((c): c is SpendCategory => !!c),
    [categories],
  );

  const toggleCategoryFilter = (categoryId: string) => {
    setActiveCategoryFilters((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
    setVisibleCount(PAGE_SIZE);
  };

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    return catalogCards.filter((c) => {
      if (issuer && c.issuer !== issuer) return false;
      if (type && c.category !== type) return false;
      if (hideInsufficient && isInfoInsufficient(c)) return false;
      if (q && !c.name.toLowerCase().includes(q) && !c.issuer.toLowerCase().includes(q)) return false;
      if (activeCategoryFilters.size > 0 && ![...activeCategoryFilters].some((catId) => cardSupportsCategory(c.sourceId, catId))) {
        return false;
      }
      return true;
    });
  }, [debouncedQuery, issuer, type, hideInsufficient, activeCategoryFilters]);

  const sorted = useMemo(() => {
    if (sortOption === "default") return filtered;
    const items = [...filtered];
    switch (sortOption) {
      case "fee-asc":
        return items.sort((a, b) => {
          const feeA = a.annualFee ?? Number.MAX_SAFE_INTEGER;
          const feeB = b.annualFee ?? Number.MAX_SAFE_INTEGER;
          if (feeA !== feeB) return feeA - feeB;
          return a.sourceId - b.sourceId;
        });
      case "fee-desc":
        return items.sort((a, b) => {
          const feeA = a.annualFee ?? -1;
          const feeB = b.annualFee ?? -1;
          if (feeA !== feeB) return feeB - feeA;
          return a.sourceId - b.sourceId;
        });
      case "name-asc":
        return items.sort((a, b) => a.name.localeCompare(b.name, "ko"));
      case "newest":
        return items.sort((a, b) => b.sourceId - a.sourceId);
      default:
        return items;
    }
  }, [filtered, sortOption]);

  const visible = sorted.slice(0, visibleCount);
  const hasMore = visibleCount < sorted.length;

  const resetPaging = () => setVisibleCount(PAGE_SIZE);

  // 지출이 가장 큰 카테고리 하나를 찾아, 아직 안 담은 카드 중 그 카테고리 요율이 가장 좋은
  // 카드를 "맞춤 추천"으로 보여준다. 실제 지출·카탈로그 데이터로만 계산하고, 의미 있는
  // 요율(2% 이상)이 없으면 추천 자체를 숨긴다(허수 추천 방지).
  const topSpendCategory = useMemo(() => {
    const withSpend = categories
      .map((c) => ({ ...c, spend: spending[c.id] || 0 }))
      .filter((c) => c.spend > 0)
      .sort((a, b) => b.spend - a.spend);
    return withSpend[0] ?? null;
  }, [categories, spending]);

  const personalizedRecommendation = useMemo(() => {
    if (!topSpendCategory) return null;
    const ownedIds = new Set(myCards.ids);
    const candidates = catalogCards.filter(
      (c) => !ownedIds.has(c.sourceId) && !isDiscontinued(c) && !isInfoInsufficient(c),
    );
    const best = findBestCardForCategory(candidates, topSpendCategory.id);
    if (!best || best.rate < 0.02) return null;
    return { category: topSpendCategory, entry: best.entry, rate: best.rate };
  }, [topSpendCategory, myCards.ids]);

  const handleSelect = (entry: CatalogListing) => {
    setSelected(entry);
    recentlyViewed.markViewed(entry.sourceId);
  };

  const toggleCompare = (entry: CatalogListing) => {
    setCompareIds((prev) => {
      if (prev.includes(entry.sourceId)) return prev.filter((id) => id !== entry.sourceId);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, entry.sourceId];
    });
  };

  const compareEntries = compareIds
    .map((id) => catalogCards.find((c) => c.sourceId === id))
    .filter((c): c is CatalogListing => !!c);

  useEffect(() => {
    if (!hasMore || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((v) => Math.min(v + PAGE_SIZE, sorted.length));
        }
      },
      { rootMargin: "300px" },
    );

    const currentSentinel = sentinelRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }

    return () => {
      observer.disconnect();
    };
  }, [hasMore, sorted.length]);

  return (
    <section ref={topRef} className="relative flex flex-col gap-5 pb-16">
      {personalizedRecommendation && (
        <div className="brand-gradient flex items-center gap-4 rounded-2xl p-4 text-white shadow-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 3l1.9 5.8H20l-4.9 3.6 1.9 5.8L12 14.6l-5 3.6 1.9-5.8L4 8.8h6.1z" fill="#ffffff" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-bold">
              회원님의 {personalizedRecommendation.category.label} 지출엔 이 카드가 좋아요
            </p>
            <p className="mt-1 text-[11px] text-white/85">
              최근 지출 패턴 기준 · {personalizedRecommendation.entry.name} · {personalizedRecommendation.category.label}{" "}
              {formatRatePercent(personalizedRecommendation.rate)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleSelect(personalizedRecommendation.entry)}
            className="glass-panel shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[11px] font-extrabold text-brand-blue-deep"
          >
            자세히 보기
          </button>
        </div>
      )}

      {recentlyViewed.ids.length > 0 && (
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[11px] font-bold text-slate-400">최근 본 카드</span>
          {recentlyViewed.ids.map((sourceId) => {
            const entry = catalogCards.find((c) => c.sourceId === sourceId);
            if (!entry) return null;
            return (
              <button
                key={sourceId}
                type="button"
                onClick={() => handleSelect(entry)}
                className="recent-chip glass-panel flex items-center gap-1.5 rounded-full border border-slate-200 py-1 pl-1 pr-3 text-left"
              >
                <CardThumb imageUrl={entry.imageUrl} name={entry.name} size={20} />
                <span className="text-[11px] font-semibold text-[#14192f]">{entry.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* 검색창 + 드롭다운 3개 + 버튼이 sm 이상에서 한 줄로 나란히 있었는데, 폭이 좁으면
          맨 뒤(정렬 기준 드롭다운)가 화면 밖으로 밀려 잘렸습니다. flex-wrap으로 줄바꿈을
          허용하고, 각 드롭다운은 shrink-0으로 눌리지 않게 고정합니다. */}
      <div className="glass-panel flex flex-col gap-3 rounded-2xl border border-slate-200/80 p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <div className="relative flex-1 sm:min-w-[220px]">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.3-4.3M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              resetPaging();
            }}
            placeholder="카드 이름 또는 카드사로 검색"
            className="w-full rounded-lg border border-slate-200 bg-white/60 py-2.5 pl-9 pr-9 text-sm text-slate-800 outline-none transition focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-sky/60"
          />
          {query && (
            <button
              type="button"
              aria-label="검색어 초기화"
              onClick={() => {
                setQuery("");
                resetPaging();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <select
          value={issuer}
          onChange={(e) => {
            setIssuer(e.target.value);
            resetPaging();
          }}
          className="shrink-0 rounded-lg border border-slate-200 bg-white/60 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-sky/60"
        >
          <option value="">전체 카드사</option>
          {catalogIssuers.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>

        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            resetPaging();
          }}
          className="shrink-0 rounded-lg border border-slate-200 bg-white/60 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-sky/60"
        >
          <option value="">전체 종류</option>
          {catalogTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <select
          aria-label="정렬 기준"
          value={sortOption}
          onChange={(e) => {
            setSortOption(e.target.value as CatalogSortOption);
            resetPaging();
          }}
          className="shrink-0 rounded-lg border border-slate-200 bg-white/60 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-sky/60"
        >
          <option value="default">기본순</option>
          <option value="fee-asc">연회비 낮은순</option>
          <option value="fee-desc">연회비 높은순</option>
          <option value="name-asc">카드명 가나다순</option>
          <option value="newest">최신 등록순</option>
        </select>

        <button
          type="button"
          onClick={() => {
            setHideInsufficient((v) => !v);
            resetPaging();
          }}
          aria-pressed={hideInsufficient}
          className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
            hideInsufficient
              ? "brand-gradient-select border-transparent text-white"
              : "border-slate-200 bg-white/60 text-slate-600 hover:border-brand-blue/50 hover:text-brand-blue"
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4.5h18M6 4.5v15a1.5 1.5 0 0 0 1.5 1.5h9a1.5 1.5 0 0 0 1.5-1.5v-15M9 8v8M15 8v8" />
          </svg>
          정보 부족 카드 제외
        </button>
      </div>

      {featuredFilterCategories.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-slate-400">혜택으로 빠르게 찾기</span>
          {featuredFilterCategories.map((c) => {
            const isOn = activeCategoryFilters.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCategoryFilter(c.id)}
                className={`rounded-full border px-3 py-1.5 text-[11.5px] font-bold transition ${
                  isOn ? "brand-gradient-select border-transparent text-white" : "border-slate-200 text-slate-500 hover:border-brand-blue/50"
                }`}
              >
                {c.label} 혜택
              </button>
            );
          })}
          {activeCategoryFilters.size > 0 && (
            <button
              type="button"
              onClick={() => {
                setActiveCategoryFilters(new Set());
                resetPaging();
              }}
              className="text-[11px] text-slate-400 underline underline-offset-2"
            >
              필터 지우기
            </button>
          )}
        </div>
      )}

      <p className="text-sm text-slate-500">
        총 <span className="font-semibold text-slate-800">{filtered.length.toLocaleString()}</span>개 카드
        {hideInsufficient && (
          <span className="ml-1 text-xs text-slate-400">
            (연회비·혜택 정보가 없는 카드는 제외됨)
          </span>
        )}
      </p>

      {filtered.length === 0 ? (
        <div className="glass-panel flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 py-16 text-center">
          <p className="text-sm text-slate-500">조건에 맞는 카드가 없습니다.</p>
          <p className="text-xs text-slate-400">검색어나 필터를 조정해 보세요.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((entry) => (
              <CatalogCardTile
                key={entry.sourceId}
                entry={entry}
                onSelect={handleSelect}
                inMyCards={myCards.has(entry.sourceId)}
                onToggleMyCards={(e) => myCards.toggle(e.sourceId)}
                compareChecked={compareIds.includes(entry.sourceId)}
                onToggleCompare={toggleCompare}
                compareDisabled={compareIds.length >= MAX_COMPARE && !compareIds.includes(entry.sourceId)}
              />
            ))}
          </div>

          {hasMore && (
            <div className="flex flex-col items-center gap-3 pt-2">
              <div ref={sentinelRef} className="h-4 w-full" aria-hidden="true" />
              <button
                type="button"
                onClick={() => setVisibleCount((v) => Math.min(v + PAGE_SIZE, filtered.length))}
                className="glass-panel mx-auto rounded-lg border border-slate-200 px-6 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition hover:border-brand-blue/50 hover:text-brand-blue"
              >
                더 보기 ({filtered.length - visibleCount}개 남음)
              </button>
            </div>
          )}
        </>
      )}

      <CardDetailModal
        entry={selected}
        onClose={() => setSelected(null)}
        inMyCards={selected ? myCards.has(selected.sourceId) : false}
        onToggleMyCards={(e) => myCards.toggle(e.sourceId)}
      />

      <CardCompareModal
        entries={compareOpen ? compareEntries : []}
        onClose={() => setCompareOpen(false)}
      />

      {compareIds.length > 0 && (
        <div className="sticky bottom-4 z-30 mx-auto flex w-full max-w-xl items-center gap-3.5 rounded-2xl bg-[#12194a] px-5 py-3 text-white shadow-[0_4px_10px_rgba(18,25,74,0.25)]">
          <div className="flex items-center">
            {compareEntries.map((entry, i) => (
              <div key={entry.sourceId} className="-ml-2.5 first:ml-0" style={{ zIndex: compareEntries.length - i }}>
                <CardThumb imageUrl={entry.imageUrl} name={entry.name} size={28} />
              </div>
            ))}
          </div>
          <span className="text-[12.5px] font-bold">{compareIds.length}장 선택됨</span>
          <span className="hidden text-[11px] text-white/70 sm:inline">최대 {MAX_COMPARE}장까지 나란히 비교할 수 있어요</span>
          <button type="button" onClick={() => setCompareIds([])} className="ml-auto text-[11px] text-white/70 hover:text-white">
            선택 해제
          </button>
          <button
            type="button"
            onClick={() => setCompareOpen(true)}
            disabled={compareIds.length < 2}
            className="brand-gradient rounded-xl px-4 py-2 text-[12px] font-bold disabled:cursor-not-allowed disabled:opacity-40"
          >
            비교하기 →
          </button>
        </div>
      )}

      {visibleCount > PAGE_SIZE && (
        <button
          type="button"
          onClick={() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          aria-label="맨 위로 이동"
          className="brand-gradient-soft absolute bottom-28 right-8 z-20 flex h-11 w-11 items-center justify-center rounded-full text-white shadow-lg transition hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-brand-blue"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </button>
      )}
    </section>
  );
}
