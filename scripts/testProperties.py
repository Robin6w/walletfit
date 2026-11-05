"""
추천 엔진 성질 시험(property test). 실행(저장소 루트에서):
    python scripts/testProperties.py                 짧은 모드: 몇십 건, 1분 안(CI용)
    python scripts/testProperties.py long            긴 모드: 수백 건, 수 분
    python scripts/testProperties.py long --seed 5   시드 바꾸기(기본 20261105)
    python scripts/testProperties.py --report out.md 깨진 사례를 파일로도 남김

무작위 카드·무작위 지출로 엔진이 늘 지켜야 할 성질이 깨지는지 확인한다(시드 고정이라 같은 명령은 같은 결과).
깨진 성질은 고치지 않고 사례(카드 번호·지출·숫자)를 그대로 보여 준다. 고칠지는 사람이 정한다.

 P1 카드 한 장(calc): 한 카테고리 지출을 늘리면 그 카드 혜택 합이 줄지 않는다(전월실적 구간이 바뀌면 늘어나는 게 정상)
 P2 calc 금액은 0 이상, NaN·무한대·예외 없음(혜택 표 1,554장 전부, 지출 몇 가지)
 P3 추천: 장수 상한을 늘리면 순혜택이 줄지 않는다(막대 단조), 화면 순혜택 = calc 다시 계산(1원 이내)
 P4 내 카드(fixed)를 넣으면 결과에 그 카드가 있고 연회비가 빠진다
 P5 의심 혜택 비율 1.0이면 0.8일 때보다 조합의 calc 순혜택이 낮지 않다(고를 때만 깎으므로)
"""
import json, math, os, random, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "src/domain/engine/py"))
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass
import calc  # noqa: E402
import milp  # noqa: E402
import wf_engine as E  # noqa: E402

args = sys.argv[1:]
LONG = "long" in args


def opt(name, default):
    return args[args.index(name) + 1] if name in args else default


SEED = int(opt("--seed", 20261105))
REPORT = opt("--report", None)
# 모드별 건수: (P1 카드 수, P1 카드당 변경 수, P2 지출 종류 수, P3 사례 수, P4 사례 수, P5 사례 수)
N = {"short": (60, 3, 2, 6, 6, 4), "long": (400, 6, 6, 20, 30, 30)}["long" if LONG else "short"]

read = lambda p: open(os.path.join(ROOT, p), encoding="utf-8").read()  # noqa: E731
E.init_json(read("data/catalog/cards-benefit.json"), read("data/catalog/assumptions.json"), read("data/catalog/merchant-share.json"),
            read("data/catalog/benefit-conditions.json"), read("data/catalog/benefit-coverage.json"))
R = E.STATE["records"]
CATS = [c["id"] for c in json.load(open(os.path.join(ROOT, "data/categories.json"), encoding="utf-8"))]
ISSUED = sorted(s for s, r in R.items() if not r["card"].get("discontinued"))
A0 = E._A(None)
F0 = E.STATE["A"].get("suspect_discount", {}).get("factor", 1.0)

rng = random.Random(SEED)
fails = []  # (성질, 설명, 사례)
counts = {}


def record(prop, ok, desc, case, active=True):
    """active: 혜택이 0원이라 뻔히 통과하는 건이 아닌지(통과 건수가 의미 있는지 보려고 센다)"""
    counts.setdefault(prop, [0, 0, 0])
    counts[prop][0] += 1
    counts[prop][2] += bool(active)
    if not ok:
        counts[prop][1] += 1
        fails.append((prop, desc, case))


def rand_spend(lo_n=3, hi_n=8):
    """카테고리 3~8개, 월 합계 30만~150만원쯤. 천 원 단위"""
    cats = rng.sample(CATS, rng.randint(lo_n, hi_n))
    total = rng.choice([300000, 500000, 835000, 1000000, 1500000])
    w = [rng.random() + 0.1 for _ in cats]
    return {c: max(1000, round(total * x / sum(w), -3)) for c, x in zip(cats, w)}


def calc_net(sid, alloc, A=A0):
    sp = {k: v for k, v in alloc.items() if v > 0}
    return (calc.evaluate(R[sid], sp, A)["total"] if sp else 0.0) - E._fee_m(R[sid])


def screen_vs_calc(res, A=A0):
    """화면 순혜택과 calc 다시 계산한 값(카드별 합 - 연회비)"""
    return sum(calc_net(c["sid"], c["alloc"], A) for c in res["cards"])


def fresh_recommend(pool, spend, **kw):
    E._SEED.clear()
    p = {"ids": pool, "spending": spend, "margin": 0, "maxCards": 3, "withAlt": False, **kw}
    return json.loads(E.recommend_json(json.dumps(p)))


def rand_pool(lo=8, hi=30):
    return rng.sample(ISSUED, rng.randint(lo, hi))


T0 = time.time()

# ---- P1: 지출을 늘리면 카드 혜택 합이 줄지 않는다
t = time.time()
for sid in rng.sample(ISSUED, min(N[0], len(ISSUED))):
    base = rand_spend()
    b0 = calc.evaluate(R[sid], base, A0)["total"]
    for _ in range(N[1]):
        cat = rng.choice(CATS)
        more = dict(base)
        more[cat] = more.get(cat, 0) + rng.choice([10000, 50000, 100000, 300000, 1000000])
        b1 = calc.evaluate(R[sid], more, A0)["total"]
        record("P1", b1 >= b0 - 1e-6, f"카드 {sid} {R[sid]['card']['name']}: {cat} 지출 {base.get(cat, 0):,}→{more[cat]:,}원인데 혜택 {b0:,.1f}→{b1:,.1f}원",
               {"sid": sid, "cat": cat, "base": base, "more": more, "before": b0, "after": b1}, active=b1 > 0)
        base, b0 = more, b1  # 이어서 계속 늘려 본다
print(f"P1 {counts['P1'][0]}건 ({time.time() - t:.1f}초)")

# ---- P2: calc 금액은 0 이상, NaN·예외 없음(1,554장 전부)
t = time.time()
spends2 = [{"etc": 500000}, {c: 40000 for c in CATS}, rand_spend(1, 3)] + [rand_spend() for _ in range(max(0, N[2] - 3))]
spends2 = spends2[:N[2]]
for sid in sorted(R):
    for sp in spends2:
        try:
            r = calc.evaluate(R[sid], sp, A0)
            vals = [r["total"]] + list(r["by_benefit"].values())
            ok = all(isinstance(v, (int, float)) and math.isfinite(v) and v >= -1e-9 for v in vals)
            record("P2", ok, f"카드 {sid} {R[sid]['card']['name']}: 음수·NaN·무한대 금액 {[v for v in vals if not (math.isfinite(v) and v >= -1e-9)][:3]}",
                   {"sid": sid, "spend": sp}, active=r["total"] > 0)
        except Exception as e:  # noqa: BLE001
            record("P2", False, f"카드 {sid} {R[sid]['card']['name']}: 예외 {type(e).__name__}: {str(e)[:100]}", {"sid": sid, "spend": sp})
print(f"P2 {counts['P2'][0]}건 = {len(R)}장 × 지출 {len(spends2)}가지 ({time.time() - t:.1f}초)")

SUSPECT_CARDS = [s for s in ISSUED if any(b.get("suspect") for b in R[s]["benefits"])]


def sus_in(res):
    """조합이 받는 의심 혜택 금액(calc 그대로). 0이면 비율을 바꿔도 달라질 게 없는 건이다"""
    t = 0.0
    for c in res["cards"]:
        r = calc.evaluate(R[c["sid"]], {k: v for k, v in c["alloc"].items() if v > 0}, A0)
        t += sum(r["by_benefit"].get(b["id"], 0) for b in R[c["sid"]]["benefits"] if b.get("suspect"))
    return t


def with_factor(f, fn):
    E.STATE["A"].setdefault("suspect_discount", {})["factor"] = f
    try:
        return fn()
    finally:
        E.STATE["A"]["suspect_discount"]["factor"] = F0
        E._SEED.clear()



# ---- P3: 장수 상한을 늘리면 순혜택이 줄지 않고, 화면 순혜택 = calc 다시 계산
# 엔진은 조합을 '고르는 값'(실적 기준 + 여유, 의심 혜택 × 비율)으로 고르고 화면엔 calc 그대로를 보여 준다. 그래서
#  P3  (여유 0, 의심 비율 1.0): 고르는 값 = 화면 값이라 화면 순혜택과 막대가 장수에 따라 줄면 안 된다
#  P3m (여유 2만원, 기본 의심 비율): 고르는 값이 장수에 따라 줄면 안 된다. 화면 값은 줄 수 있어(설계상) 따로 센다


def select_net(res, margin):
    """엔진이 조합을 고를 때 쓰는 순혜택: 기준을 margin만큼 올린 카드로 calc, 의심 혜택은 비율을 곱해 깎는다"""
    f, t = E.suspect_factor(E.STATE["A"]), 0.0
    for c in res["cards"]:
        rec = E._raised(R[c["sid"]], margin)
        r = calc.evaluate(rec, {k: v for k, v in c["alloc"].items() if v > 0}, A0)
        t += r["total"] - (1 - f) * sum(r["by_benefit"].get(b["id"], 0) for b in rec["benefits"] if b.get("suspect")) - c["feeMonthly"]
    return t


t = time.time()
caps3 = (1, 2, 3, 4, 5) if LONG else (1, 2, 3)
screen_dips = []  # 화면 순혜택이 장수 상한을 올렸더니 줄어든 건(P3m에서만 설계상 나올 수 있음, 참고용)
for i in range(N[3]):
    strict = i % 2 == 0
    pool, sp, margin = rand_pool(), rand_spend(), (0 if strict else 20000)
    PR = "P3" if strict else "P3m"
    case = {"pool": pool, "spend": sp, "margin": margin, "suspectFactor": 1.0 if strict else F0}
    rs = []
    for mc in caps3:
        r = (with_factor(1.0, lambda: fresh_recommend(pool, sp, margin=margin, maxCards=mc)) if strict
             else fresh_recommend(pool, sp, margin=margin, maxCards=mc))
        if not r.get("ok") or r.get("empty"):
            continue
        rs.append((mc, r))
        net = r["result"]["net"]
        diff = abs(screen_vs_calc(r["result"]) - net)
        record(PR, diff < 1, f"화면 순혜택 {net:,.1f}원 ≠ calc 다시 계산 (차 {diff:,.1f}원, 상한 {mc}장)", dict(case, maxCards=mc), active=net > 0)
        if strict:
            bars = [b["net"] for b in r["bar"]]
            record(PR, all(bars[j] >= bars[j - 1] - 1 for j in range(1, len(bars))), f"막대가 장수가 늘며 줄어듦 {[round(x) for x in bars]}", dict(case, maxCards=mc))
    for (m1, r1), (m2, r2) in zip(rs, rs[1:]):
        n1, n2 = (r1["result"]["net"], r2["result"]["net"]) if strict else (select_net(r1["result"], margin), select_net(r2["result"], margin))
        record(PR, n2 >= n1 - 1, f"장수 상한 {m1}→{m2}장인데 {'순혜택' if strict else '고르는 값'} {n1:,.0f}→{n2:,.0f}원", dict(case, caps=[m1, m2], nets=[n1, n2]), active=n2 > 0)
        if not strict and r2["result"]["net"] < r1["result"]["net"] - 1:
            screen_dips.append((m1, m2, r1["result"]["net"], r2["result"]["net"], case))
print(f"P3 {sum(counts.get(k, [0])[0] for k in ('P3', 'P3m'))}건 ({time.time() - t:.1f}초)")

# ---- P4: 내 카드(fixed)는 결과에 남고 연회비가 빠진다
t = time.time()
fee_cards = [s for s in ISSUED if milp.annual_fee(R[s]) >= 10000]
for i in range(N[4]):
    pool, sp = rand_pool(), rand_spend()
    own = rng.sample(fee_cards, 1 if i % 2 == 0 else 2)  # 연회비가 있는 카드, 절반은 2장
    pool = list(dict.fromkeys(own + pool))
    mc = rng.choice([1, 2, 3])
    r = fresh_recommend(pool, sp, margin=rng.choice([0, 20000]), maxCards=mc, fixed=own)
    case = {"pool": pool, "spend": sp, "fixed": own, "maxCards": mc}
    if not r.get("ok"):
        record("P4", False, f"내 카드 {own}를 넣었더니 실패: {r.get('error')}", case)
        continue
    res = r["result"]
    sids = res["sids"]
    fee_want = sum(milp.annual_fee(R[s]) / 12 for s in sids)
    record("P4", set(own) <= set(sids), f"내 카드 {own}가 결과 {sids}에 없음", case)
    record("P4", abs(res["fee"] - fee_want) < 1 and abs(res["net"] - (res["total"] - res["fee"])) < 1,
           f"연회비 합 월 {res['fee']:,.0f}원 ≠ 조합 카드 연회비/12 {fee_want:,.0f}원", case)
    record("P4", abs(screen_vs_calc(res) - res["net"]) < 1, f"화면 순혜택 {res['net']:,.0f}원 ≠ calc 다시 계산", case)
    bars = [b["net"] for b in r["bar"]]
    record("P4", all(bars[j] >= bars[j - 1] - 1 for j in range(1, len(bars))), f"막대가 줄어듦 {[round(x) for x in bars]}", case)
print(f"P4 {counts['P4'][0]}건 ({time.time() - t:.1f}초)")

# ---- P5: 의심 혜택 비율 1.0은 0.8보다 calc 순혜택이 낮지 않다


t = time.time()
for _ in range(N[5]):
    # 의심 혜택이 있는 카드 3장과 그 혜택의 카테고리 지출을 넣어, 비율이 실제로 조합에 영향을 주게 한다
    sus_cards = rng.sample(SUSPECT_CARDS, 3)
    sus_cats = sorted({R[s]["benefits"][i]["scope"].get("app_category") for s in sus_cards for i, b in enumerate(R[s]["benefits"]) if b.get("suspect")} - {None})
    pool = list(dict.fromkeys(sus_cards + rand_pool(7, 30)))
    sp = rand_spend()
    for c in rng.sample(sus_cats, min(3, len(sus_cats))):
        sp[c] = sp.get(c, 0) + rng.choice([50000, 100000, 200000])
    mc, margin = rng.choice([2, 3]), rng.choice([0, 20000])
    r10 = with_factor(1.0, lambda: fresh_recommend(pool, sp, margin=margin, maxCards=mc))
    r08 = with_factor(0.8, lambda: fresh_recommend(pool, sp, margin=margin, maxCards=mc))
    if not (r10.get("ok") and r08.get("ok")) or r10.get("empty"):
        continue
    n10, n08 = screen_vs_calc(r10["result"]), screen_vs_calc(r08["result"])
    record("P5", n10 >= n08 - max(1, 0.005 * abs(n08)),  # 같은 조합에서 5천원 단위 배분 차이로 생기는 0.5% 안쪽 오차는 봐 준다
            f"비율 1.0 순혜택 {n10:,.0f}원 < 0.8 순혜택 {n08:,.0f}원 (조합 {r10['result']['sids']} vs {r08['result']['sids']})",
           {"pool": pool, "spend": sp, "margin": margin, "maxCards": mc, "n10": n10, "n08": n08,
            "sids10": r10["result"]["sids"], "sids08": r08["result"]["sids"]}, active=sus_in(r10["result"]) > 0)
print(f"P5 {counts['P5'][0]}건 ({time.time() - t:.1f}초)")

# ---- 결과
NAMES = {"P1": "지출 늘리면 혜택 안 줄어듦", "P2": "금액 0 이상·NaN 없음", "P3": "장수 상한 늘리면 안 줄어듦·화면=calc(여유 0, 의심 1.0)",
         "P3m": "장수 상한 늘리면 고르는 값 안 줄어듦(여유 2만원, 의심 0.8)", "P4": "내 카드 남고 연회비 빠짐", "P5": "의심 비율 1.0 ≥ 0.8"}
print(f"\n모드 {'긴' if LONG else '짧은'}, 시드 {SEED}, {time.time() - T0:.0f}초")
for k in sorted(counts):
    n, bad, act = counts[k]
    print(f"[{'통과' if not bad else '실패'}] {k} {NAMES[k]}: {n}건 중 {bad}건 깨짐(혜택이 있는 건 {act}건)")
if fails:
    print("\n--- 깨진 사례 ---")
    seen = {}
    for prop, desc, case in fails:
        seen[prop] = seen.get(prop, 0) + 1
        if seen[prop] <= 5:
            print(f"{prop}: {desc}")
    for p, c in seen.items():
        if c > 5:
            print(f"{p}: …외 {c - 5}건")
    if REPORT:
        with open(REPORT, "w", encoding="utf-8") as f:
            f.write(f"# 성질 시험 깨진 사례 (시드 {SEED}, {'긴' if LONG else '짧은'} 모드)\n\n")
            for prop, desc, case in fails:
                f.write(f"## {prop} {desc}\n\n```json\n{json.dumps(case, ensure_ascii=False)}\n```\n\n")
        print(f"사례 {len(fails)}건을 {REPORT}에 적었어요")
sys.exit(1 if fails else 0)
