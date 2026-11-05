"""
계산 엔진(wf_engine.py) 시험. 실행: python scripts/testEngine.py (저장소 루트에서)

1. 혜택 표 1,525장 모두 계산기에서 오류 없이 계산되는지
2. 시나리오(보유 카드 6장, 월 83만 5천원, 실적 여유 2만원)에서
   - 조합의 화면 숫자가 calc.py로 직접 다시 계산한 값과 원 단위까지 같은지
   - 실적 여유를 지키는지(고른 카드 실적 ≥ 구간 기준 + 2만원)
   - 카드 수 막대가 장수에 따라 줄지 않는지
3. 카드 바꿔보기(explain)와 브랜드 목록(brands)이 동작하는지
"""
import json, os, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "src/domain/engine/py"))
import calc  # noqa: E402
import milp  # noqa: E402
import wf_engine as E  # noqa: E402

E.init_json(open(os.path.join(ROOT, "data/catalog/cards-benefit.json"), encoding="utf-8").read(),
            open(os.path.join(ROOT, "data/catalog/assumptions.json"), encoding="utf-8").read())
A = json.load(open(os.path.join(ROOT, "data/catalog/assumptions.json"), encoding="utf-8"))

ok = fail = 0


def check(name, cond, detail=""):
    global ok, fail
    if cond:
        ok += 1
        print(f"[통과] {name}")
    else:
        fail += 1
        print(f"[실패] {name} {detail}")


SPEND = {"convenience": 250000, "cafe": 180000, "mobile": 140000, "transport": 80000,
         "dining": 70000, "onlineShopping": 65000, "gas": 50000}
BRANDS = {"cafe": {"스타벅스": 0.4, "투썸플레이스": 0.15}, "convenience": {"GS25": 0.5, "CU": 0.4},
          "dining": {"배달의민족": 0.3}, "onlineShopping": {"쿠팡": 0.6, "네이버페이": 0.2},
          "gas": {"SK에너지": 0.6, "GS칼텍스": 0.4}}
OWNED = [2686, 51, 13, 2235, 2330, 281]

# 1
t = time.time()
rows = json.loads(E.rank_json(json.dumps({"spending": SPEND})))["rows"]
errs = [r for r in rows if r.get("error")]
check(f"혜택 표 {len(rows)}장 계산 ({time.time() - t:.1f}초)", not errs, errs[:3])

# 2
t = time.time()
r = json.loads(E.recommend_json(json.dumps({"ids": OWNED, "spending": SPEND, "margin": 20000, "mode": "maxBenefit",
                                             "maxCards": 5, "brandShare": BRANDS, "withAlt": True})))
check(f"시나리오 추천 계산 ({r.get('elapsed')}초)", r["ok"], r.get("error", ""))
res = r["result"]
A2 = dict(A, user_brand_share=BRANDS)
direct = 0.0
for c in res["cards"]:
    rec = E.STATE["records"][c["sid"]]
    v = calc.evaluate(rec, {k: v for k, v in c["alloc"].items() if v > 0}, A2)["total"]
    direct += v - c["feeMonthly"]
    check(f"  {c['name']} 화면 값 = calc 직접 계산", abs(v - c["total"]) < 1, f"{c['total']} vs {v}")
    th = c["perf"]["threshold"] or 0
    check(f"  {c['name']} 실적 여유 2만원 지킴 (실적 {c['perf']['q']:,.0f}원, 기준 {th:,}원)", th == 0 or c["perf"]["q"] >= th + 20000 - 1)
check(f"조합 순혜택 = 카드별 합 ({res['net']:,.0f}원)", abs(direct - res["net"]) < 1)
nets = [b["net"] for b in r["bar"]]
check(f"카드 수 막대가 줄지 않음 {[round(n) for n in nets]}", all(nets[i] <= nets[i + 1] + 1 for i in range(len(nets) - 1)))
check("통신비·대중교통은 카드 1장에만", all(sum(1 for c in res["cards"] if c["alloc"].get(k)) <= 1 for k in ("mobile", "transport")))
check(f"시나리오 조합에 D4가 들어감 ({', '.join(c['name'] for c in res['cards'])})", 2686 in res["sids"])

# 3
ex = json.loads(E.explain_json(json.dumps({"ids": [2686, 51], "spending": SPEND, "margin": 20000, "brandShare": BRANDS})))
check(f"카드 바꿔보기: D4 + taptap O 월 {ex['result']['net']:,.0f}원", ex["ok"] and len(ex["result"]["cards"]) == 2)
br = json.loads(E.brands_json(json.dumps({"ids": OWNED})))
check(f"자주 가는 곳 브랜드 목록 {sorted(br['categories'])}", "cafe" in br["categories"])

# 4. 2026-10-06 점검에서 고친 것
ex3 = json.loads(E.explain_json(json.dumps({"ids": [2686, 51, 13], "spending": SPEND, "margin": 20000})))
kept = ex3["ok"] and 13 in ex3["result"]["sids"]
fee3 = sum(E._fee_m(E.STATE["records"][s]) for s in (2686, 51, 13))
check("카드 바꿔보기: 맡을 지출이 없는 카드도 조합에 남고 연회비가 계산됨", kept and abs(ex3["result"]["fee"] - fee3) < 1, ex3["result"]["sids"])
import random  # noqa: E402
random.seed(7)
bad = 0
for _ in range(3000):
    total = random.choice([7000, 18000, 50000, 123456, 999999])
    n = random.randint(2, 4)
    cuts = sorted(random.random() for _ in range(n - 1))
    parts = [(b - a) * total for a, b in zip([0] + cuts, cuts + [1])]
    for g in (10000, 5000, 1000):
        Y = E._round_grid({i: {"c": v} for i, v in enumerate(parts)}, {"c": total}, g)
        got = [y.get("c", 0) for y in Y.values()]
        if abs(sum(got) - total) > 1e-6 or min(got) < 0:
            bad += 1
check("배분 반올림: 카테고리 합계 유지, 음수 없음(무작위 9,000번)", bad == 0, bad)

# 5. 2026-10-31 명세서 결제 금액(tickets)으로 건당 조건 계산
At = E._A(None, {"cafe": [1800, 2400, 1800, 1800, 6400, 1400], "dining": [55000, 20000], "mobile": [60000] * 6})
n_real, _, _ = calc._txn_model(15600, "cafe", At, 0.5, 5000)
n_assumed, _, _ = calc._txn_model(15600, "cafe", E._A(None), 0.5, 5000)
check(f"건당 5천원 이상 카페 결제 수: 가정값 {n_assumed:.2f}건 → 명세서 {n_real:.2f}건(6건 중 6,400원 1건)",
      abs(n_real - 15600 / (15600 / 6) * (1 / 6)) < 1e-9 and n_assumed > n_real)
check("결제 5건 미만 카테고리는 평균만 바꾼다(외식 2건 평균 37,500원)",
      At["avg_ticket_won"]["dining"] == 37500 and "dining" not in At["user_tickets"])
check("한 달 한 번 결제 카테고리(통신비)는 명세서 금액을 쓰지 않는다", "mobile" not in At["user_tickets"])
Ac = E._A(None, {"cafe": [10000] * 5})
check("실제 금액 분포에도 건당 최대 혜택이 걸린다", calc._txn_model(50000, "cafe", Ac, 0.1, None, None, 500) == (5.0, 10000.0, 500.0))
# 실제 카드: 카페 업종 혜택에 건당 5천원 이상 조건이 있는 카드는, 카페 결제가 모두 2,400원 이하인 사람에게 혜택이 늘면 안 되고
# (월 한도에 걸리지 않은 카드는) 줄어야 한다. 다른 지출은 같고 카페 결제 금액만 다르다
probes = [sid for sid, rec in E.STATE["records"].items()
          if not rec["card"].get("discontinued") and any(
              (b.get("scope") or {}).get("app_category") == "cafe" and (b.get("scope") or {}).get("specificity") == "category"
              and ((b.get("conditions") or {}).get("min_txn_won") or 0) >= 5000 for b in rec["benefits"])]
small = {"cafe": [1800, 2400, 1800, 1800, 1400, 2000]}
sp = {"cafe": 60000, "etc": 400000}
r0 = {r["sid"]: r["total"] for r in json.loads(E.rank_json(json.dumps({"ids": probes, "spending": sp})))["rows"]}
r1 = {r["sid"]: r["total"] for r in json.loads(E.rank_json(json.dumps({"ids": probes, "spending": sp, "tickets": small})))["rows"]}
up = [s for s in probes if r1[s] > r0[s] + 0.5]
down = [s for s in probes if r1[s] < r0[s] - 0.5]
check(f"건당 5천원 이상 카페 혜택 카드 {len(probes)}장: 소액 결제만 하면 {len(down)}장 혜택 줄고 늘어난 카드 없음",
      probes and not up and down, [E.STATE["records"][s]["card"]["name"] for s in up])

# 6. 2026-11-01 명세서 경로: 요일 한정 혜택은 실제 요일 비중, 간편결제 비중은 가정 대신 0
Aw = E._A(None, {"cafe": [5000] * 5, "_wd:cafe": [10000, 0, 0, 0, 0, 0, 30000]})
check("주말 한정 혜택: 카페 결제 4만원 중 일요일 3만원 → 75%(가정값이면 2/7)",
      abs(calc.day_share_of({"days": "weekend"}, "cafe", Aw) - 0.75) < 1e-9 and abs(calc.day_share_of({"days": "weekend"}, "cafe", E._A(None)) - 2 / 7) < 1e-9)
check("특정 요일(월) 혜택: 명세서 요일 비중 25%", abs(calc.day_share_of({"days": "specific", "day_list": ["월"]}, "cafe", Aw) - 0.25) < 1e-9)
check("명세서에 없는 카테고리는 요일 가정값 그대로", abs(calc.day_share_of({"days": "weekday"}, "dining", Aw) - 5 / 7) < 1e-9)
check("명세서 경로: 간편결제로 결제하는 비중은 가정(30%) 대신 0", Aw["payment_method_share"]["default"] == 0 and E._A(None)["payment_method_share"]["default"] == 0.3)
wk = next((sid for sid, rec in E.STATE["records"].items() if not rec["card"].get("discontinued") and any(
    (b.get("scope") or {}).get("days") == "weekend" and (b.get("scope") or {}).get("app_category") == "dining" and (b.get("scope") or {}).get("specificity") == "category"
    for b in rec["benefits"])), None)
weekday_only = {"dining": [20000] * 10, "_wd:dining": [40000, 40000, 40000, 40000, 40000, 0, 0]}
rw0 = calc.evaluate(E.STATE["records"][wk], {"dining": 200000, "etc": 600000}, E._A(None, {"dining": [20000] * 10}))["total"]
rw1 = calc.evaluate(E.STATE["records"][wk], {"dining": 200000, "etc": 600000}, E._A(None, weekday_only))["total"]
check(f"주말 외식 혜택 카드({E.STATE['records'][wk]['card']['name']}): 평일에만 먹으면 {rw0:,.0f} → {rw1:,.0f}원", rw1 < rw0)

# 7. 2026-11-03 가맹점 비중표·계약이 필요한 혜택·정액 혜택 받을 확률
read = lambda p: open(os.path.join(ROOT, p), encoding="utf-8").read()  # noqa: E731
E.init_json(read("data/catalog/cards-benefit.json"), read("data/catalog/assumptions.json"),
            read("data/catalog/merchant-share.json"), read("data/catalog/benefit-conditions.json"))
R, A7 = E.STATE["records"], E._A(None)
ms = json.loads(read("data/catalog/merchant-share.json"))["categories"]
sh = calc.brand_shares([b for b in R[2997]["benefits"] if b["id"] == "s1b1"], A7)["s1b1"]
want = sum(ms["cafe"]["merchants"][m]["share"] for m in ("스타벅스", "커피빈", "이디야커피", "투썸플레이스", "메가MGC커피", "컴포즈커피"))
check(f"비중표: MOVING PLAY 커피 6사 혜택 비중 {sh:.3f} = 표 합 {want:.3f}(별칭 '이디야'·'메가커피' 포함, 예전 묶음 가정 70%)", abs(sh - want) < 1e-9)
check("비중표: 표에 없는 가맹점·이름 빈칸 혜택은 꼬리 값(CJ 외식 할인 1%도 안 됨)",
      calc.brand_shares([b for b in R[1286]["benefits"] if b["id"] == "s2b1_1"], A7)["s2b1_1"] == ms["dining"]["tail"]["mid"])
two = [{"id": i, "scope": {"region": "domestic", "specificity": "brand", "app_category": "convenience", "merchants": ["GS25"], "channel": "any"}}
       for i in ("a", "b")]
s2 = calc.brand_shares(two, A7)
check("비중표: 같은 가맹점을 노리는 독점 혜택 둘은 그 가맹점 몫을 나눠 가짐", abs(s2["a"] + s2["b"] - ms["convenience"]["merchants"]["GS25"]["share"]) < 1e-9)
ub = calc.brand_shares(two, E._A({"convenience": {"GS25": 0.7}}))
check("비중표: 사용자가 브랜드를 고른 카테고리는 입력값(합 1 넘으면 1로)", abs(ub["a"] + ub["b"] - 1.0) < 1e-9)
sp7 = {"bills": 1000, "etc": 400000}
check("계약 혜택: 보험엔로카 보험 혜택은 계약이 있다고 안 하면 0원(예전: 생활요금 1,000원에도 월 26,000원)",
      calc.evaluate(R[2659], sp7, A7)["total"] == 0)
# 생활요금 1,000원이면 정액은 대상 결제 1,000원까지로 잘리므로(11-04) 보험료가 들어갈 만큼 생활요금을 둔다
check("계약 혜택: 보험이 있다고 하면 다시 계산", calc.evaluate(R[2659], dict(sp7, bills=100000), E._A(None, None, ["insurance"]))["by_benefit"].get("s3b1") == 13000)
mob = next(b for b in R[343]["benefits"] if b["id"] == "s5b1")
check("정액 혜택: 통신요금 5만원 이상 조건은 통신비 3만원이면 0, 6만원이면 1",
      calc.period_prob(mob, ["mobile"], {"mobile": 30000}, A7, 1.0, False) == 0 and calc.period_prob(mob, ["mobile"], {"mobile": 60000}, A7, 1.0, False) == 1)
kk = next(b for b in R[2822]["benefits"] if b["id"] == "s1b1")
A7r = E._A({"bills": {}}, None, ["rental"])
check("정액 혜택: 브랜드 '없음'을 고르면 렌탈 계약이 있어도 0(calc)", calc.evaluate(R[2822], {"bills": 100000, "etc": 400000}, A7r)["total"] == 0)
r7 = json.loads(E.recommend_json(json.dumps({"ids": [2822], "spending": {"bills": 100000, "etc": 400000}, "margin": 0, "maxCards": 1,
                                             "brandShare": {"bills": {}}, "contracts": ["rental"], "withAlt": False})))
check("정액 혜택: 브랜드 '없음'이면 MILP도 0(예전: MILP만 26,000원)", all(c["total"] == 0 for c in r7["result"]["cards"]))
r7 = json.loads(E.recommend_json(json.dumps({"ids": OWNED, "spending": SPEND, "margin": 20000, "maxCards": 3, "withAlt": False})))
d7 = sum(calc.evaluate(R[c["sid"]], {k: v for k, v in c["alloc"].items() if v > 0}, A7)["total"] - c["feeMonthly"] for c in r7["result"]["cards"])
check(f"비중표 켠 추천: 조합 순혜택 = calc 직접 계산 ({r7['result']['net']:,.0f}원)", abs(d7 - r7["result"]["net"]) < 1)

# 8. 2026-11-03 C1: 좁은 업종 혜택은 카테고리 지출 중 덮는 비중만(benefit-coverage.json)
E.init_json(read("data/catalog/cards-benefit.json"), read("data/catalog/assumptions.json"), read("data/catalog/merchant-share.json"),
            read("data/catalog/benefit-conditions.json"), read("data/catalog/benefit-coverage.json"))
R, A8 = E.STATE["records"], E._A(None)
cov = json.loads(read("data/catalog/benefit-coverage.json"))["benefits"]
ev = next(b for b in R[2998]["benefits"] if b["id"] == "s2b6")
check(f"C1: MOVING LIFE 'EV충전'은 주유 지출의 {cov['2998']['s2b6']['coverage']:.0%}만 대상(예전 100%)",
      calc._elig_share(ev["scope"], A8)[0] == cov["2998"]["s2b6"]["coverage"] and not calc.splits_spend(ev))
r8 = json.loads(E.recommend_json(json.dumps({"ids": [2998, 2616, 2686, 51], "spending": {"gas": 150000, "dining": 200000, "etc": 300000},
                                             "margin": 20000, "maxCards": 3, "withAlt": False})))
d8 = sum(calc.evaluate(R[c["sid"]], {k: v for k, v in c["alloc"].items() if v > 0}, A8)["total"] - c["feeMonthly"] for c in r8["result"]["cards"])
check(f"C1 켠 추천: 조합 순혜택 = calc 직접 계산 ({r8['result']['net']:,.0f}원)", abs(d8 - r8["result"]["net"]) < 1)

# 9. 2026-11-03 마지막 국소 탐색(1장 바꾸기·더하기, 평가 횟수 상한)
sp9 = {"mart": 200000, "education": 150000, "dining": 100000, "onlineShopping": 120000, "gas": 80000, "mobile": 70000,
       "bills": 80000, "medical": 50000, "household": 50000, "department": 40000, "etc": 60000}
pool9 = [s for s, st in E.STATE["status"].items() if st == "extracted"]


def rec9(**kw):
    E._SEED.clear()
    return json.loads(E.recommend_json(json.dumps({"ids": pool9, "spending": sp9, "margin": 20000, "maxCards": 3, "withAlt": False, **kw})))


off, on, on2 = rec9(localSearch=False), rec9(), rec9()
check(f"국소 탐색: 순혜택이 줄지 않음 {off['result']['net']:,.0f} → {on['result']['net']:,.0f}원(평가 {on['lsEvals']}번 ≤ {E.LS_EVALS})",
      on["result"]["net"] >= off["result"]["net"] - 1 and on["lsEvals"] <= E.LS_EVALS)
check("국소 탐색: 같은 입력이면 같은 조합·금액(평가 횟수로 끊음)", on["result"]["sids"] == on2["result"]["sids"] and abs(on["result"]["net"] - on2["result"]["net"]) < 1)
d9 = sum(calc.evaluate(R[c["sid"]], {k: v for k, v in c["alloc"].items() if v > 0}, A8)["total"] - c["feeMonthly"] for c in on["result"]["cards"])
check("국소 탐색: 화면 순혜택 = calc 직접 계산", abs(d9 - on["result"]["net"]) < 1)
nets9 = [b["net"] for b in on["bar"]]
check(f"국소 탐색: 카드 수 막대가 줄지 않음 {[round(n) for n in nets9]}", all(nets9[i] <= nets9[i + 1] + 1 for i in range(len(nets9) - 1)))
quick = rec9(kLimit=2)
check("국소 탐색: 빠른 첫 결과(kLimit)에는 돌지 않음", quick.get("lsEvals") is None)
cap = rec9(feeCap=20000)
check(f"국소 탐색: 연회비 상한(연 2만원)을 지킴({sum(c['feeMonthly'] for c in cap['result']['cards']) * 12:,.0f}원)",
      sum(c["feeMonthly"] for c in cap["result"]["cards"]) * 12 <= 20000 + 1)

# 10. 2026-11-04 정액 혜택: '일 N원'은 이용 일수만큼, 정액은 대상 결제보다 크지 않게
sp10 = {"transport": 30000, "dining": 400000, "mart": 200000}
bbig = calc.evaluate(R[10], sp10, A8)["by_benefit"]["s1b1"]
bbig2 = calc.evaluate(R[10], dict(sp10, transport=120000), A8)["by_benefit"]["s1b1"]
check(f"정액 혜택: B.Big 교통 일 할인은 교통비 3만원이면 이용 10일만큼 {bbig:,.0f}원(예전: 30일치 12,000원), 12만원이면 {bbig2:,.0f}원",
      bbig <= 600 * 30000 / 1500 / 2 + 1 and bbig2 > bbig)
tiny = {"card": {"name": "정액 시험"}, "performance": {"basis": "none", "tiers": [], "excluded_app_categories": []}, "benefits": [
    {"id": "m", "scope": {"region": "domestic", "specificity": "category", "app_category": "mobile", "channel": "any", "merchants": []},
     "reward": {"kind": "discount", "type": "won_per_period", "value_by_tier": [{"tier": None, "value": 5000}], "period_of_reward": "month"},
     "conditions": {"tier_set": "none"}, "caps": [], "shared_cap_ids": []}], "shared_caps": []}
check("정액 혜택: 월 5천원 할인도 통신비가 3천원이면 3천원까지", abs(calc.evaluate(tiny, {"mobile": 3000}, A8)["total"] - 3000) < 1e-6)
E._SEED.clear()
r10 = json.loads(E.recommend_json(json.dumps({"ids": [10], "spending": sp10, "margin": 0, "maxCards": 1, "withAlt": False})))
d10 = sum(calc.evaluate(R[c["sid"]], {k: v for k, v in c["alloc"].items() if v > 0}, A8)["total"] - c["feeMonthly"] for c in r10["result"]["cards"])
check(f"정액 혜택: MILP도 같은 규칙(화면 순혜택 {r10['result']['net']:,.0f}원 = calc)", abs(d10 - r10["result"]["net"]) < 1)

yb = lambda m: calc.evaluate(R[2596], {"etc": m}, A8)["by_benefit"].get("s1b3", 0)  # noqa: E731
check(f"정액 혜택: 2596 '연 1,500만원 이상 시 2만원'은 월 100만원(연 1,200만)이면 0, 월 130만원이면 월 환산 {yb(1300000):,.0f}원",
      yb(1000000) == 0 and abs(yb(1300000) - 20000 / 12) < 1)

# 11. 2026-11-04 통신사·기후동행 전용 혜택: 답이 없으면 그 답일 확률만큼, 답하면 맞을 때만 전액
E.init_json(read("data/catalog/cards-benefit.json"), read("data/catalog/assumptions.json"), read("data/catalog/merchant-share.json"),
            read("data/catalog/benefit-conditions.json"), read("data/catalog/benefit-coverage.json"))
R = E.STATE["records"]
sp11 = {"mobile": 60000, "etc": 500000}
kt = lambda ch: calc.evaluate(R[2484], sp11, E._A(None, None, None, ch))["total"]  # noqa: E731  KT 통신요금 청구할인
share_kt = json.loads(read("data/catalog/benefit-conditions.json"))["choices"]["telecom"]["options"]["kt"]["share"]
check(f"통신사 전용: KT 할인은 답이 없으면 KT 점유율 {share_kt:.1%}만큼({kt(None):,.0f}원), KT면 {kt({'telecom': 'kt'}):,.0f}원, SKT면 0",
      abs(kt(None) - kt({"telecom": "kt"}) * share_kt) < 1 and kt({"telecom": "skt"}) == 0)
for ch in (None, {"telecom": "mvno"}):
    E._SEED.clear()
    r11 = json.loads(E.recommend_json(json.dumps({"ids": [2467, 2484], "spending": sp11, "margin": 0, "maxCards": 2, "withAlt": False, "choices": ch})))
    d11 = sum(calc.evaluate(R[c["sid"]], {k: v for k, v in c["alloc"].items() if v > 0}, E._A(None, None, None, ch))["total"] - c["feeMonthly"]
              for c in r11["result"]["cards"])
    check(f"통신사 전용: MILP도 같은 확률({ch}, 화면 {r11['result']['net']:,.0f}원 = calc)", abs(d11 - r11["result"]["net"]) < 1)

# 12. 2026-11-04 '자주 가는 곳' 다른 곳 찾기 후보 정리: 업종 이름·문구·장소 한정은 빼고, 비중표·카드 2장 이상·가진 카드만
pool12 = [s for s, st in E.STATE["status"].items() if st == "extracted"]
br = json.loads(E.brands_json(json.dumps({"ids": pool12})))["categories"]
names12 = {r["name"] for rows in br.values() for r in rows}
check(f"후보 정리: 스타벅스·쿠팡은 남고 '헬스장'·'○○ 내 이용금액'·홈경기는 빠짐(카페 {len(br['cafe'])}곳, 온라인쇼핑 {len(br['onlineShopping'])}곳)",
      {"스타벅스", "쿠팡"} <= names12 and not any(n in names12 for n in ("헬스장", "현대백화점그룹 내 이용금액")) and not any("홈경기" in n for n in names12))
solo = [(s, m) for s in pool12 for b in R[s]["benefits"] if b.get("status", "auto") == "auto" and b["scope"].get("specificity") == "brand"
        and b["scope"].get("app_category") == "cafe" for m in b["scope"].get("merchants", []) if m == "팔공티"]
if solo:
    s12 = solo[0][0]
    with_own = {r["name"] for r in json.loads(E.brands_json(json.dumps({"ids": pool12, "own": [s12]})))["categories"]["cafe"]}
    check("후보 정리: 카드 1장에만 나오는 가게(팔공티)는 그 카드를 가졌을 때만 후보", ("팔공티" in with_own) and ("팔공티" not in {r["name"] for r in br["cafe"]}))
lg = next(b for b in R[1003]["benefits"] if b["id"] == "s8b1")
check("장소 한정: LG트윈스 홈경기 할인은 계산하지 않는 혜택", lg.get("status") == "no_calc")

# 13. 2026-11-05 엔진 버그(검증 보고서 가 2·3·4)와 리터당 상한(나 9)
sp13 = {"cafe": 100000, "convenience": 50000, "onlineShopping": 150000, "etc": 200000}
A13 = E._A(None)
idle = next(s for s in pool12 if milp.annual_fee(R[s]) >= 30000 and calc.evaluate(R[s], sp13, A13)["total"] == 0)
E._SEED.clear()
r13 = json.loads(E.recommend_json(json.dumps({"ids": [idle, 2929, 819, 2997], "spending": sp13, "margin": 20000, "maxCards": 3,
                                              "fixed": [idle], "withAlt": False})))
sids13 = r13["result"]["sids"]
fee13 = sum(c["feeMonthly"] for c in r13["result"]["cards"])
check(f"내 카드: 지출을 안 맡아도 결과에 남고 연회비가 빠짐({idle}, 연 {milp.annual_fee(R[idle]):,}원)",
      idle in sids13 and abs(fee13 - sum(milp.annual_fee(R[s]) / 12 for s in sids13)) < 1
      and all(b["net"] <= r13["result"]["net"] + 1 for b in r13["bar"] if b["k"] == r13["k"]))
bars = [b["net"] for b in r13["bar"]]
check("카드 수 막대가 장수가 늘며 줄지 않음", all(bars[i] >= bars[i - 1] - 1 for i in range(1, len(bars))), str(bars))
E._SEED.clear()
r13b = json.loads(E.recommend_json(json.dumps({"ids": [2929, 819, 2997, 591], "spending": sp13, "margin": 0, "maxCards": 2,
                                               "fixed": [2929, 819, 2997], "withAlt": False})))
check("모순 입력: 내 카드 3장 + 상한 2장이면 3장으로 계산", r13b.get("ok") and set(r13b["result"]["sids"]) >= {2929, 819, 2997})
fees = sum(milp.annual_fee(R[s]) for s in (2929, 819, 2997))
r13c = json.loads(E.recommend_json(json.dumps({"ids": [2929, 819, 2997, 591, idle], "spending": sp13, "margin": 0, "maxCards": 3,
                                               "fixed": [idle], "feeCap": milp.annual_fee(R[idle]) - 1, "withAlt": False})))
check("모순 입력: 내 카드 연회비가 상한보다 크면 이유를 알려 줌", not r13c.get("ok") and "연회비" in r13c.get("error", ""), r13c.get("error", ""))
gas = next(b for b in R[2]["benefits"] if b["reward"]["type"] == "won_per_liter" and (b.get("conditions") or {}).get("max_counted_txn_won"))
sp13g = {"gas": 400000, "etc": 300000}
got = calc.evaluate(R[2], sp13g, A13)["by_benefit"].get(gas["id"], 0)
naive = 400000 * calc._elig_share(gas["scope"], A13)[0] / A13["fuel_price_won_per_liter"] * gas["reward"]["value_by_tier"][0]["value"]
check(f"리터당: 건당 {gas['conditions']['max_counted_txn_won']:,}원 상한을 환산 전에 적용({got:,.0f}원 < 상한 무시 {naive:,.0f}원)", 0 < got < naive)
E._SEED.clear()
r13g = json.loads(E.recommend_json(json.dumps({"ids": [2], "spending": sp13g, "margin": 0, "maxCards": 1, "withAlt": False})))
d13 = calc.evaluate(R[2], {k: v for k, v in r13g["result"]["cards"][0]["alloc"].items() if v > 0}, A13)["total"] - r13g["result"]["cards"][0]["feeMonthly"]
check("리터당: MILP로 고른 값 = calc", abs(d13 - r13g["result"]["net"]) < 1)

print(f"\n{ok}/{ok + fail} 통과")
sys.exit(1 if fail else 0)
