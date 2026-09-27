"""
walletOptimizerCore.py(다구간 실적 MILP 확장)의 회귀 테스트입니다.

Pyodide 없이 순수 CPython + scipy만으로 돌아갑니다 — walletOptimizerCore.py 자체가
브라우저 전용 API를 전혀 안 쓰기 때문에, 이 스크립트로 로직만 따로 빠르게 검증할 수
있습니다(실행: python3 scripts/testWalletOptimizerCore.py).

구간 선택(reached/z 변수) 로직을 고칠 때마다 이 스크립트를 다시 돌려서 회귀가 없는지
확인하는 걸 권장합니다.
"""

import sys
import importlib.util
from pathlib import Path

CORE_PATH = Path(__file__).resolve().parent.parent / "src/domain/engine/walletOptimizerCore.py"
spec = importlib.util.spec_from_file_location("core", CORE_PATH)
core = importlib.util.module_from_spec(spec)
spec.loader.exec_module(core)


def card(id_, tiers, annual_fee=0, excluded=None):
    return {"id": id_, "annualFee": annual_fee, "excludedCategories": excluded or [], "tiers": tiers}


def tier(min_spend, benefits):
    return {"minSpend": min_spend, "benefits": benefits}


def rule(category, rate, cap=None, type_="point"):
    r = {"category": category, "type": type_, "rate": rate}
    if cap is not None:
        r["capPerMonth"] = cap
    return r


def run(name, candidates, spending, options, expect):
    result = core.solve_wallet(candidates, spending, options)
    ok = True
    details = []
    for k, v in expect.items():
        actual = result.get(k)
        if isinstance(v, float) or isinstance(actual, float):
            match = abs((actual or 0) - v) < 1e-6
        else:
            match = actual == v
        if not match:
            ok = False
            details.append(f"  {k}: expected {v}, got {actual}")
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name}")
    if not ok:
        for d in details:
            print(d)
        print("  full result:", result)
    return ok


def run_tier_status(name, candidates, spending, options, card_id, expect):
    """cardTierStatus[card_id]의 개별 필드들을 검증한다(중첩 dict라 run()의 단순 top-level
    비교로는 확인이 안 돼서 별도 헬퍼로 뺐다)."""
    result = core.solve_wallet(candidates, spending, options)
    status = (result.get("cardTierStatus") or {}).get(card_id)
    ok = True
    details = []
    if status is None:
        ok = False
        details.append(f"  cardTierStatus에 {card_id}가 없음 (result: {result.get('cardTierStatus')})")
    else:
        for k, v in expect.items():
            actual = status.get(k)
            if isinstance(v, float) or isinstance(actual, float):
                match = abs((actual or 0) - v) < 1e-6
            else:
                match = actual == v
            if not match:
                ok = False
                details.append(f"  {k}: expected {v}, got {actual}")
    print(f"[{'PASS' if ok else 'FAIL'}] {name}")
    if not ok:
        for d in details:
            print(d)
        print("  full cardTierStatus:", result.get("cardTierStatus"))
    return ok


def main():
    all_ok = True

    # ---- A: 구간이 올라갈수록 요율이 오르는 카드가, 총 지출(같은 카드에 배정된 다른
    # 카테고리 지출까지 합친 것)에 따라 실제로 다른 요율을 받는지 ----
    c1 = card(
        "tiered",
        [
            tier(0, [rule("etc", 0.0)]),
            tier(300000, [rule("etc", 0.005)]),
            tier(1000000, [rule("etc", 0.015)]),
        ],
    )
    c2 = card("flat", [tier(0, [rule("etc", 0.01)])])

    all_ok &= run(
        "A1: 지출이 크면 최고 구간(1.5%)까지 도달해서 고정 1% 카드를 이긴다",
        [c1, c2],
        {"etc": 2000000},
        {"maxCards": 1},
        {"selectedCardIds": ["tiered"], "totalMonthlyBenefit": 2000000 * 0.015},
    )
    all_ok &= run_tier_status(
        "A1-tier: cardTierStatus가 최고 구간(index 2) 도달을 보여준다",
        [c1, c2],
        {"etc": 2000000},
        {"maxCards": 1},
        "tiered",
        {
            "tierIndex": 2,
            "tierCount": 3,
            "qualifyingSpend": 2000000,
            "nextTierMinSpend": None,
            "tierLocked": False,
        },
    )

    all_ok &= run_tier_status(
        "A1b-tier: 경쟁 카드 없이 혼자 후보면 중간 구간(index 1)에서 멈춘 상태를 보여준다",
        [c1],
        {"etc": 500000},
        {"maxCards": 1},
        "tiered",
        {
            "tierIndex": 1,
            "tierCount": 3,
            "qualifyingSpend": 500000,
            "nextTierMinSpend": 1000000,
            "tierLocked": False,
        },
    )

    all_ok &= run(
        "A2: 중간 지출이면 1구간(0.5%)까지만 도달해서 고정 1% 카드가 더 유리하다",
        [c1, c2],
        {"etc": 500000},
        {"maxCards": 1},
        {"selectedCardIds": ["flat"], "totalMonthlyBenefit": 500000 * 0.01},
    )

    all_ok &= run(
        "A3: 첫 구간(30만원)에도 못 미치면 기본 요율 0%라서 고정 1% 카드가 이긴다",
        [c1, c2],
        {"etc": 100000},
        {"maxCards": 1},
        {"selectedCardIds": ["flat"], "totalMonthlyBenefit": 100000 * 0.01},
    )

    # ---- B: 구간이 올라갈수록 요율이 오히려 낮아지는 카드(GOAT BC 바로카드 사례)는
    # 안전하게 구간 선택을 포기하고 tiers[0] 요율로 고정해야 한다 ----
    c3 = card(
        "declining",
        [
            tier(0, [rule("etc", 0.015)]),
            tier(1000000, [rule("etc", 0.01)]),
        ],
    )
    all_ok &= run(
        "B: 요율이 구간마다 낮아지는 카드는 구간 로직을 안 쓰고 tiers[0]만 쓴다",
        [c3],
        {"etc": 2000000},
        {"maxCards": 1},
        {"selectedCardIds": ["declining"], "totalMonthlyBenefit": 2000000 * 0.015},
    )
    all_ok &= run_tier_status(
        "B-tier: 비단조 카드는 tierLocked=True로 표시되고 다음 구간 정보는 비운다",
        [c3],
        {"etc": 2000000},
        {"maxCards": 1},
        "declining",
        {
            "tierIndex": 0,
            "tierCount": 2,
            "qualifyingSpend": 2000000,
            "nextTierMinSpend": None,
            "tierLocked": True,
        },
    )

    # ---- C: excludedCategories에 들어간 카테고리는 그 카드의 실적 집계에서 빠져야 한다 ----
    c4 = card(
        "excl",
        [
            tier(0, [rule("shopping", 0.0)]),
            tier(500000, [rule("shopping", 0.05)]),
        ],
        excluded=["dining"],
    )
    all_ok &= run(
        "C1: 제외된 카테고리 지출은 실적에 안 잡혀서 구간에 못 미친다",
        [c4],
        {"shopping": 400000, "dining": 700000},
        {"maxCards": 1},
        {"totalMonthlyBenefit": 0.0},  # shopping 400k < 500k 구간 기준(제외 전이라면 1.1M로 넘었을 것)
    )

    # 제외 없이 같은 걸 반복하면 dining까지 실적에 잡혀서 구간을 넘는다.
    # 주의: 카드가 어떤 카테고리에도 혜택이 전혀 없으면(모든 구간에서 rate=0), 그
    # 카테고리 지출은 이 카드에 배정되는 것 자체가 모델에 없어서(x 변수가 안 생김) 실적
    # 집계에도 안 잡힌다 — 이건 이번 확장으로 생긴 제약이 아니라 "실제 혜택이 있는
    # (카드,카테고리) 쌍에만 변수를 만든다"는 원래 모델의 희소성 설계 자체의 한계다
    # (변수 개수를 줄여 solver를 빠르게 유지하려는 의도된 트레이드오프). 그래서 아래
    # 카드는 dining에도 아주 작은(0.1%) 혜택을 둬서 변수가 생기게 한다.
    c5 = card(
        "no_excl",
        [
            tier(0, [rule("shopping", 0.0), rule("dining", 0.001)]),
            tier(500000, [rule("shopping", 0.05), rule("dining", 0.001)]),
        ],
    )
    all_ok &= run(
        "C2: 제외가 없으면 합산 지출이 구간을 넘어 shopping도 5%를 받는다",
        [c5],
        {"shopping": 400000, "dining": 700000},
        {"maxCards": 1},
        {"totalMonthlyBenefit": 400000 * 0.05 + 700000 * 0.001},
    )

    # ---- D: baselineSpendByCardId(이 앱이 못 잡는 지출을 가상으로 더해주는 옵션)가
    # 실제로 구간 도달 판정에 반영되는지 ----
    c6 = card(
        "baseline",
        [
            tier(0, [rule("etc", 0.0)]),
            tier(1000000, [rule("etc", 0.02)]),
        ],
    )
    all_ok &= run(
        "D1: 배정된 지출(60만원)만으로는 100만원 구간에 못 미친다",
        [c6],
        {"etc": 600000},
        {"maxCards": 1},
        {"totalMonthlyBenefit": 0.0},
    )
    all_ok &= run(
        "D2: baselineSpendByCardId(50만원)를 더하면 100만원 구간을 넘는다",
        [c6],
        {"etc": 600000},
        {"maxCards": 1, "baselineSpendByCardId": {"baseline": 500000}},
        {"totalMonthlyBenefit": 600000 * 0.02},
    )
    all_ok &= run_tier_status(
        "D2-tier: qualifyingSpend에 baseline(50만원)까지 합산되어 최고 구간으로 표시된다",
        [c6],
        {"etc": 600000},
        {"maxCards": 1, "baselineSpendByCardId": {"baseline": 500000}},
        "baseline",
        {
            "tierIndex": 1,
            "tierCount": 2,
            "qualifyingSpend": 1100000,
            "nextTierMinSpend": None,
            "tierLocked": False,
        },
    )

    # ---- E: 구간이 하나뿐인 카드(카탈로그 대다수)는 예전과 완전히 같은 결과가 나와야
    # 한다(회귀 없음 확인) ----
    c7 = card("simple", [tier(0, [rule("cafe", 0.03, cap=15000)])])
    all_ok &= run(
        "E: 구간이 1개뿐인 카드는 한도 포함 기존 방식과 동일하게 계산된다",
        [c7],
        {"cafe": 1000000},
        {"maxCards": 1},
        {"totalMonthlyBenefit": 15000.0},  # 100만원*3%=3만원인데 한도 1.5만원에 걸림
    )

    print()
    print("ALL PASS" if all_ok else "SOME FAILED")
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
