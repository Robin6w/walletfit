export interface ParsedSpendingItem {
  merchant: string;
  amount: number;
  category: string; // convenience, cafe, transport, mobile, onlineShopping, mart, dining, culture, gas, etc
}

// 한국어 지출 카테고리 매핑 규칙
export const KEYWORD_MAP: { [category: string]: string[] } = {
  cafe: ["스타벅스", "스벅", "투썸", "이디야", "커피", "메가커피", "빽다방", "폴바셋", "할리스", "카페", "디저트", "베이커리", "빵집", "설빙"],
  convenience: ["GS25", "CU", "세븐일레븐", "이마트24", "미니스톱", "편의점"],
  transport: ["택시", "버스", "지하철", "철도", "코레일", "SRT", "KTX", "티머니", "캐시비", "카카오T", "카카오택시", "타다", "대중교통"],
  mobile: ["SKT", "KT", "LGU+", "엘지유플러스", "알뜰폰", "통신요금", "통신비", "휴대폰요금"],
  onlineShopping: ["쿠팡", "네이버쇼핑", "네이버페이", "G마켓", "지마켓", "11번가", "SSG", "옥션", "마켓컬리", "컬리", "위메프", "티몬", "배송", "택배"],
  mart: ["이마트", "홈플러스", "롯데마트", "농협하나로", "하나로마트", "슈퍼마켓", "슈퍼", "마트", "다이소", "노브랜드", "SSM"],
  dining: ["식당", "맛집", "푸드", "고기집", "갈비", "삼겹살", "국밥", "찌개", "치킨", "피자", "족발", "보쌈", "스시", "초밥", "반점", "짜장면", "파스타", "배달의민족", "배민", "요기요", "쿠팡이츠", "한식", "양식", "중식", "일식"],
  culture: ["넷플릭스", "유튜브", "premium", "디즈니", "티빙", "웨이브", "CGV", "롯데시네마", "메가박스", "영화관", "멜론", "지니", "티켓", "공연", "연극"],
  gas: ["주유소", "GS칼텍스", "칼텍스", "SK에너지", "엔크린", "에쓰오일", "S-OIL", "오일뱅크", "주유", "충전소"],
};

const REFUND_KEYWORD_REGEX = /(?:승인취소|결제취소|취소완료|취소|환불)/i;
// 금액 패턴 (예: 12,000원, -5,500원, ▲5500, 45000 등). 부호(-, ▲)와 "원"은 있어도 없어도 매칭됩니다.
const AMOUNT_REGEX = /([-▲]?\s*)(\d{1,3}(,\d{3})+|\d+)\s*원?/g;
// 날짜/시간 표기(08/23, 14:15 등)를 금액으로 오인하지 않기 위한 최소 인정 금액
const MIN_RECOGNIZABLE_AMOUNT = 100;

interface AmountCandidate {
  value: number;
  hasNegativeSign: boolean;
  index: number;
  matchedText: string;
}

/** 한 줄에서 "금액처럼 보이는" 부분을 전부 찾는다. */
function findAmountCandidates(line: string): AmountCandidate[] {
  const candidates: AmountCandidate[] = [];
  for (const match of line.matchAll(AMOUNT_REGEX)) {
    const signPart = match[1].trim();
    const value = parseInt(match[2].replace(/,/g, ""), 10);
    if (value < MIN_RECOGNIZABLE_AMOUNT) continue;
    candidates.push({
      value,
      hasNegativeSign: signPart === "-" || signPart === "▲",
      index: match.index,
      matchedText: match[0],
    });
  }
  return candidates;
}

/** 한 줄에 금액이 여러 번 등장하면(할부 안내 등), 가장 마지막에 언급된 금액을 실제 결제 금액으로 본다. */
function selectPrimaryAmount(candidates: AmountCandidate[]): AmountCandidate | null {
  return candidates.length > 0 ? candidates[candidates.length - 1] : null;
}

function resolveSignedAmount(candidate: AmountCandidate, hasRefundKeyword: boolean): number {
  const isRefund = candidate.hasNegativeSign || hasRefundKeyword;
  return isRefund ? -Math.abs(candidate.value) : candidate.value;
}

const MERCHANT_NOISE_TOKENS = [
  "결제", "승인", "완료", "일시불", "금액", "이용", "건", "님", "고객님",
  "회원님", "체크", "신용", "원", "타사", "취소", "환불", "승인취소", "결제취소", "취소완료",
];

// 상호명 후보 텍스트를 순서대로 정제한다: 대괄호 제거 -> 소괄호 제거 -> MM/DD HH:MM 제거 -> YYYY-MM-DD 제거
const MERCHANT_TEXT_SANITIZERS: Array<(text: string) => string> = [
  (text) => text.replace(/\[[^\]]+\]/g, ""),
  (text) => text.replace(/\([^)]+\)/g, ""),
  (text) => text.replace(/\b\d{2}[/-]\d{2}\s+\d{2}:\d{2}\b/g, ""),
  (text) => text.replace(/\b\d{4}[/-]\d{2}[/-]\d{2}\b/g, ""),
];

/** 자유 텍스트를 정제한 뒤, 의미 없는 단어(결제/승인 등)를 뺀 토큰 목록으로 쪼갠다. */
function tokenize(rawText: string): string[] {
  if (!rawText) return [];
  const cleaned = MERCHANT_TEXT_SANITIZERS.reduce((text, sanitize) => sanitize(text), rawText).trim();
  if (!cleaned) return [];
  return cleaned.split(/\s+/).filter((token) => token.length > 0 && !MERCHANT_NOISE_TOKENS.includes(token));
}

function tokenIncludesKeyword(token: string, keyword: string): boolean {
  return token.toLowerCase().includes(keyword.toLowerCase());
}

// 상호명 후보를 우선순위대로 시도하는 리졸버 체인.
type MerchantResolver = (beforeTokens: string[], afterTokens: string[]) => string | null;

// 1순위: 금액 뒤 토큰 중 KEYWORD_MAP 브랜드명과 직접 매칭되는 것 (예: "결제취소 홍길동 15,000원 스타벅스")
const resolveMerchantFromAfterKeyword: MerchantResolver = (_before, afterTokens) =>
  afterTokens.find((token) => Object.values(KEYWORD_MAP).some((keywords) => keywords.some((kw) => tokenIncludesKeyword(token, kw)))) ?? null;

// 2순위: 금액 앞 토큰 중 가장 마지막 단어 (예: "홍길동 스타벅스" -> "스타벅스", "티머니 대중교통" -> "대중교통")
const resolveMerchantFromLastBeforeToken: MerchantResolver = (beforeTokens) =>
  beforeTokens.length > 0 ? beforeTokens[beforeTokens.length - 1] : null;

// 3순위: 금액 뒤 토큰의 첫 단어
const resolveMerchantFromFirstAfterToken: MerchantResolver = (_before, afterTokens) =>
  afterTokens.length > 0 ? afterTokens[0] : null;

const MERCHANT_RESOLVERS: MerchantResolver[] = [
  resolveMerchantFromAfterKeyword,
  resolveMerchantFromLastBeforeToken,
  resolveMerchantFromFirstAfterToken,
];

const DEFAULT_MERCHANT_NAME = "기타 가맹점";

function resolveMerchant(beforeTokens: string[], afterTokens: string[]): string {
  for (const resolve of MERCHANT_RESOLVERS) {
    const merchant = resolve(beforeTokens, afterTokens);
    if (merchant) return merchant;
  }
  return DEFAULT_MERCHANT_NAME;
}

/**
 * 짧은 키워드가 다른 카테고리의 긴 키워드 안에 우연히 통째로 들어있어서 생기는 오분류를
 * 막으려고, 카테고리 순서 대신 키워드 글자 수가 긴 것부터 먼저 검사한다.
 * 예: "KTX"(교통)가 "KT"(통신비)보다 길어서 먼저 검사되므로, "KTX"라는 글자에 통신비
 * 키워드 "KT"가 끼어 있어도 통신비로는 더 이상 잘못 잡히지 않는다. 같은 원리로
 * "쿠팡이츠"(외식)가 "쿠팡"(온라인쇼핑)보다, "이마트24"(편의점)가 "이마트"/"마트"(마트)보다
 * 먼저 검사된다.
 */
export const KEYWORD_CATEGORY_PAIRS: Array<{ keyword: string; category: string }> = Object.entries(KEYWORD_MAP)
  .flatMap(([category, keywords]) => keywords.map((keyword) => ({ keyword, category })))
  .sort((a, b) => b.keyword.length - a.keyword.length);

/**
 * 글자 수 우선순위만으로는 못 거르는, 순전히 우연히 겹치는 예외 사례들.
 * 실제 카드 카탈로그 데이터를 감사해서 확인한 확정 사례만 등록한다.
 *  - "슈퍼적립": 마트(슈퍼마켓)가 아니라 "더 많이 적립해준다"는 뜻의 마케팅 표현
 *  - "슈퍼프리미엄": 위와 같은 이유
 *  - "제주지니": 문화(지니뮤직)가 아니라 제주항공 자체 제휴 프로그램 이름
 */
export const FALSE_POSITIVE_PHRASES = ["슈퍼적립", "슈퍼프리미엄", "제주지니"];

/** text에서 needle이 나타나는 모든 자리를 같은 길이의 공백으로 지운다 (겹치는 재매칭을 막기 위함). */
export function blankOutAll(text: string, needle: string): string {
  if (!needle) return text;
  let result = text;
  let index = result.indexOf(needle);
  while (index !== -1) {
    result = result.slice(0, index) + " ".repeat(needle.length) + result.slice(index + needle.length);
    index = result.indexOf(needle, index + needle.length);
  }
  return result;
}

/** 매칭 전에 예외 문구가 있는 자리를 지워서, 그 문구 안에 우연히 들어있는 키워드가 잡히지 않게 한다. */
export function stripFalsePositivePhrases(lowerCaseText: string): string {
  return FALSE_POSITIVE_PHRASES.reduce((text, phrase) => blankOutAll(text, phrase.toLowerCase()), lowerCaseText);
}

function resolveCategory(merchant: string, line: string): string {
  const merchantLower = stripFalsePositivePhrases(merchant.toLowerCase());
  const lineLower = stripFalsePositivePhrases(line.toLowerCase());
  for (const { keyword, category } of KEYWORD_CATEGORY_PAIRS) {
    const keywordLower = keyword.toLowerCase();
    if (merchantLower.includes(keywordLower) || lineLower.includes(keywordLower)) {
      return category;
    }
  }
  return "etc";
}

function parseSpendingLine(rawLine: string): ParsedSpendingItem | null {
  const line = rawLine.trim();
  if (!line) return null;

  const primaryAmount = selectPrimaryAmount(findAmountCandidates(line));
  if (!primaryAmount) return null;

  const hasRefundKeyword = REFUND_KEYWORD_REGEX.test(line);
  const amount = resolveSignedAmount(primaryAmount, hasRefundKeyword);

  const beforeTokens = tokenize(line.substring(0, primaryAmount.index).trim());
  const afterTokens = tokenize(line.substring(primaryAmount.index + primaryAmount.matchedText.length).trim());
  const merchant = resolveMerchant(beforeTokens, afterTokens);
  const category = resolveCategory(merchant, line);

  return { merchant, amount, category };
}

/**
 * 로컬 정규식 & 키워드 휴리스틱 파서
 * SMS 결제 문자, 카카오톡 알림톡, 텍스트 형태의 지출 기록을 한 줄씩 분석합니다.
 * "금액 후보 찾기 -> 대표 금액 선택 -> 상호명 추정 -> 카테고리 판정" 단계로 나눠 각 줄을 처리합니다.
 */
export function parseTextLocally(text: string): ParsedSpendingItem[] {
  return text
    .split("\n")
    .map(parseSpendingLine)
    .filter((item): item is ParsedSpendingItem => item !== null);
}

/**
 * 업로드 허용 최대 명세서 파일 크기 (10MB) 및 허용 포맷 정의
 */
export const MAX_STATEMENT_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_STATEMENT_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/vnd.ms-excel", // 일부 브라우저/OS가 .csv에 부여하는 MIME
] as const;

export const ALLOWED_STATEMENT_EXTENSIONS = [".pdf", ".txt", ".csv"] as const;

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * 카드 명세서 파일 크기 및 포맷 검증
 * - 최대 10MB 제한
 * - 지원 포맷 (PDF, TXT, CSV) 화이트리스트 검증
 */
export function validateStatementFile(file: File): FileValidationResult {
  if (file.size > MAX_STATEMENT_FILE_SIZE) {
    return {
      isValid: false,
      error: "파일 크기는 최대 10MB 이하만 업로드 가능합니다.",
    };
  }

  const fileExt = "." + (file.name.split(".").pop() || "").toLowerCase();
  const isMimeAllowed = ALLOWED_STATEMENT_MIME_TYPES.includes(
    file.type as (typeof ALLOWED_STATEMENT_MIME_TYPES)[number],
  );
  const isExtAllowed = ALLOWED_STATEMENT_EXTENSIONS.includes(
    fileExt as (typeof ALLOWED_STATEMENT_EXTENSIONS)[number],
  );

  if (!isMimeAllowed && !isExtAllowed) {
    return {
      isValid: false,
      error: "지원하지 않는 파일 형식입니다. PDF, TXT, CSV 파일만 지원합니다.",
    };
  }

  return { isValid: true };
}

/**
 * 업로드된 PDF 명세서에서 텍스트를 추출합니다 (pdfjs-dist 사용).
 *
 * 카드사 명세서 PDF는 대부분 이미지가 아니라 선택 가능한 텍스트로 이루어져 있어서,
 * 페이지별 텍스트를 그대로 이어붙이면 parseTextLocally가 처리할 수 있는 줄 단위
 * 텍스트가 됩니다. 스캔본(이미지로만 이루어진 PDF)처럼 텍스트 레이어가 없는 파일은
 * 추출 결과가 비어있을 수 있고, 그 경우 호출한 쪽에서 안내 메시지를 보여줘야 합니다.
 *
 * pdfjs-dist는 번들 용량이 커서, 실제 PDF를 업로드했을 때만 동적으로 불러옵니다.
 *
 * 아래 두 모듈 경로를 문자열 리터럴이 아니라 변수(PDFJS_MODULE_SPECIFIER 등)에 담아서
 * import()에 넘기는 이유는, 아직 npm install로 pdfjs-dist를 설치하지 않은 상태에서도
 * Vite 개발 서버가 이 파일을 불러오는 시점(=PDF를 실제로 업로드하지 않아도)에 미리
 * 경로를 분석/검증하다가 "모듈을 찾을 수 없다"는 에러 화면을 띄우는 것을 막기 위함입니다.
 * 리터럴로 그대로 적으면 주석(@vite-ignore)을 붙여도 Vite가 여전히 미리 해석을 시도합니다.
 * 이 경로는 실제로 PDF 파일을 업로드해서 이 함수가 호출될 때만 동작하며, 그때 pdfjs-dist가
 * 설치돼 있지 않으면 아래 catch에서 안내 메시지를 담아 에러를 던집니다.
 */
const PDFJS_MODULE_SPECIFIER = "pdfjs-dist";
const PDFJS_WORKER_SPECIFIER = "pdfjs-dist/build/pdf.worker.mjs?url";

export async function extractTextFromPdf(file: File): Promise<string> {
  let pdfjsLib;
  let workerSrc;
  try {
    pdfjsLib = await import(/* @vite-ignore */ PDFJS_MODULE_SPECIFIER);
    ({ default: workerSrc } = await import(/* @vite-ignore */ PDFJS_WORKER_SPECIFIER));
  } catch {
    throw new Error(
      "PDF 명세서 처리에 필요한 라이브러리(pdfjs-dist)가 아직 설치되지 않았습니다. 터미널에서 npm install을 한 번 실행한 뒤 다시 시도해 주세요. (TXT/CSV 파일은 이 라이브러리 없이도 바로 사용할 수 있습니다.)",
    );
  }
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  const pageTexts: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const lineText = content.items
      .map((item: unknown) => (typeof item === "object" && item !== null && "str" in item ? (item as { str: string }).str : ""))
      .join(" ");
    pageTexts.push(lineText);
  }

  return pageTexts.join("\n");
}

/**
 * 업로드된 명세서 파일(PDF/TXT/CSV)에서 텍스트를 읽어 옵니다.
 * PDF는 extractTextFromPdf로, 그 외 텍스트 기반 파일은 File.text()로 직접 읽습니다.
 */
export async function readStatementFileAsText(file: File): Promise<string> {
  const fileExt = "." + (file.name.split(".").pop() || "").toLowerCase();
  if (fileExt === ".pdf" || file.type === "application/pdf") {
    return extractTextFromPdf(file);
  }
  return file.text();
}
