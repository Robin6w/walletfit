import { useEffect, useRef } from "react";
import { Check, X, ExternalLink } from "lucide-react";
import type { EngineCard, TraceBenefit } from "@/domain/types/engine";
import { CardFace, StepDot, QuoteToggle, Pill } from "@/v1/ui";
import { korWon, num, pct, won } from "@/v1/format";
import { catLabel } from "@/v1/catalog";
import { cardMonthlyLabel, monthlyTone, statusLine } from "@/v1/wallet/model";
import { useToast } from "@/shared/hooks/useToast";

interface Props {
  card: EngineCard;
  color: string;
  onClose: () => void;
  onAsk: (q: string) => void;
}

/** 계산 근거: 패키지 → 실적 → 혜택별 → 묶음 한도 → 합계 (데스크톱 오른쪽 패널, 모바일 전체 화면) */
export function ProofPanel({ card, color, onClose, onAsk }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const got = card.benefits.filter((b) => b.final > 0.5);
  const zero = card.benefits.filter((b) => b.final <= 0.5);
  const t = card.perf.threshold ?? 0;
  const excludedPay = Object.entries(card.alloc)
    .filter(([c]) => card.perf.excluded.includes(c))
    .reduce((s, [, v]) => s + v, 0);
  const discounted = Math.max(0, card.perf.qRaw - card.perf.q);
  const sharedHit = card.shared.filter((s) => s.sum > 0.5);
  let step = 0;
  const status = statusLine(card);
  const quoteOf = (b?: TraceBenefit) => b?.quote ?? "";

  const report = () => {
    try {
      const key = "walletfit:v1:reports";
      const list = JSON.parse(window.localStorage.getItem(key) ?? "[]");
      list.push({ sid: card.sid, name: card.name, at: new Date().toISOString(), total: card.total });
      window.localStorage.setItem(key, JSON.stringify(list));
    } catch {
      /* 저장 못 해도 안내는 보여줌 */
    }
    showToast("검수 목록에 올렸어요. 이 카드의 혜택 표를 먼저 다시 확인할게요.", "success");
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`${card.name} 계산 근거`}>
      <button type="button" aria-label="닫기" onClick={onClose} className="absolute inset-0 hidden bg-ink/40 md:block" />
      <div ref={ref} tabIndex={-1} className="relative h-full w-full overflow-y-auto bg-surface p-5 outline-none md:w-[480px] md:p-6">
        <div className="flex items-start gap-3">
          <CardFace sid={card.sid} width={120} dot={color} />
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-bold text-primary">계산 근거</div>
            <h2 className="text-[18px] font-extrabold leading-tight">{card.name}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="계산 근거 닫기" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-line-soft">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-2 rounded-[16px] bg-ground p-4">
          <div>
            <div className="text-[12.5px] text-ink-3">이 카드로 내는 월 {korWon(card.pay)} 기준</div>
            <div className={`tnum text-[26px] font-extrabold ${monthlyTone(card)}`}>{cardMonthlyLabel(card)}</div>
          </div>
          <div className="text-right text-[12.5px] text-ink-2">
            연회비 월 {num(card.feeMonthly)}원을 빼면
            <div className="tnum text-[15px] font-bold text-ink">약 {num(Math.round(card.net / 100) * 100)}원</div>
          </div>
        </div>

        {card.choiceAll.length > 1 && (
          <ProofStep n={++step} title={`패키지 고르기 · ${card.choiceAll.length}개를 모두 계산했어요`}>
            <ul className="space-y-1">
              {[...card.choiceAll]
                .sort((a, b) => b.total - a.total)
                .slice(0, 8)
                .map((o, i, arr) => (
                  <li key={o.label} className={`grid grid-cols-[1fr_90px_64px] items-center gap-2 rounded-[8px] px-2 py-1.5 text-[12.5px] ${i === 0 ? "bg-tint font-bold" : ""}`}>
                    <span className="truncate">{o.label}</span>
                    <span className="h-1.5 rounded-full" style={{ width: `${(o.total / (arr[0].total || 1)) * 100}%`, background: color, opacity: i === 0 ? 1 : 0.45 }} />
                    <span className="tnum text-right">{num(o.total)}</span>
                  </li>
                ))}
            </ul>
            <p className="mt-2 text-[12.5px] text-ink-2">패키지는 카드사 앱에서 바꿀 수 있어요. 지출이 바뀌면 가장 나은 패키지도 바뀔 수 있어요.</p>
          </ProofStep>
        )}

        <ProofStep n={++step} title={t ? `전월실적 확인 · ${korWon(t)} 이상 구간` : "전월실적 확인 · 실적 조건 없음"}>
          <dl className="space-y-1 text-[13px]">
            <Row k="이 카드로 낸 결제" v={korWon(card.pay)} />
            {excludedPay > 0 && <Row k={`실적에서 빠지는 카테고리(${card.perf.excluded.map(catLabel).join("·")})`} v={`− ${korWon(excludedPay)}`} />}
            {discounted > 0.5 && <Row k="할인받은 결제는 빠져요" v={`− ${korWon(discounted)}`} />}
            <Row k={<strong>실적</strong>} v={<strong>{korWon(card.perf.q)}</strong>} />
          </dl>
          {t > 0 && (
            <>
              <div className="relative mt-3 h-3 overflow-hidden rounded-full bg-line-soft">
                <div className="h-full" style={{ width: `${Math.min(100, (card.perf.q / (Math.max(card.perf.q, t) * 1.15)) * 100)}%`, background: color }} />
                <div className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: `${(t / (Math.max(card.perf.q, t) * 1.15)) * 100}%` }} />
              </div>
              <div className="mt-2">
                {card.perf.q >= t ? (
                  <Pill tone="positive">
                    <Check className="h-3 w-3" /> {korWon(t)} 이상 · 여유 {korWon(card.perf.q - t)}
                  </Pill>
                ) : (
                  <Pill tone="caution">{korWon(t - card.perf.q)} 더 쓰면 구간 달성</Pill>
                )}
              </div>
            </>
          )}
          {card.perf.excludesDiscounted && (
            <p className="mt-2 text-[12.5px] text-ink-2">한도에 걸린 뒤의 결제에는 할인이 붙지 않아서 실적에 그대로 남아요.</p>
          )}
        </ProofStep>

        <ProofStep n={++step} title="혜택별 계산">
          <div className="overflow-hidden rounded-[12px] border border-line">
            <table className="w-full text-[12.5px]">
              <thead className="bg-ground text-ink-3">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">혜택</th>
                  <th className="px-3 py-2 text-left font-semibold">대상 금액 × 비율</th>
                  <th className="px-3 py-2 text-right font-semibold">계산값</th>
                </tr>
              </thead>
              <tbody>
                {got.map((b) => (
                  <tr key={b.id} className="border-t border-line-soft align-top">
                    <td className="px-3 py-2 font-semibold">{b.title}</td>
                    <td className="px-3 py-2 text-ink-2">
                      {b.cats.map((c) => (
                        <div key={c.cat}>
                          {catLabel(c.cat)} {korWon(c.spend)}
                          {c.share < 0.999 && ` × ${pct(c.share)}`} = {korWon(c.target)}
                          {b.type === "percent" && b.value ? ` × ${pct(b.value)}` : ""}
                        </div>
                      ))}
                    </td>
                    <td className="tnum px-3 py-2 text-right font-bold">
                      {num(b.raw)}
                      {b.afterOwn < b.raw - 0.5 && <div className="text-[11.5px] font-normal text-ink-3">자체 한도 → {num(b.afterOwn)}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {zero.length > 0 && (
              <p className="border-t border-line-soft bg-ground px-3 py-2 text-[12px] text-ink-3">
                0원: {zero.slice(0, 6).map((b) => `${b.title}${b.skip ? `(${b.skip})` : ""}`).join(", ")}. 이 카드로 내지 않는 지출이거나 조건이 안 맞아요.
              </p>
            )}
          </div>
          <QuoteToggle quote={quoteOf(got[0])} />
        </ProofStep>

        {sharedHit.length > 0 && (
          <ProofStep n={++step} title="묶음 한도 적용">
            {sharedHit.map((s) => (
              <div key={s.id} className="mb-2">
                <div className="flex justify-between text-[12.5px]">
                  <span>
                    <strong>{s.label}</strong> 월 {korWon(s.cap)}
                  </span>
                  <span className="tnum">
                    {num(s.sum)} → <strong>{num(Math.min(s.sum, s.cap))}</strong>
                  </span>
                </div>
                <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-line-soft">
                  <div style={{ width: `${(Math.min(s.sum, s.cap) / Math.max(s.sum, s.cap)) * 100}%`, background: color }} />
                  {s.sum > s.cap && <div className="v1-hatch opacity-40" style={{ width: `${((s.sum - s.cap) / s.sum) * 100}%`, color }} />}
                </div>
              </div>
            ))}
          </ProofStep>
        )}

        <ProofStep n={++step} title="합계" last>
          <p className="tnum text-[13px] text-ink-2">
            {got.map((b) => num(b.final)).join(" + ") || "0"} = <strong className="text-positive">월 {won(card.total)}</strong>
          </p>
        </ProofStep>

        <div className="mt-5 border-t border-line-soft pt-4">
          <div className="text-[14px] font-bold">이 계산에 쓴 값</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {card.flags.slice(0, 8).map((f) => {
              const text = f.replace(/^[^:]+:\s*/, "");
              const user = /입력한/.test(text);
              return (
                <Pill key={f} tone={user ? "tint" : "caution"}>
                  {user ? text : `가정 · ${text}`}
                </Pill>
              );
            })}
            {card.flags.length === 0 && <span className="text-[12.5px] text-ink-3">가정한 값 없이 원문 숫자만 썼어요.</span>}
          </div>
          {status && <p className="mt-3 rounded-[10px] bg-caution-bg px-3 py-2 text-[12.5px] text-caution">{status}</p>}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-4 text-[13px]">
          <div className="flex gap-4">
            {card.url && (
              <a href={card.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-primary">
                카드고릴라 원문 전체 <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <button type="button" onClick={() => onAsk(`${card.name} 계산 근거를 설명해 줘`)} className="font-bold text-primary">
              이 계산 물어보기
            </button>
          </div>
          <button type="button" onClick={report} className="min-h-10 rounded-full border border-line-strong px-4 font-semibold">
            숫자가 이상해요
          </button>
        </div>
      </div>
    </div>
  );
}

function ProofStep({ n, title, children, last }: { n: number; title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <section className="mt-5 flex gap-3">
      <StepDot n={n} tone={last ? "positive" : "primary"} />
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-extrabold">{title}</h3>
        <div className="mt-2">{children}</div>
      </div>
    </section>
  );
}

function Row({ k, v }: { k: React.ReactNode; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-2">{k}</dt>
      <dd className="tnum">{v}</dd>
    </div>
  );
}
