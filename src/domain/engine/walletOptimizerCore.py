"""
buildWalletBlueprint (src/domain/engine/walletOptimizer.ts)의 Python 포트.

브라우저 메인 스레드에서 javascript-lp-solver(순수 JS, 후보가 늘어나면 거의 지수적으로
느려짐)로 풀던 MILP를, Web Worker 안에서 Pyodide + scipy.optimize.milp(HiGHS)로 풉니다.
서버 없이 브라우저 안에서만 동작하며, Worker 안에서 실행되므로 UI 스레드를 막지 않습니다.

TypeScript 원본(walletOptimizer.ts)은 이 파일과 기본 골격(y/x/b 변수, 목적함수, 카드 개수·
연회비 상한 제약)은 같지만, 아래 설명하는 "구간 선택"(reached/z 변수)까지는 아직 이식하지
않았습니다 — 그 경로는 지금 앱에서 실제로 쓰이지 않는(legacy/미사용) 코드라 우선순위를
낮췄습니다. 실제 서비스가 쓰는 계산은 전부 이 파일 기준입니다.

  변수
    y_c        : 카드 c를 지갑에 포함할지 (이진)
    x_{c,i}    : 카테고리 i 지출 중 카드 c에 배정한 금액 (연속, >= 0)
    b_{c,i}    : x_{c,i}에서 실제로 발생하는 혜택액 (연속, >= 0)
  단, (c, i) 쌍은 카드 c가 카테고리 i에 대해 "어느 구간에서든" rate > 0인 규칙을 가진
  경우에만 변수를 만듭니다 (희소성 최적화 — TS 원본과 동일한 발상. 예전엔 tiers[0]만
  봐서 기본 구간 요율이 0이고 실적을 채워야만 요율이 붙는 카드(예: 씨티 리워드)가 변수
  자체가 없어 최적화 후보에서 통째로 빠졌었는데, 이제는 그런 카드도 포함됩니다).

  구간(전월실적 tiers)이 2개 이상인 카드는 추가로:
    reached_{c,k} ∈ {0,1} : 카드 c가 그 달 총 이용액으로 k번째 구간(tiers[k], k>=1)에
                            도달했는지
    z_{c,i,k}  ≥ 0        : x_{c,i} · reached_{c,k}를 표현하는 선형화 보조변수
  로 "이번 달 이 카드에 얼마를 몰아주면 어느 구간까지 열리는지"까지 최적화가 스스로
  판단하게 만듭니다(구간 선택을 사용자가 미리 정해주는 게 아니라 endogenous하게 계산).

  목적함수: maximize  Σ b_{c,i} − Σ (annualFee_c/12 + managementCostPerCard)·y_c

  제약조건
    Σ_c y_c ≤ min(maxCards, len(candidates))
    (선택) Σ_c annualFee_c · y_c ≤ maxTotalAnnualFee
    각 카테고리 i: Σ_c x_{c,i} ≤ spend_i
    각 (c,i):      x_{c,i} − spend_i · y_c ≤ 0   (선택 안 한 카드로는 배정 불가)
    각 (c,i):      b_{c,i} − baseRate_{c,i}·x_{c,i} − Σ_k increment_{c,i,k}·z_{c,i,k} ≤ 0
                   (baseRate = tiers[0]의 요율, increment_k = tiers[k]-tiers[k-1] 요율차)
    각 (c,i) capPerMonth 있으면: b_{c,i} ≤ capPerMonth_{c,i}  (변수 상한. 구간마다 달라질
                   수 있지만, 아래 "한도(capPerMonth) 처리" 참고 — 가장 타이트한 값 하나로
                   고정해서 씀)
    z 선형화(이진 × 연속의 표준 기법, k는 구간마다):
      z_{c,i,k} ≤ x_{c,i}
      z_{c,i,k} ≤ spend_i · reached_{c,k}
      x_{c,i} − z_{c,i,k} ≤ spend_i · (1 − reached_{c,k})
    구간 도달 조건 (baseline_c는 아래 "전월실적 산정" 참고, 기본 0):
      m_{c,k} · reached_{c,k} − Σ_{i not excluded} x_{c,i} ≤ baseline_c
      (상한만 있고 하한이 없어도 되는 이유: 요율 증분이 항상 ≥0이라 목적함수를 최대화하는
      과정에서 solver가 조건이 되는 한 reached를 스스로 1로 밀어 올리기 때문 — 표준적인
      "수량 할인(quantity discount)" MILP 정식화와 동일한 트릭)

  구간별 요율이 오히려 낮아지는 카드(1528장 중 발견된 건 GOAT BC 바로카드 1장뿐 — "100만원
  초과부터" 요율이 떨어지는 특이 구조)는 위 트릭이 안 통합니다(도달해도 손해일 수 있는데
  일단 도달하면 되돌릴 방법이 없음). 이런 카드는 감지해서 안전하게 구간 선택 없이 그냥
  tiers[0]만 쓰는 기존 방식으로 되돌립니다(카드 전체 단위로 판단 — 카테고리 하나만
  비단조여도 그 카드는 전부 tiers[0] 고정).

  한도(capPerMonth) 처리: cardConverter.ts의 estimateCapPerMonth는 요율이 높을수록 한도를
  더 타이트하게 추정하는 휴리스틱이라(둘 다 실측이 아니라 추정), 구간이 오르면 요율은
  오르는데 한도(추정값)는 오히려 내려가는 경우가 실제로 있습니다. 한도까지 reached에
  연동시키면(요율과 같은 방식으로) "추정 위에 추정"이 겹쳐 복잡도만 커지므로, 대신 그
  카드·카테고리의 모든 구간 중 가장 타이트한(작은) 한도 하나로 고정해서 상수 상한으로
  씁니다 — 실제보다 유리하게 보여주지 않는 쪽으로 근사한다는 이 프로젝트의 기존 방침과
  같은 방향입니다.

  전월실적 산정(어떤 지출이 "그 카드 실적"으로 잡히는지):
    - excludedCategories: 카드별로 전월실적에서 빼는 카테고리(WalletCard 타입에 이미 있던
      필드). 지금 카탈로그에는 항상 빈 배열이라 동작 변화는 없지만, 나중에 실제 제외
      카테고리 데이터가 채워지면 자동으로 반영되도록 미리 배선해 둡니다.
    - baselineSpendByCardId(options, 카드ID -> 원/월, 선택): 이 앱이 카테고리로 잡지 못하는
      지출(공과금, 이미 그 카드로 나가는 고정 지출 등)이 있어도 실제로는 전월실적에
      잡히는 경우가 있습니다. 이 값을 카드별로 넣어주면 "혜택 계산에는 안 들어가지만
      구간 도달 판정에는 더해지는" 가상의 기본 실적으로 취급합니다. 지금은 이 값을 채워
      주는 화면이 없어서 항상 0(=기존과 동일)이지만, 나중에 "이 카드 원래 매달 이 정도는
      쓰고 있어요" 같은 입력을 추가할 때 이 옵션만 채우면 바로 반영되도록 미리 만들어
      둡니다.
"""

import json
from collections import defaultdict

import numpy as np
from scipy.optimize import milp, LinearConstraint, Bounds
from scipy.sparse import coo_matrix

MIN_MEANINGFUL_SPEND = 1
# 구간별 요율이 부동소수점 오차로 아주 살짝(예: 1e-13) 줄어든 것처럼 보이는 것까지
# "요율이 낮아지는 카드"로 오판하지 않기 위한 허용 오차.
MONOTONIC_EPS = 1e-9


def _rate_and_cap(tier, category):
    for rule in (tier or {}).get("benefits", []) or []:
        if rule.get("category") == category:
            return rule.get("rate", 0) or 0, rule.get("capPerMonth")
    return 0.0, None


def _rate_sequence(card, category):
    """카드의 구간(tiers)마다 이 카테고리의 요율을 tiers 순서(오름차순) 그대로 뽑는다."""
    return [_rate_and_cap(tier, category)[0] for tier in (card.get("tiers") or [])]


def _max_rate(card, category):
    rates = _rate_sequence(card, category)
    return max(rates) if rates else 0.0


def _min_cap(card, category):
    caps = [cap for _, cap in (_rate_and_cap(tier, category) for tier in (card.get("tiers") or [])) if cap is not None]
    return min(caps) if caps else None


def _is_nondecreasing(seq):
    return all(seq[i] <= seq[i + 1] + MONOTONIC_EPS for i in range(len(seq) - 1))


class InfeasibleError(Exception):
    pass


def solve_wallet(candidates, spending, options):
    """
    candidates: list of card dicts (id, annualFee, excludedCategories?, tiers[{minSpend,
      benefits[{category,rate,capPerMonth}]}] — tiers는 minSpend 오름차순)
    spending: dict categoryId -> monthly amount
    options: {maxCards, managementCostPerCard?, maxTotalAnnualFee?, baselineSpendByCardId?}

    returns dict matching WalletBlueprint, except selectedCards/assignments reference
    cards only by id (JS 쪽에서 원본 candidate 객체로 다시 매핑합니다).

    추가로 "cardTierStatus" 필드(dict, cardId -> {tierIndex, tierCount, qualifyingSpend,
    nextTierMinSpend, tierLocked})를 반환합니다. 구간이 2개 이상이면서 실제로 선택된 카드에
    대해서만 채워지며(구간이 하나뿐인 카드는 보여줄 게 없어서 제외), UI에서 "이 카드가 지금
    몇 번째 구간에 도달했는지 / 다음 구간까지 얼마 남았는지"를 보여주는 데 씁니다.
      - tierIndex: 도달한 구간의 인덱스(0-base, tiers 배열 기준)
      - tierCount: 그 카드의 전체 구간 개수(len(tiers))
      - qualifyingSpend: baseline + 이 카드에 실제로 배정된(제외 카테고리 제외) 지출 합
      - nextTierMinSpend: 다음 구간의 minSpend(이미 최고 구간이면 None)
      - tierLocked: True면 이 카드는 요율이 구간마다 낮아지는 비단조 카드라 구간 선택
        로직을 안 쓰고 tiers[0]로 고정했다는 뜻(이 경우 tierIndex=0, nextTierMinSpend=None
        으로 고정되며, qualifyingSpend만 참고용으로 계산해서 보여줌)
    """
    max_cards = options.get("maxCards", 0)
    management_cost_per_card = options.get("managementCostPerCard", 0) or 0
    max_total_annual_fee = options.get("maxTotalAnnualFee")
    baseline_spend_by_card = options.get("baselineSpendByCardId") or {}

    categories_with_spend = [(cat, amt or 0) for cat, amt in spending.items() if (amt or 0) > 0]
    spend_by_category = dict(categories_with_spend)

    empty = {
        "feasible": False,
        "selectedCardIds": [],
        "assignments": [],
        "totalMonthlyBenefit": 0,
        "totalMonthlyFee": 0,
        "totalMonthlyManagementCost": 0,
        "netMonthlyBenefit": 0,
    }

    if not candidates or not categories_with_spend or max_cards <= 0:
        return {**empty, "feasible": True}

    n = len(candidates)
    var_index = {}
    var_kind = []  # "y" | "x" | "b" | "reached" | "z", per column, aligned with var_index insertion order
    ub = []  # upper bound per variable (lb is always 0)
    obj = []  # objective coefficient (for scipy minimize -> already negated where needed)

    def add_var(kind, card_id, slot, upper_bound, objective_coeff):
        idx = len(var_kind)
        var_index[(kind, card_id, slot)] = idx
        var_kind.append(kind)
        ub.append(upper_bound)
        obj.append(objective_coeff)
        return idx

    for card in candidates:
        card_id = card["id"]
        annual_fee = card.get("annualFee", 0) or 0
        add_var("y", card_id, None, 1.0, annual_fee / 12 + management_cost_per_card)

    # x/b 변수는 (카드, 카테고리) 조합 중 "어느 구간에서든" rate > 0인 규칙이 있는 것만
    # 만든다 (희소성). base_rate는 항상 tiers[0] 기준(구간 로직의 시작점).
    pair_rules = []  # (card, category, spend, base_rate, cap)
    for card in candidates:
        tiers = card.get("tiers") or []
        for category, spend in categories_with_spend:
            if _max_rate(card, category) <= 0:
                continue
            base_rate = _rate_and_cap(tiers[0], category)[0] if tiers else 0.0
            cap = _min_cap(card, category)
            pair_rules.append((card, category, spend, base_rate, cap))

    for card, category, spend, base_rate, cap in pair_rules:
        add_var("x", card["id"], category, np.inf, 0.0)
        b_ub = cap if cap is not None else np.inf
        add_var("b", card["id"], category, b_ub, -1.0)  # maximize b -> minimize -b

    pairs_by_card = defaultdict(list)  # card_id -> [(category, spend, base_rate, cap), ...]
    for card, category, spend, base_rate, cap in pair_rules:
        pairs_by_card[card["id"]].append((category, spend, base_rate, cap))

    # 구간이 2개 이상이고, 실제로 지출이 있는 카테고리 중 요율이 구간이 오를수록 낮아지는
    # 경우가 없는 카드만 "구간 선택도 최적화가 결정"하는 대상으로 삼는다.
    card_tiers = {}  # card_id -> tiers (endogenous 모드 적용 대상만)
    for card in candidates:
        card_id = card["id"]
        if card_id not in pairs_by_card:
            continue
        tiers = card.get("tiers") or []
        if len(tiers) < 2:
            continue
        if all(_is_nondecreasing(_rate_sequence(card, category)) for category, *_ in pairs_by_card[card_id]):
            card_tiers[card_id] = tiers

    # reached_{c,k} (k=1..len(tiers)-1, tiers[0]은 항상 기본 구간이라 변수가 필요 없음)
    reached_index = {}  # (card_id, k) -> var idx
    for card_id, tiers in card_tiers.items():
        for k in range(1, len(tiers)):
            reached_index[(card_id, k)] = add_var("reached", card_id, k, 1.0, 0.0)

    # z_{c,i,k} = x_{c,i} * reached_{c,k} (요율이 실제로 바뀌는 구간에서만 만든다)
    z_info = {}  # (card_id, category, k) -> (var idx, increment)
    for card_id, tiers in card_tiers.items():
        for category, spend, base_rate, cap in pairs_by_card[card_id]:
            rates = [_rate_and_cap(t, category)[0] for t in tiers]
            for k in range(1, len(tiers)):
                increment = rates[k] - rates[k - 1]
                if increment <= MONOTONIC_EPS:
                    continue
                z_idx = add_var("z", card_id, (category, k), spend, 0.0)
                z_info[(card_id, category, k)] = (z_idx, increment)

    num_vars = len(var_kind)

    # ---- 제약조건 (전부 "<=" 형태의 부등식 하나로 쌓는다) ----
    rows, cols, data, row_ub = [], [], [], []

    def add_term(row, col, value):
        rows.append(row)
        cols.append(col)
        data.append(value)

    row = 0

    # budget: sum y_c <= min(maxCards, n)
    for card in candidates:
        add_term(row, var_index[("y", card["id"], None)], 1.0)
    row_ub.append(min(max_cards, n))
    row += 1

    # annual fee ceiling (optional): sum annualFee_c * y_c <= maxTotalAnnualFee
    if max_total_annual_fee is not None:
        for card in candidates:
            annual_fee = card.get("annualFee", 0) or 0
            add_term(row, var_index[("y", card["id"], None)], annual_fee)
        row_ub.append(max_total_annual_fee)
        row += 1

    # category cap: sum_c x_{c,i} <= spend_i
    cat_row = {}
    for category, spend in categories_with_spend:
        cat_row[category] = row
        row_ub.append(spend)
        row += 1
    for card, category, spend, base_rate, cap in pair_rules:
        add_term(cat_row[category], var_index[("x", card["id"], category)], 1.0)

    # xlink: x_{c,i} - spend_i * y_c <= 0
    for card, category, spend, base_rate, cap in pair_rules:
        x_idx = var_index[("x", card["id"], category)]
        y_idx = var_index[("y", card["id"], None)]
        add_term(row, x_idx, 1.0)
        add_term(row, y_idx, -spend)
        row_ub.append(0.0)
        row += 1

    # bRateLink: b_{c,i} - base_rate_{c,i} * x_{c,i} - Σ_k increment_k * z_{c,i,k} <= 0
    for card, category, spend, base_rate, cap in pair_rules:
        card_id = card["id"]
        b_idx = var_index[("b", card_id, category)]
        x_idx = var_index[("x", card_id, category)]
        add_term(row, b_idx, 1.0)
        add_term(row, x_idx, -base_rate)
        if card_id in card_tiers:
            for k in range(1, len(card_tiers[card_id])):
                z = z_info.get((card_id, category, k))
                if z:
                    z_idx, increment = z
                    add_term(row, z_idx, -increment)
        row_ub.append(0.0)
        row += 1

    # z 선형화 (이진 reached × 연속 x의 표준 선형화, McCormick 스타일):
    #   z <= x
    #   z <= spend_i * reached
    #   x - z <= spend_i * (1 - reached)
    for (card_id, category, k), (z_idx, increment) in z_info.items():
        x_idx = var_index[("x", card_id, category)]
        reached_idx = reached_index[(card_id, k)]
        spend_i = spend_by_category[category]

        add_term(row, z_idx, 1.0)
        add_term(row, x_idx, -1.0)
        row_ub.append(0.0)
        row += 1

        add_term(row, z_idx, 1.0)
        add_term(row, reached_idx, -spend_i)
        row_ub.append(0.0)
        row += 1

        add_term(row, x_idx, 1.0)
        add_term(row, z_idx, -1.0)
        add_term(row, reached_idx, spend_i)
        row_ub.append(spend_i)
        row += 1

    # 구간 도달 조건: m_{c,k} * reached_{c,k} - Σ_{i not excluded} x_{c,i} <= baseline_c
    for card_id, tiers in card_tiers.items():
        excluded = set(next(c for c in candidates if c["id"] == card_id).get("excludedCategories") or [])
        baseline = baseline_spend_by_card.get(card_id, 0) or 0
        card_x_idx = [
            var_index[("x", card_id, category)]
            for category, *_ in pairs_by_card[card_id]
            if category not in excluded
        ]
        for k in range(1, len(tiers)):
            reached_idx = reached_index[(card_id, k)]
            min_spend = tiers[k].get("minSpend", 0) or 0
            add_term(row, reached_idx, min_spend)
            for x_idx in card_x_idx:
                add_term(row, x_idx, -1.0)
            row_ub.append(baseline)
            row += 1

    num_rows = row
    A = coo_matrix((data, (rows, cols)), shape=(num_rows, num_vars)).tocsr()
    constraints = LinearConstraint(A, -np.inf, np.array(row_ub, dtype=float))

    lb_arr = np.zeros(num_vars)
    ub_arr = np.array(ub, dtype=float)
    bounds = Bounds(lb_arr, ub_arr)

    integrality = np.array([1 if k in ("y", "reached") else 0 for k in var_kind])
    c_vec = np.array(obj, dtype=float)

    result = milp(c=c_vec, constraints=constraints, integrality=integrality, bounds=bounds)

    if not result.success:
        return empty

    x_sol = result.x

    selected_card_ids = []
    for card in candidates:
        y_idx = var_index[("y", card["id"], None)]
        if x_sol[y_idx] > 0.5:
            selected_card_ids.append(card["id"])

    selected_set = set(selected_card_ids)
    assignments = []
    total_monthly_benefit = 0.0
    for card, category, spend, base_rate, cap in pair_rules:
        card_id = card["id"]
        if card_id not in selected_set:
            continue
        spend_amount = x_sol[var_index[("x", card_id, category)]]
        if spend_amount < MIN_MEANINGFUL_SPEND:
            continue
        benefit_amount = x_sol[var_index[("b", card_id, category)]]
        assignments.append(
            {
                "category": category,
                "cardId": card_id,
                "spend": spend_amount,
                "benefitAmount": benefit_amount,
            }
        )
        total_monthly_benefit += benefit_amount

    total_monthly_fee = sum((c.get("annualFee", 0) or 0) / 12 for c in candidates if c["id"] in selected_set)
    total_monthly_management_cost = len(selected_card_ids) * management_cost_per_card

    # 화면에 "이 카드가 지금 몇 번째 구간인지 / 다음 구간까지 얼마 남았는지"를 보여주기 위한
    # 정보. 구간이 2개 이상인 선택된 카드에 대해서만 채운다(대부분의 카드는 구간이
    # 하나뿐이라 보여줄 게 없음).
    card_tier_status = {}
    for card_id in selected_set:
        card = next((c for c in candidates if c["id"] == card_id), None)
        if card is None:
            continue
        tiers = card.get("tiers") or []
        if len(tiers) < 2:
            continue
        excluded = set(card.get("excludedCategories") or [])
        baseline = baseline_spend_by_card.get(card_id, 0) or 0
        qualifying_spend = baseline + sum(
            x_sol[var_index[("x", card_id, category)]]
            for category, *_ in pairs_by_card.get(card_id, [])
            if category not in excluded
        )
        if card_id in card_tiers:
            # reached_{c,k}가 1인 것 중 가장 높은 k가 실제로 solver가 판정한 구간이다.
            tier_index = 0
            for k in range(1, len(tiers)):
                if x_sol[reached_index[(card_id, k)]] > 0.5:
                    tier_index = k
            next_tier_min_spend = tiers[tier_index + 1]["minSpend"] if tier_index + 1 < len(tiers) else None
            card_tier_status[card_id] = {
                "tierIndex": tier_index,
                "tierCount": len(tiers),
                "qualifyingSpend": qualifying_spend,
                "nextTierMinSpend": next_tier_min_spend,
                "tierLocked": False,
            }
        else:
            # 구간이 올라갈수록 요율이 오히려 낮아지는 카드(위 card_tiers 설명 참고)라
            # 구간 로직 자체를 안 쓰고 항상 tiers[0]로 계산했다. "다음 구간"을 알려주면
            # 오히려 오해를 살 수 있어 비워둔다.
            card_tier_status[card_id] = {
                "tierIndex": 0,
                "tierCount": len(tiers),
                "qualifyingSpend": qualifying_spend,
                "nextTierMinSpend": None,
                "tierLocked": True,
            }

    return {
        "feasible": True,
        "selectedCardIds": selected_card_ids,
        "assignments": assignments,
        "totalMonthlyBenefit": total_monthly_benefit,
        "totalMonthlyFee": total_monthly_fee,
        "totalMonthlyManagementCost": total_monthly_management_cost,
        "netMonthlyBenefit": total_monthly_benefit - total_monthly_fee - total_monthly_management_cost,
        "cardTierStatus": card_tier_status,
    }


def solve_wallet_json(candidates_json: str, spending_json: str, options_json: str) -> str:
    candidates = json.loads(candidates_json)
    spending = json.loads(spending_json)
    options = json.loads(options_json)
    try:
        result = solve_wallet(candidates, spending, options)
        return json.dumps(result)
    except Exception as exc:  # noqa: BLE001 - Worker 쪽으로 에러 메시지를 그대로 전달
        return json.dumps({"ok": False, "error": str(exc)})
