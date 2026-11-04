import type { CSSProperties } from "react";
import { CHOICE_QUESTIONS, setChoice, useChoices, type ChoiceKey } from "@/domain/engine/choices";
import { CategoryIcon } from "@/v2/ui/icons";

/**
 * 통신사·기후동행 질문(2026-11-04). 통신사 전용 할인(KT 통신요금 자동이체 등)과 기후동행 정기권 요금 할인은
 * 그 통신사·정기권을 써야 받는다. 답이 없으면 엔진이 통신사 점유율만큼만 계산하고, 답하면 맞는 혜택만 전액 계산한다.
 * 통신비·교통비 지출이 있을 때만 묻는다.
 */

const SHADOW = "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)";

const pill = (on: boolean): CSSProperties => ({
  height: 40,
  padding: "0 16px",
  borderRadius: 20,
  fontFamily: "inherit",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
  ...(on ? { border: "2px solid #2457F5", background: "#FFFFFF", color: "#2457F5" } : { border: "2px solid transparent", background: "#F3F7FF", color: "#3A4A78" }),
});

const ROWS: { key: ChoiceKey; cat: string; hint: string }[] = [
  { key: "telecom", cat: "mobile", hint: "통신사 전용 통신요금 할인은 그 통신사를 써야 받아요. 모르면 통신사 점유율만큼만 계산해요." },
  { key: "climate_pass", cat: "transport", hint: "기후동행 정기권 요금 할인은 정기권을 사야 받아요. 모르면 서울 이용자 비율만큼만 계산해요." },
];

export function ChoiceQuestions({ spending }: { spending: Record<string, number> }) {
  const choices = useChoices();
  const rows = ROWS.filter((r) => (spending[r.cat] ?? 0) > 0);
  if (rows.length === 0) return null;
  return (
    <section aria-label="통신사·교통" style={{ background: "#FFFFFF", borderRadius: 24, padding: 24, boxShadow: SHADOW, display: "flex", flexDirection: "column", gap: 22 }}>
      {rows.map((r) => {
        const q = CHOICE_QUESTIONS[r.key];
        const cur = choices[r.key] ?? null;
        return (
          <div key={r.key} role="group" aria-labelledby={`choice-${r.key}`}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <CategoryIcon cat={r.cat} size={40} radius={13} glyph={22} />
              <h2 id={`choice-${r.key}`} style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>
                {q.question}
              </h2>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.6, color: "#5E6D96" }}>{r.hint}</p>
            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {Object.entries(q.options).map(([id, o]) => (
                <button key={id} type="button" aria-pressed={cur === id} onClick={() => setChoice(r.key, cur === id ? null : id)} style={pill(cur === id)}>
                  {o.label}
                </button>
              ))}
              <button type="button" aria-pressed={cur === null} onClick={() => setChoice(r.key, null)} style={pill(cur === null)}>
                잘 모름
              </button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
