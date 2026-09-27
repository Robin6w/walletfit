import { useMemo, useState, useRef } from "react";
import type { CatalogListing } from "@/domain/types/catalog";
import { useSavedCards, downloadSavedCardsBackup, parseSavedCardsBackup } from "@/domain/state/useSavedCards";
import { catalogCards } from "@/domain/engine/loadCatalog";
import { formatWon } from "@/shared/lib/format";
import { CardDetailModal } from "@/features/catalog/CardDetailModal";
import { useToast } from "@/shared/hooks/useToast";

interface MyCardsPageProps {
  myCards: ReturnType<typeof useSavedCards>;
}

export function MyCardsPage({ myCards }: MyCardsPageProps) {
  const [selected, setSelected] = useState<CatalogListing | null>(null);
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const entries = useMemo(() => {
    const idSet = new Set(myCards.ids);
    return catalogCards.filter((c) => idSet.has(c.sourceId));
  }, [myCards.ids]);

  const totalAnnualFee = entries.reduce((sum, c) => sum + (c.annualFee ?? 0), 0);
  const knownFeeCount = entries.filter((c) => c.annualFee !== undefined).length;

  const handleBackupDownload = () => {
    if (myCards.ids.length === 0) {
      toast.error("백업할 카드가 없습니다.");
      return;
    }
    downloadSavedCardsBackup(myCards.ids);
    toast.success("내 카드 목록 백업 파일이 다운로드되었습니다.");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const result = parseSavedCardsBackup(text);
      if (!result.success) {
        toast.error(result.error);
      } else {
        const added = myCards.importIds(result.cardIds, "merge");
        toast.success(`카드 ${result.count}장을 성공적으로 불러왔습니다. (신규 추가: ${added}장)`);
      }
    } catch {
      toast.error("파일을 읽는 도중 오류가 발생했습니다.");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <section className="flex flex-col gap-5">
      <input
        type="file"
        ref={fileInputRef}
        accept=".json,application/json"
        className="hidden"
        data-testid="my-cards-file-input"
        onChange={handleFileUpload}
      />

      {entries.length === 0 ? (
        <div className="glass-panel flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 py-20 text-center">
          <div className="brand-gradient-soft flex h-14 w-14 items-center justify-center rounded-full text-2xl">
            🗂️
          </div>
          <p className="text-sm font-medium text-slate-600">아직 담아둔 카드가 없습니다.</p>
          <p className="max-w-sm text-xs text-slate-400">
            카드 갤러리에서 카드 우측 상단의 + 버튼을 눌러 내 카드에 추가하거나, 백업해둔 JSON 파일을 불러와 보세요.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="glass-panel flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:border-brand-blue/50 hover:text-brand-blue"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              백업 파일 불러오기 (JSON)
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="glass-panel flex flex-col gap-4 rounded-2xl border border-slate-200/80 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-slate-900">내 카드</h2>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleBackupDownload}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white/60 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand-blue/50 hover:bg-white hover:text-brand-blue"
                    title="내 카드 목록을 JSON 파일로 백업"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    백업 다운로드
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white/60 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand-blue/50 hover:bg-white hover:text-brand-blue"
                    title="JSON 파일에서 내 카드 목록 불러오기"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    불러오기
                  </button>
                </div>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                보유 중이거나 관심 있는 카드 {entries.length}장을 담아뒀어요.
              </p>
            </div>
            <div className="rounded-xl bg-[#f7f8fd] px-4 py-2 text-right">
              <p className="text-xs text-brand-blue">
                연회비 합계{knownFeeCount < entries.length ? " (정보 있는 카드만)" : ""}
              </p>
              <p className="text-lg font-bold text-[#14192f]">{formatWon(totalAnnualFee)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map((entry) => (
              <div
                key={entry.sourceId}
                className="glass-panel flex flex-col gap-3 rounded-2xl border border-slate-200/80 p-4 shadow-sm transition hover:border-brand-sky hover:shadow-md"
              >
                <button
                  type="button"
                  onClick={() => setSelected(entry)}
                  className="flex flex-1 flex-col gap-2 text-left"
                >
                  <p className="text-xs font-medium text-brand-blue">{entry.issuer || "카드사 미상"}</p>
                  <h3 className="text-sm font-semibold leading-snug text-slate-900">{entry.name}</h3>
                  {entry.benefitSummary && (
                    <p className="line-clamp-2 text-xs leading-relaxed text-slate-500">
                      {entry.benefitSummary}
                    </p>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-1 text-sm">
                    <span className="text-xs text-slate-400">연회비</span>
                    <span
                      className="font-semibold text-slate-900"
                      title={entry.annualFeeApprox ? "국내전용/해외겸용 등 여러 연회비 중 하나로 추정한 값입니다." : undefined}
                    >
                      {entry.annualFeeApprox && "약 "}
                      {entry.annualFee !== undefined ? formatWon(entry.annualFee) : "정보 없음"}
                    </span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => myCards.remove(entry.sourceId)}
                  className="rounded-lg border border-slate-200 py-1.5 text-xs font-medium text-slate-500 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
                >
                  내 카드에서 제거
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <CardDetailModal
        entry={selected}
        onClose={() => setSelected(null)}
        inMyCards={selected ? myCards.has(selected.sourceId) : false}
        onToggleMyCards={(e) => myCards.toggle(e.sourceId)}
      />
    </section>
  );
}
