import { useMemo, useState } from "react";
import { ErrorBoundary } from "@/shared/components/ErrorBoundary";
import { SpendingImporter } from "@/features/statement/SpendingImporter";
import type { ParsedSpendingItem } from "@/features/statement/importerParser";
import { useMonthlySpend } from "@/domain/state/useMonthlySpend";
import { useBrands } from "@/domain/engine/walletEngine";
import { catalogCards, categories, catLabel } from "@/v1/catalog";
import { Btn, Section } from "@/v1/ui";
import { korWon } from "@/v1/format";
import type { BrandSpend } from "@/v1/state";

interface Props {
  addBrands: (items: { cat: string; brand: string; amount: number }[]) => void;
  brandSpend: BrandSpend;
  onRecommend: () => void;
}

const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();

export function StatementV1({ addBrands, brandSpend, onRecommend }: Props) {
  const { spending, applyImportedItems } = useMonthlySpend(categories);
  const [lastBrands, setLastBrands] = useState<number>(0);
  // 혜택 표에 나오는 브랜드 전체(가게 이름을 브랜드로 묶을 때 씀)
  const allIds = useMemo(() => catalogCards.map((c) => c.sourceId), []);
  const brands = useBrands(allIds);

  const onImport = (items: ParsedSpendingItem[], mode: "merge" | "overwrite") => {
    applyImportedItems(items, mode);
    const dict = brands.data?.categories ?? {};
    const found: { cat: string; brand: string; amount: number }[] = [];
    for (const it of items) {
      if (it.amount <= 0) continue;
      const rows = dict[it.category] ?? [];
      const hit = rows.find((r) => norm(it.merchant).includes(norm(r.name)));
      if (hit) found.push({ cat: it.category, brand: hit.name, amount: it.amount });
    }
    if (found.length) addBrands(found);
    setLastBrands(found.length);
  };

  const breakdown = categories
    .map((c) => ({ id: c.id, amount: spending[c.id] ?? 0 }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const total = breakdown.reduce((s, c) => s + c.amount, 0);
  const brandLines = Object.entries(brandSpend).flatMap(([cat, b]) => Object.entries(b).map(([n, v]) => `${catLabel(cat)} · ${n} ${korWon(v)}`));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[26px] font-extrabold md:text-[32px]">명세서로 지출 채우기</h1>
        <p className="text-[13.5px] text-ink-2">카드사 앱이나 홈페이지에서 받은 이용대금명세서를 올리면 카테고리별 지출을 대신 채워 드려요</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {[
          ["1", "명세서 올리기", "한 달치 이용대금명세서 하나면 돼요"],
          ["2", "분류 확인·수정", "가맹점 이름으로 나눈 결과를 표에서 고쳐요. 환불은 자동으로 빼요"],
          ["3", "지출에 반영", "지출 금액과 자주 가는 곳 금액이 함께 채워져요"],
        ].map(([n, t, d]) => (
          <div key={n} className="flex gap-3 rounded-[16px] border border-line bg-surface p-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-white">{n}</span>
            <div>
              <div className="text-[14px] font-bold">{t}</div>
              <div className="text-[12.5px] text-ink-2">{d}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-[20px] border border-line bg-surface p-4 md:p-5">
        <ErrorBoundary fallbackTitle="지출 내역 가져오기 오류" fallbackMessage="명세서를 읽는 중 오류가 났어요. 다시 시도해 주세요.">
          <SpendingImporter categories={categories} onImport={onImport} />
        </ErrorBoundary>
        <p className="mt-3 text-[12.5px] text-ink-3">파일은 이 브라우저 안에서만 읽어요. 서버로 보내거나 저장하지 않아요.</p>
      </div>

      <Section title="분석 결과" aside={total ? `합계 ${korWon(total)}` : undefined}>
        {breakdown.length === 0 ? (
          <p className="rounded-[14px] border border-dashed border-line-strong py-10 text-center text-[13.5px] text-ink-3">아직 분석한 명세서가 없어요. 명세서를 올리면 여기에 카테고리별 금액이 나와요.</p>
        ) : (
          <>
            <ul className="space-y-2.5">
              {breakdown.map((c) => (
                <li key={c.id} className="grid grid-cols-[96px_1fr_96px] items-center gap-3 text-[13.5px]">
                  <span className="text-ink-2">{catLabel(c.id)}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-line-soft">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${(c.amount / breakdown[0].amount) * 100}%` }} />
                  </span>
                  <span className="tnum text-right font-bold">{korWon(c.amount)}</span>
                </li>
              ))}
            </ul>
            {brandLines.length > 0 && (
              <div className="mt-4 rounded-[14px] bg-tint p-3 text-[13px] text-ink-2">
                <strong className="text-ink">자주 가는 곳{lastBrands ? ` (이번에 ${lastBrands}건 찾음)` : ""}</strong>: {brandLines.slice(0, 8).join(" · ")}
              </div>
            )}
            <Btn kind="primary" size="lg" className="mt-5 w-full" onClick={onRecommend}>
              이 지출로 카드 추천받기
            </Btn>
          </>
        )}
      </Section>
    </div>
  );
}
