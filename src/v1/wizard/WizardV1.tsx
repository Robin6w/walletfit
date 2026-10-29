import { useEffect, useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";
import { Shell, type V1Tab, type WizardStepPill } from "@/v1/Shell";
import { CardsStep } from "@/v1/wizard/CardsStep";
import { SpendStep } from "@/v1/wizard/SpendStep";
import { BrandsStep } from "@/v1/wizard/BrandsStep";
import { ResultStep } from "@/v1/wizard/ResultStep";
import { ProofPanel } from "@/v1/wizard/ProofPanel";
import { Conditions } from "@/v1/wizard/Conditions";
import { Btn } from "@/v1/ui";
import { catalogBySourceId, categories, issuableCards } from "@/v1/catalog";
import { korWon, approxWon, num } from "@/v1/format";
import { colorOf, todosOf } from "@/v1/wallet/model";
import { useMonthlySpend } from "@/domain/state/useMonthlySpend";
import { useBrands, useRank, useRecommendation, toBrandShare } from "@/domain/engine/walletEngine";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { useToast } from "@/shared/hooks/useToast";
import type { useSavedCards } from "@/domain/state/useSavedCards";
import type { CardKind } from "@/domain/types/card";
import type { RecommendArgs, RecommendResponse } from "@/domain/types/engine";
import { useBrandSpend, useIncludeUnverified, useMargin, type SavedWallet } from "@/v1/state";

export type WizardStep = 1 | 2 | 3 | 4;

interface Props {
  scope: "myCards" | "all";
  onScope: (s: "myCards" | "all") => void;
  step: WizardStep;
  onStep: (s: WizardStep) => void;
  myCards: ReturnType<typeof useSavedCards>;
  onNavigate: (tab: V1Tab) => void;
  onResult: (rec: RecommendResponse | null, ctx: { spending: Record<string, number>; margin: number }) => void;
  onAsk: (q?: string) => void;
  onSave: (w: SavedWallet) => void;
}

export function WizardV1({ scope, onScope, step, onStep, myCards, onNavigate, onResult, onAsk, onSave }: Props) {
  const { spending, updateCategory, setSpending } = useMonthlySpend(categories);
  const { brandSpend, setBrand } = useBrandSpend();
  const [margin, setMargin] = useMargin();
  const [includeUnverified, setIncludeUnverified] = useIncludeUnverified();
  const [maxCards, setMaxCards] = useState(5);
  const [mode, setMode] = useState<"maxBenefit" | "efficient">("maxBenefit");
  const [feeCap, setFeeCap] = useState<number | null>(null);
  const [cardTypes, setCardTypes] = useState<CardKind[]>(["credit", "check"]);
  const [excludedIssuers, setExcludedIssuers] = useState<Set<string>>(new Set());
  const [proof, setProof] = useState<number | null>(null);
  const [retry, setRetry] = useState(0);
  const { showToast } = useToast();

  const owned = myCards.ids;
  const typeOk = (sid: number) => {
    const e = catalogBySourceId.get(sid);
    const kind: CardKind = e?.category === "체크" ? "check" : "credit";
    return cardTypes.includes(kind) && !excludedIssuers.has(e?.issuer ?? "");
  };
  const candidateIds = useMemo(() => {
    const base = scope === "myCards" ? owned : Array.from(new Set([...owned, ...issuableCards({ includeUnverified }).map((c) => c.sourceId)]));
    return base.filter(typeOk);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, owned, cardTypes, excludedIssuers, includeUnverified]);
  const unverifiedCount = useMemo(() => issuableCards({ includeUnverified: true }).length - issuableCards().length, []);
  const issuers = useMemo(
    () =>
      Array.from(new Set((scope === "myCards" ? owned : issuableCards({ includeUnverified }).map((c) => c.sourceId)).map((s) => catalogBySourceId.get(s)?.issuer ?? "")))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "ko")),
    [scope, owned, includeUnverified],
  );

  const spend = useMemo(() => Object.fromEntries(Object.entries(spending).filter(([, v]) => v > 0)), [spending]);
  const total = Object.values(spend).reduce((s, v) => s + v, 0);
  const dSpend = useDebounce(spend, 400);
  const dBrand = useDebounce(brandSpend, 400);

  // 자주 가는 곳: 담은 카드(새 카드 포함이면 이 지출에서 상위 카드까지)의 브랜드 한정 혜택
  const rank = useRank(scope === "all" && step >= 2 && total > 0 ? { ids: candidateIds, spending: dSpend } : null);
  const brandIds = useMemo(() => {
    if (scope === "myCards") return owned;
    const top = (rank.data ?? rank.lastGood)?.rows
      ?.slice()
      .sort((a, b) => b.net - a.net)
      .slice(0, 30)
      .map((r) => r.sid);
    return Array.from(new Set([...owned, ...(top ?? [])]));
  }, [scope, owned, rank.data, rank.lastGood]);
  const brands = useBrands(step >= 2 && brandIds.length ? brandIds : null);
  const brandCats = useMemo(() => Object.entries(brands.data?.categories ?? {}).filter(([c, rows]) => (spend[c] ?? 0) > 0 && rows.length > 0), [brands.data, spend]);

  const args: RecommendArgs | null =
    step === 4 && candidateIds.length > 0 && total > 0
      ? {
          ids: candidateIds,
          spending: dSpend,
          margin,
          mode,
          maxCards,
          feeCap: feeCap ?? undefined,
          brandShare: toBrandShare(dSpend, dBrand),
          withAlt: margin > 0,
          ...(retry ? { retry } : {}),
        }
      : null;
  const rec = useRecommendation(args);
  // 계산을 보낼 수 없는 이유. 이때와 계산이 실패했을 때는 예전 결과를 보여 주거나 저장하지 않는다
  const blocked: string | null =
    step !== 4
      ? null
      : total === 0
        ? "넣은 지출이 없어요. 지출 입력 단계에서 금액을 넣어 주세요."
        : candidateIds.length === 0
          ? scope === "myCards" && owned.length === 0
            ? "담은 카드가 없어요. 카드 선택 단계에서 가진 카드를 담아 주세요."
            : "조건에 맞는 카드가 없어요. 아래 조건 바꾸기에서 카드 종류나 카드사 제외를 풀어 주세요."
          : null;
  const shown = args && !rec.error ? (rec.data ?? rec.lastGood) : null;

  useEffect(() => {
    if (rec.data) onResult(rec.data, { spending: dSpend, margin });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.data]);

  // Chrome 152부터 scrollTo가 Promise를 돌려준다. 그 값을 정리 함수로 넘기지 않도록 중괄호로 감싼다
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  const steps: WizardStepPill[] = [
    { label: "카드 선택", summary: step > 1 ? (scope === "myCards" ? `${owned.length}장` : `+ 발급 가능 카드`) : undefined, state: step > 1 ? "done" : "current" },
    {
      label: "지출 입력",
      summary: step > 2 ? `${korWon(total)}` : step === 3 ? "자주 가는 곳" : undefined,
      state: step > 3 ? "done" : step >= 2 ? "current" : "todo",
    },
    { label: "추천 결과", state: step === 4 ? "current" : "todo" },
  ];

  const save = () => {
    if (!shown || shown.empty) return;
    onSave({
      savedAt: new Date().toISOString(),
      scope,
      spending: dSpend,
      brandSpend,
      margin,
      pack: shown.result,
      singleNet: shown.bar.find((b) => b.k === 1)?.net ?? null,
      todos: todosOf(shown.result).map((t) => ({ ...t, done: false })),
    });
    showToast("내 지갑에 저장했어요", "success");
    onNavigate("wallet");
  };

  const brandCount = Object.values(brandSpend).reduce((s, b) => s + Object.keys(b).length, 0);
  // 브랜드 목록이 아직 계산 중이면(새 카드 포함은 카드 순위를 먼저 구한다) 자주 가는 곳 단계로 간다
  const brandsPending = brands.isComputing || (scope === "all" && rank.isComputing && !brands.data);
  const nextFromSpend = () => onStep(brandCats.length > 0 || brandsPending ? 3 : 4);

  const bottom =
    step === 1 ? (
      <>
        <Btn kind="ghost" onClick={() => onNavigate("home")}>
          ← 홈으로
        </Btn>
        <span className="ml-auto hidden text-[13px] text-ink-2 sm:inline">
          <strong className="text-ink">{owned.length}장</strong> 담았어요 · 연회비 연 {num(owned.reduce((s, id) => s + (catalogBySourceId.get(id)?.annualFee ?? 0), 0))}원
        </span>
        <Btn kind="primary" className="ml-auto sm:ml-2" onClick={() => onStep(2)} disabled={scope === "myCards" && owned.length === 0}>
          다음: 지출 입력
        </Btn>
      </>
    ) : step === 2 ? (
      <>
        {/* 휴대폰은 위쪽 뒤로 버튼이 있어서 이전 버튼을 숨긴다 */}
        <span className="hidden sm:block">
          <Btn kind="ghost" onClick={() => onStep(1)}>
            ← 이전
          </Btn>
        </span>
        <span className="ml-1 text-[13px] text-ink-2 sm:ml-auto">
          <span className="hidden sm:inline">월 합계 · {Object.keys(spend).length}개 항목 </span>
          <span className="sm:hidden">월 </span>
          <strong className="tnum text-[18px] text-ink md:text-[22px]">{num(total)}원</strong>
        </span>
        <Btn kind="primary" className="ml-auto sm:ml-2" onClick={nextFromSpend} disabled={total === 0}>
          {brandCats.length > 0 || brandsPending ? "다음: 자주 가는 곳" : "다음: 추천 결과"}
        </Btn>
      </>
    ) : step === 3 ? (
      <>
        <span className="hidden sm:block">
          <Btn kind="ghost" onClick={() => onStep(2)}>
            ← 이전
          </Btn>
        </span>
        <span className="ml-auto hidden text-[13px] text-ink-2 sm:inline">
          브랜드 {brandCount}곳 · 카테고리 {Object.keys(brandSpend).length}개
        </span>
        <Btn className="ml-auto sm:ml-2" onClick={() => onStep(4)}>
          건너뛰기
        </Btn>
        <Btn kind="primary" onClick={() => onStep(4)}>
          추천 조합 보기
        </Btn>
      </>
    ) : (
      <>
        <span className="hidden sm:block">
          <Btn kind="ghost" onClick={() => onStep(2)}>
            ← 지출 다시 입력
          </Btn>
        </span>
        {shown && !shown.empty && (
          <span className="ml-auto hidden text-[13px] text-ink-2 md:inline">
            {shown.result.cards.length}장 · 순혜택 <strong className="text-positive">월 {approxWon(shown.result.net)}</strong>
          </span>
        )}
        <Btn className="whitespace-nowrap md:ml-2" onClick={() => onAsk()}>
          <MessageCircle className="h-4 w-4" /> 물어보기
        </Btn>
        <Btn kind="primary" className="flex-1 whitespace-nowrap md:flex-none" onClick={save} disabled={!shown || shown.empty || rec.isComputing}>
          내 지갑에 저장
        </Btn>
      </>
    );

  const proofCard = proof !== null && shown ? shown.result.cards.find((c) => c.sid === proof) : null;

  return (
    <Shell
      tab="wizard"
      onNavigate={onNavigate}
      wizard={{
        title: "지갑 만들기",
        sub: scope === "myCards" ? "보유한 카드로" : "새 카드까지 포함해서",
        steps,
        onClose: () => onNavigate("home"),
        onBack: () => (step > 1 ? onStep((step - 1) as WizardStep) : onNavigate("home")),
        mobileTitle: ["카드 선택", "지출 입력", "자주 가는 곳", "추천 결과"][step - 1],
      }}
      bottomBar={bottom}
    >
      {step === 1 && <CardsStep scope={scope} ids={owned} onToggle={(sid) => myCards.toggle(sid)} onSwitchScope={() => onScope("all")} />}
      {step === 2 && <SpendStep spending={spending} onChange={updateCategory} onReplace={setSpending} onOpenStatement={() => onNavigate("statement")} />}
      {step === 3 && (
        <BrandsStep
          cardCount={scope === "myCards" ? owned.length : 0}
          spending={spend}
          brands={brands.data?.categories ?? null}
          loading={brandsPending}
          brandSpend={brandSpend}
          onSet={setBrand}
          defaultShare={brands.data?.defaultShare ?? 0.35}
        />
      )}
      {step === 4 && (
        <ResultStep
          rec={shown}
          isComputing={rec.isComputing}
          error={rec.error}
          scope={scope}
          ownedCount={owned.length}
          spending={spend}
          brandSpend={brandSpend}
          margin={margin}
          onMargin={setMargin}
          feeCap={feeCap}
          onFeeCap={setFeeCap}
          maxCards={maxCards}
          onMaxCards={setMaxCards}
          onProof={setProof}
          onEditBrands={() => onStep(3)}
          onAsk={onAsk}
          onRetry={() => setRetry((r) => r + 1)}
          blocked={blocked}
          candidateCount={candidateIds.length}
          includeUnverified={includeUnverified}
          conditions={
            <Conditions
              scope={scope}
              includeUnverified={includeUnverified}
              onIncludeUnverified={setIncludeUnverified}
              unverifiedCount={unverifiedCount}
              mode={mode}
              onMode={setMode}
              maxCards={maxCards}
              onMaxCards={setMaxCards}
              cardTypes={cardTypes}
              onToggleType={(t) => setCardTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))}
              issuers={issuers}
              excludedIssuers={excludedIssuers}
              onToggleIssuer={(i) =>
                setExcludedIssuers((prev) => {
                  const next = new Set(prev);
                  if (next.has(i)) next.delete(i);
                  else next.add(i);
                  return next;
                })
              }
              onIncludeAll={() => setExcludedIssuers(new Set())}
              onExcludeAll={() => setExcludedIssuers(new Set(issuers))}
              candidateIds={candidateIds}
              pack={shown && !shown.empty ? shown.result : null}
              spending={spending}
              brandSpend={brandSpend}
              margin={margin}
              feeCap={feeCap}
              onApplySpending={setSpending}
              efficientCeiling={shown?.efficientCeiling ?? null}
            />
          }
        />
      )}
      {proofCard && shown && (
        <ProofPanel card={proofCard} color={colorOf(shown.result, proofCard.sid)} onClose={() => setProof(null)} onAsk={(q) => onAsk(q)} />
      )}
    </Shell>
  );
}
