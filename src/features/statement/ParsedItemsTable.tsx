import { useState } from "react";
import { AlertCircle, Check, Plus, Trash2 } from "lucide-react";
import type { SpendCategory } from "@/domain/types/card";
import type { ParsedSpendingItem } from "@/features/statement/importerParser";
import { useToast } from "@/shared/hooks/useToast";

type ImportMode = "merge" | "overwrite";

interface ParsedItemsTableProps {
  categories: SpendCategory[];
  items: ParsedSpendingItem[];
  onUpdateItem: <K extends keyof ParsedSpendingItem>(
    index: number,
    field: K,
    value: ParsedSpendingItem[K],
  ) => void;
  onDeleteItem: (index: number) => void;
  onDeleteSelected?: (indices: number[]) => void;
  onAddItem?: () => void;
  importMode: ImportMode;
  onImportModeChange: (mode: ImportMode) => void;
  onCancel: () => void;
  onApply: () => void;
}

/** AI/로컬 분석 결과를 검토·수정하고 지출 시뮬레이터에 반영하기 전 보여주는 미리보기 테이블. */
export function ParsedItemsTable({
  categories,
  items,
  onUpdateItem,
  onDeleteItem,
  onDeleteSelected,
  onAddItem,
  importMode,
  onImportModeChange,
  onCancel,
  onApply,
}: ParsedItemsTableProps) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [validationError, setValidationError] = useState<string | null>(null);
  const toast = useToast();

  const hasRefund = items.some((item) => item.amount < 0);
  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  const totalCount = items.length;

  const handleToggleAll = () => {
    if (selectedIndices.size === items.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(items.map((_, i) => i)));
    }
  };

  const handleToggleIndex = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleDeleteSelected = () => {
    if (selectedIndices.size === 0) return;
    const indices = Array.from(selectedIndices);
    if (onDeleteSelected) {
      onDeleteSelected(indices);
    } else {
      const sorted = [...indices].sort((a, b) => b - a);
      sorted.forEach((idx) => onDeleteItem(idx));
    }
    setSelectedIndices(new Set());
  };

  const handleSingleDelete = (index: number) => {
    onDeleteItem(index);
    setSelectedIndices((prev) => {
      const next = new Set<number>();
      for (const i of prev) {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      }
      return next;
    });
  };

  const handleApplyClick = () => {
    const emptyMerchantIdx = items.findIndex((item) => !item.merchant.trim());
    if (emptyMerchantIdx !== -1) {
      const msg = `${emptyMerchantIdx + 1}번째 항목의 가맹점명을 입력해 주세요.`;
      setValidationError(msg);
      toast.warning(msg);
      return;
    }

    const invalidAmountIdx = items.findIndex((item) => item.amount === 0);
    if (invalidAmountIdx !== -1) {
      const msg = `${invalidAmountIdx + 1}번째 항목의 금액을 0원 초과하여 입력해 주세요.`;
      setValidationError(msg);
      toast.warning(msg);
      return;
    }

    setValidationError(null);
    onApply();
  };

  return (
    <div className="mt-6 border-t border-slate-100 pt-5 animate-fadeIn">
      <div className="mb-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
        <h3 className="text-sm font-bold text-slate-800">지출 파싱 결과 미리보기 ({totalCount}건)</h3>
        <span className="text-xs text-slate-400">
          {hasRefund
            ? "💡 환불/취소 내역(음수 금액)은 시뮬레이터 적용 시 지출에서 차감됩니다."
            : "데이터를 검토하고 수정한 뒤 시뮬레이터에 적용하세요."}
        </span>
      </div>

      {validationError && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-medium">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* 총 파싱 요약 배너 */}
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">파싱 건수:</span>
            <span className="rounded-md bg-blue-100/80 px-2 py-0.5 text-xs font-bold text-blue-700">
              {totalCount}건
            </span>
          </div>
          {selectedIndices.size > 0 && (
            <button
              type="button"
              onClick={handleDeleteSelected}
              className="inline-flex items-center gap-1 rounded-md bg-rose-50 border border-rose-200 px-2 py-0.5 text-xs font-bold text-rose-600 hover:bg-rose-100 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              선택 삭제 ({selectedIndices.size}개)
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-semibold text-slate-600">총 파싱 금액:</span>
          <span className="text-sm font-extrabold text-blue-600">
            {totalAmount.toLocaleString()}원
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
          <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-2.5 w-10 text-center">
                <input
                  type="checkbox"
                  aria-label="전체 선택"
                  checked={items.length > 0 && selectedIndices.size === items.length}
                  onChange={handleToggleAll}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </th>
              <th className="px-4 py-2.5">가맹점(내역)</th>
              <th className="px-4 py-2.5 w-32">카테고리</th>
              <th className="px-4 py-2.5 w-32">금액</th>
              <th className="px-2 py-2.5 text-center w-12">삭제</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {items.map((item, index) => {
              const isRefund = item.amount < 0;
              const isSelected = selectedIndices.has(index);
              const isMerchantEmpty = !item.merchant.trim();
              const isAmountZero = item.amount === 0;

              return (
                <tr
                  key={index}
                  className={`hover:bg-slate-50/50 ${
                    isSelected ? "bg-blue-50/40" : isRefund ? "bg-rose-50/20" : ""
                  }`}
                >
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      aria-label={`항목 선택 ${index + 1}`}
                      checked={isSelected}
                      onChange={() => handleToggleIndex(index)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1.5">
                      {isRefund && (
                        <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-700">
                          환불/취소
                        </span>
                      )}
                      <input
                        type="text"
                        aria-label="가맹점명"
                        placeholder={isMerchantEmpty ? "가맹점명 필수 입력" : ""}
                        value={item.merchant}
                        onChange={(e) => {
                          if (validationError) setValidationError(null);
                          onUpdateItem(index, "merchant", e.target.value);
                        }}
                        className={`w-full rounded-md border px-1.5 py-1 font-medium text-slate-800 focus:bg-white focus:outline-none ${
                          isMerchantEmpty && validationError
                            ? "border-rose-400 bg-rose-50/40 placeholder:text-rose-400 focus:border-rose-500"
                            : "border-transparent bg-transparent hover:border-slate-200 focus:border-blue-500"
                        }`}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={item.category}
                      aria-label="카테고리"
                      onChange={(e) => onUpdateItem(index, "category", e.target.value)}
                      className="w-full rounded-md border border-transparent bg-transparent px-1 py-1 font-semibold text-slate-700 hover:border-slate-200 focus:border-blue-500 focus:bg-white focus:outline-none"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      aria-label="금액"
                      value={item.amount}
                      step={1000}
                      onChange={(e) => {
                        if (validationError) setValidationError(null);
                        onUpdateItem(index, "amount", Number(e.target.value) || 0);
                      }}
                      className={`w-full rounded-md border px-1.5 py-1 text-right font-bold focus:bg-white focus:outline-none ${
                        isAmountZero && validationError
                          ? "border-rose-400 bg-rose-50/40 text-rose-600 focus:border-rose-500"
                          : isRefund
                          ? "border-transparent bg-transparent text-rose-600 hover:border-slate-200 focus:border-blue-500"
                          : "border-transparent bg-transparent text-slate-800 hover:border-slate-200 focus:border-blue-500"
                      }`}
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button
                      type="button"
                      aria-label="항목 삭제"
                      onClick={() => handleSingleDelete(index)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-2.5 flex items-center justify-between">
        {onAddItem ? (
          <button
            type="button"
            onClick={onAddItem}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-blue-300 bg-blue-50/60 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-100/70 hover:border-blue-400 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            지출 항목 직접 추가
          </button>
        ) : <div />}

        {selectedIndices.size > 0 && (
          <button
            type="button"
            onClick={handleDeleteSelected}
            className="inline-flex items-center gap-1 rounded-lg bg-rose-50 border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            선택 삭제 ({selectedIndices.size}개)
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-col justify-between gap-4 rounded-xl border border-blue-100 bg-blue-50/20 p-4 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="importMode"
                checked={importMode === "merge"}
                onChange={() => onImportModeChange("merge")}
                className="text-blue-600 focus:ring-blue-500"
              />
              기존 지출액에 합산 (누적)
            </label>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="importMode"
                checked={importMode === "overwrite"}
                onChange={() => onImportModeChange("overwrite")}
                className="text-blue-600 focus:ring-blue-500"
              />
              기존 값 덮어쓰기 (교체)
            </label>
          </div>

          <div className="hidden md:flex items-center gap-1.5 border-l border-blue-200 pl-4 text-xs">
            <span className="text-slate-500 font-medium">총 파싱 금액:</span>
            <span className="font-extrabold text-blue-700 text-sm">
              {totalAmount.toLocaleString()}원
            </span>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleApplyClick}
            className="flex items-center gap-1 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            <Check className="h-4 w-4" />
            지출 시뮬레이터에 적용
          </button>
        </div>
      </div>
    </div>
  );
}
