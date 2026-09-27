import { useMemo, useState } from "react";
import { Search, ArrowRight } from "lucide-react";
import { formatWon } from "@/shared/lib/format";
import { CardThumb } from "@/shared/components/CardThumb";
import { useToast } from "@/shared/hooks/useToast";
import { catalogCards, isDiscontinued, isInfoInsufficient } from "@/domain/engine/loadCatalog";
import { toWalletCard } from "@/domain/engine/cardConverter";
import { useWalletBlueprintAsync, computeNetContributionByCard } from "@/domain/engine/useWalletBlueprintAsync";
import type { useSavedCards } from "@/domain/state/useSavedCards";
import type { SpendCategory, MonthlySpend } from "@/domain/types/card";
import type { CatalogListing } from "@/domain/types/catalog";

interface WalletQuickEditViewProps {
  myCards: ReturnType<typeof useSavedCards>;
  categories: SpendCategory[];
  spending: MonthlySpend;
  onBack: () => void;
  onEditSpending: () => void;
}

const CATALOG_BY_SOURCE_ID = new Map<number, CatalogListing>(catalogCards.map((c) => [c.sourceId, c]));

function cardsFromSourceIds(sourceIds: number[]) {
  return sourceIds
    .map((id) => CATALOG_BY_SOURCE_ID.get(id))
    .filter((c): c is CatalogListing => !!c)
    .map(toWalletCard);
}

export function WalletQuickEditView({
  myCards,
  categories,
  spending,
  onBack,
  onEditSpending,
}: WalletQuickEditViewProps) {
  const toast = useToast();
  const [removedIds, setRemovedIds] = useState<Set<number>>(new Set());
  const [addedIds, setAddedIds] = useState<number[]>([]);
  const [query, setQuery] = useState("");

  const categoryLabel = (id: string) => categories.find((c) => c.id === id)?.label ?? id;

  const effectiveIds = useMemo(() => {
    const kept = myCards.ids.filter((id) => !removedIds.has(id));
    return [...kept, ...addedIds];
  }, [myCards.ids, removedIds, addedIds]);

  const originalCandidates = useMemo(() => cardsFromSourceIds(myCards.ids), [myCards.ids]);
  const editedCandidates = useMemo(() => cardsFromSourceIds(effectiveIds), [effectiveIds]);

  const before = useWalletBlueprintAsync(originalCandidates, spending, {
    maxCards: Math.max(1, originalCandidates.length),
    mode: "maxBenefit",
  });
  const after = useWalletBlueprintAsync(editedCandidates, spending, {
    maxCards: Math.max(1, editedCandidates.length),
    mode: "maxBenefit",
  });

  const beforeContribution = useMemo(() => computeNetContributionByCard(before.result), [before.result]);
  const afterContribution = useMemo(() => computeNetContributionByCard(after.result), [after.result]);

  const lostCategories = useMemo(() => {
    const beforeCats = new Set(before.result.assignments.map((a) => a.category));
    const afterCats = new Set(after.result.assignments.map((a) => a.category));
    return [...beforeCats].filter((c) => !afterCats.has(c));
  }, [before.result, after.result]);

  const hasPendingChanges = removedIds.size > 0 || addedIds.length > 0;
  const isComputing = before.isComputing || after.isComputing;
  const delta = after.result.netMonthlyBenefit - before.result.netMonthlyBenefit;

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const effectiveSet = new Set(effectiveIds);
    return catalogCards
      .filter((c) => !effectiveSet.has(c.sourceId))
      .filter((c) => !isDiscontinued(c) && !isInfoInsufficient(c))
      .filter((c) => c.name.toLowerCase().includes(q) || c.issuer.toLowerCase().includes(q))
      .slice(0, 6);
  }, [query, effectiveIds]);

  const handleAdd = (sourceId: number) => {
    setAddedIds((prev) => (prev.includes(sourceId) ? prev : [...prev, sourceId]));
    setQuery("");
  };

  const handleRemoveNewlyAdded = (sourceId: number) => {
    setAddedIds((prev) => prev.filter((id) => id !== sourceId));
  };

  const handleMarkForRemoval = (sourceId: number) => {
    setRemovedIds((prev) => new Set(prev).add(sourceId));
  };

  const handleUndoRemoval = (sourceId: number) => {
    setRemovedIds((prev) => {
      const next = new Set(prev);
      next.delete(sourceId);
      return next;
    });
  };

  const handleCancel = () => {
    setRemovedIds(new Set());
    setAddedIds([]);
    setQuery("");
  };

  const handleCommit = () => {
    for (const id of removedIds) myCards.remove(id);
    for (const id of addedIds) myCards.add(id);
    const removedCount = removedIds.size;
    const addedCount = addedIds.length;
    setRemovedIds(new Set());
    setAddedIds([]);
    toast.success(
      `지갑을 업데이트했어요. ${addedCount > 0 ? `${addedCount}장 추가` : ""}${
        addedCount > 0 && removedCount > 0 ? " · " : ""
      }${removedCount > 0 ? `${removedCount}장 제외` : ""}`.trim(),
    );
    onBack();
  };

  return (
    <div>
      <div className="mb-4">
        <button
          type="button"
          onClick={onBack}
          className="text-[12.5px] font-semibold text-slate-400 transition hover:text-brand-blue"
        >
          ← 내 지갑 보기
        </button>
        <h1 className="mt-2 text-xl font-extrabold text-[#14192f]">지갑 빠르게 바꾸기</h1>
        <p className="mt-1 text-[12.5px] text-slate-500">
          전체 마법사를 다시 거치지 않고, 카드만 넣고 빼면서 결과를 바로 확인해보세요
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.15fr_1fr]">
        {/* 왼쪽: 카드 편집 */}
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-xs font-bold text-slate-500">현재 지갑 ({effectiveIds.length}장)</p>
            {myCards.ids.length === 0 && addedIds.length === 0 ? (
              <div className="glass-panel rounded-2xl border border-[#e6ecf8] py-8 text-center text-[12px] text-slate-400">
                아직 담긴 카드가 없어요. 아래에서 카드를 검색해 추가해보세요.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {myCards.ids.map((sourceId) => {
                  const entry = CATALOG_BY_SOURCE_ID.get(sourceId);
                  if (!entry) return null;
                  const card = toWalletCard(entry);
                  const isRemoved = removedIds.has(sourceId);
                  const contribution = beforeContribution.get(card.id) ?? 0;
                  return (
                    <div
                      key={sourceId}
                      className={`flex items-center gap-3 rounded-[14px] border p-2.5 ${
                        isRemoved
                          ? "border-rose-200 bg-rose-50"
                          : "glass-panel border-[#e6ecf8]"
                      }`}
                    >
                      <CardThumb imageUrl={card.imageUrl} name={card.name} size={44} />
                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate text-[12.5px] font-bold ${
                            isRemoved ? "text-rose-800 line-through" : "text-[#14192f]"
                          }`}
                        >
                          {card.name}
                        </p>
                        <p className={`mt-0.5 text-[11px] ${isRemoved ? "text-rose-500" : "text-slate-400"}`}>
                          {isRemoved
                            ? `빼기로 표시됨 · 월 약 ${formatWon(Math.max(0, contribution))} 혜택 사라짐`
                            : `월 약 ${formatWon(Math.max(0, contribution))} 혜택`}
                        </p>
                      </div>
                      {isRemoved ? (
                        <button
                          type="button"
                          onClick={() => handleUndoRemoval(sourceId)}
                          className="shrink-0 text-[11px] font-bold text-rose-600 hover:text-rose-700"
                        >
                          되돌리기
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleMarkForRemoval(sourceId)}
                          aria-label="지갑에서 빼기"
                          className="remove-btn flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm text-slate-500 transition hover:bg-rose-100 hover:text-rose-600"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                })}

                {addedIds.map((sourceId) => {
                  const entry = CATALOG_BY_SOURCE_ID.get(sourceId);
                  if (!entry) return null;
                  const card = toWalletCard(entry);
                  const contribution = afterContribution.get(card.id) ?? 0;
                  return (
                    <div
                      key={`added-${sourceId}`}
                      className="flex items-center gap-3 rounded-[14px] border border-emerald-200 bg-emerald-50 p-2.5"
                    >
                      <CardThumb imageUrl={card.imageUrl} name={card.name} size={44} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-bold text-emerald-800">{card.name}</p>
                        <p className="mt-0.5 text-[11px] text-emerald-600">
                          새로 추가됨 · 월 약 {formatWon(Math.max(0, contribution))} 혜택
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveNewlyAdded(sourceId)}
                        aria-label="추가 취소"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/70 text-sm text-emerald-700 transition hover:bg-white"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-bold text-slate-500">카드 추가하기</p>
            <div className="add-row glass-panel flex h-[50px] items-center gap-2.5 rounded-[14px] border border-dashed border-[#d5d8ea] px-3.5 transition">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="카드 이름이나 카드사명을 검색해서 추가해보세요"
                className="w-full border-none bg-transparent text-[13px] text-[#14192f] outline-none placeholder:text-slate-400"
              />
            </div>
            {searchResults.length > 0 && (
              <div className="glass-panel mt-2 flex flex-col gap-1 rounded-2xl border border-[#e6ecf8] p-2">
                {searchResults.map((entry) => (
                  <button
                    key={entry.sourceId}
                    type="button"
                    onClick={() => handleAdd(entry.sourceId)}
                    className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition hover:bg-brand-sky/20"
                  >
                    <CardThumb imageUrl={entry.imageUrl} name={entry.name} size={30} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-semibold text-[#14192f]">{entry.name}</p>
                      <p className="text-[10.5px] text-slate-400">{entry.issuer}</p>
                    </div>
                    <span className="shrink-0 text-[11px] font-bold text-brand-blue">+ 담기</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl bg-[#f7f8fd] px-3.5 py-2.5 text-[11px] leading-relaxed text-slate-400">
            지출 패턴은 지난달 계산에 쓴 값을 그대로 사용해요. 지출도 함께 바꾸고 싶다면{" "}
            <button type="button" onClick={onEditSpending} className="font-bold text-brand-blue hover:underline">
              지출 다시 입력하기
            </button>
            를 눌러주세요.
          </div>
        </div>

        {/* 오른쪽: 실시간 미리보기 */}
        <div className="glass-panel flex flex-col gap-4 rounded-[22px] border border-[#e6ecf8] p-5.5">
          <p className="text-[12.5px] font-bold text-slate-500">
            변경 후 예상 결과{" "}
            <span className="font-medium text-slate-300">
              {isComputing ? "— 다시 계산하는 중..." : "— 실시간으로 다시 계산돼요"}
            </span>
          </p>

          <div className="flex items-stretch rounded-2xl border border-[#e6ecf8] p-4">
            <div className="flex flex-1 flex-col items-center gap-2 text-center">
              <span className="text-[11.5px] font-bold text-slate-400">지금 지갑 ({originalCandidates.length}장)</span>
              <span className="text-[19px] font-extrabold text-slate-500">
                {formatWon(Math.max(0, before.result.netMonthlyBenefit))}
              </span>
              <span className="text-[10.5px] text-slate-300">월 순혜택</span>
            </div>
            <div className="flex shrink-0 items-center justify-center px-3.5">
              <ArrowRight className={`h-4.5 w-4.5 ${delta < 0 ? "text-rose-500" : "text-emerald-500"}`} />
            </div>
            <div
              className={`flex flex-1 flex-col items-center gap-2 rounded-xl text-center ${
                delta < 0 ? "bg-rose-50" : delta > 0 ? "bg-emerald-50" : ""
              }`}
            >
              <span
                className={`text-[11.5px] font-bold ${delta < 0 ? "text-rose-800" : "text-emerald-700"}`}
              >
                변경 후 ({effectiveIds.length}장)
              </span>
              <span className={`text-[19px] font-extrabold ${delta < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                {formatWon(Math.max(0, after.result.netMonthlyBenefit))}
              </span>
              <span className={`text-[10.5px] ${delta < 0 ? "text-rose-400" : "text-emerald-500"}`}>
                {delta === 0 ? "변동 없음" : `${delta > 0 ? "+" : "−"}약 ${formatWon(Math.abs(delta))}`}
              </span>
            </div>
          </div>

          {lostCategories.length > 0 && (
            <div className="rounded-xl bg-rose-50 px-3.5 py-3 text-[11.5px] leading-relaxed text-rose-800">
              <strong>참고.</strong> 이 조합으로 바꾸면{" "}
              <strong>{lostCategories.map(categoryLabel).join(", ")}</strong> 카테고리를 맡을 카드가 없어서, 그만큼
              순혜택이 줄어들 수 있어요. 그래도 계속 진행할까요?
            </div>
          )}

          <div className="flex-1" />

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={handleCancel}
              disabled={!hasPendingChanges}
              className="glass-panel flex-1 rounded-[14px] border border-[#e2e5f2] px-3 py-3 text-[13px] font-bold text-slate-500 transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleCommit}
              disabled={!hasPendingChanges}
              className="cta-btn brand-gradient flex-[2] rounded-[14px] px-3 py-3 text-[13px] font-bold text-white shadow-[0_3px_8px_rgba(27,63,196,0.14)] transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              이대로 지갑 업데이트하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
