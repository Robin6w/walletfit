import { useState } from "react";
import { categories, catLabel } from "@/v1/catalog";
import type { StatementSummary } from "@/v2/model/statement";

/*
 * 명세서에서 읽은 결제를 한 건씩 보여 주는 표(2026-10-31). 카테고리 칩을 누르면 그 카테고리만 본다.
 * 카테고리 칸에서 바꾸면 같은 가맹점 결제가 모두 함께 바뀐다(사전에 없는 일반 가게는 '그 외'로 두고 사용자가 고친다)
 */

const label = (c: string) => (c === "etc" ? "그 외 가맹점" : catLabel(c));
const won = (v: number) => `${v < 0 ? "−" : ""}${Math.abs(v).toLocaleString("ko-KR")}원`;

const th = { position: "sticky", top: 0, background: "#F3F7FF", padding: "10px 12px", fontSize: 13, fontWeight: 700, color: "#3A4A78", textAlign: "left", whiteSpace: "nowrap" } as const;
const td = { padding: "10px 12px", fontSize: 14, borderTop: "1px solid #E6ECF7", verticalAlign: "top" } as const;

export function StatementItems({ summary, onRecategorize }: { summary: StatementSummary; onRecategorize: (name: string, category: string) => void }) {
  const [only, setOnly] = useState<string | null>(null);
  // 명세서를 여러 장 합쳤을 때: 명세서(카드)별로 보기
  const [fromSrc, setFromSrc] = useState<string | null>(null);
  const { months } = summary;
  const sourceRows = new Map<string, { count: number; total: number }>();
  for (const it of summary.items) {
    if (!it.source || it.cancelled || it.reward) continue;
    const g = sourceRows.get(it.source) ?? { count: 0, total: 0 };
    g.count += 1;
    g.total += it.amount;
    sourceRows.set(it.source, g);
  }
  const multi = sourceRows.size > 1;
  const items = multi && fromSrc ? summary.items.filter((it) => it.source === fromSrc) : summary.items;

  const counted = items.filter((it) => !it.cancelled && !it.reward);
  const cancelledCount = items.filter((it) => it.cancelled).length;
  const rewardCount = items.filter((it) => it.reward).length;
  const byCat = new Map<string, { count: number; total: number }>();
  for (const it of counted) {
    const g = byCat.get(it.category) ?? { count: 0, total: 0 };
    g.count += 1;
    g.total += it.amount;
    byCat.set(it.category, g);
  }
  const cats = Array.from(byCat.entries()).sort((a, b) => b[1].total - a[1].total);
  const total = counted.reduce((s, it) => s + it.amount, 0);
  const shown = only ? items.filter((it) => it.category === only) : items;

  const chip = (key: string | null, text: string, sub: string, cur = only, set = setOnly) => {
    const on = cur === key;
    return (
      <button
        key={key ?? "all"}
        type="button"
        aria-pressed={on}
        onClick={() => set(on ? null : key)}
        style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, padding: "8px 12px", borderRadius: 12, border: `1px solid ${on ? "#2457F5" : "#D3DDF2"}`, background: on ? "#E8EEFF" : "#FFFFFF", fontFamily: "inherit", color: "#0D1B4A", cursor: "pointer", textAlign: "left" }}
      >
        <span style={{ fontSize: 13, fontWeight: 700 }}>{text}</span>
        <span style={{ fontSize: 12, color: "#5E6D96", fontVariantNumeric: "tabular-nums" }}>{sub}</span>
      </button>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>읽은 내역 {counted.length}건</h2>
        <span style={{ fontSize: 14, color: "#3A4A78", fontVariantNumeric: "tabular-nums" }}>합계 {won(total)}</span>
      </div>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "#5E6D96" }}>
        가맹점마다 어느 카테고리로 들어갔는지 확인하고, 틀린 곳은 카테고리를 눌러 바꿔 주세요. 같은 가맹점 결제는 함께 바뀌어요.{months > 1 ? ` 표의 금액은 실제 결제 금액이고, 추천에는 ${months}달 평균으로 들어가요.` : ""}
        {cancelledCount > 0 ? ` 취소된 결제 ${cancelledCount}건은 합계와 추천 계산에서 뺐어요.` : ""}
        {rewardCount > 0 ? ` 캐시백 같은 카드 혜택 입금 ${rewardCount}건은 소비가 아니라 뺐어요.` : ""}
      </p>

      {multi && (
        <fieldset style={{ margin: 0, padding: 0, border: "none", display: "flex", flexWrap: "wrap", gap: 8 }}>
          <legend style={{ padding: 0, marginBottom: 6, fontSize: 13, fontWeight: 700, color: "#3A4A78" }}>명세서별</legend>
          {chip(null, "모든 명세서", `${sourceRows.size}장`, fromSrc, setFromSrc)}
          {Array.from(sourceRows.entries()).map(([s, g]) => chip(s, s, `${g.count}건 · ${won(g.total)}`, fromSrc, setFromSrc))}
        </fieldset>
      )}

      <fieldset style={{ margin: 0, padding: 0, border: "none", display: "flex", flexWrap: "wrap", gap: 8 }}>
        <legend className={multi ? undefined : "sr-only"} style={multi ? { padding: 0, marginBottom: 6, fontSize: 13, fontWeight: 700, color: "#3A4A78" } : undefined}>
          카테고리별
        </legend>
        {chip(null, "전체", `${counted.length}건`)}
        {cats.map(([c, g]) => chip(c, label(c), `${g.count}건 · ${won(g.total)}`))}
      </fieldset>

      <div style={{ maxHeight: 380, overflow: "auto", border: "1px solid #D3DDF2", borderRadius: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 420 }}>
          <caption className="sr-only">명세서에서 읽은 결제 내역{only ? ` · ${label(only)}` : ""}</caption>
          <thead>
            <tr>
              <th scope="col" style={th}>날짜</th>
              <th scope="col" style={th}>가맹점</th>
              <th scope="col" style={th}>카테고리</th>
              <th scope="col" style={{ ...th, textAlign: "right" }}>금액</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((it, i) =>
              it.cancelled || it.reward ? (
                <tr key={i} style={{ color: "#8A97B8" }}>
                  <td style={{ ...td, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{it.date ?? "-"}</td>
                  <td style={{ ...td, overflowWrap: "anywhere" }}>{it.name}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{it.reward ? "카드 혜택 입금" : "취소된 결제"}</td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                    <s>{won(it.amount)}</s>
                  </td>
                </tr>
              ) : (
                <tr key={i}>
                  <td style={{ ...td, color: "#5E6D96", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{it.date ?? "-"}</td>
                  <td style={{ ...td, overflowWrap: "anywhere" }}>
                    {it.name}
                    {/* 어느 브랜드로 읽었는지: 명세서 경로는 여기 나온 브랜드만 브랜드 혜택으로 계산한다(2026-11-01) */}
                    {it.brand && <div style={{ fontSize: 12, color: "#2457F5" }}>브랜드 혜택 대상 · {it.brand}</div>}
                    {multi && !fromSrc && it.source && <div style={{ fontSize: 12, color: "#8A97B8" }}>{it.source}</div>}
                  </td>
                  <td style={{ ...td, whiteSpace: "nowrap", padding: "6px 12px" }}>
                    <select
                      aria-label={`${it.name} 카테고리`}
                      value={it.category}
                      onChange={(e) => onRecategorize(it.name, e.target.value)}
                      style={{ height: 34, maxWidth: 150, padding: "0 8px", borderRadius: 8, border: `1px solid ${it.edited ? "#2457F5" : "#D3DDF2"}`, background: it.edited ? "#E8EEFF" : "#FFFFFF", fontFamily: "inherit", fontSize: 14, color: it.category === "etc" && !it.edited ? "#7A4F00" : "#0D1B4A", cursor: "pointer" }}
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {label(c.id)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", color: it.amount < 0 ? "#C62828" : "#0D1B4A" }}>{won(it.amount)}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
