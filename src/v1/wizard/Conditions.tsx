import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { CardKind, MonthlySpend } from "@/domain/types/card";
import type { EnginePack } from "@/domain/types/engine";
import { IssuerExclusionFilter } from "@/features/wallet/IssuerExclusionFilter";
import { IncomeCardCountEstimator } from "@/features/wallet/IncomeCardCountEstimator";
import { toWalletCard } from "@/domain/engine/cardConverter";
import { useExplain, toBrandShare } from "@/domain/engine/walletEngine";
import { catalogBySourceId, categories, isUnread } from "@/v1/catalog";
import { Btn, Spinner } from "@/v1/ui";
import { approxWon, korWon, num } from "@/v1/format";
import { shortCard } from "@/v1/wallet/model";
import { UNVERIFIED_IN_NEW_CARDS, type BrandSpend } from "@/v1/state";

interface Props {
  scope: "myCards" | "all";
  includeUnverified: boolean;
  onIncludeUnverified: (v: boolean) => void;
  unverifiedCount: number;
  mode: "maxBenefit" | "efficient";
  onMode: (m: "maxBenefit" | "efficient") => void;
  maxCards: number;
  onMaxCards: (n: number) => void;
  cardTypes: CardKind[];
  onToggleType: (t: CardKind) => void;
  issuers: string[];
  excludedIssuers: Set<string>;
  onToggleIssuer: (i: string) => void;
  onIncludeAll: () => void;
  onExcludeAll: () => void;
  candidateIds: number[];
  pack: EnginePack | null;
  spending: MonthlySpend;
  brandSpend: BrandSpend;
  margin: number;
  feeCap: number | null;
  onApplySpending: (s: MonthlySpend) => void;
  efficientCeiling: number | null;
}

/** 조건 바꾸기: 이전 결과 화면에 있던 기능을 모아 둔 접힌 영역 */
export function Conditions(p: Props) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-[20px] border border-line bg-surface">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left">
        <span>
          <span className="block text-[16px] font-extrabold">조건 바꾸기</span>
          <span className="block text-[12.5px] text-ink-3">계산 방식 · 최대 카드 수 · 카드 종류 · 카드사 제외 · 소득으로 카드 수 추정 · 카드 바꿔보기</span>
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-6 border-t border-line-soft p-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <div className="text-[13.5px] font-bold">계산 방식</div>
              <div className="mt-2 flex rounded-full bg-line-soft p-1" role="group" aria-label="계산 방식">
                {(["maxBenefit", "efficient"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={p.mode === m}
                    onClick={() => p.onMode(m)}
                    className={`min-h-10 flex-1 rounded-full text-[13px] ${p.mode === m ? "bg-surface font-bold text-primary shadow-sm" : "text-ink-2"}`}
                  >
                    {m === "maxBenefit" ? "혜택 최대화" : "효율적"}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[12px] text-ink-3">
                {p.mode === "maxBenefit"
                  ? "최대 카드 수 안에서 순혜택이 가장 큰 조합을 골라요."
                  : `1등 카드 순혜택의 30%도 못 버는 카드는 빼요.${p.efficientCeiling ? ` 이 지출에서는 ${p.efficientCeiling}장까지가 이득이에요.` : ""}`}
              </p>
            </div>
            <div>
              <div className="text-[13.5px] font-bold">최대 카드 수</div>
              <div className="mt-2 flex items-center gap-2">
                <Btn size="sm" onClick={() => p.onMaxCards(Math.max(1, p.maxCards - 1))} aria-label="최대 카드 수 줄이기">
                  −
                </Btn>
                <span className="tnum w-10 text-center text-[18px] font-extrabold">{p.maxCards}</span>
                <Btn size="sm" onClick={() => p.onMaxCards(Math.min(8, p.maxCards + 1))} aria-label="최대 카드 수 늘리기">
                  +
                </Btn>
                <span className="text-[12px] text-ink-3">장까지</span>
              </div>
            </div>
          </div>

          <div>
            <div className="text-[13.5px] font-bold">카드 종류</div>
            <div className="mt-2 flex gap-2">
              {(["credit", "check"] as CardKind[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={p.cardTypes.includes(t)}
                  onClick={() => p.onToggleType(t)}
                  className={`min-h-10 rounded-full border px-4 text-[13px] ${p.cardTypes.includes(t) ? "border-primary bg-tint font-bold text-primary" : "border-line-strong text-ink-3"}`}
                >
                  {t === "credit" ? "신용카드" : "체크카드"}
                </button>
              ))}
            </div>
          </div>

          {p.scope === "all" && UNVERIFIED_IN_NEW_CARDS && (
            <label className="flex items-start gap-3 rounded-[16px] bg-ground p-4 text-[13.5px]">
              <input type="checkbox" aria-label="검수 전 카드도 넣기" checked={p.includeUnverified} onChange={(e) => p.onIncludeUnverified(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--color-primary)]" />
              <span>
                <span className="font-bold">검수 전 카드도 넣기</span> <span className="text-ink-3">(자동 변환 {num(p.unverifiedCount)}장)</span>
                <span className="mt-0.5 block text-[12.5px] text-ink-3">
                  기본은 카드사 원문과 대조한 카드만 비교해요. 검수 전 카드는 혜택 요약 한 줄을 자동으로 옮겨서 실적 조건을 거의 못 읽었고, 혜택이 실제보다 크게 잡힐 수 있어요.
                </span>
              </span>
            </label>
          )}

          <IssuerExclusionFilter
            issuers={p.issuers}
            excludedIssuers={p.excludedIssuers}
            onToggleIssuer={p.onToggleIssuer}
            onIncludeAll={p.onIncludeAll}
            onExcludeAll={p.onExcludeAll}
          />

          <IncomeCardCountEstimator
            categories={categories}
            candidates={p.candidateIds.flatMap((sid) => { const e = catalogBySourceId.get(sid); return e ? [toWalletCard(e)] : []; }).slice(0, 60)}
            maxAnnualFee={p.feeCap ?? undefined}
            mode={p.mode}
            onApplySpending={p.onApplySpending}
            onApplyMaxCards={p.onMaxCards}
          />

          {p.pack && p.pack.cards.length > 0 && <SwapCard pack={p.pack} candidates={p.candidateIds} spending={p.spending} brandSpend={p.brandSpend} margin={p.margin} />}
        </div>
      )}
    </section>
  );
}

function SwapCard({ pack, candidates, spending, brandSpend, margin }: { pack: EnginePack; candidates: number[]; spending: MonthlySpend; brandSpend: BrandSpend; margin: number }) {
  const [outPick, setOut] = useState<number>(pack.cards[0].sid);
  const [inPick, setInId] = useState<number | null>(null);
  // 조건을 바꿔 조합이 다시 계산되면 고른 카드가 조합에서 빠지거나 이미 들어가 있을 수 있다 → 그때는 고른 값을 무시한다
  const out = pack.sids.includes(outPick) ? outPick : pack.cards[0].sid;
  const inId = inPick !== null && !pack.sids.includes(inPick) ? inPick : null;
  const options = useMemo(() => candidates.filter((s) => !pack.sids.includes(s) && catalogBySourceId.has(s)).slice(0, 200), [candidates, pack.sids]);
  const ids = inId ? pack.sids.map((s) => (s === out ? inId : s)) : null;
  const res = useExplain(ids ? { ids, spending, margin, brandShare: toBrandShare(spending, brandSpend) } : null);
  const after = res.data?.result;
  const unread = after?.cards.filter((c) => isUnread(c.sid)) ?? [];
  const idle = after?.cards.filter((c) => (c.pay ?? 0) <= 0 && !isUnread(c.sid)) ?? [];
  return (
    <div>
      <div className="text-[13.5px] font-bold">카드 바꿔보기</div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
        <select aria-label="뺄 카드" value={out} onChange={(e) => setOut(Number(e.target.value))} className="min-h-10 rounded-[10px] border border-line-strong bg-surface px-2">
          {pack.cards.map((c) => (
            <option key={c.sid} value={c.sid}>
              {shortCard(c.name)}
            </option>
          ))}
        </select>
        대신
        <select aria-label="넣을 카드" value={inId ?? ""} onChange={(e) => setInId(e.target.value ? Number(e.target.value) : null)} className="min-h-10 max-w-[260px] rounded-[10px] border border-line-strong bg-surface px-2">
          <option value="">카드 고르기</option>
          {options.map((s) => (
            <option key={s} value={s}>
              {catalogBySourceId.get(s)?.name}
            </option>
          ))}
        </select>
        을 넣으면
      </div>
      {res.isComputing && (
        <div className="mt-2">
          <Spinner />
        </div>
      )}
      {after && !res.isComputing && (
        <p className="mt-2 text-[13.5px]">
          순혜택 {approxWon(pack.net)} → <strong>{approxWon(after.net)}</strong>{" "}
          <span className={after.net >= pack.net ? "text-positive" : "text-caution"}>
            ({after.net >= pack.net ? "+" : "−"}
            {korWon(Math.abs(after.net - pack.net))})
          </span>
          . 배분은 바꾼 카드에 맞춰 다시 골랐어요.
          {idle.length > 0 && (
            <span className="mt-1 block text-[12.5px] text-caution">
              {idle.map((c) => shortCard(c.name)).join(", ")}에 맡길 지출이 없어서 연회비만 나가요.
            </span>
          )}
          {unread.length > 0 && (
            <span className="mt-1 block text-[12.5px] text-caution">
              {unread.map((c) => shortCard(c.name)).join(", ")}의 혜택 정보를 아직 못 읽어서 0원으로 계산했어요.
            </span>
          )}
        </p>
      )}
    </div>
  );
}
