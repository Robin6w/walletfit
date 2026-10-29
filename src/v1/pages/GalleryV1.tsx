import { lazy, Suspense, useMemo, useState } from "react";
import { Check, Plus, Search } from "lucide-react";
import type { CatalogListing } from "@/domain/types/catalog";
import type { useSavedCards } from "@/domain/state/useSavedCards";
import { catalogCards, catLabel, feeLabel, cardTypeLabel, isDiscontinued } from "@/v1/catalog";
import { CardFace, Btn, Pill } from "@/v1/ui";
import { useRank, toBrandShare } from "@/domain/engine/walletEngine";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { num } from "@/v1/format";
import type { BrandSpend } from "@/v1/state";

const CardDetailModal = lazy(() => import("@/features/catalog/CardDetailModal").then((m) => ({ default: m.CardDetailModal })));
const CardCompareModal = lazy(() => import("@/features/catalog/CardCompareModal").then((m) => ({ default: m.CardCompareModal })));

const BENEFIT_FILTERS = ["cafe", "convenience", "transport", "mobile", "onlineShopping", "dining"];
const PAGE = 24;

interface Props {
  myCards: ReturnType<typeof useSavedCards>;
  spending: Record<string, number>;
  brandSpend: BrandSpend;
}

export function GalleryV1({ myCards, spending, brandSpend }: Props) {
  const [tab, setTab] = useState<"all" | "mine">("all");
  const [q, setQ] = useState("");
  const [issuer, setIssuer] = useState("");
  const [type, setType] = useState("");
  const [sort, setSort] = useState<"fit" | "feeLow" | "name">("fit");
  const [benefit, setBenefit] = useState<string>("");
  const [showDisc, setShowDisc] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [compare, setCompare] = useState<number[]>([]);
  const [detail, setDetail] = useState<CatalogListing | null>(null);
  const [comparing, setComparing] = useState(false);
  const dq = useDebounce(q, 250);
  const owned = useMemo(() => new Set(myCards.ids), [myCards.ids]);
  const hasSpend = Object.values(spending).some((v) => v > 0);
  const rank = useRank(sort === "fit" && hasSpend ? { spending, brandShare: toBrandShare(spending, brandSpend) } : null);
  const netBy = useMemo(() => new Map(((rank.data ?? rank.lastGood)?.rows ?? []).map((r) => [r.sid, r.net])), [rank.data, rank.lastGood]);
  const issuers = useMemo(() => Array.from(new Set(catalogCards.map((c) => c.issuer).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ko")), []);

  const list = useMemo(() => {
    let l = catalogCards;
    if (tab === "mine") l = l.filter((c) => owned.has(c.sourceId));
    else if (!showDisc) l = l.filter((c) => !isDiscontinued(c) || owned.has(c.sourceId));
    if (dq.trim()) {
      const s = dq.trim().toLowerCase().replace(/\s+/g, "");
      l = l.filter((c) => `${c.name}${c.issuer}`.toLowerCase().replace(/\s+/g, "").includes(s));
    }
    if (issuer) l = l.filter((c) => c.issuer === issuer);
    if (type) l = l.filter((c) => c.category === type);
    if (benefit) {
      const label = catLabel(benefit).split("·")[0];
      l = l.filter((c) => (c.benefitSummary ?? "").includes(label) || c.categoryTiers?.some((t) => t.category === benefit));
    }
    const sorted = [...l];
    if (sort === "feeLow") sorted.sort((a, b) => (a.annualFee ?? 0) - (b.annualFee ?? 0));
    else if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    else if (netBy.size) sorted.sort((a, b) => (netBy.get(b.sourceId) ?? -1e9) - (netBy.get(a.sourceId) ?? -1e9));
    return sorted;
  }, [tab, owned, showDisc, dq, issuer, type, benefit, sort, netBy]);

  const issuableCount = catalogCards.filter((c) => !isDiscontinued(c)).length;
  const toggleCompare = (sid: number) => setCompare((c) => (c.includes(sid) ? c.filter((x) => x !== sid) : c.length >= 3 ? c : [...c, sid]));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold md:text-[32px]">전체 카드</h1>
          <p className="text-[13.5px] text-ink-2">
            카드고릴라 기준 {num(catalogCards.length)}장 · 지금 발급되는 카드 {num(issuableCount)}장
          </p>
        </div>
        <div className="flex rounded-full bg-line-soft p-1" role="tablist" aria-label="카드 범위">
          {(["all", "mine"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => {
                setTab(t);
                setLimit(PAGE);
              }}
              className={`min-h-10 rounded-full px-4 text-[13.5px] ${tab === t ? "bg-surface font-bold shadow-sm" : "text-ink-2"}`}
            >
              {t === "all" ? "전체 카드" : `내 카드 ${myCards.ids.length}`}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
        <label className="flex items-center gap-2 rounded-[12px] border border-line-strong bg-surface px-3 py-2.5">
          <Search className="h-4 w-4 text-ink-3" />
          <span className="sr-only">카드 찾기</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="카드 이름 또는 카드사" className="min-w-0 flex-1 bg-transparent text-[14px] outline-none" />
        </label>
        <select aria-label="카드사" value={issuer} onChange={(e) => setIssuer(e.target.value)} className="min-h-11 rounded-[12px] border border-line-strong bg-surface px-3 text-[13.5px]">
          <option value="">전체 카드사</option>
          {issuers.map((i) => (
            <option key={i}>{i}</option>
          ))}
        </select>
        <select aria-label="카드 종류" value={type} onChange={(e) => setType(e.target.value)} className="min-h-11 rounded-[12px] border border-line-strong bg-surface px-3 text-[13.5px]">
          <option value="">신용·체크</option>
          <option value="신용">신용</option>
          <option value="체크">체크</option>
        </select>
        <select aria-label="정렬" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="min-h-11 rounded-[12px] border border-line-strong bg-surface px-3 text-[13.5px]">
          <option value="fit">내 지출에 유리한 순</option>
          <option value="feeLow">연회비 낮은 순</option>
          <option value="name">카드명 가나다순</option>
        </select>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[13px] text-ink-3">혜택으로 찾기</span>
        {["", ...BENEFIT_FILTERS].map((b) => (
          <button
            key={b || "all"}
            type="button"
            aria-pressed={benefit === b}
            onClick={() => setBenefit(b)}
            className={`min-h-9 rounded-full border px-3.5 text-[13px] ${benefit === b ? "border-primary bg-tint font-bold text-primary" : "border-line-strong text-ink-2"}`}
          >
            {b ? catLabel(b) : "전체"}
          </button>
        ))}
        {tab === "all" && (
          <label className="ml-auto flex min-h-9 items-center gap-2 text-[13px]">
            <input type="checkbox" checked={showDisc} onChange={(e) => setShowDisc(e.target.checked)} className="h-4 w-4 accent-[#1B4FD8]" />
            발급 중단 카드도 보기
          </label>
        )}
      </div>
      {sort === "fit" && !hasSpend && <p className="mt-2 text-[12.5px] text-caution">지출을 넣으면 내 지출 기준으로 정렬해요. 지금은 기본 순서예요.</p>}

      <ul className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {list.slice(0, limit).map((c) => {
          const mine = owned.has(c.sourceId);
          const net = netBy.get(c.sourceId);
          return (
            <li key={c.sourceId} className="flex flex-col rounded-[18px] border border-line bg-surface p-4">
              <button type="button" onClick={() => setDetail(c)} className="text-left" aria-label={`${c.name} 자세히 보기`}>
                <CardFace sid={c.sourceId} width={200} />
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="text-[15px] font-bold leading-tight">{c.name}</span>
                  {isDiscontinued(c) && <Pill tone="caution">발급 중단</Pill>}
                </div>
                <div className="text-[12.5px] text-ink-3">
                  {c.issuer} · {cardTypeLabel(c)} · {feeLabel(c)}
                </div>
                <p className="mt-2 line-clamp-2 text-[13px] text-ink-2">{c.benefitSummary}</p>
              </button>
              {sort === "fit" && net !== undefined && <div className="tnum mt-2 text-[12.5px] text-ink-3">내 지출 전부를 이 카드로 내면 월 순혜택 약 {num(Math.round(net / 100) * 100)}원</div>}
              <div className="mt-auto flex items-center justify-between pt-3">
                <button
                  type="button"
                  onClick={() => myCards.toggle(c.sourceId)}
                  aria-pressed={mine}
                  className={`flex min-h-10 items-center gap-1 rounded-[10px] px-3 text-[13px] font-bold ${mine ? "bg-tint text-primary" : "border border-primary text-primary"}`}
                >
                  {mine ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {mine ? "내 카드" : "내 카드에 담기"}
                </button>
                <label className="flex min-h-10 items-center gap-1.5 text-[12.5px] text-ink-2">
                  <input type="checkbox" checked={compare.includes(c.sourceId)} onChange={() => toggleCompare(c.sourceId)} className="h-4 w-4 accent-[#1B4FD8]" />
                  비교
                </label>
              </div>
            </li>
          );
        })}
      </ul>
      {list.length === 0 && <p className="mt-10 text-center text-[14px] text-ink-3">조건에 맞는 카드가 없어요.</p>}
      {list.length > limit && (
        <div className="mt-5 text-center">
          <Btn onClick={() => setLimit((l) => l + PAGE * 2)}>{num(list.length - limit)}장 더 보기</Btn>
        </div>
      )}

      {compare.length > 0 && (
        <div className="fixed inset-x-3 bottom-20 z-30 md:bottom-6">
          <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-3 rounded-full bg-ink/90 px-5 py-3 text-white shadow-lg">
            <strong>비교함 {compare.length}장</strong>
            <span className="hidden min-w-0 flex-1 truncate text-[13px] text-white/80 sm:inline">
              {compare.map((s) => catalogCards.find((c) => c.sourceId === s)?.name).join(" · ")} · 최대 3장
            </span>
            <button type="button" onClick={() => setCompare([])} className="ml-auto min-h-10 rounded-full border border-white/40 px-4 text-[13px]">
              비우기
            </button>
            <button type="button" disabled={compare.length < 2} onClick={() => setComparing(true)} className="min-h-10 rounded-full bg-white px-4 text-[13px] font-bold text-ink disabled:opacity-50">
              나란히 비교하기
            </button>
          </div>
        </div>
      )}

      <Suspense fallback={null}>
        {detail && <CardDetailModal entry={detail} onClose={() => setDetail(null)} inMyCards={owned.has(detail.sourceId)} onToggleMyCards={(e) => myCards.toggle(e.sourceId)} />}
        {comparing && <CardCompareModal entries={compare.map((s) => catalogCards.find((c) => c.sourceId === s)!).filter(Boolean)} onClose={() => setComparing(false)} />}
      </Suspense>
    </div>
  );
}
