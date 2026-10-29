import { useMemo, useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { catalogCards, catalogBySourceId, summaryChips, feeLabel, cardTypeLabel, isDiscontinued } from "@/v1/catalog";
import { CardFace, Pill, Btn } from "@/v1/ui";
import { useCardsInfo } from "@/domain/engine/walletEngine";
import { num } from "@/v1/format";

const ALIASES: Record<string, string[]> = {
  taptap: ["탭탭", "탭탭오", "탭탭에스"],
  "mr.life": ["미스터라이프", "미스터 라이프"],
  loca: ["로카"],
  "deep dream": ["딥드림"],
  "id on": ["아이디온"],
  "the more": ["더모아"],
};

function matches(name: string, issuer: string, q: string): boolean {
  const n = `${name} ${issuer}`.toLowerCase().replace(/\s+/g, "");
  const query = q.toLowerCase().replace(/\s+/g, "");
  if (n.includes(query)) return true;
  return Object.entries(ALIASES).some(([en, ko]) => ko.some((k) => k.replace(/\s+/g, "").includes(query) || query.includes(k.replace(/\s+/g, ""))) && n.includes(en.replace(/\s+/g, "")));
}

const TOP_ISSUERS = ["신한카드", "삼성카드", "KB국민카드", "현대카드", "우리카드", "롯데카드", "하나카드", "NH농협카드", "BC 바로카드"];
/** 칩에 보이는 짧은 이름. 카탈로그의 카드사 이름은 카드고릴라 표기를 그대로 쓴다(BC는 "BC 바로카드") */
const issuerChip = (i: string) => (i.startsWith("BC") ? "BC" : i.replace("카드", ""));
const PAGE = 20;

interface Props {
  scope: "myCards" | "all";
  ids: number[];
  onToggle: (sid: number) => void;
  onSwitchScope: () => void;
}

export function CardsStep({ scope, ids, onToggle, onSwitchScope }: Props) {
  const [q, setQ] = useState("");
  const [type, setType] = useState<"all" | "신용" | "체크">("all");
  const [issuer, setIssuer] = useState<string | null>(null);
  const [moreIssuers, setMoreIssuers] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const owned = useMemo(() => new Set(ids), [ids]);
  const info = useCardsInfo(ids.length ? ids : null);

  const results = useMemo(() => {
    let list = catalogCards;
    if (q.trim()) list = list.filter((c) => matches(c.name, c.issuer, q.trim()));
    if (type !== "all") list = list.filter((c) => c.category === type);
    if (issuer) list = list.filter((c) => c.issuer === issuer);
    // 담은 카드 → 발급 중인 카드 → 발급 중단 카드 순
    return [...list].sort((a, b) => Number(owned.has(b.sourceId)) - Number(owned.has(a.sourceId)) || Number(isDiscontinued(a)) - Number(isDiscontinued(b)));
  }, [q, type, issuer, owned]);
  const discCount = results.filter((c) => isDiscontinued(c)).length;
  const issuers = moreIssuers ? Array.from(new Set(catalogCards.map((c) => c.issuer).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ko")) : TOP_ISSUERS;
  const feeTotal = ids.reduce((s, sid) => s + (catalogBySourceId.get(sid)?.annualFee ?? 0), 0);

  return (
    <div>
      <h1 className="text-[24px] font-extrabold md:text-[32px]">{scope === "myCards" ? "가지고 있는 카드를 담아 주세요" : "가진 카드가 있으면 담아 주세요"}</h1>
      <p className="mt-1 text-[14px] text-ink-2">
        {scope === "myCards"
          ? "담은 카드만으로 조합을 계산해요. 오른쪽에서 카드마다 계산에 쓰는 혜택을 바로 확인할 수 있어요."
          : "담은 카드와 지금 발급되는 카드를 함께 비교해서 조합을 찾아요. 담지 않아도 다음으로 갈 수 있어요."}
      </p>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          <div className="rounded-[20px] border border-line bg-surface p-4 md:p-5">
            <label className="flex items-center gap-2 rounded-[12px] border-2 border-primary/70 bg-surface px-3 py-2.5">
              <Search className="h-4 w-4 text-ink-3" />
              <span className="sr-only">카드 찾기</span>
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setLimit(PAGE);
                }}
                placeholder="카드 이름, 카드사, 별명으로 찾기"
                className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
              />
              {q && (
                <button type="button" onClick={() => setQ("")} aria-label="검색어 지우기" className="text-ink-3">
                  <X className="h-4 w-4" />
                </button>
              )}
            </label>
            <p className="mt-2 text-[12.5px] text-ink-3">영문 카드명은 한글 별명으로도 찾아요 · 예: 탭탭오, 미스터라이프, 로카</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="flex rounded-full bg-line-soft p-1" role="group" aria-label="카드 종류">
                {(["all", "신용", "체크"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={type === t}
                    onClick={() => setType(t)}
                    className={`min-h-9 rounded-full px-3.5 text-[13px] ${type === t ? "bg-surface font-bold text-ink shadow-sm" : "text-ink-3"}`}
                  >
                    {t === "all" ? "전체" : t}
                  </button>
                ))}
              </div>
              <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />
              <span className="text-[12.5px] text-ink-3">카드사</span>
              {issuers.map((i) => (
                <button
                  key={i}
                  type="button"
                  aria-pressed={issuer === i}
                  onClick={() => setIssuer(issuer === i ? null : i)}
                  className={`min-h-9 rounded-full border px-3 text-[13px] ${issuer === i ? "border-primary bg-tint font-bold text-primary" : "border-line-strong text-ink-2"}`}
                >
                  {issuerChip(i)}
                </button>
              ))}
              <button type="button" onClick={() => setMoreIssuers((v) => !v)} className="min-h-9 rounded-full border border-dashed border-line-strong px-3 text-[13px] text-ink-2">
                {moreIssuers ? "접기" : "+ 더보기"}
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
            <div>
              {q && <strong>'{q}' </strong>}
              검색 결과 {num(results.length)}장{discCount > 0 && <span className="text-ink-3"> · 발급 중단 {num(discCount)}장 포함</span>}
            </div>
            <div className="text-ink-3">이미 가진 카드라면 발급이 끝났어도 담을 수 있어요</div>
          </div>

          <ul className="mt-2 divide-y divide-line-soft rounded-[20px] border border-line bg-surface">
            {results.slice(0, limit).map((c) => {
              const on = owned.has(c.sourceId);
              return (
                <li key={c.sourceId} className={`flex items-center gap-3 px-3 py-3 md:gap-4 md:px-4 ${on ? "bg-tint/40" : ""}`}>
                  <CardFace sid={c.sourceId} width={80} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate text-[15px] font-bold">{c.name}</span>
                      <span className="text-[12.5px] text-ink-3">
                        {c.issuer} · {cardTypeLabel(c)} · {feeLabel(c)}
                      </span>
                      {isDiscontinued(c) && <Pill tone="caution">신규 발급 중단</Pill>}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {summaryChips(c).map((chip, ci) => (
                        <span key={`${ci}-${chip}`} className="rounded-full border border-line px-2 py-0.5 text-[12px] text-ink-2">
                          {chip}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggle(c.sourceId)}
                    aria-pressed={on}
                    aria-label={`${c.name} ${on ? "빼기" : "담기"}`}
                    className={`flex min-h-11 shrink-0 items-center gap-1 rounded-full px-4 text-[13.5px] font-bold ${on ? "border border-tint-line bg-tint text-primary" : "border border-line-strong text-ink"}`}
                  >
                    {on ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {on ? "담음" : "담기"}
                  </button>
                </li>
              );
            })}
            {results.length === 0 && <li className="px-4 py-10 text-center text-[14px] text-ink-3">찾는 카드가 없어요. 카드사 이름으로도 찾아보세요.</li>}
          </ul>
          {results.length > limit && (
            <div className="mt-3 text-center">
              <Btn onClick={() => setLimit((l) => l + PAGE * 3)}>{num(results.length - limit)}장 더 보기</Btn>
            </div>
          )}
        </div>

        <aside className="h-fit rounded-[20px] border border-line bg-surface lg:sticky lg:top-28" aria-label="담은 카드">
          <div className="border-b border-line-soft p-4">
            {ids.length > 0 && (
              <div className="mb-3 flex -space-x-6 overflow-hidden">
                {ids.slice(0, 6).map((sid) => (
                  <CardFace key={sid} sid={sid} width={72} />
                ))}
              </div>
            )}
            <div className="text-[18px] font-extrabold">담은 카드 {ids.length}장</div>
            <div className="text-[13px] text-ink-2">
              연회비 합계 연 {num(feeTotal)}원 · 월 약 {num(Math.round(feeTotal / 12 / 100) * 100)}원
            </div>
            <p className="mt-2 text-[12.5px] text-ink-3">카드사 원문에서 읽은 혜택이에요. 회색 줄은 실적 조건이에요.</p>
          </div>
          <ul className="max-h-[560px] divide-y divide-line-soft overflow-y-auto">
            {ids.map((sid) => {
              const c = catalogBySourceId.get(sid);
              const ci = info.data?.cards?.[String(sid)] ?? info.lastGood?.cards?.[String(sid)];
              return (
                <li key={sid} className="flex gap-3 p-4">
                  <CardFace sid={sid} width={64} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-bold leading-tight">{c?.name}</div>
                    <div className="text-[12px] text-ink-3">
                      {c?.issuer} · {feeLabel(c)}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {(ci?.titles ?? summaryChips(c, 4)).slice(0, 4).map((t, ti) => (
                        <span key={`${ti}-${t}`} className="rounded-full border border-tint-line bg-tint px-2 py-0.5 text-[11.5px] font-semibold text-primary">
                          {t.length > 16 ? `${t.slice(0, 15)}…` : t}
                        </span>
                      ))}
                      {ci && ci.benefitCount === 0 && <span className="text-[12px] text-ink-3">계산에 쓸 혜택 정보가 없어요</span>}
                    </div>
                    {ci && (
                      <div className="mt-1 text-[12px] text-ink-3">
                        {ci.tiers.length ? `전월실적 ${ci.tiers.map((t) => `${Math.round(t / 10000)}`).join("·")}만원 이상 구간` : "실적 조건 없음"}
                        {ci.excludesDiscounted && " · 할인받은 결제는 실적 제외"}
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={() => onToggle(sid)} aria-label={`${c?.name} 빼기`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-line-soft">
                    <X className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
            {ids.length === 0 && <li className="p-6 text-center text-[13px] text-ink-3">왼쪽에서 카드를 담아 주세요</li>}
          </ul>
          {scope === "myCards" && (
            <div className="border-t border-line-soft p-4">
              <button type="button" onClick={onSwitchScope} className="text-[13.5px] font-bold text-primary">
                새 카드까지 포함해서 추천받기 →
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
