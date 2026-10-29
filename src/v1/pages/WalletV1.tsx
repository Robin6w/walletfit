import { useState } from "react";
import { Wallet } from "lucide-react";
import type { SavedWallet } from "@/v1/state";
import { CardFace, Btn, Section } from "@/v1/ui";
import { annualMan, approxKor, approxWon, korWon } from "@/v1/format";
import { catalogBySourceId, feeLabel } from "@/v1/catalog";
import { cardMonthlyLabel, colorOf, monthlyTone, paymentGuide, shortCard } from "@/v1/wallet/model";
import { ProofPanel } from "@/v1/wizard/ProofPanel";
import { catLabel } from "@/v1/catalog";

interface Props {
  wallet: SavedWallet | null;
  ownedIds: number[];
  onToggleTodo: (id: string) => void;
  onStart: () => void;
  onEditSpend: () => void;
  onSwap: () => void;
  onAsk: (q?: string) => void;
}

export function WalletV1({ wallet, ownedIds, onToggleTodo, onStart, onEditSpend, onSwap, onAsk }: Props) {
  const [proof, setProof] = useState<number | null>(null);
  if (!wallet) {
    return (
      <div className="mx-auto max-w-[640px] py-10 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-[18px] bg-tint text-primary">
          <Wallet className="h-7 w-7" />
        </span>
        <h1 className="mt-5 text-[26px] font-extrabold">아직 저장한 지갑이 없어요</h1>
        <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">
          카드를 담고 한 달 지출을 넣으면 조합과 결제 순서를 계산해 드려요. 결과 화면에서 '내 지갑에 저장'을 누르면 여기에 남아요.
        </p>
        <Btn kind="primary" size="lg" className="mt-6" onClick={onStart}>
          내 지갑 만들기
        </Btn>
      </div>
    );
  }
  const pack = wallet.pack;
  const { withBenefit, without } = paymentGuide(pack, wallet.spending);
  const unused = ownedIds.filter((s) => !pack.sids.includes(s));
  const total = Object.values(wallet.spending).reduce((s, v) => s + v, 0);
  const proofCard = proof !== null ? pack.cards.find((c) => c.sid === proof) : null;
  const done = wallet.todos.filter((t) => t.done).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold md:text-[32px]">내 지갑</h1>
          <p className="text-[13.5px] text-ink-2">
            {new Date(wallet.savedAt).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}에 저장한 조합 · 월 지출 {korWon(total)} · 실적 여유 {wallet.margin ? korWon(wallet.margin) : "없음"} 기준
          </p>
        </div>
        <div className="flex gap-2">
          <Btn size="sm" onClick={onEditSpend}>
            지출 다시 입력
          </Btn>
          <Btn size="sm" onClick={onSwap}>
            카드 바꿔보기
          </Btn>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] bg-primary p-6 text-white md:p-7">
        <div>
          <div className="text-[13.5px] text-white/80">이번 달 예상 순혜택</div>
          <div className="tnum mt-1 text-[34px] font-extrabold md:text-[40px]">{approxWon(pack.net)}</div>
          <div className="text-[13px] text-white/85">
            카드 {pack.cards.length}장 조합 · 1년이면 {annualMan(pack.net)}
            {wallet.singleNet !== null && pack.cards.length > 1 && ` · 1장만 쓸 때보다 월 ${approxKor(pack.net - wallet.singleNet)} 더`}
          </div>
        </div>
        <div className="flex -space-x-10">
          {pack.cards.map((c) => (
            <CardFace key={c.sid} sid={c.sid} width={140} />
          ))}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Section title={`지갑에 넣고 다닐 카드 ${pack.cards.length}장`}>
          <ul className="divide-y divide-line-soft">
            {pack.cards.map((c) => (
              <li key={c.sid} className="flex items-center gap-3 py-3">
                <CardFace sid={c.sid} width={96} dot={colorOf(pack, c.sid)} />
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-bold">{c.name}</div>
                  <div className="text-[12.5px] text-ink-3">
                    {Object.keys(c.alloc).slice(0, 3).map(catLabel).join(" · ")} · 실적 여유 {c.perf.threshold ? korWon(Math.max(0, c.perf.q - c.perf.threshold)) : "-"}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`tnum text-[15px] font-extrabold ${monthlyTone(c)}`}>{cardMonthlyLabel(c)}</div>
                  <div className="text-[12px] text-ink-3">{feeLabel(catalogBySourceId.get(c.sid))}</div>
                </div>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setProof(pack.cards[0].sid)} className="mt-2 text-[13.5px] font-bold text-primary">
            카드별 계산 근거 보기 →
          </button>
        </Section>

        <Section title="결제할 때 이 순서로">
          <ul className="divide-y divide-line-soft text-[13.5px]">
            {withBenefit.map((r) => (
              <li key={r.cat} className="py-2.5">
                <div className="font-bold">{catLabel(r.cat)}</div>
                <div className="text-ink-2">
                  {r.parts.map((pt, i) => (i === 0 ? `${pt.name}로 ${korWon(pt.amount)}` : ` → 나머지 ${korWon(pt.amount)}은 ${pt.name}`)).join("")}
                </div>
              </li>
            ))}
            {without.length > 0 && (
              <li className="py-2.5">
                <div className="font-bold">혜택 없는 지출</div>
                <div className="text-ink-2">
                  {without.map((r) => `${catLabel(r.cat)}는 ${r.parts.length > 1 ? "반씩" : r.parts[0]?.name}`).join(", ")}. 카드 실적을 채워요.
                </div>
              </li>
            )}
          </ul>
        </Section>
      </div>

      {wallet.todos.length > 0 && (
        <section className="rounded-[20px] border border-tint-line bg-tint p-5 md:p-6">
          <h2 className="text-[17px] font-extrabold">
            카드사 앱에서 할 일 {wallet.todos.length}가지 <span className="text-[13px] font-semibold text-ink-3">· {done}개 완료</span>
          </h2>
          <ul className="mt-3 space-y-2">
            {wallet.todos.map((t) => (
              <li key={t.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[14px]">
                  <input type="checkbox" checked={t.done} onChange={() => onToggleTodo(t.id)} className="h-5 w-5 accent-[#1B4FD8]" />
                  <span className={t.done ? "text-ink-3 line-through" : ""}>{t.text}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      {unused.length > 0 && (
        <Section title="이 조합에서 쓰지 않는 카드">
          <p className="text-[13px] text-ink-2">
            가진 카드 {ownedIds.length}장 중 {unused.length}장은 이번 조합에서 결제에 쓰지 않아요. 해지나 정리를 고민한다면 카드사 실적·약관을 먼저 확인하세요.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {unused.map((s) => {
              const e = catalogBySourceId.get(s);
              return (
                <span key={s} className="flex items-center gap-2 rounded-[12px] border border-line px-3 py-2 text-[13px]">
                  <CardFace sid={s} width={36} />
                  {e ? `${shortCard(e.name)} · ${feeLabel(e)}` : s}
                </span>
              );
            })}
          </div>
        </Section>
      )}

      {proofCard && <ProofPanel card={proofCard} color={colorOf(pack, proofCard.sid)} onClose={() => setProof(null)} onAsk={(q) => onAsk(q)} />}
    </div>
  );
}
