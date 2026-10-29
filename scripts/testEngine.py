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

print(f"\n{ok}/{ok + fail} 통과")
sys.exit(1 if fail else 0)
