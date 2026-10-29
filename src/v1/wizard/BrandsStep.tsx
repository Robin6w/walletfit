import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { catLabel } from "@/v1/catalog";
import { WonInput, Spinner } from "@/v1/ui";
import { korWon } from "@/v1/format";
import type { BrandRow } from "@/domain/types/engine";
import type { BrandSpend } from "@/v1/state";
import { shortCard } from "@/v1/wallet/model";

interface Props {
  cardCount: number;
  spending: Record<string, number>;
  brands: Record<string, BrandRow[]> | null;
  loading: boolean;
  brandSpend: BrandSpend;
  onSet: (cat: string, brand: string, amount: number) => void;
  defaultShare: number;
}

export function BrandsStep({ cardCount, spending, brands, loading, brandSpend, onSet, defaultShare }: Props) {
  const cats = Object.entries(brands ?? {})
    .filter(([cat, rows]) => (spending[cat] ?? 0) > 0 && rows.length > 0)
    .sort((a, b) => (spending[b[0]] ?? 0) - (spending[a[0]] ?? 0));
  const examples = cats
    .flatMap(([, rows]) => rows.slice(0, 1).map((r) => r.name))
    .slice(0, 2)
    .join("·");

  return (
    <div>
      <div className="text-[13px] font-bold text-primary">지출 입력 · 마지막 질문 (선택)</div>
      <h1 className="mt-1 text-[24px] font-extrabold md:text-[32px]">자주 가는 곳이 있나요?</h1>
      <p className="mt-1 text-[14px] text-ink-2">
        {cardCount > 0 ? `가진 카드 ${cardCount}장에` : "비교할 카드에"} {examples ? `${examples}처럼 ` : ""}특정 브랜드에서만 되는 할인이 있어요. 대략 얼마 쓰는지 알려주시면 그
        할인을 정확히 계산해요. 명세서를 올렸다면 자동으로 채워져요.
      </p>

      {loading && !brands && (
        <div className="mt-8">
          <Spinner label="담은 카드의 브랜드 할인을 찾고 있어요" />
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cats.map(([cat, rows]) => (
          <BrandCard key={cat} cat={cat} rows={rows} spend={spending[cat] ?? 0} values={brandSpend[cat] ?? {}} onSet={onSet} />
        ))}
        {cats.length > 0 && (
          <div className="flex gap-3 rounded-[20px] border border-[#F3D9B5] bg-caution-bg p-5 text-[14px] leading-relaxed text-ink-2">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-caution" />
            <p>
              적은 브랜드만 할인 대상으로 계산해요.
              <br />
              카테고리를 통째로 비워 두면 그 카테고리의 브랜드 할인은 지출의 {Math.round(defaultShare * 100)}%로 추정하고, 결과에 '추정'으로 표시해요.
            </p>
          </div>
        )}
      </div>
      {!loading && brands && cats.length === 0 && (
        <p className="mt-8 rounded-[16px] bg-surface p-6 text-center text-[14px] text-ink-2">이 카드들에는 브랜드 한정 할인이 없어요. 바로 결과를 볼 수 있어요.</p>
      )}
    </div>
  );
}

function BrandCard({
  cat,
  rows,
  spend,
  values,
  onSet,
}: {
  cat: string;
  rows: BrandRow[];
  spend: number;
  values: Record<string, number>;
  onSet: (cat: string, brand: string, amount: number) => void;
}) {
  const initial = rows.filter((r, i) => i < 2 || values[r.name] > 0).map((r) => r.name);
  const [open, setOpen] = useState<string[]>(initial);
  const sum = Object.values(values).reduce((s, v) => s + v, 0);
  const over = sum > spend;
  const cards = Array.from(new Set(rows.flatMap((r) => r.cards))).map(shortCard);
  return (
    <div className="flex flex-col rounded-[20px] border border-line bg-surface p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[16px] font-extrabold">{catLabel(cat)}</h2>
        <span className="text-[13px] text-ink-3">월 {korWon(spend)}</span>
      </div>
      <div className="mt-3 space-y-2.5">
        {open.map((name) => (
          <div key={name} className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-[14px]">{name}</span>
            <div className="flex items-center gap-2">
              <WonInput value={values[name] ?? 0} onChange={(v) => onSet(cat, name, v)} label={`${name} 월 금액`} widthClass="w-20" />
              <span className="tnum w-9 text-right text-[12.5px] text-ink-3">{spend ? Math.round(((values[name] ?? 0) / spend) * 100) : 0}%</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {rows
          .filter((r) => !open.includes(r.name))
          .slice(0, 6)
          .map((r) => (
            <button key={r.name} type="button" onClick={() => setOpen((o) => [...o, r.name])} className="min-h-9 rounded-full border border-line-strong px-3 text-[12.5px] text-ink-2">
              + {r.name}
            </button>
          ))}
      </div>
      {over && (
        <p className="mt-2 text-[12.5px] font-semibold text-caution" role="alert">
          브랜드 합계가 {catLabel(cat)} 월 지출보다 많아요. 금액을 다시 확인해 주세요.
        </p>
      )}
      <div className="mt-auto flex flex-wrap justify-between gap-2 border-t border-line-soft pt-3 text-[12.5px] text-ink-3">
        <span>
          {sum > 0 ? `다른 ${catLabel(cat).split("·")[0]} ${korWon(Math.max(0, spend - sum))}` : `비워 두면 ${catLabel(cat)} 지출의 35%로 추정`}
        </span>
        <span>할인 카드: {cards.slice(0, 3).join(" · ")}</span>
      </div>
    </div>
  );
}
