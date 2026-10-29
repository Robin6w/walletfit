import { useState } from "react";
import { categories, catLabel, MAIN_CATEGORIES } from "@/v1/catalog";
import { WonInput, Btn } from "@/v1/ui";
import { estimateSpendingFromIncome, ASSUMED_CARD_SPEND_RATIO } from "@/domain/engine/incomeEstimate";
import type { MonthlySpend } from "@/domain/types/card";

interface Props {
  spending: MonthlySpend;
  onChange: (cat: string, value: number) => void;
  onReplace: (next: MonthlySpend) => void;
  onOpenStatement: () => void;
}

export function SpendStep({ spending, onChange, onReplace, onOpenStatement }: Props) {
  const [extra, setExtra] = useState<string[]>(() => categories.map((c) => c.id).filter((id) => !MAIN_CATEGORIES.includes(id) && (spending[id] ?? 0) > 0));
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [income, setIncome] = useState(0);
  const shown = [...MAIN_CATEGORIES, ...extra];
  const rest = categories.map((c) => c.id).filter((id) => !shown.includes(id));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-extrabold md:text-[32px]">한 달에 어디에 얼마를 쓰나요?</h1>
          <p className="mt-1 text-[14px] text-ink-2">대략적인 금액이면 충분해요. 안 쓰는 항목은 비워 두세요.</p>
        </div>
        <div className="flex gap-2">
          <Btn size="sm" onClick={onOpenStatement}>
            명세서로 채우기
          </Btn>
          <Btn size="sm" kind={incomeOpen ? "tint" : "secondary"} onClick={() => setIncomeOpen((v) => !v)} aria-expanded={incomeOpen}>
            월 소득으로 대략 채우기
          </Btn>
        </div>
      </div>

      {incomeOpen && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[16px] border border-tint-line bg-tint p-4 text-[14px]">
          <span>월 소득(세후)</span>
          <WonInput value={income} onChange={setIncome} label="월 소득" />
          <span className="text-ink-2">의 {Math.round(ASSUMED_CARD_SPEND_RATIO * 100)}%를 카드로 쓴다고 보고 카테고리별 평균 비중으로 나눠요.</span>
          <Btn
            kind="primary"
            size="sm"
            disabled={!income}
            onClick={() => {
              onReplace(estimateSpendingFromIncome(income, categories, ASSUMED_CARD_SPEND_RATIO));
              setIncomeOpen(false);
            }}
          >
            채우기
          </Btn>
        </div>
      )}

      <div className="mt-6 grid rounded-[20px] border border-line bg-surface px-4 md:grid-cols-2 md:gap-x-10 md:px-6">
        {shown.map((id) => (
          <div key={id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft py-3.5">
            <span className="min-w-[88px] text-[15px] font-bold">{catLabel(id)}</span>
            <div className="flex items-center gap-1.5">
              <WonInput value={spending[id] ?? 0} onChange={(v) => onChange(id, v)} label={`${catLabel(id)} 월 지출`} widthClass="w-24 md:w-28" />
              {[10000, 50000].map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => onChange(id, (spending[id] ?? 0) + step)}
                  className="hidden min-h-11 rounded-[10px] border border-line px-2.5 text-[12.5px] text-ink-2 hover:bg-ground sm:block"
                  aria-label={`${catLabel(id)} ${step / 10000}만원 더하기`}
                >
                  +{step / 10000}만
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {rest.length > 0 && (
        <div className="mt-5">
          <div className="text-[14px] font-bold">다른 데도 쓰나요? 눌러서 추가</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {rest.map((id) => (
              <button key={id} type="button" onClick={() => setExtra((e) => [...e, id])} className="min-h-10 rounded-full border border-line-strong bg-surface px-3.5 text-[13px] text-ink-2 hover:border-primary">
                + {catLabel(id)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
