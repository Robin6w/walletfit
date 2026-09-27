import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CatalogListing } from "@/domain/types/catalog";
import { formatWon, formatRatePercent } from "@/shared/lib/format";
import { categories } from "@/domain/engine/loadCatalog";

const REWARD_KIND_LABEL: Record<string, string> = {
  discount: "할인",
  point: "포인트 적립",
  cashback: "캐시백",
};

const categoryLabel = (id: string) => categories.find((c) => c.id === id)?.label ?? id;

interface CardDetailModalProps {
  entry: CatalogListing | null;
  onClose: () => void;
  inMyCards?: boolean;
  onToggleMyCards?: (entry: CatalogListing) => void;
}

export function CardDetailModal({
  entry,
  onClose,
  inMyCards = false,
  onToggleMyCards = () => {},
}: CardDetailModalProps) {
  const [prevEntry, setPrevEntry] = useState(entry);
  const [imgError, setImgError] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const prevActiveElementRef = useRef<HTMLElement | null>(null);

  if (entry !== prevEntry) {
    setPrevEntry(entry);
    setImgError(false);
  }

  useEffect(() => {
    if (!entry) return;

    // 모달 활성화 전 포커스 위치 보관 (Focus Restoration)
    prevActiveElementRef.current = document.activeElement as HTMLElement | null;

    // 배경 스크롤 차단 및 이전 스타일 저장
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // 첫 번째 포커스 가능한 요소로 자동 포커스
    const focusTimer = setTimeout(() => {
      if (!dialogRef.current) return;
      const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]):not([tabindex="-1"]), [href]:not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length > 0) {
        focusables[0].focus();
      }
    }, 0);

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape 키 입력 시 모달 닫기
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      // Tab 키 입력 시 포커스 트랩(Focus Trap) 순환 제어
      if (e.key === "Tab") {
        if (!dialogRef.current) return;
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]):not([tabindex="-1"]), [href]:not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])'
          )
        );

        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const firstElement = focusables[0];
        const lastElement = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement || !dialogRef.current.contains(document.activeElement)) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement || !dialogRef.current.contains(document.activeElement)) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
      // 모달 종료 시 이전 활성 요소로 포커스 복원
      prevActiveElementRef.current?.focus?.();
    };
  }, [entry, onClose]);

  if (!entry) return null;
  const showImage = entry.imageUrl && !imgError;

  // 2026-09 버그 수정: 이 모달이 (glass-panel 등) backdrop-filter가 걸린 조상 요소 안에서
  // 렌더링되면, CSS 스펙상 그 조상이 position:fixed 자손의 containing block이 되어버려서
  // "fixed inset-0"이 뷰포트가 아니라 그 조상 기준으로 계산된다. 그 결과 모달의 배경
  // 오버레이(backdrop-blur-sm)가 조상의 backdrop-filter 합성 레이어 안에 갇혀 화면 전체가
  // 뿌옇게 뭉개져 보이는 버그가 생긴다. document.body로 포탈을 띄워서 어떤 조상의
  // stacking/filter 컨텍스트와도 완전히 분리한다.
  return createPortal(
    <dialog
      ref={dialogRef}
      open
      aria-modal="true"
      aria-labelledby="card-modal-title"
      className="fixed inset-0 z-50 m-0 flex h-full w-full max-h-none max-w-none items-center justify-center border-none bg-transparent p-4 animate-[fadeIn_0.15s_ease-out]"
    >
      <button
        type="button"
        aria-label="대화상자 닫기"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
        className="fixed inset-0 h-full w-full bg-slate-900/50 backdrop-blur-sm -z-10 cursor-default border-none"
      />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl animate-[popIn_0.18s_ease-out]">
        <div className="relative flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-6 py-8">
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-slate-500 shadow-sm transition hover:bg-white hover:text-slate-800"
          >
            ✕
          </button>
          {showImage ? (
            <img
              src={entry.imageUrl}
              alt={entry.name}
              onError={() => setImgError(true)}
              className="max-h-40 w-auto object-contain drop-shadow-lg"
            />
          ) : (
            <div className="brand-gradient-soft flex h-32 w-52 items-center justify-center rounded-xl text-sm font-medium text-white/90">
              이미지 없음
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 p-6">
          <div>
            <p className="text-sm font-medium text-brand-blue">{entry.issuer || "카드사 미상"}</p>
            <h2 id="card-modal-title" className="mt-1 text-xl font-bold text-slate-900">{entry.name}</h2>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm">
            <div>
              <p className="text-xs text-slate-400">카드 종류</p>
              <p className="mt-0.5 font-medium text-slate-800">{entry.category || "정보 없음"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">연회비{entry.annualFeeApprox && " (추정)"}</p>
              <p className="mt-0.5 font-medium text-slate-800">
                {entry.annualFee !== undefined ? formatWon(entry.annualFee) : "정보 없음"}
              </p>
            </div>
            {entry.annualFeeText && (
              <div className="col-span-2">
                <p className="text-xs text-slate-400">연회비 상세</p>
                <p className="mt-0.5 font-medium text-slate-800">{entry.annualFeeText}</p>
              </div>
            )}
          </div>

          {entry.benefitSummary && (
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-400">혜택 요약</p>
              <p className="text-sm leading-relaxed text-slate-700">{entry.benefitSummary}</p>
            </div>
          )}

          {entry.categoryTiers && entry.categoryTiers.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-400">구간별 요율</p>
              <p className="mb-2 text-[11px] leading-relaxed text-slate-400">
                전월실적(카테고리 지출 합계) 구간에 따라 요율이 달라져요. 구간이 높을수록 더 많이
                써야 하지만 요율도 더 좋아져요.
              </p>
              <div className="flex flex-col gap-2.5">
                {entry.categoryTiers.map((ct) => (
                  <div key={ct.category} className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-600">
                      {categoryLabel(ct.category)}
                      <span className="ml-1.5 text-[10px] font-normal text-slate-400">
                        {REWARD_KIND_LABEL[ct.type] ?? "혜택"}
                      </span>
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {ct.tiers.map((tier, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200"
                        >
                          {formatWon(tier.minSpend)}~ {formatRatePercent(tier.rate)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onToggleMyCards(entry)}
              className={`cta-btn flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                inMyCards
                  ? "bg-rose-50 text-rose-600 hover:bg-rose-100"
                  : "brand-gradient text-white"
              }`}
            >
              {inMyCards ? "내 카드에서 제거" : "내 카드에 추가"}
            </button>
            <a
              href={entry.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-brand-blue/50 hover:text-brand-blue"
            >
              상세보기 ↗
            </a>
          </div>
        </div>
      </div>
    </dialog>,
    document.body
  );
}
