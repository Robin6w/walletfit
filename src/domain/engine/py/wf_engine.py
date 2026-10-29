"""
WalletFit 계산 엔진 어댑터 (Pyodide 워커와 테스트에서 같이 씁니다)

- 카드 데이터: data/catalog/cards-benefit.json (모든 카드의 혜택 표, 양식 v0.2.1)
- 조합 찾기: milp.py (추천 엔진 v2, 혜택 표를 그대로 읽는 MILP)
- 화면 숫자: calc.py (카드 한 장 계산기). MILP가 고른 배분을 calc로 다시 계산하고, 5천원 단위로 배분을 다듬는다.
  MILP 값과 calc 값이 다르면 화면에는 calc 값을 쓴다.

워커는 문자열(JSON)만 주고받는다: init_json / recommend_json / rank_json / brands_json / explain_json
"""
import itertools
import json, copy, math, time
import calc
import milp

WHOLE_CATS = ("mobile", "transport")  # 자동납부·후불교통은 카드 1장에만 등록되므로 나누지 않는다
SHORTLIST = 12                        # 후보가 이보다 많으면 카드 한 장 계산값으로 먼저 추린다
EFFICIENT_RELATIVE_CUTOFF = 0.3       # '효율적' 모드: 1등 카드 순혜택의 30% 미만을 버는 카드는 뺀다
MAX_BAR = 5                           # 카드 수 막대는 1~5장
# 3장 이상 MILP 시간 제한(초). 2026-10-29 측정: 지출 조건 11가지에서 5초와 2초의 결과 금액이 모두 같고
# 시간은 최대 15.1초 → 8.2초. 1초는 한 조건에서 20원 차이가 나서 2초로 둔다
K3_TIME_LIMIT = 2

STATE = {"records": {}, "status": {}, "A": None}


def init_json(catalog_text, assumptions_text):
    data = json.loads(catalog_text)
    STATE["records"] = {int(c["sid"]): c["record"] for c in data["cards"]}
    STATE["status"] = {int(c["sid"]): c["status"] for c in data["cards"]}
    STATE["A"] = json.loads(assumptions_text)
    return json.dumps({"cards": len(STATE["records"]), "counts": data.get("counts", {})})


# ---------- 공통 ----------

def _A(brand_share):
    A = copy.deepcopy(STATE["A"])
    if brand_share:
        A["user_brand_share"] = brand_share
    return A


def _raised(rec, margin):
    """실적 여유: 카드 구간 기준을 margin만큼 올린 레코드(고르기·다듬기용). 화면 숫자는 원래 레코드로 계산."""
    if not margin:
        return rec
    r = copy.deepcopy(rec)
    for t in r["performance"]["tiers"]:
        if t["min_won"] > 0:
            t["min_won"] += margin
        if t.get("max_won"):
            t["max_won"] += margin
    return r


def _fee_m(rec):
    return milp.annual_fee(rec) / 12.0


def _clean_spend(spending):
    return {c: float(v) for c, v in (spending or {}).items() if v and v > 0}


class Evaluator:
    """calc.evaluate 결과 캐시. 같은 (카드, 배분)은 한 번만 계산한다."""

    def __init__(self, recs, A):
        self.recs, self.A, self.memo = recs, A, {}

    def total(self, sid, alloc):
        sp = {c: v for c, v in alloc.items() if v > 0.5}
        if not sp:
            return 0.0
        key = (sid, tuple(sorted((c, int(round(v))) for c, v in sp.items())))
        if key not in self.memo:
            self.memo[key] = calc.evaluate(self.recs[sid], sp, self.A)["total"]
        return self.memo[key]


def _net_of(ev, X):
    return sum(ev.total(s, X[s]) - _fee_m(ev.recs[s]) for s in X if sum(X[s].values()) > 0.5)


def _round_grid(X, spending, grid=5000):
    """MILP 배분(예: 39,456원)을 grid 단위로 맞춘다. 카테고리 합계는 그대로, 음수 배분은 생기지 않는다.
    단위 개수를 내림으로 나눈 뒤 남는 단위를 소수점이 큰 카드부터 하나씩 준다(최대 나머지 방식).
    grid로 나누어떨어지지 않는 나머지(예: 3천원)는 가장 많이 맡은 카드에 더한다."""
    for c, total in spending.items():
        holders = [s for s in X if X[s].get(c, 0) > 0.5]
        if len(holders) <= 1:
            continue
        units = int(total // grid)
        raw = {s: X[s][c] / grid for s in holders}
        base = {s: int(math.floor(raw[s])) for s in holders}
        left = units - sum(base.values())
        for s in sorted(holders, key=lambda s: raw[s] - base[s], reverse=True)[:max(0, left)]:
            base[s] += 1
        for s in holders:
            X[s][c] = base[s] * grid
        big = max(holders, key=lambda s: X[s][c])
        X[big][c] += total - units * grid
        for s in holders:
            if X[s][c] <= 0.5:
                X[s].pop(c, None)
    return X


def _polish(ev, X, spending, steps=(50000, 20000, 10000, 5000), budget_s=6.0):
    """calc 값을 목적함수로 배분을 다듬는다(국소 탐색). 통신비·대중교통은 통째로만 옮긴다."""
    t0 = time.time()
    sids = list(X)
    if len(sids) < 2:
        return X
    cur = _net_of(ev, X)
    improved = True
    while improved and time.time() - t0 < budget_s:
        improved = False
        best = (0.5, None)
        for c in spending:
            for s1 in sids:
                have = X[s1].get(c, 0)
                if have <= 0.5:
                    continue
                for s2 in sids:
                    if s2 == s1:
                        continue
                    amounts = [have] if c in WHOLE_CATS else sorted({min(st, have) for st in steps}, reverse=True)
                    for amt in amounts:
                        a1, a2 = dict(X[s1]), dict(X[s2])
                        a1[c] = have - amt
                        a2[c] = a2.get(c, 0) + amt
                        if a1[c] <= 0.5:
                            a1.pop(c)
                        old = sum(ev.total(s, X[s]) - (_fee_m(ev.recs[s]) if sum(X[s].values()) > 0.5 else 0) for s in (s1, s2))
                        new = sum(ev.total(s, a) - (_fee_m(ev.recs[s]) if sum(a.values()) > 0.5 else 0) for s, a in ((s1, a1), (s2, a2)))
                        if new - old > best[0]:
                            best = (new - old, (s1, s2, a1, a2))
        if best[1]:
            s1, s2, a1, a2 = best[1]
            X[s1], X[s2] = a1, a2
            cur += best[0]
            improved = True
    return X


SPLIT_MAX_POOL = 8                    # 후보가 이 이하면 카테고리를 나눠 결제하는 모드로 푼다(느리지만 더 좋은 해)


def _refine(ev, X, spending, budget_s=3.0):
    """MILP 배분을 사람이 따라 하기 쉬운 단위로 맞춘다. 단위를 맞추다 순혜택이 눈에 띄게 줄면 더 작은 단위를 쓴다."""
    base = copy.deepcopy(X)
    v_raw = _net_of(ev, base)
    tol = max(300.0, abs(v_raw) * 0.01)
    best_X, best_v = base, v_raw
    for grid in (10000, 5000, 1000):
        Xg = _round_grid(copy.deepcopy(base), spending, grid)
        Xg = _polish(ev, Xg, spending, steps=tuple(st for st in (50000, 20000, 10000, 5000, 1000) if st >= grid), budget_s=budget_s / 3)
        v = _net_of(ev, Xg)
        if v >= v_raw - tol:
            return Xg
        if v > best_v:
            best_X, best_v = Xg, v
    return best_X


def _solve_k(recs_sel, spending, A, K, fee_cap=None, fixed=(), lb=None, time_limit=10):
    split = len(recs_sel) <= SPLIT_MAX_POOL
    res = milp.solve(recs_sel, spending, A, K=K, split=split, whole_cats=WHOLE_CATS, time_limit=time_limit,
                     lb=lb, fee_cap=fee_cap, fixed=fixed)
    if not res.get("cards"):
        return None, res.get("objective")
    X = {c["sid"]: {k: float(v) for k, v in c["assign"].items() if v > 0.5} for c in res["cards"]}
    return X, res.get("objective")


def _shortlist(ids, spending, A, margin, fixed=()):
    """후보가 많으면 카드 한 장에 지출 전부를 냈을 때의 순혜택과 카테고리별 혜택으로 추린다."""
    if len(ids) <= SHORTLIST:
        return list(ids)
    rows = []
    for sid in ids:
        rec = _raised(STATE["records"][sid], margin)
        try:
            r = calc.evaluate(rec, spending, A)
        except Exception:
            continue
        by_cat = {}
        for b in rec["benefits"]:
            v = r["by_benefit"].get(b["id"], 0)
            cat = (b.get("scope") or {}).get("app_category") or "all"
            by_cat[cat] = by_cat.get(cat, 0) + v
        rows.append((sid, r["total"] - _fee_m(rec), by_cat))
    keep = [s for s, _, _ in sorted(rows, key=lambda x: -x[1])[:8]]
    for c in spending:
        for s, _, bc in sorted(rows, key=lambda x: -x[2].get(c, 0))[:2]:
            if s not in keep and rows and dict((r[0], r[2]) for r in rows)[s].get(c, 0) > 0:
                keep.append(s)
    for s in fixed:
        if s not in keep:
            keep.append(s)
    return keep[:SHORTLIST + len(fixed)]


def _card_view(sid, alloc, A, margin, ev_total):
    """화면용 카드 한 장: calc 과정 기록(trace)과 혜택 표의 원문 문장."""
    rec = STATE["records"][sid]
    t, log = {}, []
    sp = {c: v for c, v in alloc.items() if v > 0.5}
    r = calc.evaluate(rec, sp, A, log=log, trace=t) if sp else {"total": 0.0, "options": [], "flags": []}
    perf = rec["performance"]
    tiers = [{"id": x["id"], "min": x["min_won"], "max": x.get("max_won")} for x in perf.get("tiers", [])]
    tier_now = (t.get("tiers") or {}).get("card")
    titles = {b["id"]: b for b in rec["benefits"]}
    benefits = []
    for bid, tb in (t.get("benefits") or {}).items():
        b = titles.get(bid, {})
        caps = [{"period": c.get("period"), "amount": c.get("amount"), "monthly": c.get("monthly"), "hit": c.get("hit")} for c in tb.get("own_caps", [])]
        benefits.append({
            "id": bid, "title": b.get("title", bid), "category": (b.get("scope") or {}).get("app_category"),
            "specificity": (b.get("scope") or {}).get("specificity"), "merchants": (b.get("scope") or {}).get("merchants", [])[:6],
            "kind": tb.get("kind"), "type": tb.get("type"), "value": tb.get("value"),
            "cats": [{"cat": c["cat"], "spend": c["spend"], "share": c["share"] * c.get("scale", 1) * c.get("day_share", 1), "target": c.get("target", 0)} for c in tb.get("cats", [])],
            "raw": tb.get("raw", 0.0), "afterOwn": tb.get("after_own_cap", 0.0), "caps": caps,
            "final": (t.get("final") or {}).get(bid, 0.0), "skip": tb.get("skip"),
            "quote": (b.get("source_quote") or "")[:400],
            # 이 혜택이 속한 묶음 한도(shared_caps) id — 2026-10-28 v2 화면의 '묶음 한도 1만원' 표시용
            "sharedIds": b.get("shared_cap_ids") or [],
            # 혜택 표 원문 조건(카드 비교 화면용, 2026-10-29). 계산에는 쓰지 않고 그대로 옮긴다
            "region": (b.get("scope") or {}).get("region"),
            "channel": (b.get("scope") or {}).get("channel"),
            "condition": (b.get("scope") or {}).get("payment_condition"),
            "perTxnCap": (b.get("conditions") or {}).get("max_benefit_per_txn_won"),
            "minTxn": (b.get("conditions") or {}).get("min_txn_won"),
            "countLimits": (b.get("conditions") or {}).get("count_limits"),
            "appliesInTiers": (b.get("conditions") or {}).get("applies_in_tiers"),
            "valueTiers": [{"tier": v.get("tier"), "value": v.get("value")} for v in ((b.get("reward") or {}).get("value_by_tier") or [])],
            "capTiers": [{"period": c.get("period"), "tiers": [{"tier": x.get("tier"), "amount": x.get("amount_won")} for x in (c.get("by_tier") or [])]}
                         for c in (b.get("caps") or [])],
        })
    benefits.sort(key=lambda x: -x["final"])
    choice = t.get("choice")
    groups = rec.get("choice_groups", [])
    opt_titles = {o["id"]: o.get("label") or o.get("title") or o["id"] for g in groups for o in g["options"]}
    threshold = None
    if tier_now:
        threshold = next((x["min"] for x in tiers if x["id"] == tier_now), None)
    elif tiers:
        threshold = tiers[0]["min"]
    return {
        "sid": sid, "name": rec["card"]["name"], "issuer": rec["card"]["issuer"], "status": STATE["status"].get(sid, "auto"),
        "annualFee": milp.annual_fee(rec), "feeMonthly": _fee_m(rec), "alloc": {c: round(v) for c, v in sp.items()},
        "pay": round(sum(sp.values())), "total": r["total"], "net": r["total"] - _fee_m(rec),
        "options": [{"id": o, "label": opt_titles.get(o, o)} for o in (r.get("options") or [])],
        "choiceAll": [{"ids": k.split(","), "label": " + ".join(opt_titles.get(i, i) for i in k.split(",")), "total": v} for k, v in (choice or {}).get("all", {}).items()],
        "perf": {"basis": perf.get("basis"), "tiers": tiers, "tier": tier_now, "threshold": threshold, "margin": margin,
                 "qRaw": t.get("q_raw", 0.0), "q": t.get("q", 0.0), "excluded": t.get("excluded", []),
                 "excludesDiscounted": bool(perf.get("excludes_discounted_spend")),
                 # 원문 조건(카드 비교 화면용, 2026-10-29): 실적 제외 항목, 실적 제외 카테고리, 신규 발급 유예
                 "excludedItems": perf.get("excluded_items") or [], "excludedCats": perf.get("excluded_app_categories") or [],
                 "grace": perf.get("new_card_grace")},
        "cardType": rec["card"].get("card_type"),
        "benefits": benefits,
        "shared": [{"id": s["id"], "label": s["label"], "sum": s["sum"], "cap": s["cap"], "factor": s["factor"]} for s in t.get("shared", [])],
        "flags": r.get("flags", []), "log": log[-60:],
        "url": (rec.get("source") or {}).get("url"),
        # 선택형 혜택 그룹(패키지 등). auto=카드사가 이용금액으로 자동 적용(사용자가 바꿀 일 없음) — 2026-10-28 v2 화면용
        "choiceGroups": [{"id": g.get("id"), "label": g.get("label"), "rule": g.get("change_rule"), "auto": _choice_auto(g.get("change_rule"))} for g in groups],
    }


def _choice_auto(rule):
    """혜택 표 change_rule 문구로 자동 적용 여부를 판단한다('자동 적용/선정/결정'이고 '변경 신청'이 없으면 자동)."""
    return bool(rule) and ("자동" in rule) and ("변경 신청" not in rule)


def _pack(X, A, margin, keep=()):
    """keep: 맡은 지출이 없어도 조합에 남길 카드(카드 바꿔보기에서 사용자가 넣은 카드). 연회비도 그대로 계산한다."""
    cards = [_card_view(s, X[s], A, margin, None) for s in X if sum(X[s].values()) > 0.5 or s in keep]
    cards.sort(key=lambda c: -c["net"])
    total = sum(c["total"] for c in cards)
    fee = sum(c["feeMonthly"] for c in cards)
    return {"cards": cards, "total": total, "fee": fee, "net": total - fee, "sids": [c["sid"] for c in cards]}


# ---------- 추천 ----------

def recommend_json(payload_text):
    p = json.loads(payload_text)
    t0 = time.time()
    ids = [int(x) for x in p["ids"] if int(x) in STATE["records"]]
    spending = _clean_spend(p.get("spending"))
    margin = int(p.get("margin") or 0)
    mode = p.get("mode", "maxBenefit")
    max_cards = max(1, int(p.get("maxCards") or 5))
    fee_cap = p.get("feeCap")
    fixed = [int(x) for x in p.get("fixed", []) if int(x) in ids]
    time_limit = float(p.get("timeLimit") or 10)
    A = _A(p.get("brandShare"))
    if not ids or not spending:
        return json.dumps({"ok": True, "empty": True})

    pool = _shortlist(ids, spending, A, margin, fixed)
    recs_sel = {s: _raised(STATE["records"][s], margin) for s in pool}
    ev = Evaluator(recs_sel, A)
    k_top = min(len(pool), max(MAX_BAR, max_cards))
    by_k, X_prev, obj_prev = {}, None, None
    for K in range(max(1, len(fixed)), k_top + 1):
        X, obj = _solve_k(recs_sel, spending, A, K, fee_cap=fee_cap, fixed=fixed, lb=obj_prev,
                          time_limit=time_limit if K <= 2 else min(time_limit, K3_TIME_LIMIT))
        if X is None:
            if X_prev is None:
                continue
            X, obj = copy.deepcopy(X_prev), obj_prev
        X = _refine(ev, X, spending)
        net = _net_of(ev, X)
        if X_prev is not None and net < by_k[K - 1]["netSel"] + 1:
            # 한 장 더 넣어도 늘지 않으면 이후 장수도 같은 조합
            for k2 in range(K, k_top + 1):
                by_k[k2] = dict(by_k[K - 1], same=True)
            break
        by_k[K] = {"X": X, "netSel": net}
        X_prev, obj_prev = X, obj

    if not by_k:
        return json.dumps({"ok": False, "error": "조건에 맞는 조합을 찾지 못했어요"})

    # 장수 고르기: 혜택 최대화 = 상한 안에서 순혜택이 가장 큰 장수 / 효율적 = 기여가 작은 카드를 빼는 기존 규칙
    ks = sorted(k for k in by_k if k <= max_cards)
    if not ks:
        ks = [min(by_k)]
    efficient_ceiling = None
    if mode == "efficient":
        kmax = max(by_k)
        Xm = by_k[kmax]["X"]
        contrib = [ev.total(s, Xm[s]) - _fee_m(recs_sel[s]) for s in Xm if sum(Xm[s].values()) > 0.5]
        top = max(contrib) if contrib else 0
        efficient_ceiling = sum(1 for v in contrib if v >= top * EFFICIENT_RELATIVE_CUTOFF) if top > 0 else len(contrib)
        k_rec = max(min(efficient_ceiling, max_cards), ks[0])
        k_rec = max(k for k in ks if k <= k_rec) if any(k <= k_rec for k in ks) else ks[0]
    else:
        k_rec = max(ks, key=lambda k: (round(by_k[k]["netSel"]), -k))

    bar = []
    for k in range(1, MAX_BAR + 1):
        if k in by_k:
            X = by_k[k]["X"]
            real = _net_of(Evaluator({s: STATE["records"][s] for s in X}, A), X)
            used = [s for s in X if sum(X[s].values()) > 0.5]
            # sids: 그 장수에서 고른 카드(2026-10-28 v2 화면의 '1장만 쓸 때 ○○ 한 장' 표시용)
            bar.append({"k": k, "net": real, "cards": len(used), "same": bool(by_k[k].get("same")), "sids": used})
    rec_pack = _pack(by_k[k_rec]["X"], A, margin)

    alt = None
    if margin > 0 and p.get("withAlt", False):
        alt = _alt_of(pool, spending, A, k_rec, fee_cap=fee_cap, fixed=fixed, time_limit=time_limit)

    return json.dumps({
        "ok": True, "k": k_rec, "mode": mode, "margin": margin, "efficientCeiling": efficient_ceiling,
        "result": rec_pack, "bar": bar, "alt": alt, "pool": pool, "spending": spending,
        "elapsed": round(time.time() - t0, 2),
    })


def _alt_of(pool, spending, A, k, fee_cap=None, fixed=(), time_limit=10):
    """실적 여유 없이(원래 구간 기준) 같은 후보·같은 장수로 고른 조합. 기본 추천과 비교하는 대안."""
    recs0 = {s: STATE["records"][s] for s in pool if s in STATE["records"]}
    if not recs0:
        return None
    ev0 = Evaluator(recs0, A)
    X0, _ = _solve_k(recs0, spending, A, max(1, min(k, len(recs0))), fee_cap=fee_cap, fixed=fixed, time_limit=time_limit)
    if not X0:
        return None
    X0 = _refine(ev0, X0, spending)
    used = [s for s in X0 if sum(X0[s].values()) > 0.5]
    return {"net": _net_of(ev0, X0), "sids": used, "names": [STATE["records"][s]["card"]["name"] for s in used]}


def alt_json(payload_text):
    """기본 추천(recommend)과 따로, 필요할 때만 대안 조합을 계산한다(2026-10-29: 결과 화면 첫 계산에서 분리).
    입력: ids = recommend 응답의 pool, k = recommend 응답의 k"""
    p = json.loads(payload_text)
    pool = [int(x) for x in p.get("ids", []) if int(x) in STATE["records"]]
    spending = _clean_spend(p.get("spending"))
    if not pool or not spending:
        return json.dumps({"ok": True, "alt": None})
    A = _A(p.get("brandShare"))
    fixed = [int(x) for x in p.get("fixed", []) if int(x) in pool]
    alt = _alt_of(pool, spending, A, int(p.get("k") or 1), fee_cap=p.get("feeCap"), fixed=fixed,
                  time_limit=float(p.get("timeLimit") or 10))
    return json.dumps({"ok": True, "alt": alt})


def explain_json(payload_text):
    """정해진 조합(카드 목록)으로 배분만 다시 고르고 카드별 과정 기록을 돌려준다(카드 바꿔보기, 저장한 지갑 다시 계산)."""
    p = json.loads(payload_text)
    ids = [int(x) for x in p["ids"] if int(x) in STATE["records"]]
    spending = _clean_spend(p.get("spending"))
    margin = int(p.get("margin") or 0)
    A = _A(p.get("brandShare"))
    if not ids or not spending:
        return json.dumps({"ok": True, "empty": True})
    recs_sel = {s: _raised(STATE["records"][s], margin) for s in ids}
    ev = Evaluator(recs_sel, A)
    X, _ = _solve_k(recs_sel, spending, A, len(ids), fixed=ids, time_limit=float(p.get("timeLimit") or 10))
    if X is None:
        return json.dumps({"ok": False, "error": "이 카드들로는 계산할 수 없어요"})
    X = _refine(ev, X, spending)
    for s in ids:
        X.setdefault(s, {})
    pack = _pack(X, A, margin, keep=set(ids))
    return json.dumps({"ok": True, "result": pack})


def rank_json(payload_text):
    """카드마다 지출 전부를 그 카드로 냈을 때의 월 혜택(전체 카드 정렬, 혜택별 추천, 카드 목록)."""
    p = json.loads(payload_text)
    spending = _clean_spend(p.get("spending"))
    A = _A(p.get("brandShare"))
    ids = [int(x) for x in p.get("ids", []) if int(x) in STATE["records"]] or list(STATE["records"])
    detail = bool(p.get("detail"))
    out = []
    for sid in ids:
        rec = STATE["records"][sid]
        if not spending:
            out.append({"sid": sid, "total": 0, "net": -_fee_m(rec)})
            continue
        try:
            if detail:
                v = _card_view(sid, spending, A, 0, None)
                out.append({"sid": sid, "total": v["total"], "net": v["net"], "view": v})
            else:
                r = calc.evaluate(rec, spending, A)
                out.append({"sid": sid, "total": r["total"], "net": r["total"] - _fee_m(rec), "tier": r["tier"].get("card")})
        except Exception as e:  # 레코드 하나가 깨져도 목록 전체는 보여준다
            out.append({"sid": sid, "total": 0, "net": -_fee_m(rec), "error": str(e)[:120]})
    return json.dumps({"ok": True, "rows": out})


def brands_json(payload_text):
    """담은 카드의 브랜드 한정 혜택에 나오는 브랜드(자주 가는 곳 질문에 쓸 목록)."""
    p = json.loads(payload_text)
    ids = [int(x) for x in p.get("ids", []) if int(x) in STATE["records"]]
    cats = {}
    for sid in ids:
        rec = STATE["records"][sid]
        for b in rec["benefits"]:
            sc = b.get("scope") or {}
            if sc.get("specificity") not in ("brand", "merchant_group") or not sc.get("app_category") or sc.get("region") == "overseas":
                continue
            slot = cats.setdefault(sc["app_category"], {})
            for m in sc.get("merchants", [])[:12]:
                key = calc._norm_m(m)
                row = slot.setdefault(key, {"name": m, "cards": []})
                if rec["card"]["name"] not in row["cards"]:
                    row["cards"].append(rec["card"]["name"])
    out = {c: sorted(v.values(), key=lambda r: (-len(r["cards"]), r["name"])) for c, v in cats.items()}
    return json.dumps({"ok": True, "categories": out, "defaultShare": STATE["A"]["eligible_share_by_specificity"]["brand"]})


def _benefit_note(b, tb, final):
    """혜택 한 줄 설명: '편의점 11% · 월 한도 3,300원에 걸림'."""
    parts = []
    v, typ = tb.get("value"), tb.get("type")
    if typ == "percent" and v:
        parts.append(f"{b.get('title', '')[:24]}")
    else:
        parts.append(b.get("title", "")[:24])
    hit = [c for c in tb.get("own_caps", []) if c.get("hit")]
    if hit:
        parts.append(f"월 한도 {round(hit[0]['monthly']):,}원에 걸림")
    return " · ".join(p for p in parts if p)


def _cat_value(rec, r, cat, amount, excl, elig):
    """한 카테고리에서 받는 월 혜택: 그 카테고리 혜택 + 모든 가맹점 혜택 중 그 카테고리 몫."""
    val = 0.0
    for b in rec["benefits"]:
        got = r["by_benefit"].get(b["id"], 0)
        if not got:
            continue
        sc = b.get("scope") or {}
        if sc.get("app_category") == cat:
            val += got
        elif sc.get("specificity") == "all_merchants" and sc.get("app_category") is None and cat not in excl:
            val += got * amount / elig
    return val


def category_rank_json(payload_text):
    """혜택별 추천: 한 카테고리 지출을 각 카드로 낼 때 그 카테고리에서 받는 월 혜택.
    실적은 지출 입력 전체(그 카테고리는 입력한 금액으로 바꿈)를 그 카드로 낸다고 보고 계산한다.
    패키지(하나만 고르는 선택형)가 있는 카드는 그 카테고리 혜택이 가장 큰 패키지로 계산하고,
    지출 전체 기준으로 고른 패키지와 다르면 switched=True(2026-10-29 v2)."""
    p = json.loads(payload_text)
    cat = p["category"]
    amount = float(p.get("amount") or 0)
    base = _clean_spend(p.get("spending"))
    base[cat] = amount
    base = {c: v for c, v in base.items() if v > 0}
    A = _A(p.get("brandShare"))
    ids = [int(x) for x in p.get("ids", []) if int(x) in STATE["records"]] or list(STATE["records"])
    rows = []
    for sid in ids:
        rec = STATE["records"][sid]
        try:
            r = calc.evaluate(rec, base, A)
        except Exception:
            continue
        excl = set(rec["performance"].get("excluded_app_categories", []))
        elig = sum(v for c, v in base.items() if c not in excl) or 1.0
        val = _cat_value(rec, r, cat, amount, excl, elig)
        opts = r.get("options") or []
        switched = False
        groups = rec.get("choice_groups", [])
        if groups and all(g.get("choose", 1) == 1 for g in groups):
            for combo in itertools.product(*[[o["id"] for o in g["options"]] for g in groups]):
                try:
                    r2 = calc.evaluate(rec, base, A, list(combo))
                except Exception:
                    continue
                v2 = _cat_value(rec, r2, cat, amount, excl, elig)
                if v2 > val + 0.5:
                    val, opts = v2, list(combo)
                    switched = opts != list(r.get("options") or [])
        rows.append({"sid": sid, "value": val, "name": rec["card"]["name"], "options": opts, "switched": switched})
    rows.sort(key=lambda x: -x["value"])
    top = rows[: int(p.get("limit") or 20)]
    for row in top:
        if row["value"] <= 0.5:
            row["note"] = None
            continue
        rec = STATE["records"][row["sid"]]
        t = {}
        calc.evaluate(rec, base, A, row["options"] if row["options"] else None, trace=t)
        best = None
        for b in rec["benefits"]:
            tb = (t.get("benefits") or {}).get(b["id"])
            fin = (t.get("final") or {}).get(b["id"], 0)
            if tb and (b.get("scope") or {}).get("app_category") == cat and fin > 0.5 and (best is None or fin > best[2]):
                best = (b, tb, fin)
        row["note"] = _benefit_note(*best) if best else "모든 가맹점 기본 혜택"
        row["detail"] = _cat_detail(rec, t, best, row.get("options") or [])
    for row in top:
        row["status"] = STATE["status"].get(row["sid"], "auto")
    return json.dumps({"ok": True, "rows": top, "total": len(rows), "spending": base})


def _cat_detail(rec, t, best, options):
    """혜택별 추천 화면의 한 줄 설명 재료(2026-10-29 v2): 가장 큰 혜택, 걸린 한도, 건당·횟수 조건, 고른 패키지."""
    groups = rec.get("choice_groups", [])
    opt_titles = {o["id"]: o.get("label") or o.get("title") or o["id"] for g in groups for o in g["options"]}
    out = {"options": [{"id": o, "label": opt_titles.get(o, o)} for o in options]}
    if not best:
        return out
    b, tb, fin = best
    cond = b.get("conditions") or {}
    hit = [c for c in tb.get("own_caps", []) if c.get("hit")]
    shared = None
    for s in t.get("shared", []):
        if s["id"] in (b.get("shared_cap_ids") or []) and s.get("factor", 1) < 0.999:
            shared = {"label": s["label"], "cap": s["cap"]}
            break
    shares = [c["share"] for c in tb.get("cats", [])]  # 브랜드(대상 가맹점) 비중. 요일·채널 비중은 뺀 값
    out.update({
        "title": b.get("title", ""), "kind": tb.get("kind"), "type": tb.get("type"), "value": tb.get("value"),
        "specificity": (b.get("scope") or {}).get("specificity"), "merchants": (b.get("scope") or {}).get("merchants", [])[:6],
        "final": fin, "capHit": round(hit[0]["monthly"]) if hit else None, "shared": shared,
        "perTxnCap": cond.get("max_benefit_per_txn_won"), "maxCountedTxn": cond.get("max_counted_txn_won"),
        "minTxn": cond.get("min_txn_won"), "countLimits": cond.get("count_limits"),
        "share": max(shares) if shares else None,
    })
    return out


def cards_info_json(payload_text):
    """카드 선택 화면용 요약: 혜택 제목(원문 기준), 전월실적 구간, 할인 결제 실적 제외 여부, 혜택 표 상태."""
    p = json.loads(payload_text)
    out = {}
    for x in p.get("ids", []):
        sid = int(x)
        rec = STATE["records"].get(sid)
        if not rec:
            continue
        perf = rec["performance"]
        tiers = [t["min_won"] for t in perf.get("tiers", []) if t["min_won"] > 0]
        groups = rec.get("choice_groups", [])
        titles = [b.get("title", "") for b in rec["benefits"] if (b.get("scope") or {}).get("region") != "overseas"][:6]
        out[sid] = {
            "titles": titles,
            "tiers": tiers,
            "excludesDiscounted": bool(perf.get("excludes_discounted_spend")),
            "status": STATE["status"].get(sid, "auto"),
            "hasChoice": bool(groups),
            "benefitCount": len(rec["benefits"]),
        }
    return json.dumps({"ok": True, "cards": out})
