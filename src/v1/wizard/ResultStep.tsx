import type { ReactNode } from "react";
import { ChevronRight, Info, ListChecks, MessageCircle, BarChart3 } from "lucide-react";
import type { RecommendResponse, EngineCard, EnginePack } from "@/domain/types/engine";
import { CardFace, Pill, Section, Skeleton, Btn, Spinner } from "@/v1/ui";
import { approxKor, approxWon, annualMan, korWon, num, won } from "@/v1/format";
import { catLabel, catalogBySourceId, feeLabel } from "@/v1/catalog";
import { benefitLine, capCaption, cardMonthlyLabel, colorOf, monthlyTone, paymentGuide, shortCard, todosOf, usedValues } from "@/v1/wallet/model";
import { MARGIN_OPTIONS, type BrandSpend } from "@/v1/state";

export interface ResultProps {
  rec: RecommendResponse | null;
  isComputing: boolean;
  error: string | null;
  scope: "myCards" | "all";
  ownedCount: number;
  spending: Record<string, number>;
  brandSpend: BrandSpend;
  margin: number;
  onMargin: (m: number) => void;
  feeCap: number | null;
  onFeeCap: (v: number | null) => void;
  maxCards: number;
  onMaxCards: (k: number) => void;
  onProof: (sid: number) => void;
  onEditBrands: () => void;
  onAsk: (q?: string) => void;
  onSaveTodos?: () => void;
  onRetry: () => void;
  conditions: ReactNode;
  /** 계산을 보낼 수 없는 이유(카드·지출이 없거나 조건에 맞는 카드가 없음). 있으면 예전 결과 대신 이 안내를 보여 준다 */
  blocked?: string | null;
  /** 새 카드 포함: 엔진에 넘긴 후보 수, 검수 전 카드 포함 여부(문구용) */
  candidateCount?: number;
  includeUnverified?: boolean;
}

const FEE_CAPS: { label: string; value: number | null }[] = [
  { label: "제한 없음", value: null },
  { label: "연 3만원", value: 30000 },
  { label: "연 5만원", value: 50000 },
  { label: "연 10만원", value: 100000 },
];

export function ResultStep(p: ResultProps) {
  const rec = p.rec;
  if (!rec && (p.blocked || (p.error && !p.isComputing))) {
    // 계산할 수 없거나 계산이 실패했을 때: 예전 결과를 남기지 않고, 조건을 바로 고칠 수 있게 한다
    return (
      <div className="space-y-5">
        {p.blocked ? (
          <div role="status" className="rounded-[20px] border border-line bg-surface p-6 text-[15px] text-ink-2">
            {p.blocked}
          </div>
        ) : (
          <ErrorBox error={p.error ?? ""} onRetry={p.onRetry} />
        )}
        {p.feeCap !== null && (
          <div className="flex flex-wrap items-center gap-3 rounded-[16px] bg-surface p-4 text-[14px] text-ink-2">
            연회비 상한이 연 {num(p.feeCap)}원으로 걸려 있어요.
            <Btn size="sm" onClick={() => p.onFeeCap(null)}>
              상한 풀기
            </Btn>
          </div>
        )}
        {p.conditions}
      </div>
    );
  }
  if (!rec) {
    return (
      <div aria-busy="true">
        <div className="mb-4">
          <Spinner label="카드사 원문 기준으로 조합을 계산하고 있어요. 처음에는 10초쯤 걸려요" />
        </div>
        <Skeleton className="h-48" />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
        {p.error && <ErrorBox error={p.error} onRetry={p.onRetry} />}
      </div>
    );
  }
  if (rec.empty || rec.result.cards.length === 0) {
    return <p className="rounded-[20px] bg-surface p-8 text-center text-[15px] text-ink-2">계산할 카드나 지출이 없어요. 앞 단계에서 카드와 지출을 넣어 주세요.</p>;
  }
  const pack = rec.result;
  const n = pack.cards.length;
  const single = rec.bar.find((b) => b.k === 1)?.net ?? null;
  const poolName = p.includeUnverified ? "발급 중인 카드" : "검수한 카드";
  const poolSize = p.candidateCount ?? rec.pool.length;
  const pickedFrom =
    p.scope === "myCards"
      ? `가진 카드 ${p.ownedCount}장 중 ${n}장`
      : poolSize > rec.pool.length
        ? `${poolName} ${num(poolSize)}장에서 ${rec.pool.length}장을 추려 비교`
        : `${poolName} ${num(poolSize)}장을 비교`;

  return (
    <div className={`space-y-5 ${p.isComputing ? "opacity-60 transition-opacity" : ""}`} aria-busy={p.isComputing}>
      {p.isComputing && (
        <div className="sticky top-24 z-20 flex justify-center">
          <span className="rounded-full bg-surface px-4 py-2 shadow">
            <Spinner label="바뀐 조건으로 다시 계산하고 있어요" />
          </span>
        </div>
      )}
      {p.error && <ErrorBox error={p.error} onRetry={p.onRetry} />}

      {/* 헤드라인 + 요약 + 실적 막대 */}
      <Section>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[13px] font-bold text-primary">추천 조합 · {pickedFrom}</div>
            <h1 className="mt-1 text-[24px] font-extrabold leading-tight md:text-[32px]">
              {n === 1 ? (
                <>
                  지금은 카드 1장으로 충분해요 · 매달 <span className="whitespace-nowrap text-primary">{approxKor(pack.net)}</span>
                </>
              ) : (
                <>
                  카드 {n}장으로 매달 <span className="whitespace-nowrap text-primary">{approxKor(pack.net)}</span> 받아요
                </>
              )}
            </h1>
            <p className="mt-1 text-[14px] text-ink-2">
              1년이면 {annualMan(pack.net)}이에요.
              {single !== null && n > 1 && ` 1장만 쓸 때보다 월 ${approxKor(pack.net - single)} 더 받아요.`}
            </p>
          </div>
          <div className="hidden gap-2 md:flex">
            <Btn onClick={() => p.onAsk()}>
              <MessageCircle className="h-4 w-4" />이 결과 물어보기
            </Btn>
          </div>
        </div>

        {/* 휴대폰: 영수증처럼 세로로 */}
        <div className="mt-4 rounded-[14px] bg-ground p-4 md:hidden">
          <dl className="space-y-1.5 text-[14px]">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-ink-2">월 혜택</dt>
              <dd className="tnum font-bold">{approxWon(pack.total)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-ink-2">
                − 연회비 월 환산 <span className="text-[12px] text-ink-3">(연 {num(pack.fee * 12)}원)</span>
              </dt>
              <dd className="tnum font-bold">{approxWon(pack.fee)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-t border-line pt-1.5">
              <dt className="font-bold">= 순혜택</dt>
              <dd className="tnum text-[17px] font-extrabold text-positive">{approxWon(pack.net)}</dd>
            </div>
          </dl>
          <button type="button" onClick={() => p.onProof(pack.cards[0].sid)} className="mt-3 inline-flex items-center gap-1 rounded-full bg-tint px-3 py-1.5 text-[12.5px] font-bold text-primary">
            <BarChart3 className="h-3.5 w-3.5" /> 카드사 원문 기준 계산 · 쓴 값 보기
          </button>
        </div>
        {/* 넓은 화면: 한 줄로 */}
        <div className="mt-4 hidden flex-wrap items-center gap-x-5 gap-y-2 rounded-[14px] bg-ground p-4 md:flex">
          <Summary label="월 혜택" value={approxWon(pack.total)} />
          <span className="text-ink-3">−</span>
          <Summary label={`연회비 월 환산 (연 ${num(pack.fee * 12)}원)`} value={approxWon(pack.fee)} />
          <span className="text-ink-3">=</span>
          <Summary label="순혜택" value={approxWon(pack.net)} strong />
          <button type="button" onClick={() => p.onProof(pack.cards[0].sid)} className="ml-auto inline-flex items-center gap-1 rounded-full bg-tint px-3 py-1.5 text-[12.5px] font-bold text-primary">
            <BarChart3 className="h-3.5 w-3.5" /> 카드사 원문 기준 계산 · 쓴 값 보기
          </button>
        </div>

        <PerfBars pack={pack} />
      </Section>

      {/* 카드 수: 모바일에서는 실적 막대 바로 아래 */}
      <div className="md:hidden">
        <CardCount {...p} rec={rec} />
      </div>

      {/* 카드 역할 */}
      <div>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[18px] font-extrabold md:text-[20px]">카드 {n}장이 맡는 일</h2>
          <span className="text-[12.5px] text-ink-3">한도는 카드사 원문에 적힌 값이에요</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {pack.cards.map((c) => (
            <RoleCard key={c.sid} card={c} color={colorOf(pack, c.sid)} onProof={() => p.onProof(c.sid)} />
          ))}
        </div>
      </div>

      <PaymentGuide pack={pack} spending={p.spending} />

      <div className="grid gap-5 md:grid-cols-2">
        <div className="hidden md:block">
          <CardCount {...p} rec={rec} />
        </div>
        <UsedValues pack={pack} brandSpend={p.brandSpend} spending={p.spending} margin={p.margin} onEditBrands={p.onEditBrands} onMargin={p.onMargin} />
      </div>

      {p.conditions}
    </div>
  );
}

function ErrorBox({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-[#F3D9B5] bg-caution-bg p-4 text-[14px] text-ink">
      <span>계산하지 못했어요. {error.split("\n")[0].slice(0, 120)}</span>
      <Btn size="sm" onClick={onRetry}>
        다시 계산
      </Btn>
    </div>
  );
}

function Summary({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <div className="text-[12px] text-ink-3">{label}</div>
      <div className={`tnum whitespace-nowrap text-[20px] font-extrabold ${strong ? "text-positive" : "text-ink"}`}>{value}</div>
    </div>
  );
}

/** 실적 막대: 실적 인정(식별색) + 할인받아 빠지는 결제(빗금) + 기준선 */
export function PerfBars({ pack, compact = false }: { pack: EnginePack; compact?: boolean }) {
  const cards = pack.cards.filter((c) => c.perf.threshold);
  if (cards.length === 0) return null;
  const scale = Math.max(...cards.map((c) => Math.max(c.perf.qRaw, (c.perf.threshold ?? 0) + c.perf.margin))) * 1.12 || 1;
  const allMet = cards.every((c) => c.perf.tier && c.perf.q >= (c.perf.threshold ?? 0));
  const th = cards[0].perf.threshold ?? 0;
  const sameTh = cards.every((c) => c.perf.threshold === th);
  return (
    <div className={compact ? "" : "mt-5"}>
      {!compact && (
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[15px] font-bold">
            {allMet ? `${cards.length === 1 ? "카드" : cards.length === 2 ? "두 카드 모두" : "모든 카드가"} 전월실적${sameTh ? ` ${korWon(th)}` : " 기준"}을 넘겨요` : "실적 기준에 못 미치는 카드가 있어요"}
          </h3>
          <span className="text-[12px] text-ink-3">할인받은 결제는 실적에서 빠져요(카드사 원문 규칙)</span>
        </div>
      )}
      <div className="space-y-3">
        {cards.map((c) => {
          const color = colorOf(pack, c.sid);
          const t = c.perf.threshold ?? 0;
          const room = c.perf.q - t;
          const lowRoom = room < c.perf.margin;
          return (
            <div key={c.sid} className="grid items-center gap-2 md:grid-cols-[150px_1fr_170px]">
              <div className="flex items-center gap-2 text-[13.5px] font-bold">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                {shortCard(c.name)}
              </div>
              <div className="relative h-5 overflow-hidden rounded-full bg-line-soft" role="img" aria-label={`${shortCard(c.name)} 실적 ${korWon(c.perf.q)}, 기준 ${korWon(t)}`}>
                <div className="absolute inset-y-0 left-0" style={{ width: `${(c.perf.q / scale) * 100}%`, background: color }} />
                <div className="v1-hatch absolute inset-y-0 opacity-40" style={{ left: `${(c.perf.q / scale) * 100}%`, width: `${(Math.max(0, c.perf.qRaw - c.perf.q) / scale) * 100}%`, color }} />
                <div className="absolute inset-y-[-2px] w-0.5 bg-ink" style={{ left: `${(t / scale) * 100}%` }} />
              </div>
              <div className="tnum text-[12.5px] text-ink-2">
                실적 {korWon(c.perf.q)} ·{" "}
                {room >= 0 ? (
                  <span className={`font-bold ${lowRoom ? "text-caution" : "text-positive"}`}>여유 {korWon(room)}</span>
                ) : (
                  <span className="font-bold text-caution">{korWon(-room)} 더 쓰면 구간 달성</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {!compact && (
        <div className="mt-2 flex flex-wrap gap-4 text-[11.5px] text-ink-3">
          <span>■ 실적으로 인정되는 결제</span>
          <span>▨ 할인받아 실적에서 빠지는 결제</span>
          <span>| 전월실적 기준선</span>
        </div>
      )}
    </div>
  );
}

function RoleCard({ card, color, onProof }: { card: EngineCard; color: string; onProof: () => void }) {
  const entry = catalogBySourceId.get(card.sid);
  const got = card.benefits.filter((b) => b.final > 0.5);
  const tierLabel = card.perf.threshold ? `실적 ${korWon(card.perf.threshold)} 이상` : "실적 조건 없음";
  const payback = card.annualFee > 0 ? Math.floor((card.total * 12) / card.annualFee) : null;
  return (
    <article className="flex flex-col rounded-[18px] border border-line bg-surface p-4 md:p-5">
      <div className="flex gap-3">
        <CardFace sid={card.sid} width={144} dot={color} />
        <div className="min-w-0">
          <h3 className="text-[16px] font-bold leading-tight">{card.name}</h3>
          <div className="mt-0.5 text-[12.5px] text-ink-3">
            {card.issuer} · {feeLabel(entry)} · {tierLabel}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className={`tnum text-[22px] font-extrabold ${monthlyTone(card)}`}>{cardMonthlyLabel(card)}</div>
        {card.choiceAll.length > 1 && card.options.length > 0 ? (
          <Pill tone="caution">{card.options.map((o) => o.label).join(" + ")}로 바꾸기</Pill>
        ) : got.length > 0 && got.every((b) => b.caps.some((c) => c.hit)) ? (
          <span className="text-[12px] text-ink-3">세 혜택 모두 한도까지</span>
        ) : null}
      </div>
      <ul className="mt-3 space-y-3">
        {got.slice(0, 5).map((b) => {
          const cap = b.caps[0]?.monthly;
          const fill = cap ? Math.min(1, b.final / cap) : 1;
          return (
            <li key={b.id}>
              <div className="flex justify-between gap-3 text-[13px]">
                <span className="min-w-0 text-ink-2">{benefitLine(b)}</span>
                <span className="tnum shrink-0 font-bold">{won(b.final)}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line-soft">
                <div className="h-full rounded-full" style={{ width: `${fill * 100}%`, background: color }} />
              </div>
              <div className="mt-0.5 text-[11.5px] text-ink-3">{capCaption(b, card)}</div>
            </li>
          );
        })}
        {got.length === 0 && <li className="text-[13px] text-ink-3">이 조합에서는 실적을 채우는 데 써요. 혜택은 0원이에요.</li>}
      </ul>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4 text-[12.5px] text-ink-2">
        <span>
          이 카드로 쓰는 돈 <strong>월 {korWon(card.pay)}</strong>
          {payback !== null && payback > 0 && (
            <>
              {" "}
              · 연회비의 <strong>{payback}배</strong>
            </>
          )}
        </span>
        <button type="button" onClick={onProof} className="inline-flex min-h-10 items-center gap-1 rounded-full border border-tint-line bg-tint px-3.5 font-bold text-primary">
          계산 근거 보기 <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </article>
  );
}

function PaymentGuide({ pack, spending }: { pack: EnginePack; spending: Record<string, number> }) {
  const { withBenefit, without } = paymentGuide(pack, spending);
  const todos = todosOf(pack);
  const max = Math.max(...Object.values(spending), 1);
  const withoutTotal = without.reduce((s, r) => s + r.spend, 0);
  const mobileRow = without.find((r) => r.cat === "mobile");
  return (
    <Section title="결제 가이드 · 계산대에서 이 순서로" aside="막대 길이 = 그 카테고리의 월 지출">
      <ul className="divide-y divide-line-soft">
        {withBenefit.map((r) => (
          <li key={r.cat} className="grid gap-2 py-4 md:grid-cols-[140px_1fr_110px] md:items-center">
            <div>
              <div className="text-[15px] font-bold">{catLabel(r.cat)}</div>
              <div className="text-[12px] text-ink-3">월 {korWon(r.spend)}</div>
            </div>
            <div>
              <div className="flex h-2.5 overflow-hidden rounded-full" style={{ width: `${(r.spend / max) * 100}%` }}>
                {r.parts.map((pt) => (
                  <div key={pt.sid} style={{ width: `${(pt.amount / r.spend) * 100}%`, background: pt.color }} />
                ))}
              </div>
              <p className="mt-1.5 text-[13px] text-ink-2">
                {r.parts.map((pt, i) => (
                  <span key={pt.sid}>
                    {i > 0 && " → "}
                    <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: pt.color }} />
                    <span className="mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-ink text-[10px] font-bold">{i + 1}</span>
                    <strong>{pt.name}</strong>
                    {r.parts.length > 1 ? (i === r.parts.length - 1 && i > 0 ? `로 나머지 ${korWon(pt.amount)}` : `로 ${korWon(pt.amount)}`) : r.cat === "transport" ? "를 후불교통 카드로 등록" : r.cat === "mobile" ? "로 자동납부" : "로 결제"}
                  </span>
                ))}
              </p>
            </div>
            <div className="tnum text-right text-[15px] font-extrabold text-positive">월 {won(Math.round(r.benefit / 100) * 100)}</div>
          </li>
        ))}
        {without.length > 0 && (
          <li className="grid gap-2 py-4 md:grid-cols-[140px_1fr_110px]">
            <div>
              <div className="text-[15px] font-bold">혜택 없는 지출</div>
              <div className="text-[12px] text-ink-3">
                {without.length}개 · 월 {korWon(withoutTotal)}
              </div>
            </div>
            <div className="space-y-1.5">
              {without.map((r) => (
                <div key={r.cat} className="grid grid-cols-[110px_1fr_auto] items-center gap-2 text-[12.5px]">
                  <span className="text-ink-2">
                    {catLabel(r.cat)} {korWon(r.spend)}
                  </span>
                  <div className="flex h-2 overflow-hidden rounded-full" style={{ width: `${(r.spend / max) * 100}%` }}>
                    {r.parts.map((pt) => (
                      <div key={pt.sid} style={{ width: `${(pt.amount / r.spend) * 100}%`, background: pt.color }} />
                    ))}
                  </div>
                  <span className="font-semibold">{r.parts.length > 1 ? "나눠서" : r.parts[0]?.name}</span>
                </div>
              ))}
              <p className="text-[12px] text-ink-3">할인은 없지만 고른 카드들의 전월실적을 채우는 데 꼭 필요한 결제예요.</p>
            </div>
            <div className="tnum text-right text-[13px] text-ink-3">혜택 없음</div>
          </li>
        )}
      </ul>
      {mobileRow && pack.cards.some((c) => c.perf.excludesDiscounted) && (
        <div className="mt-3 flex gap-2 rounded-[14px] border border-line bg-ground p-4 text-[13px] text-ink-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />
          <p>
            <strong className="text-ink">통신비는 왜 할인 카드에 안 걸었나요?</strong> 통신비처럼 한 달에 한 번 내는 요금은 할인을 받으면 결제 전액이 실적에서 빠지는 카드가 있어요. 그래서 실적을 채우는 쪽에 걸었어요.
          </p>
        </div>
      )}
      {todos.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[14px] border border-tint-line bg-tint p-4 text-[13.5px]">
          <ListChecks className="h-4 w-4 text-primary" />
          <span className="min-w-0 flex-1">
            <strong>카드사 앱에서 할 일 {todos.length}가지</strong> · {todos.map((t) => t.text).join(", ")}
          </span>
        </div>
      )}
    </Section>
  );
}

function CardCount(p: ResultProps & { rec: RecommendResponse }) {
  const { rec } = p;
  const bars = rec.bar;
  const n = rec.result.cards.length;
  const max = Math.max(...bars.map((b) => b.net), 1);
  const alt = rec.alt;
  const picked = bars.find((b) => b.cards === n)?.k ?? n;
  return (
    <Section title="카드를 몇 장 쓸까요?" aside={rec.mode === "efficient" ? "효율적 모드" : `실적 여유 ${korWon(p.margin)} 기준`}>
      <p className="text-[13.5px] text-ink-2">{countSentence(bars, picked)}</p>
      <div className="mt-4 flex h-44 items-end gap-2" role="group" aria-label="카드 수 고르기">
        {bars.map((b) => {
          const on = b.k === picked;
          const prev = bars.find((x) => x.k === b.k - 1);
          return (
            <button
              key={b.k}
              type="button"
              aria-pressed={on}
              onClick={() => p.onMaxCards(b.k)}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1"
            >
              <span className={`tnum text-[12px] font-bold ${on ? "text-primary" : "text-ink-2"}`}>{korWon(b.net).replace("원", "")}</span>
              <span className={`w-full rounded-t-[8px] ${on ? "bg-primary" : "bg-tint-line"}`} style={{ height: `${Math.max(8, (b.net / max) * 100)}%` }} />
              <span className={`text-[12px] ${on ? "font-bold text-primary" : "text-ink-3"}`}>
                {b.k}장{on ? " · 지금" : ""}
              </span>
              <span className="tnum text-[11px] text-ink-3">{prev ? (b.same ? "같음" : `${b.net - prev.net >= 0 ? "+" : ""}${korWon(b.net - prev.net)}`) : ""}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-[13px]">
        <label className="flex items-center gap-2">
          실적 여유
          <select value={p.margin} onChange={(e) => p.onMargin(Number(e.target.value))} className="min-h-10 rounded-[10px] border border-line-strong bg-surface px-2">
            {MARGIN_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m ? korWon(m) : "없음"}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          연회비 상한
          <select
            value={p.feeCap ?? ""}
            onChange={(e) => p.onFeeCap(e.target.value ? Number(e.target.value) : null)}
            className="min-h-10 rounded-[10px] border border-line-strong bg-surface px-2"
          >
            {FEE_CAPS.map((f) => (
              <option key={f.label} value={f.value ?? ""}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {alt && p.margin > 0 && alt.net > rec.result.net + 500 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#F3D9B5] bg-caution-bg p-4 text-[13px] text-ink-2">
          <p className="min-w-0 flex-1">
            여유 없이 맞추면 <strong className="text-ink">{alt.names.map(shortCard).join(" + ")}</strong>으로 월 {approxKor(alt.net)}({korWon(alt.net - rec.result.net)} 더)이에요. 다만 실적이 기준에 딱 맞아 한 달만 덜 써도 혜택이 끊길 수 있어요.
          </p>
          <Btn size="sm" onClick={() => p.onMargin(0)}>
            여유 없이 보기
          </Btn>
        </div>
      )}
    </Section>
  );
}

function countSentence(bars: RecommendResponse["bar"], picked: number): string {
  const cur = bars.find((b) => b.k === picked);
  const next = bars.find((b) => b.k === picked + 1);
  if (!cur) return "";
  if (!next) return `${picked}장이 이 지출에서 가장 효율적이에요.`;
  const gain = next.net - cur.net;
  if (next.same || Math.abs(gain) < 1000) return `${picked}장이 가장 효율적이에요. ${picked + 1}장째를 더해도 월 ${korWon(Math.max(0, gain))} 정도라 카드만 늘어요.`;
  return `${picked + 1}장째를 더하면 월 ${korWon(gain)} 늘어요. 막대를 눌러 그 장수로 다시 볼 수 있어요.`;
}

function UsedValues({
  pack,
  brandSpend,
  spending,
  margin,
  onEditBrands,
  onMargin,
}: {
  pack: EnginePack;
  brandSpend: BrandSpend;
  spending: Record<string, number>;
  margin: number;
  onEditBrands: () => void;
  onMargin: (m: number) => void;
}) {
  const { assumed } = usedValues(pack);
  const brandLines = Object.entries(brandSpend)
    .filter(([cat]) => spending[cat])
    .map(([cat, b]) => `${catLabel(cat)} ${korWon(spending[cat])} 중 ${Object.entries(b).map(([n, v]) => `${n} ${korWon(v)}`).join(" · ")}`);
  const estimatedCats = pack.cards.some((c) => c.flags.some((f) => /대상 가맹점 비중 35%/.test(f)));
  return (
    <Section title="이 계산에 쓴 값" aside="고치면 바로 다시 계산해요">
      <div className="text-[12.5px] font-bold text-primary">내가 넣은 값</div>
      <ul className="mt-2 space-y-2">
        {brandLines.map((l) => (
          <li key={l} className="flex items-center justify-between gap-2 rounded-[12px] bg-ground px-3 py-2.5 text-[13px]">
            <span className="min-w-0">{l}</span>
            <button type="button" onClick={onEditBrands} className="shrink-0 font-bold text-primary">
              고치기
            </button>
          </li>
        ))}
        <li className="flex items-center justify-between gap-2 rounded-[12px] bg-ground px-3 py-2.5 text-[13px]">
          <span>
            실적 여유 <strong>{margin ? korWon(margin) : "없음"}</strong>
          </span>
          <select aria-label="실적 여유 고치기" value={margin} onChange={(e) => onMargin(Number(e.target.value))} className="rounded-[8px] border border-line-strong bg-surface px-2 py-1 font-bold text-primary">
            {MARGIN_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m ? korWon(m) : "없음"}
              </option>
            ))}
          </select>
        </li>
      </ul>
      <div className="mt-4 text-[12.5px] font-bold text-caution">원문에 없어서 가정한 값</div>
      <ul className="mt-2 space-y-1.5 text-[13px] text-ink-2">
        {estimatedCats && (
          <li>
            <Pill tone="caution">추정</Pill> 브랜드 금액을 비운 카테고리는 브랜드 할인 대상을 지출의 35%로 봤어요.{" "}
            <button type="button" onClick={onEditBrands} className="font-bold text-primary">
              브랜드 넣기
            </button>
          </li>
        )}
        {assumed.slice(0, 4).map((a) => (
          <li key={a}>· {a}</li>
        ))}
        <li>· 포인트 1점 = 1원으로 계산해요.</li>
      </ul>
      <p className="mt-4 rounded-[12px] bg-ground p-3 text-[12px] leading-relaxed text-ink-3">
        혜택 정보는 카드고릴라 원문(9월 수집)을 혜택 표로 옮긴 값이에요. 원문을 대조하지 못한 카드는 계산 근거에 따로 표시해요.
      </p>
    </Section>
  );
}
