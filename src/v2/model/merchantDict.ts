import brandCategory from "@data/catalog/brand-category.json";

/**
 * 명세서 가맹점 이름 → 카테고리(2026-10-31). 명세서 읽기에서만 쓴다.
 * importerParser의 KEYWORD_MAP은 카드 혜택 문구 해석에도 쓰여서, '빵'·'아울렛' 같은 낱말을 거기 넣으면
 * 카드 혜택 계산까지 바뀐다. 그래서 명세서 전용 사전을 따로 두고 KEYWORD_MAP보다 먼저 본다.
 */

/**
 * 명세서에 법인명으로 찍히는 브랜드. 줄에서 법인명을 브랜드 이름으로 바꾼 뒤 카테고리·자주 가는 곳을 찾는다.
 * 법인 하나가 여러 브랜드를 운영하면(비알코리아 = 배스킨라빈스·던킨 등) 넣지 않는다.
 */
export const CORPORATE_NAMES: Record<string, string> = {
  에프알엘코리아: "유니클로",
  에이치앤엠헤네스앤모리츠: "H&M",
  에이치앤엠헤네스앤: "H&M",
  에이치앤엠: "H&M",
  비지에프리테일: "CU",
  코리아세븐: "세븐일레븐",
  우아한형제들: "배달의민족",
  위대한상상: "요기요",
  에스씨케이컴퍼니: "스타벅스",
  씨제이올리브영: "올리브영",
  아성다이소: "다이소",
  한국맥도날드: "맥도날드",
  비케이알: "버거킹",
  // 카드 혜택의 철도 할인은 대부분 'KTX' 브랜드·여행 카테고리다(2026-10-31 확인: 여행 61장, 대중교통 12장).
  // 일반열차 결제도 KTX로 보게 되지만, 대중교통으로 넣으면 버스·지하철 할인이 KTX 요금에 붙는 쪽이 더 크게 틀린다
  한국철도공사: "KTX",
  카카오모빌리티: "카카오T",
  // 케이뱅크 명세서(2026-10-31)에서 확인. 둘 다 카드 혜택 데이터에 브랜드로 나온다
  신세계프라퍼티: "스타필드",
  로쏘주식회사: "성심당",
  넷플릭스서비시스코리아: "넷플릭스",
  십일번가: "11번가",
};

/**
 * 단계별 낱말. 앞 단계에서 걸리면 뒤 단계는 보지 않는다(같은 단계에서는 긴 낱말이 먼저).
 *  1. 브랜드·체인 이름  2. 파는 것(빵, 토스트…)  3. 장소 유형(백화점, 아울렛)
 * '빵 백화점'(빵집)처럼 장소 낱말이 이름에 섞인 가게는 파는 것이 먼저 걸린다.
 */
const TIERS: Array<Record<string, string[]>> = [
  {
    mart: ["트레이더스", "코스트코", "이마트에브리데이", "식자재마트"],
    // 백화점·아울렛 안 매장은 백화점 이름으로 결제돼 백화점, 밖의 의류 매장은 의류/패션(2026-10-31 카테고리 나눔)
    department: ["롯데몰", "스타필드", "더현대", "아이파크몰", "타임스퀘어", "코엑스몰"],
    fashion: ["유니클로", "H&M", "자라", "ZARA", "에잇세컨즈", "탑텐", "스파오"],
    // OTT·디지털 구독(카드 혜택 데이터의 브랜드는 brand-category.json이 먼저 잡는다)
    subscription: ["ChatGPT", "OpenAI", "넷플릭스", "유튜브프리미엄", "티빙", "쿠팡플레이", "디즈니플러스", "스포티파이"],
    cafe: ["배스킨라빈스", "던킨", "파리바게뜨", "뚜레쥬르", "공차", "매머드", "더벤티", "크리스피크림", "성심당"],
    // 푸디스트: 학교·회사 구내식당 운영사(사조푸디스트 등)
    dining: ["맥도날드", "버거킹", "롯데리아", "맘스터치", "KFC", "서브웨이", "이삭토스트", "김밥천국", "본죽", "아웃백", "빕스", "애슐리", "쉐이크쉑", "교촌", "BBQ", "BHC", "굽네", "토리키조쿠", "에머이", "지지고", "푸디스트"],
    household: ["다이소"],
    // 철도·고속/시외버스는 대중교통이 아니라 기차/고속버스(intercity). 역 안 편의점(코레일유통)은 편의점.
    // 근거(2026-10-31 카드 혜택 데이터): 'KTX·고속버스 5% 적립'처럼 여행에 묶인 카드 41장 이상, 대중교통 혜택은
    // '시외·고속버스 제외'를 원문에 적은 카드가 많음(SolSol, NH20해봄, LOCA 365 등 7장). 포함하는 카드는 이동 전반 묶음 몇 장뿐.
    // 같은 날 여행/숙박에서 따로 뗐다: 업종 혜택 '철도 5천원 할인'(42장)과 '숙박 10%'(22장)가 서로의 결제에 붙지 않게
    intercity: ["코레일", "레츠코레일", "철도공사", "고속버스", "시외버스", "KOBUS", "코버스", "버스타고"],
    convenience: ["코레일유통", "스토리웨이"],
    // 택시는 대중교통이 아니라 자동차(app_category car). 근거: '택시 10% 할인' 등 자동차 업종 혜택 132장, 카카오T 브랜드 23장,
    // 대중교통 혜택 원문은 '택시 제외'(하나 1Q Play1, NH 올바른 하나로, 국민행복 체크 등). 주차·통행료도 자동차 업종 혜택(19장·11장)
    car: ["택시", "카카오택시", "아이엠택시", "주차", "하이패스", "한국도로공사", "통행료"],
  },
  {
    cafe: ["베이글", "도넛", "빵", "떡", "모찌", "제과", "아이스크림", "젤라또", "케이크", "마카롱", "와플", "디저트", "커피"],
    dining: ["토스트", "김밥", "분식", "떡볶이", "버거", "쌀국수", "이자카야", "야키토리", "포차", "주점", "술집", "냉면", "칼국수", "국수", "곱창", "막창", "횟집", "돈까스", "돈가스", "라멘", "우동", "마라탕", "샤브", "닭갈비", "감자탕", "해장국", "순대", "브런치", "레스토랑", "비스트로", "뷔페", "맥주", "호프", "음식점"],
    // 아래는 카드 업종 혜택 원문에 나오는 업종 이름(2026-10-31, 현행 카드 업종 혜택의 제목·원문에서 4장 이상이 한 카테고리로 묶은 낱말).
    // 괄호는 그 카테고리로 묶은 카드 수. '충전'처럼 다른 결제(교통카드 충전)에 섞이는 낱말은 구체적인 이름으로만 넣는다
    medical: ["산후조리원" /* 25 */, "조산원" /* 10 */, "한약방" /* 9 */, "안경" /* 안경점 5 */, "의료" /* 29 */],
    education: ["학습지" /* 23 */, "학원", "독서실", "교습소", "YBM"],
    beautyFitness: ["미용" /* 미용원 8·미용업종 5·피부미용실 5 */, "이용원" /* 5 */, "헤어", "이발", "헬스클럽" /* 10 */, "피부관리"],
    gas: ["전기차" /* 34 */, "수소충전" /* 수소차 11 */, "LPG" /* 30 */],
    bills: ["보험" /* 손해·생명·화재·운전자·자동차보험 */, "공과금" /* 9 */, "관리비"],
    travel: ["항공" /* 10 */, "여행"],
    fashion: ["의류", "패션"],
    subscription: ["구독"],
    mobile: ["케이블TV", "휴대폰", "휴대전화" /* 14 */, "유플러스", "브로드밴드", "헬로비전"],
    // 명세서에는 '경기인천버스(대표)'·'08월경기버스8건'처럼 지역+버스로 찍혀 '버스' 하나로 찾는다(2026-11-02).
    // 현행 대중교통 혜택 325장 중 원문에 버스 포함 266장·지하철 292장·공항철도 15장. '버스 제외' 33장은 거의 고속·시외버스이고 그건 1단계 intercity가 먼저 잡는다
    transport: ["후불교통" /* 55 */, "교통카드", "교통공사", "지하철", "전철", "공항철도", "버스"],
  },
  {
    department: ["아울렛", "백화점"],
  },
];

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, "");
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\&-]/g, "\\$&");

interface WordTest {
  category: string;
  test: (line: string) => boolean;
}

/** 영문 3글자 이하(KFC, H&M 등)는 낱말 경계로만 찾는다(brandMatchers와 같은 규칙) */
function wordTest(word: string, category: string): WordTest {
  if (/^[A-Za-z0-9.+&-]{1,3}$/.test(word)) {
    const re = new RegExp(`(^|[^A-Za-z0-9])${escape(word)}([^A-Za-z0-9]|$)`, "i");
    return { category, test: (line) => re.test(line) };
  }
  const s = squash(word);
  return { category, test: (line) => squash(line).includes(s) };
}

const TIER_TESTS: WordTest[][] = TIERS.map((tier) =>
  Object.entries(tier)
    .flatMap(([category, words]) => words.map((w) => ({ w, category })))
    .sort((a, b) => b.w.length - a.w.length)
    .map(({ w, category }) => wordTest(w, category)),
);

/**
 * 명세서 한글 표기 → 카드 혜택 데이터의 표기(2026-10-31). 혜택에는 'VIPS'로, 명세서에는 '빕스'로 찍히면 브랜드 혜택과 이어지지 않는다.
 * 다른 낱말에 섞이기 쉬운 것('플로' → 플로리스트)은 넣지 않는다.
 */
export const STATEMENT_SPELLINGS: Record<string, string> = {
  빕스: "VIPS",
  씨지브이: "CGV",
  씨유: "CU",
  지에스25: "GS25",
  케이에프씨: "KFC",
  비에이치씨: "BHC",
  // 신한카드 명세서(2026-11-02) '(주)와이비엠넷'. YBM은 카드 혜택 데이터에 교육 브랜드('YBM어학원')로 나온다
  와이비엠: "YBM",
  에스케이텔레콤: "SKT",
  SK텔레콤: "SKT",
  엘지유플러스: "LG U+",
  지에스샵: "GS SHOP",
  티지아이프라이데이스: "TGIF",
  이케아: "IKEA",
  // 구독 서비스는 명세서에 영문 결제 이름으로 찍히는 경우가 많다(2026-11-01). 대소문자는 가리지 않는다
  NETFLIX: "넷플릭스",
  SPOTIFY: "스포티파이",
  YOUTUBE: "유튜브 프리미엄",
  OPENAI: "ChatGPT",
  ANTHROPIC: "Claude",
  "CLAUDE.AI": "Claude",
  TVING: "티빙",
  WAVVE: "웨이브",
  WATCHA: "왓챠",
  "DISNEY PLUS": "디즈니+",
};

/** 카드 혜택 데이터에 나오는 브랜드 이름 전부(명세서에서 브랜드를 빠짐없이 찾는 데 쓴다) */
export const CATALOG_BRAND_NAMES: string[] = Object.keys(brandCategory.brands as Record<string, string>);

const CORPORATE_ENTRIES = Object.entries({ ...CORPORATE_NAMES, ...STATEMENT_SPELLINGS }).sort((a, b) => b[0].length - a[0].length);

/** 줄에 있는 법인명·한글 표기를 브랜드 이름으로 바꾼다('(주)에프알엘코리아' → '(주)유니클로', '빕스' → 'VIPS') */
export function withBrandNames(line: string): string {
  let out = line;
  for (const [corp, brand] of CORPORATE_ENTRIES) {
    const re = new RegExp(corp.split("").map(escape).join("\\s*"), "gi");
    out = out.replace(re, brand);
  }
  return out;
}

/**
 * 카드 혜택에 나오는 브랜드 → 그 혜택의 카테고리(data/catalog/brand-category.json, scripts/buildBrandCategory.ts로 만듦).
 * 엔진은 브랜드 혜택을 혜택 카테고리 안에서만 계산하므로 명세서 전용 사전보다 먼저 본다.
 * 한글 2글자 이하('공차', '빚은')는 가맹점명 낱말의 맨 앞에서만 찾는다('아이스크림' 속 '크림', '스타벅스' 속 '벅스'는 아님)
 */
const CATALOG_TESTS: WordTest[] = Object.entries(brandCategory.brands as Record<string, string>)
  .sort((a, b) => b[0].length - a[0].length)
  .map(([name, category]) => {
    const n = name.replace(/\s+/g, "");
    if (/^[가-힣]{1,2}$/.test(n)) {
      const re = new RegExp(`(^|[^가-힣A-Za-z0-9])${n}`);
      return { category, test: (line: string) => re.test(line) };
    }
    return wordTest(name, category);
  });

export function catalogCategory(line: string): string | null {
  return CATALOG_TESTS.find((t) => t.test(line))?.category ?? null;
}

/** 글자 수가 다른 두 문자열의 편집 거리(바꾸기·넣기·빼기 횟수) */
function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

let FUZZY: { name: string; category: string }[] | null = null;
function fuzzyNames() {
  if (FUZZY) return FUZZY;
  const out = new Map<string, string>();
  for (const [name, cat] of Object.entries(brandCategory.brands as Record<string, string>)) out.set(squash(name), cat);
  for (const [cat, words] of Object.entries(TIERS[0])) for (const w of words) out.set(squash(w), cat);
  // 법인명은 그 브랜드의 카테고리로('에프알엘코리아' → 유니클로 → 의류)
  for (const [corp, brand] of Object.entries(CORPORATE_NAMES)) {
    const cat = out.get(squash(brand)) ?? statementCategory(brand);
    if (cat) out.set(squash(corp), cat);
  }
  // 5글자 이상만(4글자는 한 글자 차이로 다른 가게가 걸렸다: '올리브홀딩스' → '올리브영')
  FUZZY = [...out].filter(([n]) => /^[가-힣]{5,}$/.test(n)).map(([name, category]) => ({ name, category }));
  return FUZZY;
}

/**
 * 사진 글자 인식(OCR)으로 읽은 이름을 '거의 같은' 브랜드로 분류한다(2026-11-02). 이름은 고치지 않고 카테고리만 정한다.
 * 작게 캡처한 사진에서 '트레이더스' → '르레이더스', '배스킨라빈스' → '배스킨라번스', '이삭토스트' → '미삭토스트'처럼 한두 글자가 틀렸다.
 * 한글 5글자 이상 이름만, 5~6글자는 1글자·7글자 이상은 2글자까지 다른 것만 인정한다(짧은 이름은 한 글자로 다른 가게가 된다).
 * 2026-11-02 PDF 명세서 4장의 '그 외' 가맹점 35곳에 돌려 잘못 걸리는 곳이 없는 것을 확인했다.
 * 가게 이름을 낱말로 나눠 낱말의 앞부분하고만 비교한다(브랜드는 보통 가게 이름 맨 앞. 중간까지 보면 '정성플러스'의 '성플러스'가 '홈플러스'로 걸렸다)
 */
export function fuzzyCategory(name: string): string | null {
  // 쿠팡은 두 글자라 비교로 못 찾지만 명세서에는 늘 '쿠팡(쿠페이)'·'쿠팡(와우멤버십)' 꼴로 찍힌다('쿠등(쿠케이', '쿠광(와우멤배심)'으로 읽혔다)
  if (/쿠[가-힣]\s*\(?\s*(쿠[가-힣]이|와우)/.test(name)) return catalogCategory("쿠팡");
  const words = name
    .split(/[\s()[\]_\-·,]+/)
    .map((w) => w.replace(/[^가-힣]/g, ""))
    .filter((w) => w.length >= 3);
  let best: { category: string; d: number } | null = null;
  for (const b of fuzzyNames()) {
    const tol = b.name.length >= 7 ? 2 : 1;
    for (const w of words) {
      for (let len = b.name.length - 1; len <= Math.min(w.length, b.name.length + 1); len++) {
        const d = editDistance(w.slice(0, len), b.name);
        if (d <= tol && (!best || d < best.d)) best = { category: b.category, d };
      }
    }
  }
  return best?.category ?? null;
}

/** 명세서 한 줄 → 카테고리. 사전에 없으면 null(호출한 쪽이 KEYWORD_MAP 결과를 쓴다) */
export function statementCategory(line: string): string | null {
  for (const tier of TIER_TESTS) {
    const hit = tier.find((t) => t.test(line));
    if (hit) return hit.category;
  }
  return null;
}
