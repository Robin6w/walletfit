import { useEffect, useRef, type ReactNode } from "react";
import type { EngineCard, TraceBenefit } from "@/domain/types/engine";
import { catLabel } from "@/v1/catalog";
import { korWon, num, won } from "@/v1/format";
import { statusLine } from "@/v1/wallet/model";
import { useToast } from "@/shared/hooks/useToast";
import { chatStore } from "@/v2/chat/chatStore";
import { CardImage } from "@/v2/ui/CardImage";
import { cardAmountText, shortOf } from "@/v2/model/resultView";
import { pctText } from "@/v2/model/text";
import { NUM, SHADOW } from "@/v2/result/parts";

/**
 * 카드별 계산 근거(오른쪽 패널, 휴대폰은 전체 화면). 디자인에 없는 화면이라 v2 색·글꼴로 그렸다.
 * 순서: 패키지 → 전월실적 → 혜택별 계산 → 묶음 한도 → 합계 → 계산에 쓴 값
 */
const REPORT_KEY = "walletfit:v1:reports";

export function reportNumbers(card: Pick<EngineCard, "sid" | "name" | "total">) {
  try {
    const list = JSON.parse(window.localStorage.getItem(REPORT_KEY) ?? "[]");
    list.push({ sid: card.sid, name: card.name, at: new Date().toISOString(), total: card.total });
    window.localStorage.setItem(REPORT_KEY, JSON.stringify(list));
  } catch {
    /* 저장 못 해도 안내는 보여 준다 */
  }
}

function Step({ n, title, children, last }: { n: number; title: string; children: ReactNode; last?: boolean }) {
  return (
    <section style={{ marginTop: 20, display: "flex", gap: 12 }}>
      <span
        aria-hidden="true"
        style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Outfit, sans-serif", fontSize: 13, fontWeight: 700, color: "#FFFFFF", background: last ? "#0F6B3D" : "#2457F5" }}
      >
        {n}
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{title}</h3>
        <div style={{ marginTop: 8 }}>{children}</div>
      </div>
    </section>
  );
}

function Row({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <dt style={{ color: "#3A4A78" }}>{k}</dt>
      <dd style={{ margin: 0, ...NUM }}>{v}</dd>
    </div>
  );
}

export function ProofPanel({ card, onClose }: { card: EngineCard; onClose: () => void }) {
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
  const status = statusLine(card);
  let step = 0;
  const rate = (b: TraceBenefit) => (b.type === "percent" && b.value ? ` × ${pctText(b.value)}` : "");

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`${card.name} 계산 근거`}>
      <button type="button" aria-label="닫기" onClick={onClose} className="absolute inset-0 hidden bg-[#0D1B4A]/40 md:block" />
      <div ref={ref} tabIndex={-1} className="relative h-full w-full overflow-y-auto bg-white p-5 outline-none md:w-[480px] md:p-6" style={{ color: "#0D1B4A" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <CardImage sid={card.sid} width={112} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#2457F5" }}>계산 근거</div>
            <h2 style={{ margin: "2px 0 0", fontSize: 19, fontWeight: 700, lineHeight: 1.3 }}>{card.name}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="계산 근거 닫기" style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 22, border: "none", background: "#F3F7FF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3A4A78" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 8, padding: 16, borderRadius: 16, background: "#F3F7FF" }}>
          <div>
            <div style={{ fontSize: 13, color: "#5E6D96" }}>이 카드로 내는 월 {korWon(card.pay)} 기준</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "#1747D6", ...NUM }}>{cardAmountText(card)}</div>
          </div>
          <div style={{ textAlign: "right", fontSize: 13, color: "#3A4A78" }}>
            연회비 월 {num(card.feeMonthly)}원을 빼면
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0D1B4A", ...NUM }}>약 {num(Math.round(card.net / 100) * 100)}원</div>
          </div>
        </div>

        {card.choiceAll.length > 1 && (
          <Step n={++step} title={`패키지 고르기 · ${card.choiceAll.length}개를 모두 계산했어요`}>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
              {[...card.choiceAll]
                .sort((a, b) => b.total - a.total)
                .slice(0, 8)
                .map((o, i, arr) => (
                  <li key={o.label} style={{ display: "grid", gridTemplateColumns: "1fr 90px 64px", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 8, fontSize: 13, ...(i === 0 ? { background: "#E8EEFF", fontWeight: 700 } : {}) }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.label}</span>
                    <span style={{ height: 6, borderRadius: 3, background: "#2457F5", opacity: i === 0 ? 1 : 0.4, width: `${(o.total / (arr[0].total || 1)) * 100}%` }} />
                    <span style={{ textAlign: "right", ...NUM }}>{num(o.total)}</span>
                  </li>
                ))}
            </ul>
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "#3A4A78" }}>
              {card.choiceGroups?.some((g) => g.auto) ? "이 카드는 카드사가 이용금액을 보고 매달 자동으로 정해요." : "패키지는 카드사 앱에서 바꿀 수 있어요. 지출이 바뀌면 가장 나은 패키지도 바뀔 수 있어요."}
            </p>
          </Step>
        )}

        <Step n={++step} title={t ? `전월실적 확인 · ${korWon(t)} 이상 구간` : card.status === "auto" ? "전월실적 확인 · 실적 조건 확인 전" : "전월실적 확인 · 실적 조건 없음"}>
          <dl style={{ margin: 0, display: "flex", flexDirection: "column", gap: 4, fontSize: 14 }}>
            <Row k="이 카드로 낸 결제" v={korWon(card.pay)} />
            {excludedPay > 0 && <Row k={`실적에서 빠지는 카테고리(${card.perf.excluded.map(catLabel).join("·")})`} v={`− ${korWon(excludedPay)}`} />}
            {discounted > 0.5 && <Row k="할인받은 결제는 빠져요" v={`− ${korWon(discounted)}`} />}
            <Row k={<strong style={{ color: "#0D1B4A" }}>실적</strong>} v={<strong>{korWon(card.perf.q)}</strong>} />
          </dl>
          {t > 0 && (
            <>
              <div style={{ position: "relative", marginTop: 12, height: 10, borderRadius: 5, background: "#EDF2FC", overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 5, background: "#2457F5", width: `${Math.min(100, (card.perf.q / (Math.max(card.perf.q, t) * 1.15)) * 100)}%` }} />
                <div style={{ position: "absolute", top: 0, bottom: 0, width: 2, background: "#0D1B4A", left: `${(t / (Math.max(card.perf.q, t) * 1.15)) * 100}%` }} />
              </div>
              <p style={{ margin: "8px 0 0", fontSize: 13, fontWeight: 700, color: card.perf.q >= t ? "#0F6B3D" : "#A3420B" }}>
                {card.perf.q >= t ? `${korWon(t)} 이상 · 여유 ${korWon(card.perf.q - t)}` : `${korWon(t - card.perf.q)} 더 쓰면 구간 달성`}
              </p>
            </>
          )}
        </Step>

        <Step n={++step} title="혜택별 계산">
          <div style={{ overflow: "hidden", borderRadius: 12, border: "1px solid #E3EAF8" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#F3F7FF", color: "#5E6D96" }}>
                <tr>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600 }}>혜택</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600 }}>대상 금액 × 비율</th>
                  <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>계산값</th>
                </tr>
              </thead>
              <tbody>
                {got.map((b) => (
                  <tr key={b.id} style={{ borderTop: "1px solid #EDF2FC", verticalAlign: "top" }}>
                    <td style={{ padding: "8px 12px", fontWeight: 600 }}>{b.title}</td>
                    <td style={{ padding: "8px 12px", color: "#3A4A78" }}>
                      {b.cats.map((c) => (
                        <div key={c.cat}>
                          {catLabel(c.cat)} {korWon(c.spend)}
                          {c.share < 0.999 && ` × ${pctText(c.share)}`} = {korWon(c.target)}
                          {rate(b)}
                        </div>
                      ))}
                    </td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, ...NUM }}>
                      {num(b.raw)}
                      {b.afterOwn < b.raw - 0.5 && <div style={{ fontSize: 12, fontWeight: 400, color: "#5E6D96" }}>자체 한도 → {num(b.afterOwn)}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {zero.length > 0 && (
              <p style={{ margin: 0, padding: "8px 12px", borderTop: "1px solid #EDF2FC", background: "#F7FAFF", fontSize: 12, color: "#5E6D96" }}>
                0원: {zero.slice(0, 6).map((b) => `${b.title}${b.skip ? `(${b.skip})` : ""}`).join(", ")}. 이 카드로 내지 않는 지출이거나 조건이 안 맞아요.
              </p>
            )}
          </div>
          {got[0]?.quote && (
            <details style={{ marginTop: 8, fontSize: 13, color: "#3A4A78" }}>
              <summary style={{ cursor: "pointer", fontWeight: 700, color: "#2457F5" }}>카드사 원문 보기</summary>
              <p style={{ margin: "6px 0 0", padding: "10px 12px", borderRadius: 10, background: "#F7FAFF", lineHeight: 1.6 }}>{got[0].quote}</p>
            </details>
          )}
        </Step>

        {sharedHit.length > 0 && (
          <Step n={++step} title="묶음 한도 적용">
            {sharedHit.map((s) => (
              <div key={s.id} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
                  <span>
                    <strong>{s.label}</strong> 월 {korWon(s.cap)}
                  </span>
                  <span style={NUM}>
                    {num(s.sum)} → <strong>{num(Math.min(s.sum, s.cap))}</strong>
                  </span>
                </div>
                <div style={{ marginTop: 4, display: "flex", height: 8, borderRadius: 4, overflow: "hidden", background: "#EDF2FC" }}>
                  <div style={{ background: "#2457F5", width: `${(Math.min(s.sum, s.cap) / Math.max(s.sum, s.cap)) * 100}%` }} />
                </div>
              </div>
            ))}
          </Step>
        )}

        <Step n={++step} title="합계" last>
          <p style={{ margin: 0, fontSize: 14, color: "#3A4A78", ...NUM }}>
            {got.map((b) => num(b.final)).join(" + ") || "0"} = <strong style={{ color: "#0F6B3D" }}>월 {won(card.total)}</strong>
          </p>
        </Step>

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #EDF2FC" }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>이 계산에 쓴 값</div>
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {card.flags.slice(0, 8).map((f) => {
              const text = f.replace(/^[^:]+:\s*/, "");
              const user = /입력한/.test(text);
              return (
                <span key={f} style={{ padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, ...(user ? { background: "#E8EEFF", color: "#1747D6" } : { background: "#FFF6EE", color: "#A3420B" }) }}>
                  {user ? text : `가정 · ${text}`}
                </span>
              );
            })}
            {card.flags.length === 0 && <span style={{ fontSize: 13, color: "#5E6D96" }}>가정한 값 없이 원문 숫자만 썼어요.</span>}
          </div>
          {status && <p style={{ margin: "12px 0 0", padding: "8px 12px", borderRadius: 10, background: "#FFF6EE", fontSize: 13, color: "#A3420B" }}>{status}</p>}
        </div>

        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #EDF2FC", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 14 }}>
          <div style={{ display: "flex", gap: 16 }}>
            {card.url && (
              <a href={card.url} target="_blank" rel="noreferrer" style={{ fontWeight: 700, textDecoration: "none" }}>
                카드고릴라 원문 전체 ↗
              </a>
            )}
            <button
              type="button"
              onClick={() => {
                chatStore.ask(`${shortOf(card)} 계산 근거를 설명해 줘`);
                onClose();
              }}
              style={{ border: "none", background: "transparent", padding: 0, fontFamily: "inherit", fontSize: 14, fontWeight: 700, color: "#2457F5", cursor: "pointer" }}
            >
              이 계산 물어보기
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              reportNumbers(card);
              showToast("검수 목록에 올렸어요. 이 카드의 혜택 표를 먼저 다시 확인할게요.", "success");
            }}
            style={{ height: 40, padding: "0 16px", borderRadius: 20, border: "1px solid #D3DDF2", background: "#FFFFFF", fontFamily: "inherit", fontSize: 14, fontWeight: 600, color: "#0D1B4A", cursor: "pointer", boxShadow: SHADOW }}
          >
            숫자가 이상해요
          </button>
        </div>
      </div>
    </div>
  );
}
