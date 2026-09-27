import type { WalletCard, SpendCategoryId } from "./card";

/**
 * 카테고리 하나의 지출 중 일부(또는 전부)를 특정 카드로 결제하기로 배정했다는 뜻입니다.
 * 월 한도가 있는 카드는 한도까지만 배정되고 나머지는 다른 카드로 넘어갈 수 있으므로,
 * 같은 category 값을 가진 SlotAssignment가 여러 개(카드별로 하나씩) 있을 수 있습니다.
 * spend는 그 카드에 배정된 금액(카테고리 전체 지출이 아니라 이 카드가 맡은 몫)입니다.
 */
export interface SlotAssignment {
  category: SpendCategoryId;
  card: WalletCard;
  spend: number;
  benefitAmount: number;
}

/**
 * 카드 하나가 이번 최적화 결과에서 다구간 전월실적 중 어디까지 도달했는지 보여주는 정보.
 * 구간(tiers)이 2개 이상이면서 실제로 선택된 카드에 대해서만 채워집니다(구간이 하나뿐인
 * 카드는 보여줄 게 없어서 제외). walletOptimizerCore.py의 solve_wallet() 반환값 중
 * cardTierStatus를 그대로 옮긴 타입입니다.
 */
export interface CardTierStatus {
  /** 도달한 구간의 인덱스 (0-base, 카드의 tiers 배열 기준) */
  tierIndex: number;
  /** 그 카드의 전체 구간 개수 */
  tierCount: number;
  /** 실적 산정용 지출 합계(제외 카테고리 제외, baselineSpendByCardId 포함) */
  qualifyingSpend: number;
  /** 다음 구간의 최소 실적 금액. 이미 최고 구간이면 null */
  nextTierMinSpend: number | null;
  /**
   * true면 구간별 요율이 오히려 낮아지는 카드(예: GOAT BC 바로카드)라 구간 선택 로직을
   * 쓰지 않고 tiers[0]로 고정 계산했다는 뜻입니다. 이 경우 "다음 구간" 안내는 오해를 살
   * 수 있어 항상 null로 옵니다.
   */
  tierLocked: boolean;
}

export interface WalletBlueprint {
  /** true면 solver가 실제로 실행 가능한 해를 찾은 것. false면 아래 필드들은 참고용(빈 값)입니다. */
  feasible: boolean;
  /** 최종적으로 지갑에 담기로 선택된 카드들 (maxCards 이하) */
  selectedCards: WalletCard[];
  /**
   * 카테고리별 지출이 어떤 카드(들)에 얼마씩 배정됐는지 (지출이 0인 카테고리는 포함하지 않음).
   * 한 카테고리가 여러 카드로 나뉘어 배정된 경우, 같은 category를 가진 항목이 여러 개 들어있습니다.
   */
  assignments: SlotAssignment[];
  /** 선택된 카드들로부터 얻는 월 총 혜택액 합계 */
  totalMonthlyBenefit: number;
  /** 선택된 카드들의 "실제 연회비"만 월할로 환산한 합계입니다. 관리 비용은 포함하지 않습니다. */
  totalMonthlyFee: number;
  /**
   * 카드를 한 장 더 들고 다니는 데 드는 관리 부담(managementCostPerCard)의 월 합계입니다.
   * 연회비가 0원인 카드도 이 비용은 발생할 수 있어 totalMonthlyFee와 분리해서 보여줍니다.
   */
  totalMonthlyManagementCost: number;
  /** totalMonthlyBenefit - totalMonthlyFee - totalMonthlyManagementCost */
  netMonthlyBenefit: number;
  /** 선택된 카드 중 다구간 실적 카드의 구간 도달 현황 (카드ID -> CardTierStatus) */
  cardTierStatus: Record<string, CardTierStatus>;
}
