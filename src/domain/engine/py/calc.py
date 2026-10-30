"""
혜택 레코드(schema v0.1)로 카드 한 장의 월 혜택을 계산한다.

입력: 카드 레코드, 이 카드로 결제하는 카테고리별 월 지출, 가정값(assumptions.json)
출력: 월 혜택 합계와 혜택별 내역, 적용 구간, 사용한 가정 목록

원문에 없는 정보(브랜드 비중, 1회 결제 금액)는 가정값으로 채우고 결과에 표시한다.
"""
import json, math, functools
import numpy as np

MONTHS = {"day": 1 / 30, "month": 1, "quarter": 3, "half_year": 6, "year": 12, "card_year": 12, "one_time": 12}
DAYS_ALL = 7


# numpy 2.0부터 trapz → trapezoid. 앱 워커(Pyodide)의 numpy 1.26에서도 돌도록 둘 다 받는다
_trapz = getattr(np, "trapezoid", None) or np.trapz


def load(path):
    return json.load(open(path, encoding="utf-8"))


def _norm_m(s):
    return "".join((s or "").split()).lower()


def usable(b):
    """계산에 넣는 혜택인지. 사람 확인(review)·계산 제외(no_calc)는 빼고, 상태가 없는 예전 레코드는 넣는다"""
    return b.get("status", "auto") == "auto"


def channel_share(sc, cat, A):
    """온라인·오프라인 한정 혜택의 대상 비중(카테고리 지출 중 그 채널 결제 비중). 가정값이 없으면 1(예전 동작)"""
    ch = sc.get("channel") or "any"
    on = (A.get("online_share") or {}).get(cat)
    if ch == "any" or on is None:
        return 1.0
    return on if ch == "online" else 1.0 - on


def splits_spend(b):
    """같은 카테고리 '업종 전체' 혜택끼리 지출을 나눠 가지는지. 겹쳐 받는(stacks) 혜택은 같은 지출에 더해 주므로 나누지 않는다"""
    sc = b["scope"]
    return (sc["region"] != "overseas" and sc["specificity"] == "category" and bool(sc["app_category"])
            and b.get("stacking", "exclusive") == "exclusive")


def _chans(b):
    ch = b["scope"].get("channel") or "any"
    return ("online", "offline") if ch == "any" else (ch,)


def category_scales(benefits):
    """같은 카테고리 '업종 전체' 혜택끼리 지출을 나눠 가지는 비율. 온라인 한정과 오프라인 한정은 지출이 겹치지 않으므로
    채널별로 센다('모든 채널' 혜택은 양쪽에 다 셈). 반환: {혜택 id: 비율(1 이하)}"""
    cnt = {}
    for b in benefits:
        if splits_spend(b):
            for ch in _chans(b):
                k = (b["scope"]["app_category"], ch)
                cnt[k] = cnt.get(k, 0) + 1
    return {b["id"]: 1.0 / max(cnt[(b["scope"]["app_category"], ch)] for ch in _chans(b))
            for b in benefits if splits_spend(b)}


def _elig_share(sc, A):
    """브랜드·가맹점 묶음 혜택의 대상 비중. 사용자가 브랜드 비중을 입력했으면(user_brand_share) 그 값을 쓰고,
    입력이 없으면 기본 가정값(eligible_share_by_specificity)을 쓴다. 반환: (비중, 사용자 입력 여부)"""
    spec = sc["specificity"]
    ub = A.get("user_brand_share")
    if spec in ("brand", "merchant_group") and ub and sc.get("app_category") in ub:
        m = {_norm_m(k): v for k, v in ub[sc["app_category"]].items() if not k.startswith("_")}
        return min(1.0, sum(m.get(_norm_m(x), 0.0) for x in sc.get("merchants", []))), True
    return A["eligible_share_by_specificity"][spec], False


def _tier_of(tiers, amount):
    hit = None
    for t in tiers:
        if amount >= t["min_won"] and (t.get("max_won") is None or amount < t["max_won"]):
            hit = t["id"]
    return hit


def _amount_for_tier(by_tier, tier):
    exact = [x["amount_won"] for x in by_tier if x.get("tier") == tier]
    if exact:
        return exact[0]
    common = [x["amount_won"] for x in by_tier if x.get("tier") is None]
    return common[0] if common else None


def _txn_model(spend, cat, A, rate=None, min_txn=None, max_counted=None, max_b=None):
    """결제 건수와 '조건을 만족하는 결제 1건당' 기준 금액·혜택을 구한다.
    반환: (조건 만족 건수, 건당 기준금액 평균, 건당 혜택 평균(rate 있을 때))"""
    if spend <= 0:
        return 0.0, 0.0, 0.0
    if A["single_txn_categories"].get(cat):
        ok = spend >= (min_txn or 0)
        base = min(spend, max_counted) if max_counted else spend
        ben = rate * base if rate is not None else 0.0
        if max_b is not None:
            ben = min(ben, max_b)
        return (1.0 if ok else 0.0), base, ben
    mu = A["avg_ticket_won"].get(cat, 25000)
    n = spend / mu
    p, base_mean, ben_mean = _ticket_stats(mu, min_txn or 0, max_counted, rate, max_b)
    if p <= 0:
        return 0.0, 0.0, 0.0
    return n * p, base_mean, ben_mean


@functools.lru_cache(maxsize=4096)
def _ticket_stats(mu, m, max_counted, rate, max_b):
    """결제 금액 ~ 지수분포(평균 mu). 건당 최소 m 이상인 결제의 비율 p, 그 결제들의 평균 기준금액·평균 혜택.
    지출 규모와 무관해서 캐시한다(조합 탐색 속도용)."""
    x = np.linspace(m, m + 25 * mu, 20001)
    f = np.exp(-x / mu) / mu
    p = math.exp(-m / mu)
    if p <= 0:
        return 0.0, 0.0, 0.0
    base = np.minimum(x, max_counted) if max_counted else x
    base_mean = float(_trapz(base * f, x) / p)
    ben_mean = 0.0
    if rate is not None:
        b = rate * base
        if max_b is not None:
            b = np.minimum(b, max_b)
        ben_mean = float(_trapz(b * f, x) / p)
    return p, base_mean, ben_mean


def _count_limit(cond):
    cl = (cond or {}).get("count_limits") or {}
    lims = []
    if cl.get("per_month"): lims.append(cl["per_month"])
    if cl.get("per_half_year"): lims.append(cl["per_half_year"] / 6)
    if cl.get("per_year"): lims.append(cl["per_year"] / 12)
    if cl.get("per_day"): lims.append(cl["per_day"] * 30)
    return min(lims) if lims else None


def _value(benefit, tier, A, flags):
    allv = benefit["reward"]["value_by_tier"]
    vals = [v for v in allv if tier is not None and v.get("tier") == tier] or [v for v in allv if v.get("tier") is None]
    if not vals:
        return None
    if len(vals) > 1:
        pick = max if A["payment_condition_policy"] == "best" else min
        v = pick(vals, key=lambda z: z["value"])
        flags.add(f"{benefit['id']}: 결제 조건별 값 중 '{v.get('when', '')}' 적용")
        return v["value"]
    return vals[0]["value"]


def benefit_amount(rec, b, spending, tiers_now, A, flags, share_scale=None, covered=None, category_scale=None, log=None):
    """혜택 하나의 월 금액(자체 한도까지 적용). 공유 한도는 바깥에서 적용.
    share_scale: 카테고리별 비중 보정(같은 카테고리 브랜드 혜택들의 비중 합이 100%를 넘을 때)
    covered: 카테고리별로 다른(특정) 혜택이 이미 받은 지출. '모든 가맹점' 기본 적립은 이 지출을 빼고 계산"""
    sc, rw, cond = b["scope"], b["reward"], b.get("conditions") or {}
    b["_elig_by_cat"] = {}
    b["_trace"] = {"cats": [], "own_caps": [], "skip": None}
    if sc["region"] == "overseas":
        b["_trace"]["skip"] = "해외 혜택(국내 지출 계산에서 제외)"
        return 0.0, 0.0, 0.0
    if b.get("valid_to") and b["valid_to"] < A["eval_date"]:
        flags.add(f"{b['id']}: 기간 종료({b['valid_to']})")
        b["_trace"]["skip"] = f"프로모션 종료({b['valid_to']})"
        return 0.0, 0.0, 0.0
    tset = cond.get("tier_set", "card")
    tier = None if tset == "none" else tiers_now.get(tset)
    if tset != "none":
        allowed = cond.get("applies_in_tiers")
        if tier is None or (allowed is not None and tier not in allowed):
            b["_trace"]["skip"] = "실적 구간 미달" if tier is None or allowed is None else f"이 혜택은 {', '.join(allowed)} 구간에서만"
            return 0.0, 0.0, 0.0
    v = _value(b, tier, A, flags)
    if v is None:
        b["_trace"]["skip"] = "이 구간에 해당 값 없음"
        return 0.0, 0.0, 0.0
    b["_trace"].update(value=v, type=rw["type"], kind=rw["kind"], tier=tier)

    if sc["specificity"] == "all_merchants" and sc["app_category"] is None:
        excl = set(rec["performance"].get("excluded_app_categories", []))
        if tset not in ("card", "none"):
            ts = next(t for t in rec.get("local_tier_sets", []) if t["id"] == tset)
            excl = set(ts.get("excluded_app_categories", []))
        cats = [c for c in spending if c not in excl]
    else:
        cats = [sc["app_category"]]

    share, user_share = _elig_share(sc, A)
    days = sc.get("days", "any")
    day_share = {"any": 1.0, "weekend": 2 / 7, "weekday": 5 / 7}.get(days, len(sc.get("day_list", [])) / 7)
    if days != "any":
        flags.add(f"{b['id']}: 요일 한정({days} {''.join(sc.get('day_list', []))}) → 지출의 {day_share:.0%}만 대상으로 가정")
    hours = sc.get("hours")
    hour_share = 1.0
    if hours:
        # 시간대 한정(예: 오후 9시~오전 9시): 그 시간대 결제 비중을 가정값으로 둔다
        hour_share = A.get("time_window_share", {}).get("default", 1.0)
        flags.add(f"{b['id']}: 시간대 한정({hours.get('from')}~{hours.get('to')}) → 지출의 {hour_share:.0%}만 대상으로 가정")
    day_share = day_share * hour_share
    if sc["specificity"] in ("brand", "merchant_group"):
        if user_share:
            flags.add(f"{b['id']}: 입력한 브랜드 비중 {share:.0%}({', '.join(sc.get('merchants', [])[:3])})")
        else:
            flags.add(f"{b['id']}: 대상 가맹점 비중 {share:.0%} 가정({', '.join(sc.get('merchants', [])[:3])})")
    if sc.get("payment_condition"):
        if sc["specificity"] == "all_merchants":
            # 모든 가맹점 대상인데 결제 수단 조건이 붙은 혜택(간편결제 2% 등): 전부를 그 수단으로 결제한다고 보면 과대평가
            share = share * A["payment_method_share"]["default"]
            flags.add(f"{b['id']}: '{sc['payment_condition']}'로 결제하는 지출 비중 {A['payment_method_share']['default']:.0%} 가정")
        else:
            flags.add(f"{b['id']}: 결제 조건 '{sc['payment_condition']}'을 지킨다고 가정")

    total, elig_total = 0.0, 0.0
    elig_by_cat = {}
    lim = _count_limit(cond)
    exclusive_base = sc["specificity"] == "all_merchants" and rw["type"] in ("percent", "per_unit_spend", "won_per_liter") \
        and b.get("stacking", "exclusive") == "exclusive"
    def _target(cat):
        scale = 1.0
        if sc["specificity"] in ("brand", "merchant_group"):
            scale = (share_scale or {}).get(cat, 1.0)
        elif splits_spend(b):
            scale = (category_scale or {}).get(b["id"], 1.0)
        s = spending.get(cat, 0) * share * scale * day_share * channel_share(sc, cat, A)
        if exclusive_base and covered:
            s = max(0.0, s - covered.get(cat, 0.0))
        return s, scale

    # 횟수 제한(월 N회)은 혜택 하나에 걸린다: 여러 카테고리에 걸친 혜택(모든 가맹점 등)은 N회를 카테고리끼리 나눠 쓴다.
    # 건당 혜택이 큰 카테고리부터 채운다(MILP의 'Σ 카테고리별 횟수 ≤ N' 최적과 같음)
    alloc = None
    if lim is not None and rw["type"] in ("percent", "won_per_txn", "free_item") and len(cats) > 1:
        cnt = {}
        for cat in cats:
            s, _ = _target(cat)
            if s <= 0:
                continue
            if rw["type"] == "percent":
                n, _, per = _txn_model(s, cat, A, v, cond.get("min_txn_won"), cond.get("max_counted_txn_won"), cond.get("max_benefit_per_txn_won"))
            else:
                n, _, _ = _txn_model(s, cat, A, None, cond.get("min_txn_won"))
                per = 1.0
            cnt[cat] = (n, per)
        alloc, left = {}, lim
        for cat, (n, per) in sorted(cnt.items(), key=lambda kv: -kv[1][1]):
            alloc[cat] = min(n, left)
            left -= alloc[cat]
        if sum(n for n, _ in cnt.values()) > lim:
            flags.add(f"{b['id']}: 월 {lim:g}회 제한을 카테고리끼리 나눠 씀")

    for cat in cats:
        s, scale = _target(cat)
        if scale < 1.0 and splits_spend(b):
            flags.add(f"{b['id']}: 같은 카테고리 업종 혜택 {round(1 / scale)}개가 지출을 나눠 가짐")
        chs = channel_share(sc, cat, A)
        if chs < 1.0:
            flags.add(f"{b['id']}: {'온라인' if sc.get('channel') == 'online' else '오프라인'} 한정 → {cat} 지출의 {chs:.0%}만 대상으로 가정")
        if s <= 0:
            continue
        if log is not None and sc["specificity"] != "all_merchants":
            parts = [f"{cat} 지출 {spending.get(cat, 0):,.0f}원"]
            if share < 1: parts.append(f"대상 비중 {share:.0%}")
            if chs < 1: parts.append(f"{sc.get('channel')} 비중 {chs:.0%}")
            if scale < 1: parts.append(f"나눠 가짐 {scale:.0%}")
            if day_share < 1: parts.append(f"요일·시간대 {day_share:.0%}")
            if exclusive_base and covered and covered.get(cat): parts.append(f"특정 혜택 받은 {covered[cat]:,.0f}원 제외")
            log.append(f"    대상 지출: {' x '.join(parts)} → {s:,.0f}원")
        typ = rw["type"]
        if typ == "percent":
            n, base, per = _txn_model(s, cat, A, v, cond.get("min_txn_won"), cond.get("max_counted_txn_won"), cond.get("max_benefit_per_txn_won"))
            k = n if lim is None else alloc.get(cat, 0.0) if alloc is not None else min(n, lim)
            amt, elig = per * k, base * k
        elif typ in ("won_per_txn", "free_item"):
            n, base, _ = _txn_model(s, cat, A, None, cond.get("min_txn_won"))
            k = n if lim is None else alloc.get(cat, 0.0) if alloc is not None else min(n, lim)
            unit = v
            if typ == "free_item":
                unit = v * A["item_prices"][rw["item_key"]]
                flags.add(f"{b['id']}: 무료 제공 가격 {A['item_prices'][rw['item_key']]:,}원 가정")
            amt, elig = unit * k, base * k
        elif typ == "won_per_liter":
            amt, elig = s / A["fuel_price_won_per_liter"] * v, s
        elif typ == "per_unit_spend":
            amt, elig = s / rw["unit_spend_won"] * v, s
        elif typ == "won_per_period":
            amt, elig = 0.0, s
        else:
            raise ValueError(typ)
        total += amt
        elig_total += elig
        elig_by_cat[cat] = elig_by_cat.get(cat, 0.0) + elig
        b["_trace"]["cats"].append({"cat": cat, "spend": spending.get(cat, 0), "share": share, "scale": scale, "day_share": day_share,
                                    "covered": (covered or {}).get(cat, 0.0) if exclusive_base else 0.0, "target": s, "amount": amt, "eligible": elig})
        if log is not None and sc["specificity"] != "all_merchants" and typ != "won_per_period":
            extra = []
            if cond.get("min_txn_won"): extra.append(f"건당 {cond['min_txn_won']:,}원 이상 결제분만")
            if cond.get("max_benefit_per_txn_won"): extra.append(f"건당 최대 {cond['max_benefit_per_txn_won']:,}원")
            if lim is not None: extra.append(f"월 {lim:g}회까지")
            log.append(f"    계산: {typ} {v:g} {('(' + ', '.join(extra) + ')') if extra else ''} → {amt:,.0f}원")

    if log is not None and sc["specificity"] == "all_merchants" and elig_total > 0:
        note = f" (특정 혜택 받은 결제 제외)" if exclusive_base and covered else ""
        log.append(f"    대상 지출: 모든 카테고리 합 {elig_total:,.0f}원{note}" + (f", 요일·시간대 비중 {day_share:.0%} 반영" if day_share < 1 else ""))
        if rw["type"] != "won_per_period":
            log.append(f"    계산: {rw['type']} {v:g} → {total:,.0f}원")
    if rw["type"] == "won_per_period":
        total = v / MONTHS[rw.get("period_of_reward") or "month"] if elig_total > 0 else 0.0
        if log is not None:
            log.append(f"    계산: {rw.get('period_of_reward')}마다 {v:,.0f}원 → 월 환산 {total:,.0f}원")

    if rw["kind"] == "point":
        total *= A["point_value_won"]
    elif rw["kind"] == "mileage":
        total *= A["mileage_value_won"]
    elif rw["kind"] == "donation":
        total = 0.0

    raw = total
    b["_trace"]["raw"] = raw
    b["_trace"]["cond"] = {k: cond.get(k) for k in ("min_txn_won", "max_benefit_per_txn_won", "max_counted_txn_won") if cond.get(k)}
    b["_trace"]["count_limit"] = lim
    for cap in b.get("caps", []):
        amt = _amount_for_tier(cap["by_tier"], tier)
        if amt is None:
            continue
        monthly = amt / MONTHS[cap["period"]]
        b["_trace"]["own_caps"].append({"period": cap["period"], "amount": amt, "monthly": monthly, "hit": total > monthly})
        if cap.get("basis", "benefit") == "benefit":
            if log is not None and total > monthly:
                log.append(f"    자체 한도({cap['period']} {amt:,.0f}원 → 월 {monthly:,.0f}원)에 걸림: {total:,.0f} → {monthly:,.0f}원")
            total = min(total, monthly)
        elif cap["basis"] == "spend" and elig_total > monthly:
            total *= monthly / elig_total
    b["_elig_by_cat"] = elig_by_cat
    b["_trace"]["after_own_cap"] = total
    return total, elig_total, raw


def evaluate(rec, spending, A, option_ids=None, log=None, trace=None):
    """선택형 옵션 조합 하나에 대해 계산. option_ids=None이면 가장 유리한 옵션을 찾는다.
    (그룹마다 1개를 고르면 모든 조합을 계산하고, 2개 이상 고르는 그룹이 있으면 하나씩 늘려 가며 고른다)"""
    groups = rec.get("choice_groups", [])
    if option_ids is None and groups and any(g.get("choose", 1) > 1 for g in groups):
        # 여러 개를 고르는 선택형(예: 17개 영역 중 상위 5개)은 조합 수가 많아(17C5=6,188) 하나씩 늘려 가며 고른다:
        # 아직 덜 고른 그룹의 옵션 중 합계를 가장 크게 늘리는 것을 하나씩 추가
        chosen = []
        need = {g["id"]: g.get("choose", 1) for g in groups}
        best = evaluate(rec, spending, A, [])
        while any(n > 0 for n in need.values()):
            cand = None
            for g in groups:
                if need[g["id"]] <= 0:
                    continue
                for o in g["options"]:
                    if o["id"] in chosen:
                        continue
                    r = evaluate(rec, spending, A, chosen + [o["id"]])
                    if cand is None or r["total"] > cand[0]["total"] + 1e-9:
                        cand = (r, g["id"], o["id"])
            if cand is None:
                break
            best, gid, oid = cand
            chosen.append(oid)
            need[gid] -= 1
        if log is not None or trace is not None:
            if log is not None:
                log.append(f"[선택형] 여러 개를 고르는 선택형: 합계를 가장 크게 늘리는 옵션부터 차례로 {chosen} 선택")
            if trace is not None:
                trace["choice"] = {"best": chosen, "all": {}}
            return evaluate(rec, spending, A, chosen, log, trace)
        return best
    if option_ids is None and groups:
        import itertools
        best = None
        for combo in itertools.product(*[[o["id"] for o in g["options"]] for g in groups]):
            r = evaluate(rec, spending, A, list(combo))
            if best is None or r["total"] > best["total"]:
                best = r
        if log is not None or trace is not None:
            if log is not None:
                log.append(f"[선택형] 옵션 조합 {len(list(itertools.product(*[g['options'] for g in groups])))}가지를 모두 계산해 가장 유리한 {best['options']} 선택")
            if trace is not None:
                trace["choice"] = {"best": best["options"], "all": {",".join(cmb): evaluate(rec, spending, A, list(cmb))["total"] for cmb in itertools.product(*[[o["id"] for o in g["options"]] for g in groups])}}
            return evaluate(rec, spending, A, best["options"], log, trace)
        return best

    in_options = {x for g in groups for o in g["options"] for x in o["benefit_ids"]}
    chosen = {x for g in groups for o in g["options"] if o["id"] in (option_ids or []) for x in o["benefit_ids"]}
    active = [b for b in rec["benefits"] if (b["id"] not in in_options or b["id"] in chosen) and usable(b)]

    perf = rec["performance"]
    excl = set(perf.get("excluded_app_categories", []))
    q_raw = sum(v for c, v in spending.items() if c not in excl)
    local_q = {}
    for ts in rec.get("local_tier_sets", []):
        e = set(ts.get("excluded_app_categories", []))
        q = sum(v for c, v in spending.items() if c not in e)
        local_q[ts["id"]] = q * 12 if ts["basis"] in ("card_year", "calendar_year", "prev_year") else q * 3 if ts["basis"] == "quarter" else q

    # 같은 카테고리에 브랜드·묶음 혜택이 여러 개면 비중 합이 100%를 넘지 않게 보정
    share_sum = {}
    for b in active:
        sc = b["scope"]
        if sc["region"] != "overseas" and sc["specificity"] in ("brand", "merchant_group") and sc["app_category"]:
            share_sum[sc["app_category"]] = share_sum.get(sc["app_category"], 0) + _elig_share(sc, A)[0]
    share_scale = {c: (1.0 / v if v > 1 else 1.0) for c, v in share_sum.items()}
    # 같은 카테고리에 '업종 전체' 혜택이 여러 개면(예: 버스·지하철 10% / 택시 10%를 따로 적은 경우)
    # 같은 지출을 두 번 세지 않도록 나눠 가진다(겹쳐 받는 혜택은 빼고, 채널별로 센다)
    category_scale = category_scales(active)
    is_general = lambda b: b["scope"]["specificity"] == "all_merchants" and b["scope"].get("days", "any") == "any"
    specific = [b for b in active if not is_general(b)]
    general = [b for b in active if is_general(b)]

    q = q_raw
    seen = {}
    for _ in range(8):  # 할인받은 결제가 실적에서 빠지는 카드는 고정점까지 반복
        flags = set()
        tiers_now = {"card": _tier_of(perf["tiers"], q) if perf["basis"] != "none" else None}
        for ts in rec.get("local_tier_sets", []):
            tiers_now[ts["id"]] = _tier_of(ts["tiers"], local_q[ts["id"]])
        amounts, eligs, raws = {}, {}, {}
        covered = {}
        L = [] if log is not None else None
        if L is not None:
            L.append(f"[1단계 실적] 이 카드 지출 {sum(spending.values()):,.0f}원" + (f" - 실적 제외 카테고리({', '.join(sorted(excl))}) {sum(v for c2, v in spending.items() if c2 in excl):,.0f}원" if excl else "")
                     + (f" - 할인받아 실적에서 빠지는 결제 {q_raw - q:,.0f}원" if q_raw - q > 0.5 else "") + f" = 실적 {q:,.0f}원 → 구간 {tiers_now['card'] or '없음(혜택 못 받음)'}")
            for k, v in tiers_now.items():
                if k != "card": L.append(f"           별도 구간표 {k}: {local_q[k]:,.0f}원 → {v}")
            L.append("[2단계 혜택별 계산]")
        for b in specific:  # 특정 가맹점·업종 혜택 먼저
            if L is not None: L.append(f"  · {b['title']}")
            amounts[b["id"]], eligs[b["id"]], raws[b["id"]] = benefit_amount(rec, b, spending, tiers_now, A, flags, share_scale, None, category_scale, L)
            if amounts[b["id"]] > 0:
                for c, e in b.get("_elig_by_cat", {}).items():
                    covered[c] = covered.get(c, 0.0) + e
        for b in general:  # 모든 가맹점 기본 혜택은 특정 혜택이 받은 지출을 빼고
            if L is not None: L.append(f"  · {b['title']} (모든 가맹점)")
            amounts[b["id"]], eligs[b["id"]], raws[b["id"]] = benefit_amount(rec, b, spending, tiers_now, A, flags, share_scale, covered, category_scale, L)
        # 공유 한도: 묶인 혜택 수가 적은 것(영역 한도)부터 적용
        caps = sorted(rec.get("shared_caps", []), key=lambda c: sum(c["id"] in b.get("shared_cap_ids", []) for b in active))
        shared_events = []
        for cap in caps:
            amt = _amount_for_tier(cap["by_tier"], tiers_now["card"])
            ids = [b["id"] for b in active if cap["id"] in b.get("shared_cap_ids", [])]
            tot = sum(amounts[i] for i in ids)
            if ids and amt is not None:
                shared_events.append({"id": cap["id"], "label": cap.get("label", cap["id"]), "members": {i: amounts[i] for i in ids},
                                      "sum": tot, "cap": amt / MONTHS[cap["period"]], "factor": min(1.0, (amt / MONTHS[cap["period"]]) / tot) if tot > 0 else 1.0})
            if amt is not None and tot > amt / MONTHS[cap["period"]]:
                k = (amt / MONTHS[cap["period"]]) / tot
                if L is not None:
                    L.append(f"[3단계 공유 한도] {cap.get('label', cap['id'])}: 묶인 혜택 합 {tot:,.0f}원 > 한도 {amt:,.0f}원 → 각 혜택을 {k:.0%}로 줄임")
                for i in ids:
                    amounts[i] *= k
            elif amt is not None and L is not None and ids:
                L.append(f"[3단계 공유 한도] {cap.get('label', cap['id'])}: 묶인 혜택 합 {tot:,.0f}원 ≤ 한도 {amt:,.0f}원 → 그대로")
        state = (round(q), sum(amounts.values()), dict(amounts), dict(tiers_now), set(flags))
        last_log = L
        last_trace = {"benefits": {b["id"]: dict(b.get("_trace", {})) for b in active}, "shared": shared_events,
                      "q_raw": q_raw, "q": q, "excluded": sorted(excl), "local_q": dict(local_q), "inactive": [b["id"] for b in rec["benefits"] if b not in active]}
        by_id = {b["id"]: b for b in active}
        excl_ids = [i for i in amounts if by_id[i].get("counts_toward_performance") is False or
                    (perf.get("excludes_discounted_spend") and by_id[i]["reward"]["kind"] in ("discount", "cashback"))]
        if not excl_ids:
            break
        # 실제로 할인이 붙은 결제 금액만 실적에서 뺀다 (한도에 걸린 뒤의 결제는 할인 없이 실적에 남음)
        # 이미 실적에서 빠진 카테고리(예: 대중교통)의 할인 결제는 두 번 빼지 않는다
        disc = 0.0
        for i in excl_ids:
            if raws[i] <= 0:
                continue
            by_cat = by_id[i].get("_elig_by_cat") or {}
            ratio = amounts[i] / raws[i]
            if by_cat:
                for c2, v in by_cat.items():
                    if c2 in excl:
                        continue
                    # 한 달에 한 번 내는 요금(통신비 등)은 할인이 조금이라도 붙으면 그 결제 전액이 빠진다
                    disc += v * (1.0 if A["single_txn_categories"].get(c2) and amounts[i] > 0 else ratio)
            else:
                disc += eligs[i] * ratio
        q_new = max(0.0, q_raw - disc)
        if abs(q_new - q) < 1:
            break
        if round(q_new) in seen:  # 진동: 혜택 받은 달은 실적이 줄어 다음 달 혜택이 끊기는 상황 → 격월로 번갈아 받음
            a, b2 = seen[round(q_new)], state
            amounts = {k: (a[2].get(k, 0) + b2[2].get(k, 0)) / 2 for k in set(a[2]) | set(b2[2])}
            flags = a[4] | b2[4]
            flags.add("할인받은 결제가 실적에서 빠져 구간이 달마다 바뀜 → 두 달 평균 사용")
            q = (a[0] + b2[0]) / 2
            break
        seen[round(q)] = state
        q = q_new
    if log is not None and last_log is not None:
        log.extend(last_log)
        log.append(f"[4단계 합계] 월 {sum(amounts.values()):,.0f}원" + "".join(f"\n   가정: {f}" for f in sorted(flags)))
    for b in rec["benefits"]:  # 계산 중 붙인 임시 값 정리
        b.pop("_elig_by_cat", None)
        b.pop("_trace", None)
    if trace is not None:
        trace.update(last_trace)
        trace["final"] = dict(amounts)
        trace["flags"] = sorted(flags)
        trace["tiers"] = dict(tiers_now)
    return {
        "card": rec["card"]["name"], "options": option_ids, "tier": tiers_now, "qualifying_spend": q,
        "total": sum(amounts.values()), "by_benefit": {k: round(v) for k, v in amounts.items() if v > 0.5},
        "flags": sorted(flags),
    }


if __name__ == "__main__":
    import sys
    A = load("assumptions.json")
    rec = load(sys.argv[1])
    spending = json.loads(sys.argv[2])
    if "--explain" in sys.argv:
        log = []
        evaluate(rec, spending, A, log=log)
        print(f"{rec['card']['name']} / 월 지출 {sum(spending.values()):,.0f}원\n" + "\n".join(log))
    else:
        print(json.dumps(evaluate(rec, spending, A), ensure_ascii=False, indent=2))
