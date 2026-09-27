import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface IssuerExclusionFilterProps {
  /** "전체 카드 중 추천" 후보 풀에 실제로 등장하는 카드사 목록(가나다순) */
  issuers: string[];
  /** 추천 후보에서 제외할 카드사 집합. 비어있으면(기본값) 전체 카드사가 포함됩니다. */
  excludedIssuers: Set<string>;
  onToggleIssuer: (issuer: string) => void;
  onIncludeAll: () => void;
  onExcludeAll: () => void;
}

/**
 * "내 카드 중 추천"/"전체 카드 중 추천" 두 스코프 모두에서 특정 카드사를 통째로 후보에서 빼고
 * 싶을 때 쓰는 필터입니다. 기본값은 "전체 포함"이고, 사용자가 하나씩(또는 전체 제외 버튼으로)
 * 카드사를 빼는 방향으로만 조작합니다. 이미 excludedIssuers 상태는 WalletWizardPage에서
 * filteredCards 계산에 그대로 반영되어, 추천 후보/카드 비교 목록/조합 추천 전부 동일하게
 * 걸러집니다.
 */
export function IssuerExclusionFilter({
  issuers,
  excludedIssuers,
  onToggleIssuer,
  onIncludeAll,
  onExcludeAll,
}: IssuerExclusionFilterProps) {
  const [expanded, setExpanded] = useState(false);
  const includedCount = issuers.length - excludedIssuers.size;

  if (issuers.length === 0) return null;

  return (
    <div className="glass-panel mb-4 rounded-xl border border-slate-200">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div>
          <p className="text-[12.5px] font-semibold text-[#14192f]">카드사 필터</p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {excludedIssuers.size === 0
              ? `전체 ${issuers.length}개 카드사가 추천 후보에 포함돼요`
              : `${includedCount}/${issuers.length}개 카드사 포함 중 (${excludedIssuers.size}개 제외됨)`}
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3.5">
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={onIncludeAll}
              disabled={excludedIssuers.size === 0}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11.5px] font-semibold text-slate-500 transition hover:border-brand-blue hover:text-brand-blue disabled:cursor-not-allowed disabled:opacity-40"
            >
              전체 포함
            </button>
            <button
              type="button"
              onClick={onExcludeAll}
              disabled={excludedIssuers.size === issuers.length}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11.5px] font-semibold text-slate-500 transition hover:border-rose-400 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              전체 제외
            </button>
          </div>
          <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto pr-1">
            {issuers.map((issuer) => {
              const isExcluded = excludedIssuers.has(issuer);
              return (
                <button
                  key={issuer}
                  type="button"
                  onClick={() => onToggleIssuer(issuer)}
                  aria-pressed={!isExcluded}
                  title={isExcluded ? `${issuer} — 제외됨. 다시 눌러 포함시키기` : `${issuer} — 포함됨. 눌러서 제외하기`}
                  className={`rounded-full border px-3 py-1 text-[11.5px] font-medium transition ${
                    isExcluded
                      ? "border-slate-200 bg-slate-50 text-slate-400 line-through"
                      : "border-brand-blue/30 bg-brand-blue/10 text-brand-blue"
                  }`}
                >
                  {issuer}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
