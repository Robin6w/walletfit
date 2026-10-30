"""
WalletFit 카드 조합 MILP (혜택 양식 v0.2 기반)

1번 작업의 혜택 레코드(schema v0.2)를 그대로 읽어, 카드 여러 장의 조합과 카테고리 배정을 한 번에 고른다.
calc.py(카드 한 장 계산기)가 하는 계산을 선형식으로 옮긴 것이라, 고른 결과는 calc.py로 다시 계산해 검산한다.

지금 앱 엔진(walletOptimizerCore.py) 대비 바뀐 점
  1. 지출 전액 배정: 각 카테고리 지출은 고른 카드 중 하나로 반드시 결제된다(Σ_c x = s).
     혜택 없는 지출도 그 카드 실적에 들어간다.
  2. 실적 구간: 카드에 배정된 지출(실적 제외 카테고리 빼고, 할인받은 결제 빼고)로 구간이 정해진다.
     구간은 이진변수 w로 고르고, 실적이 그 구간 [하한, 상한) 안에 있어야 한다.
  3. 공유 한도(통합 할인한도): 여러 혜택의 합에 구간별 한도.
  4. 선택형: 1개 고르기는 옵션마다 '가상 카드'로 펼치고(같은 실물 카드는 1장만), 여러 개 고르기는 옵션별 이진변수.
  5. 혜택별 조건: 대상 비중(브랜드 35% 등), 건당 최소 결제, 횟수 제한, 자체 한도(월·연·일, 혜택액·결제액 기준),
     요일 한정, 모든 가맹점 기본 혜택은 특정 혜택을 받은 지출을 빼고(중복 없음), 연 단위 구간표.

변수 (카드 c, 카테고리 i, 혜택 b, 구간 상태 s)
  y_c        카드 선택 (이진)
  z_{c,i}    카테고리 i를 카드 c로 결제 (이진, 나누지 않는 모드) / x_{c,i} 배정 금액 (연속)
  w_{c,t}    카드 c의 실적 구간이 t (이진). '구간 미달' 상태는 y_c - Σ_t w_{c,t}
  a_{b,i}    혜택 b가 카테고리 i에서 주는 월 금액 (연속)
  e_{b,i}    특정 혜택 b가 받은 지출(기본 혜택에서 빼는 금액, 연속)
  d_c        할인받아 실적에서 빠지는 금액 (연속)
  o_{c,k}    여러 개 고르는 선택형의 옵션 k (이진)

목적: max Σ a − Σ_c (연회비_c/12 + λ) y_c
"""
import itertools, math, json
from collections import defaultdict
import numpy as np
# scipy.optimize는 브라우저(Pyodide)에서 불러오는 데 3초 넘게 걸린다. 카드 한 장 계산(calc.py)만 쓰는 호출
# (rank·categoryRank·cardsInfo·brands)이 기다리지 않도록 MILP를 처음 풀 때 불러온다(2026-10-29)
def _scipy():
    from scipy.optimize import milp, LinearConstraint, Bounds
    from scipy.sparse import coo_matrix
    return milp, LinearConstraint, Bounds, coo_matrix


def preload():
    """워커가 한가할 때 미리 불러 두는 용도"""
    _scipy()

MONTHS = {"day": 1 / 30, "month": 1, "quarter": 3, "half_year": 6, "year": 12, "card_year": 12, "one_time": 12}
DELTA = 1.0  # 구간 상한 '미만' 처리용 1원


def _norm_m(s):
    return "".join((s or "").split()).lower()


def _elig_share(sc, A):
    """calc.py와 같은 규칙: 사용자가 브랜드 금액을 넣었으면(user_brand_share) 그 비중, 아니면 기본 가정값."""
    spec = sc["specificity"]
    ub = A.get("user_brand_share")
    if spec in ("brand", "merchant_group") and ub and sc.get("app_category") in ub:
        m = {_norm_m(k): v for k, v in ub[sc["app_category"]].items() if not k.startswith("_")}
        return min(1.0, sum(m.get(_norm_m(x), 0.0) for x in sc.get("merchants", [])))
    return A["eligible_share_by_specificity"][spec]


def _hour_share(sc, A):
    return A.get("time_window_share", {}).get("default", 1.0) if sc.get("hours") else 1.0


def _txn_model(spend, cat, A, rate=None, min_txn=None, max_counted=None, max_b=None):
    import calc
    return calc._txn_model(spend, cat, A, rate, min_txn, max_counted, max_b)


def _count_limit(cond):
    import calc
    return calc._count_limit(cond)


def _splits_spend(b):
    import calc
    return calc.splits_spend(b)


def _channel_share(sc, cat, A):
    import calc
    return calc.channel_share(sc, cat, A)


def _value(b, tier, A):
    allv = b["reward"]["value_by_tier"]
    vals = [v for v in allv if tier is not None and v.get("tier") == tier] or [v for v in allv if v.get("tier") is None]
    if not vals:
        return None
    if len(vals) > 1:
        pick = max if A["payment_condition_policy"] == "best" else min
        return pick(vals, key=lambda z: z["value"])["value"]
    return vals[0]["value"]


def _amount_for_tier(by_tier, tier):
    exact = [x["amount_won"] for x in by_tier if x.get("tier") == tier]
    if exact:
        return exact[0]
    common = [x["amount_won"] for x in by_tier if x.get("tier") is None]
    return common[0] if common else None


def annual_fee(rec):
    f = rec["card"]["annual_fee"]
    d, o = f.get("domestic"), f.get("overseas")
    if d is not None:
        return d
    return o or 0


def expand_virtual(rec):
    """선택형 중 '1개 고르기' 그룹은 옵션 조합마다 가상 카드로 펼친다. 여러 개 고르기 그룹은 그대로 둔다(옵션 이진변수)."""
    groups = rec.get("choice_groups", [])
    one = [g for g in groups if g.get("choose", 1) == 1]
    multi = [g for g in groups if g.get("choose", 1) > 1]
    combos = list(itertools.product(*[[o["id"] for o in g["options"]] for g in one])) if one else [()]
    return [(list(c), multi) for c in combos]


class Model:
    def __init__(self):
        self.lb, self.ub, self.integ, self.obj, self.names = [], [], [], [], []
        self.rows, self.cols, self.vals, self.rlo, self.rhi = [], [], [], [], []
        self.nrow = 0

    def var(self, name, lb=0.0, ub=np.inf, integer=False, obj=0.0):
        self.lb.append(lb); self.ub.append(ub); self.integ.append(1 if integer else 0); self.obj.append(obj); self.names.append(name)
        return len(self.lb) - 1

    def con(self, terms, lo=-np.inf, hi=np.inf):
        """terms: dict 또는 (var, coef) 목록. 같은 변수가 여러 번 나오면 더한다."""
        acc = defaultdict(float)
        for v, c in (terms.items() if isinstance(terms, dict) else terms):
            acc[v] += c
        for v, c in acc.items():
            if c != 0:
                self.rows.append(self.nrow); self.cols.append(v); self.vals.append(c)
        self.rlo.append(lo); self.rhi.append(hi); self.nrow += 1

    def solve(self, time_limit=60, mip_rel_gap=1e-6, node_limit=None):
        """node_limit: 시간 대신 탐색 노드 수로 끊는다. 시간으로 끊으면 기기가 느릴수록(휴대폰, 백그라운드 탭) 결과가 나빠지고
        같은 입력에도 결과가 달라진다(2026-10-30). 노드 수로 끊으면 어느 기기에서나 같은 결과가 나온다(느린 기기는 더 기다림)."""
        milp, LinearConstraint, Bounds, coo_matrix = _scipy()
        n = len(self.lb)
        A = coo_matrix((self.vals, (self.rows, self.cols)), shape=(self.nrow, n)).tocsr()
        kw = dict(c=-np.array(self.obj), constraints=[LinearConstraint(A, self.rlo, self.rhi)] if self.nrow else [],
                  integrality=np.array(self.integ), bounds=Bounds(self.lb, self.ub))
        opts = {"time_limit": time_limit, "mip_rel_gap": mip_rel_gap, "disp": False}
        if node_limit:
            opts["node_limit"] = int(node_limit)
        res = milp(**kw, options=opts)
        if res.status in (2, 4):
            # HiGHS 전처리(presolve)에서 수치 오류가 나거나 해가 있는데 '해 없음'으로 끝나는 경우가 있어(2612) 전처리 없이 다시 푼다
            res = milp(**kw, options={**opts, "presolve": False})
        return res


class CardBlock:
    """가상 카드 1장의 변수·계수."""
    pass


def prune_options(rec, spending, A, keep=4, max_virtual=6):
    """1개 고르기 선택형 옵션이 많은 카드(예: 1·2위 영역 순서쌍 30개)는 이 지출로 카드 한 장에 다 줄 때 값이 큰 옵션 keep개만 남긴다.
    (모든 옵션을 가상 카드로 펼치면 변수가 너무 많아져 느려짐. 남긴 옵션 안에서는 정확)"""
    import calc
    v = expand_virtual(rec)
    if len(v) <= max_virtual:
        return None
    scored = sorted(v, key=lambda o: -calc.evaluate(rec, spending, A, o[0])["total"])
    return [o[0] for o in scored[:keep]]


def build(records, spending, A, K=3, split=False, lam=0.0, fixed=(), allowed=None, fee_cap=None, forbid_sets=(), force_include=(),
          single_txn_whole=True, option_keep=4, whole_cats=()):
    """
    records: {source_id: 레코드}
    spending: {카테고리: 월 지출}
    K: 최대 카드 수(실물 기준). fixed: 반드시 넣을 카드(보유 카드). lam: 카드 1장 추가 비용(원/월)
    split: True면 한 카테고리를 여러 카드로 나눠 결제 가능
    forbid_sets: 이미 찾은 카드 집합 목록(같은 집합이 다시 나오지 않게 하는 제약, 차선 조합 찾기용)
    force_include: 반드시 포함(why-not 질문용)
    """
    M = Model()
    cats = [c for c, v in spending.items() if v > 0]
    S = {c: float(spending[c]) for c in cats}
    total_spend = sum(S.values())
    BIGQ = total_spend * 12 + 10  # 실적 상한이 없는 구간의 상한(연 단위 구간표까지 덮음)
    single = {c for c in cats if A["single_txn_categories"].get(c)}

    phys_vars = defaultdict(list)
    blocks = []
    x_of = defaultdict(dict)  # cat -> {block idx: x var}
    ids = list(records.keys()) if allowed is None else [i for i in records if i in allowed]
    for sid in ids:
        rec = records[sid]
        fee = annual_fee(rec)
        keep = prune_options(rec, spending, A, keep=option_keep) if option_keep else None
        for opt_ids, multi_groups in expand_virtual(rec):
            if keep is not None and list(opt_ids) not in keep:
                continue
            B = CardBlock()
            B.sid, B.rec, B.opts, B.multi = sid, rec, opt_ids, multi_groups
            B.whole = not split
            B.y = M.var(f"y[{sid}|{','.join(opt_ids)}]", 0, 1, True, -(fee / 12.0 + lam))
            phys_vars[sid].append(B.y)
            B.x, B.z = {}, {}
            for c in cats:
                B.x[c] = M.var(f"x[{sid}|{c}]", 0, S[c])
                M.con({B.x[c]: 1, B.y: -S[c]}, hi=0)
                if (not split) or (single_txn_whole and c in single) or c in whole_cats:
                    B.z[c] = M.var(f"z[{sid}|{c}]", 0, 1, True)
                    M.con({B.x[c]: 1, B.z[c]: -S[c]}, lo=0, hi=0)
                x_of[c][len(blocks)] = B.x[c]
            blocks.append(B)
            _build_card(M, B, cats, S, A, BIGQ)

    # 지출 전액 배정
    for c in cats:
        M.con({v: 1 for v in x_of[c].values()}, lo=S[c], hi=S[c])
    # 실물 카드당 가상 카드 1장
    for sid, ys in phys_vars.items():
        if len(ys) > 1:
            M.con({y: 1 for y in ys}, hi=1)
    allys = [y for ys in phys_vars.values() for y in ys]
    M.con({y: 1 for y in allys}, lo=1, hi=K)
    for sid in fixed:
        M.con({y: 1 for y in phys_vars[sid]}, lo=1, hi=1)
    for sid in force_include:
        M.con({y: 1 for y in phys_vars[sid]}, lo=1, hi=1)
    if fee_cap is not None:
        M.con({b.y: annual_fee(b.rec) for b in blocks}, hi=fee_cap)
    for fs in forbid_sets:  # 같은 실물 카드 집합 금지(no-good cut)
        fs = set(fs)
        terms = {}
        for sid, ys in phys_vars.items():
            for y in ys:
                terms[y] = 1 if sid in fs else -1
        M.con(terms, hi=len(fs) - 1)
    return M, blocks, cats


def _states(rec, tset):
    """구간 상태 목록: [(tier_id 또는 None, 하한, 상한)]. None = 구간 미달."""
    if tset == "card":
        p = rec["performance"]
        if p["basis"] == "none" or not p["tiers"]:
            return [(None, 0, None)]
        T = p["tiers"]
    else:
        T = next(ts["tiers"] for ts in rec.get("local_tier_sets", []) if ts["id"] == tset)
    out = []
    first = min(t["min_won"] for t in T)
    if first > 0:
        out.append((None, 0, first))
    for t in T:
        out.append((t["id"], t["min_won"], t.get("max_won")))
    return out


def _build_card(M, B, cats, S, A, BIGQ):
    rec = B.rec
    perf = rec["performance"]
    excl = set(perf.get("excluded_app_categories", []))

    # ---- 구간 상태 변수 ----
    B.W = {}  # tset -> list of (tier, Wterms(dict), lo, hi)

    def make_states(tset, qterms, qmax):
        sts = _states(rec, tset)
        if len(sts) == 1 and sts[0][0] is None and sts[0][2] is None:
            # 구간 없음(실적 조건 없는 카드): 상태 1개 = y
            B.W[tset] = [(None, {B.y: 1.0}, 0, None)]
            return
        ws = []
        wvars = []
        for tier, lo, hi in sts:
            if tier is None:
                continue
            w = M.var(f"w[{B.sid}|{tset}|{tier}]", 0, 1, True)
            wvars.append(w)
            ws.append((tier, {w: 1.0}, lo, hi))
        M.con({**{w: 1 for w in wvars}, B.y: -1}, hi=0)
        none_terms = {B.y: 1.0, **{w: -1.0 for w in wvars}}
        if sts[0][0] is None:
            ws.insert(0, (None, none_terms, 0, sts[0][2]))
        else:
            # 0원부터 시작하는 구간이 있으면 '미달' 상태 불가: y=1이면 구간 하나는 반드시 선택
            M.con({**{w: 1 for w in wvars}, B.y: -1}, lo=0, hi=0)
        B.W[tset] = ws
        # 실적 q가 고른 구간 [하한, 상한) 안에 있어야 함
        lo_terms = dict(qterms)
        for tier, wt, lo, hi in ws:
            for v, c in wt.items():
                lo_terms[v] = lo_terms.get(v, 0) - lo * c
        if ws and ws[0][2] == 0:
            # 할인받아 빠지는 금액(d)은 보수적 추정이라 묶음끼리 겹치면 지출보다 커질 수 있다(2572: q < 0 → 해 없음).
            # 맨 아래 구간(0원부터)에서는 q가 0보다 작아도 되게 여유 σ를 둔다
            sig = M.var(f"sig[{B.sid}|{tset}]", 0, np.inf)
            M.con({sig: 1.0, **{v: -qmax * c for v, c in ws[0][1].items()}}, hi=0)
            lo_terms[sig] = 1.0
        M.con(lo_terms, lo=0)
        hi_terms = dict(qterms)
        for tier, wt, lo, hi in ws:
            ub = (hi - DELTA) if hi is not None else qmax
            for v, c in wt.items():
                hi_terms[v] = hi_terms.get(v, 0) - ub * c
        M.con(hi_terms, hi=0)

    # 카드 실적 q = Σ_{i∉excl} x_i − d
    disc_benefits = []
    by_id = {b["id"]: b for b in rec["benefits"]}
    groups = rec.get("choice_groups", [])
    in_opt = {x for g in groups for o in g["options"] for x in o["benefit_ids"]}
    chosen1 = {x for g in groups if g.get("choose", 1) == 1 for o in g["options"] if o["id"] in B.opts for x in o["benefit_ids"]}
    multi_opt_of = {}
    B.o = {}
    for g in B.multi:
        ovars = []
        for o in g["options"]:
            ov = M.var(f"o[{B.sid}|{o['id']}]", 0, 1, True)
            B.o[o["id"]] = ov
            ovars.append(ov)
            for x in o["benefit_ids"]:
                multi_opt_of[x] = ov
        M.con({**{v: 1 for v in ovars}, B.y: -g.get("choose", 1)}, lo=0, hi=0)
    active = [b for b in rec["benefits"] if (b["id"] not in in_opt or b["id"] in chosen1 or b["id"] in multi_opt_of)
              and b.get("status", "auto") == "auto"]  # calc.usable과 같음: 사람 확인·계산 제외 혜택은 빼고
    for b in active:
        if b.get("counts_toward_performance") is False or (perf.get("excludes_discounted_spend") and b["reward"]["kind"] in ("discount", "cashback")):
            disc_benefits.append(b["id"])
    B.d = M.var(f"d[{B.sid}]", 0, np.inf) if disc_benefits else None
    qterms = {B.x[c]: 1.0 for c in cats if c not in excl}
    if B.d is not None:
        qterms[B.d] = -1.0
    make_states("card", qterms, sum(S.values()) + 1)
    for ts in rec.get("local_tier_sets", []):
        e2 = set(ts.get("excluded_app_categories", []))
        mult = 12 if ts["basis"] in ("card_year", "calendar_year", "prev_year") else 3 if ts["basis"] == "quarter" else 1
        make_states(ts["id"], {B.x[c]: float(mult) for c in cats if c not in e2}, mult * sum(S.values()) + 1)
    B.W["none"] = [(None, {B.y: 1.0}, 0, None)]

    # ---- 계수 계산(calc.benefit_amount와 같은 순서) ----
    # 같은 카테고리 브랜드·묶음 혜택의 비중 합, 업종 전체 혜택 개수(calc.evaluate와 같은 보정).
    # 여러 개 고르는 선택형 옵션의 혜택은 '자기 옵션'만 고른 것으로 보고 센다(옵션끼리는 보통 영역이 달라 겹치지 않음)
    opt_members = defaultdict(set)
    for g in B.multi:
        for o in g["options"]:
            for x_ in o["benefit_ids"]:
                opt_members[x_] = set(o["benefit_ids"])
    base_active = [b for b in active if b["id"] not in multi_opt_of]

    def scales_for(b):
        pool = base_active + [bb for bb in active if bb["id"] in opt_members.get(b["id"], set())]
        import calc
        share_sum = defaultdict(float)
        for bb in pool:
            sc = bb["scope"]
            if sc["region"] != "overseas" and sc["specificity"] in ("brand", "merchant_group") and sc["app_category"]:
                share_sum[sc["app_category"]] += _elig_share(sc, A)
        return ({c: (1.0 / v if v > 1 else 1.0) for c, v in share_sum.items()},
                calc.category_scales(pool))  # 혜택 id별(채널별로 센 나눠 가짐 비율, calc와 같음)
    is_general = lambda b: b["scope"]["specificity"] == "all_merchants" and b["scope"].get("days", "any") == "any"

    def conv(b):
        k = b["reward"]["kind"]
        return A["point_value_won"] if k == "point" else A["mileage_value_won"] if k == "mileage" else 0.0 if k == "donation" else 1.0

    def bcats(b):
        sc = b["scope"]
        tset = (b.get("conditions") or {}).get("tier_set", "card")
        if sc["specificity"] == "all_merchants" and sc["app_category"] is None:
            ex = set(perf.get("excluded_app_categories", []))
            if tset not in ("card", "none"):
                lt = next(t for t in rec.get("local_tier_sets", []) if t["id"] == tset)
                ex = set(lt.get("excluded_app_categories", []))
            return [c for c in cats if c not in ex]
        return [sc["app_category"]] if sc["app_category"] in cats else []

    def factors(b, c):
        sc = b["scope"]
        share = _elig_share(sc, A)
        if sc.get("payment_condition") and sc["specificity"] == "all_merchants":
            share *= A["payment_method_share"]["default"]
        days = sc.get("days", "any")
        dshare = {"any": 1.0, "weekend": 2 / 7, "weekday": 5 / 7}.get(days, len(sc.get("day_list", [])) / 7)
        dshare *= _hour_share(sc, A)
        scale = 1.0
        share_scale, category_scale = scales_for(b)
        if sc["specificity"] in ("brand", "merchant_group"):
            scale = share_scale.get(c, 1.0)
        elif _splits_spend(b):
            scale = category_scale.get(b["id"], 1.0)
        return share * scale * dshare * _channel_share(sc, c, A)

    def coef(b, c, tier):
        """x_{c} 1원당 (혜택액, 대상지출), 횟수 제한 상한(원). 실제 금액은 지수분포 결제 모델을 그대로 씀."""
        rw, cond = b["reward"], b.get("conditions") or {}
        v = _value(b, tier, A)
        if v is None:
            return None
        f = factors(b, c)
        lim = _count_limit(cond)
        typ = rw["type"]
        k = conv(b)
        if B.whole or (c in A["single_txn_categories"] and A["single_txn_categories"].get(c)):
            # 카테고리를 나누지 않는 모드(x = S·z)와 한 달 1건 결제 카테고리: 카테고리 전액을 이 카드로 낼 때의 값을
            # 계산기와 똑같이 구해 계수로 쓴다(횟수 제한·건당 조건까지 정확).
            # 여러 카테고리에 걸친 혜택의 횟수 제한은 카테고리끼리 나눠 쓰므로 여기서 자르지 않고 상한(climit)으로 넘긴다
            s_full = S[c] * f
            multi = lim is not None and len(bcats(b)) > 1
            climit = None
            if typ == "percent":
                n, base, per = _txn_model(s_full, c, A, v, cond.get("min_txn_won"), cond.get("max_counted_txn_won"), cond.get("max_benefit_per_txn_won"))
                kk = n if lim is None or multi else min(n, lim)
                amt, el = per * kk, base * kk
                climit = per * lim * k if multi else None
            elif typ in ("won_per_txn", "free_item"):
                n, base, _ = _txn_model(s_full, c, A, None, cond.get("min_txn_won"))
                kk = n if lim is None or multi else min(n, lim)
                unit = v if typ == "won_per_txn" else v * A["item_prices"].get(rw.get("item_key"), 0)
                amt, el = unit * kk, base * kk
                climit = unit * lim * k if multi else None
            elif typ == "won_per_liter":
                amt, el = s_full / A["fuel_price_won_per_liter"] * v, s_full
            elif typ == "per_unit_spend":
                amt, el = s_full / rw["unit_spend_won"] * v, s_full
            else:
                amt, el = 0.0, s_full
            if el / S[c] < 1e-6:
                return (0.0, 0.0, None, typ)  # 아래 일반 경로와 같은 이유(너무 작은 계수)
            return (amt * k / S[c], el / S[c], climit, typ)
        unit_s = 1.0e5  # 비례 계수를 뽑기 위한 기준 금액(결과는 지출에 비례)
        s1 = unit_s * f
        if s1 <= 0:
            return (0.0, 0.0, None, typ)
        if typ == "percent":
            n, base, per = _txn_model(s1, c, A, v, cond.get("min_txn_won"), cond.get("max_counted_txn_won"), cond.get("max_benefit_per_txn_won"))
            a, e = per * n / unit_s, base * n / unit_s
            climit = per * lim if lim is not None else None
        elif typ in ("won_per_txn", "free_item"):
            n, base, _ = _txn_model(s1, c, A, None, cond.get("min_txn_won"))
            unitv = v if typ == "won_per_txn" else v * A["item_prices"].get(rw.get("item_key"), 0)
            a, e = unitv * n / unit_s, base * n / unit_s
            climit = unitv * lim if lim is not None else None
        elif typ == "won_per_liter":
            a, e, climit = f / A["fuel_price_won_per_liter"] * v, f, None
        elif typ == "per_unit_spend":
            a, e, climit = f / rw["unit_spend_won"] * v, f, None
        elif typ == "won_per_period":
            a, e, climit = 0.0, f, None
        else:
            raise ValueError(typ)
        if e < 1e-6:
            # 지출 100만원당 대상 1원도 안 되는 계수(예: 건당 50만원 이상, 1294 → 1e-13)는 0으로: 너무 작은 계수가 big-M과 섞이면
            # 솔버가 수치 오차로 '해 없음'을 낸다
            return (0.0, 0.0, None, typ)
        return (a * k, e, (climit * k if climit is not None else None), typ)

    def skip(b):
        if b["scope"]["region"] == "overseas":
            return True
        if b.get("valid_to") and b["valid_to"] < A["eval_date"]:
            return True
        return not bcats(b)

    specific = [b for b in active if not is_general(b) and not skip(b)]
    general = [b for b in active if is_general(b) and not skip(b)]

    B.ub = {}           # bid -> 혜택 금액 상한(big-M용)

    def _ub(b):
        tset = (b.get("conditions") or {}).get("tier_set", "card")
        tot = 0.0
        if b["reward"]["type"] == "won_per_period":
            per = b["reward"].get("period_of_reward") or "month"
            vs = [(_value(b, t[0], A) or 0) for t in B.W[tset]] + [(_value(b, None, A) or 0)]
            return max(vs) / MONTHS[per] * conv(b)
        for c in bcats(b):
            best = 0.0
            for t in B.W[tset]:
                cs = coef(b, c, t[0])
                if cs:
                    best = max(best, cs[0])
            tot += best * S[c]
        return tot

    B.a = {}            # (bid, cat) -> var
    B.aper = {}         # bid -> var (기간 정액)
    B.e = {}            # (bid, cat) -> var (특정 혜택이 받은 지출)
    B.bsum = {}         # bid -> dict terms of total amount
    B.rho = {}          # (bid, tier, cat) -> 혜택액/대상지출 (실적 제외·결제액 한도 계산용)
    card_states = B.W["card"]

    def gle(terms, gates, rhs, Mbig):
        """gates(구간 상태들)가 모두 켜졌을 때 terms ≤ rhs.  terms ≤ rhs·y + M·Σ(y − W)  (y=0이면 모든 변수가 0이라 성립)"""
        t = dict(terms)
        for wt in gates:
            for v, cc in wt.items():
                t[v] = t.get(v, 0) + Mbig * cc
        t[B.y] = t.get(B.y, 0) - len(gates) * Mbig - rhs
        M.con(t, hi=0)

    def gge(terms, gates, rhs, Mbig):
        """gates가 모두 켜졌을 때 terms ≥ rhs.  terms ≥ rhs·y − M·Σ(y − W)"""
        t = dict(terms)
        for wt in gates:
            for v, cc in wt.items():
                t[v] = t.get(v, 0) - Mbig * cc
        t[B.y] = t.get(B.y, 0) + len(gates) * Mbig - rhs
        M.con(t, lo=0)

    def count_row(rows, b, tier, wt, var, climit, Mbig):
        """횟수 제한 상한. 한 카테고리 혜택은 var ≤ climit, 여러 카테고리 혜택은 횟수를 나눠 쓰므로
        Σ_c var_c / climit_c ≤ 1 (= Σ 카테고리별 횟수 ≤ 월 N회, calc.py와 같음)로 모아 둔다"""
        if len(bcats(b)) <= 1:
            gle({var: 1.0}, [wt], climit, Mbig)
            return
        if climit <= 0:
            gle({var: 1.0}, [wt], 0.0, Mbig)
            return
        _, terms, mb = rows.get(tier, (wt, {}, 0.0))
        terms[var] = 1.0 / climit
        rows[tier] = (wt, terms, mb + Mbig / climit)

    def close_count_rows(rows):
        for tier, (wt, terms, mb) in rows.items():
            gle(terms, [wt], 1.0, mb + 1)

    def states_of(b):
        tset = (b.get("conditions") or {}).get("tier_set", "card")
        return tset, B.W[tset]

    def gate_terms(b):
        """여러 개 고르는 선택형 옵션에 속한 혜택이면 그 옵션 변수"""
        return multi_opt_of.get(b["id"])

    def add_amount_rows(b, c, var, coefs_by_state, tset, sts, Mbig):
        """var ≤ α_s · x_c + M(1 − W_s) (상태 s에서 열린 혜택), 닫힌 상태는 var ≤ M(1 − W_s)"""
        amax = max([cs[0] for cs in coefs_by_state.values() if cs] + [0.0])
        M.con({var: 1, B.x[c]: -amax}, hi=0)
        for (tier, wt, lo, hi) in sts:
            cs = coefs_by_state.get(tier)
            if cs is None or cs[0] <= 0:
                gle({var: 1.0}, [wt], 0.0, Mbig)
                continue
            if tset == "none" or abs(cs[0] - amax) < 1e-15 and len(sts) == 1:
                continue
            gle({var: 1.0, B.x[c]: -cs[0]}, [wt], 0.0, Mbig)

    # --- 특정 혜택 ---
    elig_coef = {}  # (bid, card_tier, cat) -> 대상지출 계수 (기본 혜택에서 빼는 몫)
    for b in specific:
        tset, sts = states_of(b)
        cond = b.get("conditions") or {}
        allowed_t = cond.get("applies_in_tiers")
        terms_total = {}
        if b["reward"]["type"] == "won_per_period":
            per = b["reward"].get("period_of_reward") or "month"
            u = M.var(f"u[{B.sid}|{b['id']}]", 0, 1)
            M.con({u: 1, B.y: -1}, hi=0)
            M.con({u: 1, **{B.x[c]: -1.0 / S[c] for c in bcats(b)}}, hi=0)
            av = M.var(f"ap[{B.sid}|{b['id']}]", 0, np.inf, False, 1.0)
            vmax = 0.0
            Mbig = 1.0
            for (tier, wt, lo, hi) in sts:
                ok = tset == "none" or (tier is not None and (allowed_t is None or tier in allowed_t))
                v = _value(b, tier, A) if ok else None
                vm = (v or 0) / MONTHS[per] * conv(b)
                vmax = max(vmax, vm)
            Mbig = vmax + 1
            M.con({av: 1, u: -vmax}, hi=0)
            for (tier, wt, lo, hi) in sts:
                ok = tset == "none" or (tier is not None and (allowed_t is None or tier in allowed_t))
                v = _value(b, tier, A) if ok else None
                vm = (v or 0) / MONTHS[per] * conv(b)
                gle({av: 1.0}, [wt], vm, Mbig)
            B.aper[b["id"]] = av
            terms_total[av] = 1.0
            for c in bcats(b):
                for (tier, wt, lo, hi) in card_states:
                    elig_coef[(b["id"], tier, c)] = factors(b, c) if (tset != "card" or tier is not None) else 0.0
        else:
            cnt_rows = {}
            for c in bcats(b):
                cs_by = {}
                for (tier, wt, lo, hi) in sts:
                    ok = tset == "none" or (tier is not None and (allowed_t is None or tier in allowed_t))
                    cs_by[tier] = coef(b, c, tier) if ok else None
                amax = max([cs[0] for cs in cs_by.values() if cs] + [0.0])
                var = M.var(f"a[{B.sid}|{b['id']}|{c}]", 0, np.inf, False, 1.0)
                B.a[(b["id"], c)] = var
                Mbig = amax * S[c] + 1
                add_amount_rows(b, c, var, cs_by, tset, sts, Mbig)
                # 횟수 제한 상한
                for (tier, wt, lo, hi) in sts:
                    cs = cs_by.get(tier)
                    if cs and cs[2] is not None:
                        count_row(cnt_rows, b, tier, wt, var, cs[2], Mbig)
                    if cs and cs[0] > 0 and cs[1] > 0:
                        B.rho[(b["id"], tier, c)] = cs[0] / cs[1]
                terms_total[var] = 1.0
                # 기본 혜택에서 뺄 '특정 혜택이 받은 지출' 계수(카드 구간 상태별)
                for (ctier, cwt, _, _) in card_states:
                    if tset == "card":
                        cs = cs_by.get(ctier)
                    else:
                        # 카드 구간과 다른 구간표를 쓰는 혜택: 가장 높은 상태에서 열려 있으면 받은 것으로 근사
                        cs = cs_by.get(sts[-1][0])
                    elig_coef[(b["id"], ctier, c)] = cs[1] if (cs and cs[0] > 0) else 0.0
            close_count_rows(cnt_rows)
        gate = gate_terms(b)
        if gate is not None:
            M.con({**terms_total, gate: -(_ub(b) + 1)}, hi=0)
        B.bsum[b["id"]] = terms_total
        B.ub[b["id"]] = _ub(b)
        _own_caps(M, B, b, sts, tset, terms_total, cs_lookup=lambda t, c: (B.rho.get((b["id"], t, c))), Mbig=B.ub[b["id"]] + 1)

    # --- 여러 개 고르는 선택형에서 같은 카테고리 '업종 전체' 혜택이 2개 이상 고를 수 있으면,
    #     같은 지출을 두 번 쓰지 않도록(계산기의 '나눠 가짐'과 같은 효과) 지출 사용량 합 ≤ 배정 지출
    if B.multi:
        by_cat = defaultdict(list)
        for b in specific:
            if (_splits_spend(b) or b["scope"]["specificity"] in ("brand", "merchant_group")) and b["reward"]["type"] != "won_per_period":
                # 겹쳐 받는(stacks) 업종 혜택은 같은 지출에 더해 주므로 넣지 않는다(calc의 나눠 가짐과 같은 기준, 108)
                by_cat[(b["scope"]["app_category"], b["scope"]["specificity"] == "category")].append(b)
        for (c, is_cat), bl in by_cat.items():
            if c not in cats or len(bl) < 2 or not any(b["id"] in multi_opt_of for b in bl):
                continue
            for (ctier, cwt, _, _) in card_states:
                terms = {B.x[c]: -1.0}
                for b in bl:
                    var = B.a.get((b["id"], c))
                    tset = (b.get("conditions") or {}).get("tier_set", "card")
                    t_use = ctier if tset == "card" else None
                    cs = coef(b, c, t_use)
                    if var is None or not cs or cs[0] <= 0:
                        continue
                    sc1, cc1 = scales_for(b)
                    if is_cat:
                        unscaled, share_b = cs[0] / cc1.get(b["id"], 1.0), 1.0
                    else:
                        unscaled, share_b = cs[0] / sc1.get(c, 1.0), _elig_share(b["scope"], A)
                    terms[var] = terms.get(var, 0) + share_b / unscaled
                Mb = 2 * S[c] + 1
                gle(terms, [cwt], 0.0, Mb)

    # --- 기본 혜택(모든 가맹점, 요일 무관): 특정 혜택이 받은 지출을 빼고 ---
    spec_ids = [b["id"] for b in specific]

    def cov_frac(ctier, c, b):
        sc = b["scope"]
        share = factors(b, c)
        used = sum(elig_coef.get((bid, ctier, c), 0.0) for bid in spec_ids)
        return max(0.0, share - used) / share if share > 0 else 0.0

    for b in general:
        tset, sts = states_of(b)
        cond = b.get("conditions") or {}
        allowed_t = cond.get("applies_in_tiers")
        rw = b["reward"]
        exclusive = rw["type"] in ("percent", "per_unit_spend", "won_per_liter") and b.get("stacking", "exclusive") == "exclusive"
        terms_total = {}
        if rw["type"] == "won_per_period":
            per = rw.get("period_of_reward") or "month"
            u = M.var(f"u[{B.sid}|{b['id']}]", 0, 1)
            M.con({u: 1, B.y: -1}, hi=0)
            M.con({u: 1, **{B.x[c]: -1.0 / S[c] for c in bcats(b)}}, hi=0)
            av = M.var(f"ap[{B.sid}|{b['id']}]", 0, np.inf, False, 1.0)
            vals = []
            for (tier, wt, lo, hi) in sts:
                ok = tset == "none" or (tier is not None and (allowed_t is None or tier in allowed_t))
                v = _value(b, tier, A) if ok else None
                vals.append((wt, (v or 0) / MONTHS[per] * conv(b)))
            vmax = max([v for _, v in vals] + [0.0])
            Mbig = vmax + 1
            M.con({av: 1, u: -vmax}, hi=0)
            for wt, vm in vals:
                gle({av: 1.0}, [wt], vm, Mbig)
            B.aper[b["id"]] = av
            terms_total[av] = 1.0
        else:
            cnt_rows = {}
            for c in bcats(b):
                cs_by = {}
                for (tier, wt, lo, hi) in sts:
                    ok = tset == "none" or (tier is not None and (allowed_t is None or tier in allowed_t))
                    cs_by[tier] = coef(b, c, tier) if ok else None
                amax = max([cs[0] for cs in cs_by.values() if cs] + [0.0])
                var = M.var(f"a[{B.sid}|{b['id']}|{c}]", 0, np.inf, False, 1.0)
                B.a[(b["id"], c)] = var
                Mbig = amax * S[c] + 1
                M.con({var: 1, B.x[c]: -amax}, hi=0)
                for (tier, wt, lo, hi) in sts:
                    cs = cs_by.get(tier)
                    if cs and cs[0] > 0 and cs[1] > 0:
                        B.rho[(b["id"], tier, c)] = cs[0] / cs[1]
                    if cs is None or cs[0] <= 0:
                        gle({var: 1.0}, [wt], 0.0, Mbig)
                        continue
                    if cs[2] is not None:
                        count_row(cnt_rows, b, tier, wt, var, cs[2], Mbig)
                    for (ctier, cwt, _, _) in card_states:
                        frac = cov_frac(ctier, c, b) if exclusive else 1.0
                        terms = {var: 1.0, B.x[c]: -cs[0] * frac}
                        if tset == "card":
                            if ctier != tier:
                                continue
                            gle(terms, [wt], 0.0, Mbig)
                        else:
                            gle(terms, [wt, cwt], 0.0, Mbig)
                terms_total[var] = 1.0
            close_count_rows(cnt_rows)
        gate = gate_terms(b)
        if gate is not None:
            M.con({**terms_total, gate: -(_ub(b) + 1)}, hi=0)
        B.bsum[b["id"]] = terms_total
        B.ub[b["id"]] = _ub(b)
        _own_caps(M, B, b, sts, tset, terms_total, cs_lookup=lambda t, c: (B.rho.get((b["id"], t, c))), Mbig=B.ub[b["id"]] + 1)

    # --- 공유 한도(카드 구간 기준) ---
    act_ids = {b["id"] for b in specific + general}
    for cap in rec.get("shared_caps", []):
        mem = [b for b in specific + general if cap["id"] in b.get("shared_cap_ids", [])]
        if not mem:
            continue
        terms = {}
        for b in mem:
            for v, cc in B.bsum[b["id"]].items():
                terms[v] = terms.get(v, 0) + cc
        Mbig = sum(B.ub.get(b["id"], 0) for b in mem) + 1
        for (ctier, cwt, _, _) in card_states:
            amt = _amount_for_tier(cap["by_tier"], ctier)
            if amt is None:
                continue
            gle(terms, [cwt], amt / MONTHS[cap["period"]], Mbig)

    # --- 선형 완화를 조이는 유효 부등식(풀이 속도용, 최적해는 바뀌지 않음) ---
    #   혜택별: Σa ≤ (구간별 자체 한도 중 최댓값)·y,  통합 한도: Σa ≤ (구간별 한도 최댓값)·y,  카드: Σa ≤ U·y
    allb = [b for b in specific + general if b["id"] in B.bsum]

    def max_owncap(b):
        tset, sts = states_of(b)
        best = None
        for (tier, wt, lo, hi) in sts:
            mins = []
            for cp in b.get("caps", []):
                if cp.get("basis", "benefit") != "benefit":
                    continue
                amt = _amount_for_tier(cp["by_tier"], tier)
                if amt is not None:
                    mins.append(amt / MONTHS[cp["period"]])
            if not mins:
                return None
            best = min(mins) if best is None else max(best, min(mins))
        return best

    capb = {}
    for b in allb:
        mc = max_owncap(b)
        ubb = B.ub.get(b["id"], 0.0)
        capb[b["id"]] = min(ubb, mc) if mc is not None else ubb
        if mc is not None and mc < ubb:
            M.con({**B.bsum[b["id"]], B.y: -mc}, hi=0)
    gb = []
    for cap in rec.get("shared_caps", []):
        mids = [b["id"] for b in allb if cap["id"] in b.get("shared_cap_ids", [])]
        if not mids:
            continue
        amts = [_amount_for_tier(cap["by_tier"], ct) for (ct, _, _, _) in card_states]
        if any(a_ is None for a_ in amts):
            continue
        mx = max(amts) / MONTHS[cap["period"]]
        if mx < sum(capb[m] for m in mids):
            terms = {}
            for m in mids:
                for v, cc in B.bsum[m].items():
                    terms[v] = terms.get(v, 0) + cc
            M.con({**terms, B.y: -mx}, hi=0)
            gb.append((mids, mx))
    U, counted = 0.0, set()
    for mids, mx in gb:
        mids = [m for m in mids if m not in counted]
        U += min(sum(capb[m] for m in mids), mx)
        counted |= set(mids)
    U += sum(capb[b["id"]] for b in allb if b["id"] not in counted)
    terms = {}
    for b in allb:
        for v, cc in B.bsum[b["id"]].items():
            terms[v] = terms.get(v, 0) + cc
    if terms:
        M.con({**terms, B.y: -U}, hi=0)
    B.U = U

    # --- 할인받은 결제의 실적 제외 ---
    # 계산기: 빠지는 금액 = Σ 대상지출 × (실제 혜택 / 한도 전 혜택). MILP가 혜택을 일부러 덜 받아 실적을 맞추는 일을
    # 막기 위해, 혜택 변수와 무관한 보수적 추정을 쓴다:
    #   묶음(공유 한도 또는 혜택 하나)마다 min(대상지출 합, 한도 ÷ 평균 혜택률)
    #   평균 혜택률 = 이 카드로 전 지출을 낼 때의 Σ혜택 ÷ Σ대상지출(계산기가 한도에 걸린 비율로 빼는 것과 같은 값).
    #   예전에는 '최소 혜택률'로 나눠 건당 한도가 걸린 카테고리(백화점 등 3%대) 때문에 빠지는 금액이 지출 전체만큼 커져
    #   위 구간이 아예 불가능해졌다(3097: 한도 1.8만 ÷ 3% = 60만 → 계산기 2.2만원을 MILP는 6천원으로 봄)
    # 그래서 이 카드들은 MILP가 실적을 조금 낮게 볼 수 있다(혜택을 과대평가하지는 않는 쪽).
    if B.d is not None:
        Mbig = sum(S.values()) * 2 + 10
        caps_by_id = {cp["id"]: cp for cp in rec.get("shared_caps", [])}
        g_all = []
        for (ctier, cwt, _, _) in card_states:
            groups_ = defaultdict(list)
            for bid in disc_benefits:
                if bid not in act_ids:
                    continue
                b = by_id[bid]
                cand = []
                for cid in b.get("shared_cap_ids", []):
                    cp = caps_by_id.get(cid)
                    if cp is None:
                        continue
                    amt = _amount_for_tier(cp["by_tier"], ctier)
                    if amt is not None:
                        cand.append((amt / MONTHS[cp["period"]], cid))
                key = ("shared", min(cand)[1], min(cand)[0]) if cand else ("own", bid, None)
                groups_[key].append(b)
            for key, members in groups_.items():
                L1 = {}
                L1s = {}
                rhos = []  # (혜택 계수 x 지출, 대상지출 계수 x 지출)
                own_caps_m = []
                for b in members:
                    tset = (b.get("conditions") or {}).get("tier_set", "card")
                    t_use = ctier if tset == "card" else (B.W[tset][-1][0] if tset in B.W else None)
                    allowed_t = (b.get("conditions") or {}).get("applies_in_tiers")
                    ok = tset == "none" or (t_use is not None and (allowed_t is None or t_use in allowed_t))
                    if not ok:
                        continue
                    for c in bcats(b):
                        if c in excl:
                            continue
                        cs = coef(b, c, t_use if tset != "none" else None)
                        if not cs or cs[1] <= 0:
                            continue
                        if A["single_txn_categories"].get(c) and cs[0] > 0:
                            # 한 달 1건 요금(통신비): 할인이 붙으면 그 결제 전액이 실적에서 빠짐(calc.py와 같음) → 한도와 무관하게 더함
                            L1s[B.x[c]] = L1s.get(B.x[c], 0) + cs[1]
                            continue
                        L1[B.x[c]] = L1.get(B.x[c], 0) + cs[1]
                        if cs[0] > 0:
                            rhos.append((cs[0] * S[c], cs[1] * S[c]))
                    if key[0] == "own":
                        for cp in b.get("caps", []):
                            if cp.get("basis", "benefit") == "benefit":
                                amt = _amount_for_tier(cp["by_tier"], t_use if tset != "none" else None)
                                if amt is not None:
                                    own_caps_m.append(amt / MONTHS[cp["period"]])
                if not L1 and not L1s:
                    continue
                capm = key[2] if key[0] == "shared" else (min(own_caps_m) if own_caps_m else None)
                g = M.var(f"g[{B.sid}|{ctier}|{key[1]}]", 0)
                g_all.append(g)
                if capm is not None and rhos:
                    # 빠지는 금액은 총지출을 넘을 수 없다. 혜택률이 아주 낮으면(1294: 0.6%) 한도 ÷ 혜택률이 big-M보다 커져
                    # 모든 경우가 불가능(해 없음)해지므로 총지출로 자른다
                    L2 = min(capm / (sum(a for a, _ in rhos) / sum(e for _, e in rhos)), sum(S.values()))
                    dl = M.var(f"dl[{B.sid}|{ctier}|{key[1]}]", 0, 1, True)
                    M.con({dl: 1, B.y: -1}, hi=0)
                    # g ≥ L1 − M·δ,  g ≥ L2 − M(1−δ)  (구간 상태 W가 켜졌을 때)
                    neg_s = {v: -c for v, c in L1s.items()}
                    t1 = {g: 1.0, dl: Mbig, **neg_s}
                    for v, c in L1.items():
                        t1[v] = t1.get(v, 0) - c
                    gge(t1, [cwt], 0.0, Mbig)
                    gge({g: 1.0, dl: -Mbig, B.y: Mbig, **neg_s}, [cwt], L2, Mbig)
                else:
                    t1 = {g: 1.0, **{v: -c for v, c in L1s.items()}}
                    for v, c in L1.items():
                        t1[v] = t1.get(v, 0) - c
                    gge(t1, [cwt], 0.0, Mbig)
        M.con({B.d: 1, **{g: -1.0 for g in g_all}}, lo=0, hi=0)
        M.con({B.d: 1, B.y: -Mbig}, hi=0)


def _own_caps(M, B, b, sts, tset, terms_total, cs_lookup, Mbig=1e7):
    for cap in b.get("caps", []):
        basis = cap.get("basis", "benefit")
        for (tier, wt, lo, hi) in sts:
            amt = _amount_for_tier(cap["by_tier"], tier)
            if amt is None:
                continue
            monthly = amt / MONTHS[cap["period"]]
            if basis == "benefit":
                terms = dict(terms_total)
            else:
                terms = {}
                ok = True
                for v in terms_total:
                    name = B_name_cat(B, v)
                    if name is None:
                        continue
                    rho = cs_lookup(tier, name)
                    if not rho:
                        continue
                    terms[v] = 1.0 / rho
                if not terms:
                    continue
            # Σa ≤ 한도·y + M·(y − W)   (y=0이면 혜택이 모두 0)
            if tset == "none":
                terms[B.y] = terms.get(B.y, 0) - monthly
            else:
                for vv, cc in wt.items():
                    terms[vv] = terms.get(vv, 0) + Mbig * cc
                terms[B.y] = terms.get(B.y, 0) - Mbig - monthly
            M.con(terms, hi=0)


def B_name_cat(B, var):
    for (bid, c), v in B.a.items():
        if v == var:
            return c
    return None


def solve(records, spending, A, **kw):
    """lb: 이미 아는 해의 목적값(예: 카드 수를 하나 줄인 풀이). 그보다 나쁜 해를 탐색에서 잘라 속도를 높인다."""
    time_limit = kw.pop("time_limit", 60)
    node_limit = kw.pop("node_limit", None)
    lb = kw.pop("lb", None)
    M, blocks, cats = build(records, spending, A, **kw)
    if lb is not None:
        M.con({i: c for i, c in enumerate(M.obj) if c != 0}, lo=lb - 1.0)
    res = M.solve(time_limit=time_limit, node_limit=node_limit)
    if res.x is None:
        return {"status": res.status, "message": res.message, "objective": None, "cards": []}
    x = res.x
    chosen = []
    for B in blocks:
        if x[B.y] > 0.5:
            assign = {c: float(round(x[B.x[c]])) for c in cats if x[B.x[c]] > 0.5}  # 솔버 허용오차(예: 49,999.9999) 제거
            opts = list(B.opts) + [oid for oid, ov in B.o.items() if x[ov] > 0.5]
            ben = 0.0
            for (bid, c), v in B.a.items():
                ben += x[v]
            for bid, v in B.aper.items():
                ben += x[v]
            tier = None
            for (t, wt, lo, hi) in B.W["card"]:
                if sum(x[v] * cc for v, cc in wt.items()) > 0.5:
                    tier = t
            chosen.append({"sid": B.sid, "name": B.rec["card"]["name"], "options": opts, "assign": assign,
                           "milp_benefit": ben, "fee_month": annual_fee(B.rec) / 12, "tier": tier})
    return {"status": res.status, "message": res.message, "objective": -res.fun, "cards": chosen, "mip_gap": getattr(res, "mip_gap", None)}
