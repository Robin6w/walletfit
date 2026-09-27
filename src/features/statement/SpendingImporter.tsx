import { useState, useRef } from "react";
import { FileText, AlertCircle, RefreshCw, Upload, X, ArrowUpToLine, ScanLine, Wallet } from "lucide-react";
import {
  readStatementFileAsText,
  validateStatementFile,
  parseTextLocally,
  type ParsedSpendingItem,
} from "@/features/statement/importerParser";
import type { SpendCategory } from "@/domain/types/card";
import { ParsedItemsTable } from "@/features/statement/ParsedItemsTable";
import { useToast } from "@/shared/hooks/useToast";
import { ErrorBoundary } from "@/shared/components/ErrorBoundary";

interface SpendingImporterProps {
  categories: SpendCategory[];
  onImport: (items: ParsedSpendingItem[], mode: "merge" | "overwrite") => void;
}

function toErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function SpendingImporter({ categories, onImport }: SpendingImporterProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // 파싱된 지출 내역 임시 보관
  const [parsedItems, setParsedItems] = useState<ParsedSpendingItem[]>([]);
  const [importMode, setImportMode] = useState<"merge" | "overwrite">("merge");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const handleFileChange = (file: File) => {
    const validation = validateStatementFile(file);
    if (!validation.isValid) {
      setAnalysisError(validation.error || "올바르지 않은 파일입니다.");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedFile(file);
    setAnalysisError(null);
    setParsedItems([]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileChange(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setParsedItems([]);
    setAnalysisError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // 파싱 결과 개별 수정/삭제 핸들러
  const handleUpdateItem = <K extends keyof ParsedSpendingItem>(
    index: number,
    field: K,
    value: ParsedSpendingItem[K],
  ) => {
    setParsedItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleDeleteItem = (index: number) => {
    setParsedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDeleteSelected = (indices: number[]) => {
    const set = new Set(indices);
    setParsedItems((prev) => prev.filter((_, i) => !set.has(i)));
  };

  const handleAddItem = () => {
    const defaultCategory = categories[0]?.id || "other";
    setParsedItems((prev) => [
      ...prev,
      { merchant: "", amount: 0, category: defaultCategory },
    ]);
  };

  // 명세서 분석 실행: PDF는 텍스트 레이어를 추출하고, TXT/CSV는 그대로 읽어서
  // 동일한 줄 단위 키워드 매칭 파서(parseTextLocally)로 넘긴다.
  const handleAnalyzeStatement = async () => {
    if (!selectedFile) {
      setAnalysisError("분석할 명세서 파일을 선택해 주세요.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    setParsedItems([]);

    try {
      const text = await readStatementFileAsText(selectedFile);
      const result = parseTextLocally(text);
      if (result.length === 0) {
        setAnalysisError(
          "명세서에서 인식 가능한 결제 내역을 찾지 못했습니다. 스캔 이미지로 저장된 PDF는 텍스트 추출이 어려울 수 있어요. 카드사 웹/앱에서 받은 원본 명세서 파일인지 확인해 주세요.",
        );
      } else {
        setParsedItems(result);
      }
    } catch (err) {
      setAnalysisError(toErrorMessage(err, "명세서 분석 중 에러가 발생했습니다."));
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 최종 지출 시뮬레이터에 적용
  const handleApply = () => {
    if (parsedItems.length === 0) return;
    const hasInvalid = parsedItems.some((item) => !item.merchant.trim() || item.amount === 0);
    if (hasInvalid) {
      setAnalysisError("가맹점명이 비어있거나 금액이 0원인 항목이 있습니다. 확인 후 다시 시도해 주세요.");
      return;
    }
    onImport(parsedItems, importMode);
    toast.success(`지출 내역 ${parsedItems.length}건이 시뮬레이터에 성공적으로 반영되었습니다.`);
    // 상태 초기화
    setParsedItems([]);
    clearFile();
  };

  return (
    <section className="glass-panel relative rounded-2xl border border-slate-200 p-6 shadow-sm transition-all duration-300 hover:shadow-md">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800">
            <FileText className="h-5 w-5 text-brand-blue fill-brand-sky/40" />
            명세서 업로드
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            카드사 앱이나 홈페이지에서 받은 이번 달 이용대금 명세서 파일 하나면, 소비 카테고리 분석부터 카드 추천까지 자동으로 이어져요.
          </p>
        </div>
      </div>

      {/* Content Area */}
      <div className="mt-5 flex flex-col gap-4">
        {!selectedFile ? (
          <>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="application/pdf,text/plain,text/csv,.pdf,.txt,.csv"
              aria-label="명세서 파일 선택"
              className="hidden"
            />
            <button
              type="button"
              aria-label="카드 명세서 파일 업로드"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`group flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-blue ${
                isDragOver
                  ? "border-brand-blue bg-brand-sky/10 scale-[0.98]"
                  : "border-slate-300 hover:border-brand-blue/50 hover:bg-slate-50/50"
              }`}
            >
              <div className="brand-gradient-soft flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm">
                <Upload className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">명세서 파일을 여기에 끌어다 놓으세요</p>
                <p className="mt-1 text-xs text-slate-400">또는 클릭해서 파일 선택 · PDF, TXT, CSV · 최대 10MB</p>
              </div>
            </button>

            {/* 처리 과정 미니 레일 */}
            <div className="flex items-center justify-center gap-3 py-1 text-[11px] font-semibold text-slate-400">
              <span className="flex items-center gap-1.5">
                <ArrowUpToLine className="h-3.5 w-3.5 text-brand-blue" />
                명세서 업로드
              </span>
              <span className="h-px w-8 bg-slate-200" />
              <span className="flex items-center gap-1.5">
                <ScanLine className="h-3.5 w-3.5" />
                카테고리 자동 분석
              </span>
              <span className="h-px w-8 bg-slate-200" />
              <span className="flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5" />
                카드 추천
              </span>
            </div>

            <div className="flex items-start gap-2 rounded-xl bg-brand-sky/15 border border-brand-blue/20 p-3.5 text-[11px] text-brand-navy leading-relaxed">
              <AlertCircle className="h-4 w-4 text-brand-blue shrink-0 mt-0.5" />
              <div>
                <strong>안내:</strong> 업로드한 명세서는 이 브라우저 안에서만 분석되고, 서버로 전송되거나 저장되지 않아요. 키워드 매칭 규칙으로 분석하기 때문에, 결과가 부정확하면 아래 표에서 바로 수정할 수 있어요.
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-4 rounded-xl border border-slate-200 p-4 bg-slate-50/30">
            <div className="flex items-center gap-3">
              <div className="brand-gradient-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-slate-700 truncate">
                  파일 준비됨: {selectedFile.name}
                </div>
                <div className="text-[10px] text-slate-400">
                  크기: {(selectedFile.size / 1024).toFixed(1)} KB
                </div>
              </div>
              <button
                onClick={clearFile}
                aria-label="파일 제거"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={handleAnalyzeStatement}
              disabled={isAnalyzing}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-blue px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-brand-blue-deep transition-colors disabled:bg-brand-blue/40"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  분석 중...
                </>
              ) : (
                <>명세서 분석하기</>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Analysis Error Warning */}
      {analysisError && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          <span>{analysisError}</span>
        </div>
      )}

      {/* Shimmer loading when analyzing */}
      {isAnalyzing && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-white/80 backdrop-blur-xs">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="h-8 w-8 text-brand-blue-deep animate-spin" />
            <div className="text-sm font-bold text-slate-800 animate-pulse">명세서에서 지출 내역을 읽어오는 중...</div>
            <div className="text-[10px] text-slate-500">키워드 매칭 규칙으로 카테고리를 분류하고 있어요.</div>
          </div>
        </div>
      )}

      {/* Parsing Result Table / Preview */}
      {parsedItems.length > 0 && (
        <ErrorBoundary
          fallbackTitle="지출 내역 표 오류"
          fallbackMessage="파싱된 지출 내역 표를 렌더링하는 중 문제가 발생했습니다."
          onReset={() => setParsedItems([])}
        >
          <ParsedItemsTable
            categories={categories}
            items={parsedItems}
            onUpdateItem={handleUpdateItem}
            onDeleteItem={handleDeleteItem}
            onDeleteSelected={handleDeleteSelected}
            onAddItem={handleAddItem}
            importMode={importMode}
            onImportModeChange={setImportMode}
            onCancel={() => setParsedItems([])}
            onApply={handleApply}
          />
        </ErrorBoundary>
      )}
    </section>
  );
}
