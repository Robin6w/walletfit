import { useMemo, useState } from "react";
import type { useSavedCards } from "@/domain/state/useSavedCards";
import { useCategoryRank, engineCall, toBrandShare } from "@/domain/engine/walletEngine";
import type { EngineCard, RecommendResponse } from "@/domain/types/engine";
import { categories, catLabel, issuableCards, catalogBySourceId, isUnread } from "@/v1/catalog";
import { CardFace, Btn, Spinner, WonInput, Skeleton } from "@/v1/ui";
import { approxKor, korWon, num } from "@/v1/format";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { ProofPanel } from "@/v1/wizard/ProofPanel";
import { shortCard } from "@/v1/wallet/model";
import { UNVERIFIED_IN_NEW_CARDS, useIncludeUnverified, type BrandSpend } from "@/v1/state";

const FIRST = ["convenience", "cafe", "transport", "mobile", "onlineShopping", "mart", "dining", "gas"];

interface Props {
  myCards: ReturnType<typeof useSavedCards>;
  spending: Record<string, number>;
  brandSpend: BrandSpend;
  lastRec: RecommendResponse | null;
  onStartWizard: () => void;
}

export function BenefitV1({ myCards, spending, brandSpend, lastRec, onStartWizard }: Props) {
  const [cat, setCat] = useState("convenience");
  const [more, setMore] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [scope, setScope] = useState<"all" | "mine">(myCards.ids.length ? "mine" : "all");
  const [proof, setProof] = useState<EngineCard | null>(null);
  const [loadingProof, setLoadingProof] = useState<number | null>(null);
  const amount = amounts[cat] ?? (spending[cat] || 200000);
  const dAmount = useDebounce(amount, 350);
  const [includeUnverified, setIncludeUnverified] = useIncludeUnverified();
  const ids = useMemo(
    () => (scope === "mine" ? myCards.ids : issuableCards({ includeUnverified }).map((c) => c.sourceId)),
    [scope, myCards.ids, includeUnverified],
  );
  const total = Object.values(spending).reduce((s, v) => s + v, 0);
  const brandShare = toBrandShare(spending, brandSpend);
  const res = useCategoryRank(ids.length ? { category: cat, amount: dAmount, spending, ids, brandShare, limit: scope === "mine" ? 50 : 20 } : null);
  const rows = (res.data ?? res.lastGood)?.rows ?? [];
  const top = rows[0];
  const cats = more ? categories.map((c) => c.id) : FIRST;

  const openProof = async (sid: number) => {
    setLoadingProof(sid);
    const base = { ...Object.fromEntries(Object.entries(spending).filter(([, v]) => v > 0)), [cat]: dAmount };
    const r = await engineCall<{ ok: boolean; rows: { view?: EngineCard }[] }>("rank", { ids: [sid], spending: base, brandShare, detail: true });
    setLoadingProof(null);
    if (r.ok && r.rows[0]?.view) setProof(r.rows[0].view);
  };

  return (
    <div>
      <h1 className="text-[26px] font-extrabold md:text-[32px]">혜택별 추천</h1>
      <p className="text-[13.5px] text-ink-2">한 카테고리만 골라 그 분야에서 가장 유리한 카드를 찾아요</p>

      <div className="mt-5 rounded-[20px] border border-line bg-surface p-4 md:p-5">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="카테고리">
          {cats.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={cat === c}
              onClick={() => setCat(c)}
              className={`min-h-10 rounded-full border px-3.5 text-[13px] ${cat === c ? "border-primary bg-tint font-bold text-primary" : "border-line-strong text-ink-2"}`}
            >
              {catLabel(c)}
            </button>
          ))}
          <button type="button" onClick={() => setMore((v) => !v)} className="min-h-10 rounded-full border border-dashed border-line-strong px-3.5 text-[13px] text-ink-2">
            {more ? "접기" : `더보기 ${categories.length - FIRST.length}`}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-[14px] font-bold">
            {catLabel(cat)}에 한 달
            <WonInput value={amount} onChange={(v) => setAmounts((a) => ({ ...a, [cat]: v }))} label={`${catLabel(cat)} 월 금액`} />
          </div>
          <div className="flex rounded-full bg-line-soft p-1" role="tablist" aria-label="비교 범위">
            <button type="button" role="tab" aria-selected={scope === "all"} onClick={() => setScope("all")} className={`min-h-10 rounded-full px-4 text-[13px] ${scope === "all" ? "bg-surface font-bold shadow-sm" : "text-ink-2"}`}>
              발급 중인 카드
            </button>
            <button type="button" role="tab" aria-selected={scope === "mine"} onClick={() => setScope("mine")} className={`min-h-10 rounded-full px-4 text-[13px] ${scope === "mine" ? "bg-surface font-bold shadow-sm" : "text-ink-2"}`}>
              내 카드 {myCards.ids.length}장
            </button>
          </div>
        </div>
      </div>

      <section className="mt-5 rounded-[20px] border border-line bg-surface p-4 md:p-5" aria-busy={res.isComputing}>
        {top && top.value > 0 ? (
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h2 className="text-[19px] font-extrabold">
              1위 · {shortCard(top.name)} 월 {num(Math.round(top.value / 100) * 100)}원
            </h2>
            <span className="text-[13px] text-ink-2">
              {catLabel(cat)} {korWon(dAmount)}을 이 카드로 낼 때 받는 혜택이에요.{total ? ` 실적은 지출 입력의 월 ${korWon(total)} 기준이에요.` : " 실적은 이 금액만 쓴다고 보고 계산했어요."}
            </span>
          </div>
        ) : (
          !res.isComputing && <h2 className="text-[17px] font-bold">{scope === "mine" && myCards.ids.length === 0 ? "담은 카드가 없어요. 전체 카드 탭에서 비교해 보세요." : `${catLabel(cat)} 혜택이 있는 카드가 없어요.`}</h2>
        )}
        {res.isComputing && rows.length === 0 && (
          <div className="mt-3 space-y-2">
            <Spinner label="카드마다 계산하고 있어요" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        )}
        <ul className="mt-3 divide-y divide-line-soft">
          {rows.map((r) => (
            <li key={r.sid} className="flex items-center gap-3 py-3">
              <CardFace sid={r.sid} width={96} />
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-bold">{catalogBySourceId.get(r.sid)?.name ?? r.name}</div>
                <div className="truncate text-[12.5px] text-ink-3">
                  {r.value > 0.5 ? r.note : isUnread(r.sid) ? "혜택 정보를 아직 못 읽은 카드예요" : `${catLabel(cat)} 혜택이 없어요`}
                </div>
              </div>
              <div className={`tnum shrink-0 text-[15px] font-extrabold ${r.value > 0.5 ? "text-positive" : "text-ink-3"}`}>
                {r.value <= 0.5 && isUnread(r.sid) ? "정보 없음" : `월 ${num(Math.round(r.value / 100) * 100)}원`}
              </div>
              {r.value > 0.5 ? (
                <Btn size="sm" kind="tint" onClick={() => openProof(r.sid)} disabled={loadingProof === r.sid}>
                  {loadingProof === r.sid ? "…" : "계산 근거"}
                </Btn>
              ) : (
                <span className="w-[76px]" />
              )}
            </li>
          ))}
        </ul>
        {scope === "all" && !UNVERIFIED_IN_NEW_CARDS && (
          <p className="mt-3 rounded-[12px] bg-ground p-3 text-[12.5px] text-ink-3">
            카드사 원문과 대조한 카드 {num(ids.length)}장만 비교했어요. 나머지 카드는 혜택 요약만 있어서 실적 조건과 통합 한도를 알 수 없어 비교에서 뺐어요.
          </p>
        )}
        {scope === "all" && UNVERIFIED_IN_NEW_CARDS && (
          <label className="mt-3 flex items-start gap-3 rounded-[12px] bg-ground p-3 text-[12.5px] text-ink-3">
            <input type="checkbox" aria-label="검수 전 카드도 넣기" checked={includeUnverified} onChange={(e) => setIncludeUnverified(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]" />
            <span>
              {includeUnverified
                ? `발급 중인 카드 ${num(ids.length)}장을 같은 계산기로 계산했어요. 검수 전(자동 변환) 카드는 실적 조건을 거의 못 읽어서 혜택이 크게 잡힐 수 있어요.`
                : `카드사 원문과 대조한 카드 ${num(ids.length)}장만 비교했어요.`}{" "}
              <span className="font-bold text-ink-2">검수 전 카드도 넣기</span>
            </span>
          </label>
        )}
      </section>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-tint-line bg-tint p-5">
        <p className="text-[14px] text-ink-2">
          {top && top.value > 0 && (
            <strong className="text-ink">
              {catLabel(cat)}만 보면 {shortCard(top.name)}가 가장 많아요.{" "}
            </strong>
          )}
          {lastRec && !lastRec.empty
            ? `다른 지출까지 같이 보면 ${lastRec.result.cards.map((c) => shortCard(c.name)).join(" + ")} 조합으로 월 ${approxKor(lastRec.result.net)}이에요.`
            : "다른 지출까지 같이 보면 더 나은 조합이 있을 수 있어요."}
        </p>
        <Btn kind="primary" onClick={onStartWizard}>
          추천 조합 보기
        </Btn>
      </div>

      {proof && <ProofPanel card={proof} color="#1B4FD8" onClose={() => setProof(null)} onAsk={() => setProof(null)} />}
    </div>
  );
}
