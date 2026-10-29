/**
 * 자동 변환 카드(카드고릴라 혜택 요약 한 줄)에서 혜택이 특정 브랜드에 한정되는지 판단합니다.
 *
 * 예전에는 "커피빈 15% 할인"을 카페 업종 전체 15%로 계산해서, 카페 지출 전부를 커피빈에서 쓰는 것처럼 혜택이 부풀었습니다.
 * 정답표(1_혜택정보구조화)와 같은 규칙으로 범위를 붙입니다.
 *  - 브랜드 1~3곳: brand (계산기가 카테고리 지출의 35%를 대상으로 봄, 브랜드 금액을 넣으면 그 값)
 *  - 브랜드 4곳 이상: merchant_group (70%)
 *  - 통신 3사를 모두 적은 혜택: 업종 전체(category). 통신 3사는 업종 전체로 본다는 기존 결정과 같음
 *  - '스타벅스 등'처럼 범위를 넓히는 말이 붙으면 업종 전체로 둡니다(덜 확실할 때는 지금까지와 같은 쪽)
 *
 * 브랜드 이름은 [대표 이름, ...다른 표기] 순서입니다. 대표 이름은 정답표의 가맹점 표기와 맞춰서,
 * 브랜드 금액 입력 화면에서 같은 브랜드가 한 줄로 묶이게 합니다.
 */
export const BRAND_NAMES: Record<string, string[][]> = {
  cafe: [
    ["스타벅스", "스벅", "STARBUCKS"],
    ["투썸플레이스", "투썸"],
    ["이디야", "EDIYA"],
    ["메가커피"],
    ["빽다방"],
    ["폴바셋"],
    ["할리스"],
    ["커피빈"],
    ["컴포즈커피", "컴포즈"],
    ["파스쿠찌"],
    ["엔제리너스"],
    ["탐앤탐스"],
    ["블루보틀"],
  ],
  convenience: [["GS25"], ["CU"], ["세븐일레븐"], ["이마트24"], ["미니스톱"]],
  mart: [
    ["이마트"],
    ["홈플러스"],
    ["롯데마트"],
    ["농협하나로마트", "농협하나로", "하나로마트"],
    ["다이소"],
    ["노브랜드"],
    ["코스트코"],
    ["트레이더스"],
  ],
  onlineShopping: [
    ["쿠팡"],
    ["네이버쇼핑"],
    ["네이버페이"],
    ["G마켓", "지마켓"],
    ["11번가"],
    ["SSG.COM", "SSG"],
    ["옥션"],
    ["컬리", "마켓컬리"],
    ["위메프"],
    ["티몬"],
    ["무신사"],
  ],
  dining: [
    ["배달의민족", "배민"],
    ["요기요"],
    ["쿠팡이츠"],
    ["맥도날드"],
    ["버거킹"],
    ["VIPS", "빕스"],
    ["아웃백"],
    ["롯데리아"],
    ["KFC"],
  ],
  culture: [
    ["넷플릭스"],
    ["유튜브 프리미엄", "유튜브"],
    ["디즈니+", "디즈니"],
    ["티빙"],
    ["웨이브"],
    ["왓챠"],
    ["CGV"],
    ["롯데시네마"],
    ["메가박스"],
    ["멜론"],
    ["지니"],
  ],
  gas: [["GS칼텍스", "칼텍스"], ["SK에너지"], ["S-OIL", "에쓰오일"], ["현대오일뱅크", "오일뱅크"]],
  mobile: [["SKT", "SK텔레콤"], ["KT"], ["LG U+", "LGU+", "엘지유플러스"]],
  department: [["롯데백화점"], ["신세계백화점"], ["현대백화점"], ["갤러리아"], ["AK플라자"]],
};

/** 이 브랜드를 모두 적으면 업종 전체로 본다 */
const WHOLE_CATEGORY: Record<string, string[]> = {
  mobile: ["SKT", "KT", "LG U+"],
};

/** 브랜드 뒤에 붙어 범위를 넓히는 말('스타벅스 등 커피전문점') */
const BROADENING = /등(?=[\s,)/]|$)/;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const ASCII = /[A-Za-z0-9]/;

/** 영문·숫자로 시작하거나 끝나는 이름은 다른 영문 단어 속에서 찾지 않는다('KT'가 'KTX' 안에서 잡히지 않게) */
function aliasPattern(alias: string): RegExp {
  const left = ASCII.test(alias[0]) ? "(?<![A-Za-z0-9])" : "";
  const right = ASCII.test(alias[alias.length - 1]) ? "(?![A-Za-z0-9&])" : "";
  return new RegExp(`${left}${escape(alias)}${right}`, "gi");
}

export interface BrandScope {
  specificity: "brand" | "merchant_group" | "category";
  merchants: string[];
}

export function inferBrandScope(category: string, clauses: string[]): BrandScope {
  const groups = BRAND_NAMES[category];
  if (!groups) return { specificity: "category", merchants: [] };
  let rest = clauses.join(" / ");
  const found: string[] = [];
  // 긴 표기부터 찾고 지운다('이마트24'를 '이마트'로 읽지 않게)
  const aliases = groups
    .flatMap((names) => names.map((alias) => ({ alias, canonical: names[0] })))
    .sort((a, b) => b.alias.length - a.alias.length);
  for (const { alias, canonical } of aliases) {
    const re = aliasPattern(alias);
    if (re.test(rest)) {
      if (!found.includes(canonical)) found.push(canonical);
      rest = rest.replace(aliasPattern(alias), " ");
    }
  }
  if (found.length === 0 || BROADENING.test(rest)) return { specificity: "category", merchants: [] };
  const whole = WHOLE_CATEGORY[category];
  if (whole && whole.every((b) => found.includes(b))) return { specificity: "category", merchants: [] };
  return { specificity: found.length <= 3 ? "brand" : "merchant_group", merchants: found };
}
