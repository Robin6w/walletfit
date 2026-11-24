export interface ParsedSpendingItem {
  merchant: string;
  amount: number;
  category: string; // data/categories.json의 id(convenience … department, delivery, travel, medical, bills, books, household, etc)
}

// 한국어 지출 카테고리 매핑 규칙
export const KEYWORD_MAP: { [category: string]: string[] } = {
  // "EDIYA"(영문 표기)와 "커피빈"은 2026-10-07 추가. "커피빈"은 원래도 "커피"로 카페에 잡혔지만, 브랜드 이름으로 먼저 잡혀야
  // 자동 변환에서 브랜드 한정 혜택으로 읽힌다(brandScope.ts)
  cafe: ["스타벅스", "스벅", "투썸", "이디야", "EDIYA", "커피빈", "커피", "메가커피", "빽다방", "폴바셋", "할리스", "카페", "디저트", "베이커리", "빵집", "설빙"],
  convenience: ["GS25", "CU", "세븐일레븐", "이마트24", "미니스톱", "편의점"],
  transport: ["택시", "버스", "지하철", "철도", "코레일", "SRT", "KTX", "티머니", "캐시비", "카카오T", "카카오택시", "타다", "대중교통"],
  // "SK텔레콤", "LG U+"(띄어쓴 표기)는 2026-10-07 추가. 혜택 요약에서 이 표기만 쓴 카드가 있었다
  mobile: ["SKT", "SK텔레콤", "KT", "LGU+", "LG U+", "엘지유플러스", "알뜰폰", "통신요금", "통신비", "휴대폰요금", "통신"],
  // "쇼핑"은 카드고릴라 key_benefit title에서 "쿠팡"/"네이버쇼핑"처럼 구체적 브랜드명 대신
  // 그냥 상위 개념어 하나로만 적혀 있는 경우가 실제로 있어서(45장 실적구간표 감사에서 확인,
  // 6건) 추가했다. 명세서 상호명 매칭에서는 원래 브랜드명이 그대로 찍히니 영향이 없다.
  onlineShopping: ["쿠팡", "네이버쇼핑", "네이버페이", "G마켓", "지마켓", "11번가", "SSG", "옥션", "마켓컬리", "컬리", "위메프", "티몬", "배송", "택배", "쇼핑"],
  mart: ["이마트", "홈플러스", "롯데마트", "농협하나로", "하나로마트", "슈퍼마켓", "슈퍼", "마트", "다이소", "노브랜드", "SSM"],
  // "외식"도 위 "쇼핑"과 같은 이유로 추가(같은 감사에서 "외식, 통신" 등 조합형 라벨로 확인).
  dining: ["식당", "맛집", "푸드", "고기집", "갈비", "삼겹살", "국밥", "찌개", "치킨", "피자", "족발", "보쌈", "스시", "초밥", "반점", "짜장면", "파스타", "한식", "양식", "중식", "일식", "외식"],
  // "디지털구독"/"구독"은 넷플릭스·웨이브 등 개별 OTT 브랜드명 대신 상위 개념어로만 적힌
  // 경우를 커버한다(같은 감사에서 "디지털구독" 1건 확인).
  culture: ["넷플릭스", "유튜브", "premium", "디즈니", "티빙", "웨이브", "CGV", "롯데시네마", "메가박스", "영화관", "멜론", "지니", "티켓", "공연", "연극", "디지털구독", "구독"],
  gas: ["주유소", "GS칼텍스", "칼텍스", "SK에너지", "엔크린", "에쓰오일", "S-OIL", "오일뱅크", "주유", "충전소"],
  // 아래 6개 카테고리(car ~ department)는 카드고릴라 45장 실적구간표 감사에서 발견된,
  // 기존 10개 카테고리 어디에도 속하지 않는 실제 소비 영역이다. 표본이 작아 각 1~2건뿐이지만,
  // 전체 카탈로그(1,400여 장)의 benefitSummary 파싱에도 같은 KEYWORD_MAP을 재사용하므로
  // 실제 영향 범위는 이보다 클 가능성이 높다.
  car: ["자동차", "정비", "카센터", "세차", "타이어"],
  pet: ["애완동물", "반려동물", "동물병원", "펫샵"],
  education: ["교육", "육아", "학원", "어린이집", "유치원"],
  beautyFitness: ["뷰티", "피트니스", "헬스장", "필라테스", "네일", "에스테틱"],
  golf: ["골프", "골프장", "스크린골프"],
  // "의류"/"잡화"는 일반 명사라 다른 브랜드명과 우연히 겹칠 위험이 상대적으로 크다.
  // 실제 카탈로그에 적용해보고 오탐이 보이면 FALSE_POSITIVE_PHRASES에 추가해서 막을 것.
  department: ["백화점", "롯데백화점", "신세계백화점", "현대백화점", "갤러리아", "AK플라자", "의류", "잡화"],
  // "금융"/"간편결제"/"생활"은 특정 소비 카테고리라기보다 결제 방식이나 포괄적 생활비에 가까워
  // 별도 카테고리를 만들지 않고 기존 "그 외 일반가맹점"으로 흡수한다. "생활"은 45장 감사에서
  // 5건으로 제일 많이 나온 미매핑 라벨인데, 원문 comment 텍스트 없이 title만으로는 더 세분화할
  // 근거가 없어 우선 보수적으로 여기 둔다(실제 카드명을 보고 더 쪼갤 수 있으면 나중에 옮길 것).
  // 10-30 정제 데이터에 맞춰 추가한 6개 카테고리. 배달 앱은 외식에서 옮겼다(배달 혜택을 따로 계산).
  // 항공사 이름은 넣지 않는다: '대한항공 마일리지 적립' 요약이 여행 카테고리로 잡힘(마일 적립은 모든 가맹점)
  delivery: ["배달의민족", "배민", "요기요", "쿠팡이츠", "땡겨요", "배달"],
  travel: ["호텔", "숙박", "여행사", "항공권", "야놀자", "여기어때", "에어비앤비", "아고다", "면세점"],
  medical: ["병원", "의원", "약국", "치과", "한의원"],
  bills: ["전기요금", "가스요금", "도시가스", "수도요금", "아파트관리비", "관리비", "보험료"],
  books: ["교보문고", "영풍문고", "알라딘", "YES24", "예스24", "서점", "도서"],
  household: ["올리브영", "생활용품", "생활잡화"],
  etc: ["금융", "간편결제", "생활"],
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
  "application/vnd.ms-excel", // 일부 브라우저/OS가 .csv에 부여하는 MIME. 카드사 엑셀(xls) 명세서도 이 MIME
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx(읽지 못하면 CSV로 저장하라고 안내)
] as const;

// xls·xlsx(2026-11-24): 롯데·현대카드 홈페이지의 '엑셀 다운로드'는 웹 표(HTML)를 xls 이름으로 준다(readSpreadsheetStatement)
export const ALLOWED_STATEMENT_EXTENSIONS = [".pdf", ".txt", ".csv", ".xls", ".xlsx"] as const;

/** 카드 앱 이용내역 캡처(2026-11-02, v2 명세서 화면만). 글자 인식(OCR)으로 읽는다 */
export const ALLOWED_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const ALLOWED_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"] as const;

export function isStatementImage(file: File): boolean {
  const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
  return (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type) || (ALLOWED_IMAGE_EXTENSIONS as readonly string[]).includes(ext);
}

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * 카드 명세서 파일 크기 및 포맷 검증
 * - 최대 10MB 제한
 * - 지원 포맷 (PDF, TXT, CSV, XLS·XLSX) 화이트리스트 검증. images를 켜면 캡처 이미지(PNG·JPG·WEBP)도 받는다(v2 명세서 화면)
 */
export function validateStatementFile(file: File, opts: { images?: boolean } = {}): FileValidationResult {
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

  if (!isMimeAllowed && !isExtAllowed && !(opts.images && isStatementImage(file))) {
    return {
      isValid: false,
      error: "지원하지 않는 파일 형식입니다. PDF, TXT, CSV, XLS 파일만 지원합니다.",
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
 * 예전에는 설치 전에도 개발 서버가 뜨도록 경로를 변수에 담아 import()에 넘겼는데, 그러면 Vite가
 * 'pdfjs-dist'를 실제 파일 경로로 바꾸지 않아 브라우저에서 항상 불러오기에 실패했다(2026-10-31).
 * 지금은 package.json 의존성이라 경로를 그대로 적는다.
 */

/**
 * 비밀번호로 잠긴 PDF. need: 비밀번호가 필요함, wrong: 비밀번호가 맞지 않음(2026-10-28 v2 명세서 화면)
 */
export class StatementPasswordError extends Error {
  readonly reason: "need" | "wrong";
  constructor(reason: "need" | "wrong") {
    super(reason === "need" ? "비밀번호로 잠긴 파일이에요." : "비밀번호가 맞지 않아요.");
    this.name = "StatementPasswordError";
    this.reason = reason;
  }
}

export async function extractTextFromPdf(file: File, password?: string): Promise<string> {
  let pdfjsLib;
  let workerSrc;
  try {
    pdfjsLib = await import("pdfjs-dist");
    ({ default: workerSrc } = await import("pdfjs-dist/build/pdf.worker.mjs?url"));
  } catch {
    throw new Error("PDF를 읽는 부품을 불러오지 못했어요. 페이지를 새로고침한 뒤 다시 시도해 주세요. (CSV·TXT 파일은 바로 읽을 수 있어요.)");
  }
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

  const buffer = await file.arrayBuffer();
  let pdf;
  try {
    pdf = await pdfjsLib.getDocument(password ? { data: buffer, password } : { data: buffer }).promise;
  } catch (e) {
    // pdf.js PasswordException: code 1 = 비밀번호 필요, 2 = 비밀번호 틀림
    const err = e as { name?: string; code?: number };
    if (err?.name === "PasswordException") throw new StatementPasswordError(err.code === 2 ? "wrong" : "need");
    throw e;
  }

  const pageTexts: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    pageTexts.push(await pdfPageToLines(await pdf.getPage(pageNumber), pdfjsLib.OPS));
  }

  return pageTexts.join("\n");
}

/** pdf.js getTextContent()의 텍스트 조각(필요한 필드만) */
export interface PdfTextItem {
  str?: string;
  /** [a, b, c, d, x, y] */
  transform?: number[];
  width?: number;
  height?: number;
  /** pdf.js 안의 글꼴 id(g_d0_f3 등) */
  fontName?: string;
  /** PDF에 적힌 글꼴 이름(ESGIPZ+SCGodicL_b3 등). pdfPageToLines가 채운다 */
  font?: string;
  /** 쪼갠 한글 글꼴을 그리기 목록의 원래 바이트로 되돌린 글자. pdfPageToLines가 채운다 */
  decoded?: string;
}

/** pdf.js 페이지(필요한 것만) */
interface PdfPageLike {
  getTextContent(params?: { disableNormalization?: boolean }): Promise<{ items: unknown[] }>;
  getOperatorList(): Promise<{ fnArray: number[]; argsArray: unknown[] }>;
  commonObjs: { has(id: string): boolean; get(id: string): unknown };
}

/** pdf.js 그리기 명령 번호(pdfjsLib.OPS에서 필요한 것만) */
export interface PdfOps {
  setFont: number;
  showText: number;
  showSpacedText: number;
}

/** 그리기 목록의 글자 하나: 글꼴 id, pdf.js가 붙인 글자, PDF 안의 원래 바이트 */
interface DrawnGlyph {
  uni: string;
  code: number;
}

/**
 * PDF 한 쪽 → 줄 단위 글자(2026-11-24). 글꼴 이름을 붙여 pdfItemsToLines에 넘긴다.
 * 글꼴 이름은 페이지를 그릴 준비(operator list)를 해야 채워진다. 삼성카드 명세서처럼 한글 글꼴을 쪼갠 쪽은
 * pdf.js의 글자 바꿈('ﬁ'→'fi', 'µ'→'μ')을 끈 글자를 다시 받고, 그리기 목록에 남은 원래 바이트(originalCharCode)를
 * 글꼴별로 차례대로 맞춰 붙인다. pdf.js가 붙인 글자만으로는 0xA8·0xAC가 같은 '¨'로, 0xCA가 빈칸으로 나와 구분이 안 된다
 */
export async function pdfPageToLines(page: PdfPageLike, ops?: PdfOps): Promise<string> {
  let items = (await page.getTextContent()).items as PdfTextItem[];
  try {
    const opList = await page.getOperatorList();
    const name = (list: PdfTextItem[]) => {
      for (const it of list) {
        if (!it.fontName || !page.commonObjs.has(it.fontName)) continue;
        const f = page.commonObjs.get(it.fontName) as { name?: string } | null;
        if (f?.name) it.font = f.name;
      }
    };
    name(items);
    if (ops && items.some((it) => splitFontLead(it.font) !== null)) {
      items = (await page.getTextContent({ disableNormalization: true })).items as PdfTextItem[];
      name(items);
      attachCodes(items, drawnGlyphs(opList, ops));
    }
  } catch {
    // 글꼴 이름을 못 얻어도 글자는 그대로 읽는다
  }
  return pdfItemsToLines(items);
}

/** 그리기 목록 → 글꼴 id별 글자 차례 */
function drawnGlyphs(opList: { fnArray: number[]; argsArray: unknown[] }, ops: PdfOps): Map<string, DrawnGlyph[]> {
  const byFont = new Map<string, DrawnGlyph[]>();
  let font = "";
  opList.fnArray.forEach((fn, i) => {
    const args = opList.argsArray[i] as unknown[] | null;
    if (fn === ops.setFont && args) font = String(args[0]);
    else if ((fn === ops.showText || fn === ops.showSpacedText) && args && Array.isArray(args[0])) {
      const list = byFont.get(font) ?? [];
      for (const g of args[0] as unknown[]) {
        if (g && typeof g === "object" && "originalCharCode" in g) {
          const glyph = g as { unicode?: string; originalCharCode?: number };
          list.push({ uni: glyph.unicode ?? "", code: Number(glyph.originalCharCode) });
        }
      }
      byFont.set(font, list);
    }
  });
  return byFont;
}

/**
 * 쪼갠 한글 글꼴의 텍스트 조각을 원래 바이트로 되돌린다. 글꼴별 그리기 차례와 조각 글자를 앞에서부터 맞춘다.
 *  - 글자: 다음 그리기 글자 중 같은 글자의 바이트를 쓴다. 그 사이에 빈칸으로 그려진 한글(0xCA '너'·'않' 등)이 있으면 pdf.js가
 *    조각에서 뺀 것이라 자리를 알 수 없어 건너뛴다(같은 글꼴의 다음 글자 앞에 넣었더니 '계약' → '계않약'처럼 엉뚱한 곳에 끼었다)
 *  - 빈칸: 빈칸만 든 조각이 한글 한 글자만큼 넓고 다음 그리기 글자도 빈칸일 때만 짝짓는다(그 글자가 0xA1 이상이면 빈칸으로 그려진 한글).
 *    좁은 빈칸은 pdf.js가 넣은 띄어쓰기라 그대로 둔다('네이버플러스 멤버십'이 '네이버플러스십멤버'가 됐다)
 */
function attachCodes(items: PdfTextItem[], byFont: Map<string, DrawnGlyph[]>): void {
  const pos = new Map<string, number>();
  for (const it of items) {
    const lead = splitFontLead(it.font);
    if (!it.fontName || !it.str || lead === null) continue;
    const list = byFont.get(it.fontName);
    if (!list) continue;
    let p = pos.get(it.fontName) ?? 0;
    let out = "";
    const size = it.height || (it.transform ? Math.hypot(it.transform[0], it.transform[1]) : 0) || 10;
    const wideBlank = !it.str.trim() && (it.width ?? 0) >= size * 0.6;
    for (const ch of it.str) {
      if (!ch.trim()) {
        if (wideBlank && p < list.length && !list[p].uni.trim()) {
          out += list[p].code >= 0xa1 ? eucKr(lead, list[p].code, ch) : ch;
          p++;
        } else out += ch;
        continue;
      }
      let j = -1;
      for (let k = p; k < Math.min(list.length, p + 4); k++) {
        if (list[k].uni === ch) {
          j = k;
          break;
        }
        if (list[k].uni.trim()) break;
      }
      if (j < 0) {
        out += decodeSplitFont(ch, it.font);
        continue;
      }
      out += list[j].code >= 0xa1 ? eucKr(lead, list[j].code, ch) : ch;
      p = j + 1;
    }
    pos.set(it.fontName, p);
    it.decoded = out;
  }
}

/** 앞 바이트 + 뒤 바이트 → EUC-KR 한 글자(못 읽으면 fallback) */
function eucKr(lead: number, trail: number, fallback: string): string {
  try {
    EUC_KR = EUC_KR ?? new TextDecoder("euc-kr");
    const out = EUC_KR.decode(new Uint8Array([lead, trail]));
    return out.includes("�") ? fallback : out;
  } catch {
    return fallback;
  }
}

let MAC_ROMAN: Map<string, number> | null = null;
let EUC_KR: TextDecoder | null = null;

/** 쪼갠 한글 글꼴의 앞 바이트: 글꼴 이름 끝 'SCGodicL_b3' → 0xB3, 'SBGBA' → 0xBA(EUC-KR 한글 앞 바이트 A1~FE만) */
function splitFontLead(font?: string): number | null {
  const m = font?.replace(/^[A-Z]{6}\+/, "").match(/(?:_|SBG)([a-fA-F][0-9a-fA-F])N?$/);
  if (!m) return null;
  const lead = parseInt(m[1], 16);
  return lead >= 0xa1 && lead <= 0xfe ? lead : null;
}

/**
 * 삼성카드 명세서 PDF(2026-11-24)는 한글 글꼴을 EUC-KR 앞 바이트별로 쪼개 두고(SCGodicL_b3·SCGodicL_bf…),
 * 글자에는 뒤 바이트만 맥(MacRoman) 문자로 넣는다. 그대로 읽으면 '2026년 9월'이 '2026‚ 9˘'가 된다.
 * 글꼴 이름의 앞 바이트와 글자의 뒤 바이트를 붙여 EUC-KR로 되돌린다(SCGodicM_b3의 '‚'(0xE2) → 0xB3E2 '년').
 * 그리기 목록의 원래 바이트를 못 얻었을 때(pdfPageToLines의 attachCodes가 못 맞춘 글자) 맥 문자표로 뒤 바이트를 짐작한다
 */
export function decodeSplitFont(str: string, font?: string): string {
  const lead = splitFontLead(font);
  if (lead === null) return str;
  try {
    if (!MAC_ROMAN) {
      const mac = new TextDecoder("macintosh");
      MAC_ROMAN = new Map();
      for (let b = 0x80; b <= 0xff; b++) MAC_ROMAN.set(mac.decode(new Uint8Array([b])), b);
      EUC_KR = new TextDecoder("euc-kr");
    }
  } catch {
    return str;
  }
  return [...str]
    .map((ch) => {
      const trail = MAC_ROMAN!.get(ch);
      if (trail === undefined || trail < 0xa1) return ch;
      const out = EUC_KR!.decode(new Uint8Array([lead, trail]));
      return out.includes("�") ? ch : out;
    })
    .join("");
}

/**
 * 텍스트 조각을 좌표로 줄을 다시 만든다(2026-10-31).
 * 조각 순서대로 " "로 이으면 카카오뱅크 확인서처럼 글자를 한 자씩 넣은 PDF가 '카 드 이 용'으로 읽히고,
 * 페이지 전체가 한 줄이 되어 결제 한 건도 못 찾는다. y가 같은 조각을 한 줄로 묶어 x 순서로 놓고,
 * 앞 조각 끝과 다음 조각 사이가 글자 크기의 1/4보다 벌어진 곳이나, 공백 조각(' ')이 있던 곳에 공백을 넣는다.
 */
export function pdfItemsToLines(items: PdfTextItem[]): string {
  const pieces = items
    .filter((it) => it.str && it.transform)
    // 옆으로 세운 글자(삼성카드 오른쪽 '다음 페이지에 이어집니다' 등)는 한 글자씩 줄이 되어 결제 줄을 어지럽혀 뺀다(2026-11-24)
    .filter((it) => Math.abs(it.transform![1]) <= Math.abs(it.transform![0]))
    .map((it) => {
      const [a, b, , , x, y] = it.transform!;
      const size = it.height || Math.hypot(a, b) || 10;
      // 신한카드 PDF는 낱말 사이를 제어 문자(\u0001)로 띄운다(2026-11-02). 빈칸으로 본다
      // eslint-disable-next-line no-control-regex
      const str = (it.decoded ?? decodeSplitFont(it.str!, it.font)).replace(/[\u0000-\u001f\u007f]/g, " ");
      return { str, x, y, end: x + (it.width ?? 0), size };
    });

  const rows: Array<{ y: number; size: number; cells: typeof pieces }> = [];
  for (const p of pieces) {
    const row = rows.find((r) => Math.abs(r.y - p.y) <= Math.max(1, r.size * 0.3));
    if (row) row.cells.push(p);
    else rows.push({ y: p.y, size: p.size, cells: [p] });
  }

  // PDF 좌표는 아래에서 위로 커지므로 y가 큰 줄이 먼저
  return rows
    .sort((r1, r2) => r2.y - r1.y)
    .map((row) => {
      const sorted = row.cells.sort((c1, c2) => c1.x - c2.x);
      // 같은 글자를 살짝 비켜 두 번 찍어 굵게 보이게 한 PDF(삼성카드 '합계 762,557762,557', 2026-11-24): 앞 조각과 글자가 같고
      // 앞 조각 너비의 절반보다 가까이 겹치면 한 번만 쓴다
      const cells: typeof sorted = [];
      for (const c of sorted) {
        const prev = cells[cells.length - 1];
        if (prev && c.str.trim() && prev.str === c.str && c.x - prev.x < Math.max(prev.end - prev.x, c.size * 0.2) * 0.5) continue;
        cells.push(c);
      }
      let line = "";
      let prevEnd = -Infinity;
      for (const c of cells) {
        if (!c.str.trim()) {
          line += " ";
        } else {
          if (line && !line.endsWith(" ") && c.x - prevEnd > c.size * 0.25) line += " ";
          line += c.str;
        }
        prevEnd = c.end;
      }
      return line.replace(/\s+/g, " ").trim();
    })
    .join("\n");
}

/**
 * OCR 글자에서 흔한 실수를 바로잡는다(2026-11-02, NH 앱 캡처로 확인).
 * 금액 끝의 '원'을 숫자로 읽는 경우: '6,150원' → '6,1508'. 쉼표 뒤는 늘 세 자리라, 줄 끝 금액의 마지막 묶음이 네 자리면 끝 숫자를 '원'으로 본다
 */
export function fixOcrText(text: string): string {
  return (
    text
      .split("\n")
      .map((l) => l.replace(/(\d{1,3}(?:,\d{3})+)\d(?=\s*$)/, "$1원"))
      // 쉼표를 점으로 읽는 경우: '6,700원' → '6.700원', 표의 금액 칸 '3,000' → '3.000'(작게 캡처한 사진).
      // '원' 앞이거나 줄 끝이고 점 뒤가 세 자리일 때만(날짜 2026.09.20은 그대로)
      .map((l) => l.replace(/(?<![\d.])(\d{1,3})\.(\d{3})(?=\s*원|\s*$)/g, "$1,$2"))
      // 칸을 잘못 읽은 영어 소문자 1~2글자 조각('승인' → 'ae', 'un')은 뺀다
      .map((l) => l.replace(/(^|\s)[a-z]{1,2}(?=\s|$)/g, "$1"))
      .join("\n")
  );
}

/**
 * 글자가 작으면 인식이 틀리기 쉬워(작게 저장한 캡처에서 '6,700원'을 700원으로 읽음) 폭 1,200px까지(최대 3배) 키워서 읽는다.
 * 2026-11-02 같은 캡처를 60·75%로 줄여 시험: 그대로는 합계가 각각 +44,858원·−6,000원 틀렸고, 2배로 키우면 +100원·일치
 */
async function upscaleForOcr(file: File): Promise<{ image: Blob | File; width: number }> {
  let width = 0;
  try {
    const bmp = await createImageBitmap(file);
    width = bmp.width;
    const scale = Math.min(3, 1200 / bmp.width);
    if (scale <= 1.05) return { image: file, width };
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { image: file, width };
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    return { image: blob ?? file, width };
  } catch {
    return { image: file, width };
  }
}

/**
 * 캡처 이미지에서 글자를 읽는다(tesseract.js, 한국어+영어). 이미지는 브라우저 밖으로 나가지 않는다.
 * 글자 인식 프로그램과 언어 데이터(약 10MB)는 처음 한 번 내려받고 브라우저가 저장해 둔다. 라이브러리가 커서 이미지를 올릴 때만 불러온다
 */
/** 사진 글자 인식 품질: 인식 신뢰도(0~100)와 원본 가로 크기(px). 낮으면 화면이 다시 캡처를 권한다 */
export interface ImageReadInfo {
  confidence: number;
  width: number;
}

export async function extractTextFromImage(file: File, onProgress?: (ratio: number) => void, onInfo?: (info: ImageReadInfo) => void): Promise<string> {
  let createWorker: typeof import("tesseract.js").createWorker;
  try {
    ({ createWorker } = await import("tesseract.js"));
  } catch {
    throw new Error("사진에서 글자를 읽는 부품을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.");
  }
  const worker = await createWorker("kor+eng", 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onProgress?.(m.progress);
    },
  });
  try {
    // 표처럼 한 줄씩 읽는다(PSM 6, 2026-11-02 측정). 기본 방식(자동)은 표를 칸마다 세로로 떼어 읽어 금액과 가맹점이 엉켰고
    // (카카오뱅크 확인서 캡처: 32건 8억원), NH 앱 캡처도 PSM 6에서 10건 173,500원 그대로 맞았다
    await worker.setParameters({ tessedit_pageseg_mode: "6" as never, preserve_interword_spaces: "1" });
    const { image, width } = await upscaleForOcr(file);
    const { data } = await worker.recognize(image);
    onInfo?.({ confidence: data.confidence, width });
    return fixOcrText(data.text);
  } finally {
    await worker.terminate();
  }
}

/**
 * 업로드된 명세서 파일(PDF/TXT/CSV/XLS/캡처 이미지)에서 텍스트를 읽어 옵니다.
 * PDF는 extractTextFromPdf로, 이미지는 extractTextFromImage(OCR)로, 엑셀은 readSpreadsheetStatement로,
 * 그 외 텍스트 기반 파일은 File.text()로 직접 읽습니다.
 */
export async function readStatementFileAsText(
  file: File,
  password?: string,
  onProgress?: (ratio: number) => void,
  onImageInfo?: (info: ImageReadInfo) => void,
): Promise<string> {
  const fileExt = "." + (file.name.split(".").pop() || "").toLowerCase();
  if (fileExt === ".pdf" || file.type === "application/pdf") {
    return extractTextFromPdf(file, password);
  }
  if (isStatementImage(file)) {
    return extractTextFromImage(file, onProgress, onImageInfo);
  }
  if (fileExt === ".xls" || fileExt === ".xlsx") {
    return readSpreadsheetStatement(new Uint8Array(await file.arrayBuffer()));
  }
  return file.text();
}

/** 엑셀 명세서를 바꾼 글자의 첫 줄. summarizeStatement가 이 표시로 '표 명세서' 규칙을 쓴다 */
export const TABLE_STATEMENT_MARK = "[표 명세서]";

const SPREADSHEET_UNSUPPORTED = "이 엑셀 파일은 아직 바로 읽지 못해요. 엑셀에서 '다른 이름으로 저장 → CSV UTF-8(쉼표로 분리)'로 저장해 올려 주세요.";

/**
 * 카드사 엑셀(xls) 명세서 → 줄 단위 글자(2026-11-24).
 * 롯데·현대카드 홈페이지의 '엑셀 다운로드'는 진짜 엑셀이 아니라 웹 표(HTML)를 xls 이름으로 준다. 진짜 엑셀(xls 원본 D0 CF 11 E0,
 * xlsx PK)은 읽는 부품이 없어 CSV로 저장하라고 안내한다. 글자 인코딩은 파일의 charset을 따르고(없으면 UTF-8), EUC-KR도 읽는다
 */
export function readSpreadsheetStatement(bytes: Uint8Array): string {
  const [b0, b1, b2, b3] = bytes;
  if ((b0 === 0xd0 && b1 === 0xcf && b2 === 0x11 && b3 === 0xe0) || (b0 === 0x50 && b1 === 0x4b)) throw new Error(SPREADSHEET_UNSUPPORTED);
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 4096));
  const charset = head.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1]?.toLowerCase() ?? "utf-8";
  let html: string;
  try {
    html = new TextDecoder(/euc-kr|ks_c_5601|cp949|x-windows-949/.test(charset) ? "euc-kr" : "utf-8").decode(bytes);
  } catch {
    html = new TextDecoder("utf-8").decode(bytes);
  }
  if (!/<table/i.test(html)) throw new Error(SPREADSHEET_UNSUPPORTED);
  return htmlTableToStatementText(html);
}

const cellText = (el: Element) => (el.textContent ?? "").replace(/ /g, " ").replace(/\s+/g, " ").trim();
const cellsOf = (row: Element) => Array.from(row.children).filter((el) => /^(TD|TH)$/i.test(el.tagName));
const spanOf = (el: Element, name: "colspan" | "rowspan") => Math.max(1, Number(el.getAttribute(name)) || 1);

/** 표 안의 금액('1,740,000원'·'-300'). 숫자가 아니면 null */
function cellAmount(text: string | undefined): number | null {
  const t = (text ?? "").replace(/[원\s,]/g, "");
  return /^-?\d+$/.test(t) ? Number(t) : null;
}

/** 표 안의 날짜('2026.06.29'·'2026년 08월 08일') → [년, 월, 일] */
function cellDate(text: string | undefined): [number, number, number] | null {
  const m = (text ?? "").match(/(20\d{2})\D{1,3}(\d{1,2})\D{1,3}(\d{1,2})/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** 머리글 줄(묶인 칸 rowspan·colspan 포함) → 칸마다 이름. 롯데 '이번 달 입금하실 금액'(2칸) 아래 '원금'·'수수료' → '이번 달 입금하실 금액 원금' */
function headerNames(rows: Element[], start: number): { names: string[]; next: number } {
  const height = Math.max(1, ...cellsOf(rows[start]).map((c) => spanOf(c, "rowspan")));
  const grid: string[][] = [];
  for (let i = 0; i < height && start + i < rows.length; i++) {
    grid[i] = grid[i] ?? [];
    let col = 0;
    for (const cell of cellsOf(rows[start + i])) {
      while (grid[i][col] !== undefined) col++;
      const text = cellText(cell);
      for (let dr = 0; dr < spanOf(cell, "rowspan"); dr++) for (let dc = 0; dc < spanOf(cell, "colspan"); dc++) (grid[i + dr] = grid[i + dr] ?? [])[col + dc] = text;
      col += spanOf(cell, "colspan");
    }
  }
  const width = Math.max(...grid.map((g) => g.length));
  const names = Array.from({ length: width }, (_, c) => Array.from(new Set(grid.map((g) => g[c] ?? "").filter(Boolean))).join(" "));
  return { names, next: start + height };
}

/** 데이터 줄 칸(묶인 칸은 그만큼 펼친다) */
function rowCells(row: Element): string[] {
  return cellsOf(row).flatMap((c) => Array<string>(spanOf(c, "colspan")).fill(cellText(c)));
}

const find = (names: string[], ...res: RegExp[]) => {
  for (const re of res) {
    const i = names.findIndex((n) => re.test(n));
    if (i >= 0) return i;
  }
  return -1;
};

/**
 * 웹 표 명세서 → summarizeStatement가 읽는 줄. 머리글 칸 이름으로 날짜·가맹점·결제 원금·할부 칸을 찾는다.
 *  - 금액: 이번 달 결제 원금(롯데 '이번 달 입금하실 금액 원금', 현대 '결제원금'). 명세서 합계가 이 칸의 합이다.
 *    이번 달 결제가 0원인 줄(현대 '카드이용알림수수료'·'이메일이용 감면')과 금액 없는 혜택 줄(롯데 '무이자할부')은 뺀다
 *  - 할부: '할부 개월/회차'를 금액 앞에 붙인다(롯데는 '회차'·'할부' 칸이 따로, 현대는 '할부/회차' 한 칸)
 *  - 합계: 요약 표의 '합계'(롯데)나 상세 표 '총 합계' 줄의 결제 원금(현대)
 *  - 이용 기간: 할부가 아닌 결제의 첫날~끝날(명세서 한 장 = 한 달). 지난달에 산 할부 회차가 있어도 달 수를 늘리지 않게
 */
export function htmlTableToStatementText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const out: string[] = [TABLE_STATEMENT_MARK];
  const days: number[] = [];
  let total: { rank: number; value: number } | null = null;
  const fmt = (v: number) => v.toLocaleString("en-US");
  const ymd = ([y, m, d]: [number, number, number]) => `${y}.${String(m).padStart(2, "0")}.${String(d).padStart(2, "0")}`;
  for (const table of Array.from(doc.querySelectorAll("table"))) {
    const rows = Array.from(table.querySelectorAll("tr"));
    const head = rows.findIndex((r) => {
      const t = cellsOf(r).map(cellText);
      return t.some((x) => /이용일|거래일|승인일|매출일/.test(x)) && t.some((x) => /가맹점|이용처|사용처/.test(x));
    });
    if (head < 0) {
      // 요약 표: '합계 943,478'(롯데)
      for (const r of rows) {
        const t = rowCells(r);
        if (t.some((x) => /^합\s*계$/.test(x))) {
          const v = t.map(cellAmount).find((x) => x !== null);
          if (v != null && (!total || total.rank > 1)) total = { rank: 1, value: v };
        }
      }
      continue;
    }
    const { names, next } = headerNames(rows, head);
    const col = {
      date: find(names, /이용일|거래일|승인일|매출일/),
      merchant: find(names, /가맹점|이용처|사용처/),
      billed: find(names, /결제\s*원금/, /(입금|청구|결제)\S*\s*금액.*원금/, /원금/),
      total: find(names, /이용\s*(총액|금액)|승인\s*금액|거래\s*금액/),
      inst: find(names, /할부\s*\/\s*회차|회차\s*\/\s*할부/),
      round: find(names, /^회차$/),
      months: find(names, /^할부(\s*개월)?$/),
    };
    if (col.date < 0 || col.merchant < 0) continue;
    const amountCol = col.billed >= 0 ? col.billed : col.total;
    for (const r of rows.slice(next)) {
      const t = rowCells(r);
      if (t.some((x) => /총\s*합\s*계/.test(x))) {
        const v = cellAmount(t[amountCol]);
        if (v !== null) total = { rank: 0, value: v };
        continue;
      }
      const date = cellDate(t[col.date]);
      const amount = cellAmount(t[amountCol]);
      if (!date || amount === null || amount === 0) continue;
      let inst = "";
      if (col.inst >= 0 && /^\d{1,2}\s*\/\s*\d{1,2}$/.test(t[col.inst] ?? "")) inst = t[col.inst].replace(/\s/g, "");
      else if (col.months >= 0 && Number(t[col.months]) > 1) inst = `${Number(t[col.months])}/${Number(t[col.round]) || 1}`;
      // '한국도로공사 0004건'의 앞자리 0은 금액·번호 규칙에 지워지므로 미리 뗀다(건수는 건당 조건 계산에 쓴다)
      const merchant = (t[col.merchant] ?? "").replace(/(^|\D)0+(\d+\s*건)/, "$1$2") || "이름 없는 가맹점";
      out.push(`${ymd(date)} ${merchant} ${inst ? `${inst} ` : ""}${fmt(amount)}`);
      if (!inst) days.push(new Date(date[0], date[1] - 1, date[2]).getTime());
    }
  }
  if (days.length) {
    const lo = Math.min(...days);
    const hi = Math.max(...days);
    const d = (t: number) => new Date(t);
    if ((hi - lo) / 86_400_000 <= 45) out.splice(1, 0, `이용기간 ${ymd([d(lo).getFullYear(), d(lo).getMonth() + 1, d(lo).getDate()])} ~ ${ymd([d(hi).getFullYear(), d(hi).getMonth() + 1, d(hi).getDate()])}`);
  }
  if (total) out.push(`합계 ${fmt(total.value)}`);
  return out.join("\n");
}
