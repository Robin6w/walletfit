import type { CSSProperties } from "react";
import type { EngineCard } from "@/domain/types/engine";
import { catLabel } from "@/v1/catalog";
import { korWon, num } from "@/v1/format";
import { benefitByCategory } from "@/v1/wallet/model";
import type { TodoVM } from "@/v2/model/resultView";
import { josa } from "@/v2/model/text";
import { CategoryIcon } from "@/v2/ui/icons";
import { NUM } from "@/v2/result/parts";

/**
 * 결과 화면 '발급 정보 보기' 상세 창 맨 위(2026-11-03): 이 조합에서 이 카드가 하는 일을 그림으로.
 *  - 1년에 받는 혜택 vs 연회비 막대, 전월실적 게이지(이 카드로 쓸 금액 vs 조건), 맡을 지출, 발급하고 할 일 단계
 * 예전 v1 창은 카드 종류·연회비·요약 한 줄뿐이라 '왜 이 카드를 발급해야 하는지'가 안 보였다.
 */

const BLUE = "#2457F5";
const INK = "#0D1B4A";
const SUB = "#5E6D96";
const LINE = "#E3EAF8";
const box: CSSProperties = { padding: "16px 18px", borderRadius: 16, background: "#F7F9FF", border: `1px solid ${LINE}`, display: "flex", flexDirection: "column", gap: 12 };
const h4: CSSProperties = { margin: 0, fontSize: 15, fontWeight: 700, color: INK };
const muted: CSSProperties = { margin: 0, fontSize: 13, lineHeight: 1.6, color: SUB };

function Bar({ label, value, max, color, text }: { label: string; value: number; max: number; color: string; text: string }) {
  const w = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "72px 1fr auto", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 13, color: SUB }}>{label}</span>
      <div aria-hidden="true" style={{ height: 14, borderRadius: 7, background: "#E8EEFF", overflow: "hidden" }}>
        <div style={{ width: `${w}%`, height: "100%", borderRadius: 7, background: color }} />
      </div>
      <strong style={{ fontSize: 14, color: INK, ...NUM }}>{text}</strong>
    </div>
  );
}

/** 혜택 vs 연회비 */
function Worth({ card }: { card: EngineCard }) {
  const year = card.total * 12;
  const fee = card.annualFee;
  const max = Math.max(year, fee, 1);
  const times = fee > 0 ? year / fee : null;
  return (
    <div style={box}>
      <h4 style={h4}>1년으로 보면</h4>
      <Bar label="받는 혜택" value={year} max={max} color={BLUE} text={korWon(year)} />
      <Bar label="연회비" value={fee} max={max} color="#9AA9CC" text={fee ? korWon(fee) : "없음"} />
      <p style={muted}>
        {fee === 0
          ? "연회비가 없어서 받는 혜택이 그대로 남아요."
          : times !== null && times >= 1
            ? `연회비의 약 ${times >= 10 ? Math.round(times) : times.toFixed(1)}배를 돌려받아요. 연회비를 빼면 1년에 ${korWon(year - fee)}이에요.`
            : `이 조합에서는 혜택이 연회비보다 적어요(1년 ${korWon(year - fee)}). 다른 카드와 함께 쓸 때 조합 전체로 이득이라 추천했어요.`}
      </p>
    </div>
  );
}

/** 전월실적 게이지 */
function Performance({ card }: { card: EngineCard }) {
  const th = card.perf.threshold;
  const q = card.perf.qRaw ?? card.perf.q;
  if (!th) {
    return (
      <div style={box}>
        <h4 style={h4}>실적 조건</h4>
        <p style={{ ...muted, color: "#3A4A78" }}>전월 실적 조건이 없어요. 쓰는 만큼 바로 혜택을 받아요.</p>
      </div>
    );
  }
  const max = Math.max(th * 1.4, q * 1.05);
  const ok = q >= th;
  const pct = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  return (
    <div style={box}>
      <h4 style={h4}>실적 조건</h4>
      <div style={{ position: "relative", height: 34 }} aria-hidden="true">
        <div style={{ position: "absolute", top: 10, left: 0, right: 0, height: 14, borderRadius: 7, background: "#E8EEFF" }} />
        <div style={{ position: "absolute", top: 10, left: 0, width: pct(q), height: 14, borderRadius: 7, background: ok ? BLUE : "#E8833A" }} />
        <div style={{ position: "absolute", top: 4, left: pct(th), width: 2, height: 26, background: INK, transform: "translateX(-1px)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6, fontSize: 13, color: SUB }}>
        <span>
          이 카드로 쓸 금액 <strong style={{ color: ok ? BLUE : "#A3420B", ...NUM }}>월 {korWon(q)}</strong>
        </span>
        <span>
          조건 <strong style={{ color: INK, ...NUM }}>{korWon(th)}</strong>
        </span>
      </div>
      <p style={muted}>
        {ok
          ? `지난달에 이 카드로 ${korWon(th)} 넘게 써야 이번 달 혜택이 나와요. 추천대로 쓰면 ${korWon(q - th)} 여유가 있어요.`
          : `추천대로 쓰면 조건보다 ${korWon(th - q)} 모자라요. 다른 지출을 조금 옮겨야 혜택이 나와요.`}
        {card.perf.excludesDiscounted ? " 할인받은 금액은 실적에서 빠져요." : ""}
        {card.perf.grace?.months_after_issue ? ` 발급 후 ${card.perf.grace.months_after_issue}개월은 실적이 모자라도 혜택을 줘요.` : ""}
      </p>
    </div>
  );
}

/** 이 카드가 맡을 지출 */
function Spend({ card }: { card: EngineCard }) {
  const byCat = benefitByCategory(card);
  const rows = Object.entries(card.alloc)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  if (!rows.length) return null;
  const max = rows[0][1];
  return (
    <div style={box}>
      <h4 style={h4}>이 카드로 낼 지출</h4>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map(([cat, v]) => (
          <li key={cat} style={{ display: "grid", gridTemplateColumns: "32px 1fr auto", alignItems: "center", gap: 10 }}>
            <CategoryIcon cat={cat} size={32} radius={10} />
            <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 14, color: INK }}>
                <span>{catLabel(cat)}</span>
                <span style={{ color: SUB, ...NUM }}>월 {korWon(v)}</span>
              </div>
              <div aria-hidden="true" style={{ height: 6, borderRadius: 3, background: "#E8EEFF" }}>
                <div style={{ width: `${Math.max(3, (v / max) * 100)}%`, height: "100%", borderRadius: 3, background: "#9DB4F7" }} />
              </div>
            </div>
            <strong style={{ fontSize: 14, color: (byCat[cat] ?? 0) >= 1 ? BLUE : SUB, minWidth: 64, textAlign: "right", ...NUM }}>
              {(byCat[cat] ?? 0) >= 1 ? `+${num(Math.round(byCat[cat] / 10) * 10)}원` : "실적만"}
            </strong>
          </li>
        ))}
      </ul>
      <p style={muted}>오른쪽 숫자는 그 지출로 받는 월 혜택이에요. '실적만'은 혜택은 없지만 실적 조건을 채우는 데 쓰는 지출이에요.</p>
    </div>
  );
}

/** 발급하고 할 일 */
function Steps({ card, todos }: { card: EngineCard; todos: TodoVM[] }) {
  const steps = [
    ...todos.map((t) => (t.id.startsWith("issue-") ? `${josa(t.text.replace(/ 발급 신청하기$/, ""), "을/를")} 카드사 앱이나 홈페이지에서 발급 신청해요` : t.text)),
    card.perf.threshold
      ? `다음 달부터 위 지출을 이 카드로 결제해 실적 ${korWon(card.perf.threshold)}을 채워요`
      : "다음 달부터 위 지출을 이 카드로 결제해요",
    "혜택은 보통 다음 달 청구서에서 할인되거나 포인트로 쌓여요",
  ];
  return (
    <div style={box}>
      <h4 style={h4}>발급하고 할 일</h4>
      <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column" }}>
        {steps.map((s, i) => (
          <li key={i} style={{ display: "grid", gridTemplateColumns: "28px 1fr", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ width: 26, height: 26, borderRadius: 13, background: i === 0 ? BLUE : "#FFFFFF", border: `2px solid ${BLUE}`, color: i === 0 ? "#FFFFFF" : BLUE, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box" }}>
                {i + 1}
              </span>
              {i < steps.length - 1 && <span aria-hidden="true" style={{ flex: 1, width: 2, minHeight: 12, background: "#C9D6F5" }} />}
            </div>
            <p style={{ margin: "3px 0 14px", fontSize: 14, lineHeight: 1.6, color: INK }}>{s}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function IssuePlan({ card, todos }: { card: EngineCard; todos: TodoVM[] }) {
  return (
    <section aria-label="이 조합에서 이 카드가 하는 일" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "4px 10px" }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: INK }}>이 조합에서 이 카드가 하는 일</h3>
        <span style={{ fontSize: 14, color: SUB }}>
          월 <strong style={{ color: BLUE, fontSize: 18, ...NUM }}>{korWon(card.total)}</strong> 혜택
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        <Worth card={card} />
        <Performance card={card} />
      </div>
      <Spend card={card} />
      <Steps card={card} todos={todos} />
    </section>
  );
}
