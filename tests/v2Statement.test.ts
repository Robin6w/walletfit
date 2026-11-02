import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { brandMatchers, cleanLine, mergeStatements, recategorize, statementSignals, summarizeStatement, ticketsOf } from "@/v2/model/statement";
import { catalogCategory, fuzzyCategory, statementCategory, withBrandNames } from "@/v2/model/merchantDict";
import { fixOcrText, pdfItemsToLines, validateStatementFile } from "@/features/statement/importerParser";
import { statementBrandShare } from "@/v2/model/brands";

const sample = readFileSync(resolve(__dirname, "../public/samples/walletfit-sample-statement.csv"), "utf-8");

describe("명세서 요약(v2)", () => {
  it("예시 명세서: 카테고리 금액이 디자인 시나리오(월 83만 5천원)와 같다", () => {
    const s = summarizeStatement(sample);
    // 10-30부터 배달의민족 3만 5천원은 외식이 아니라 배달(디자인 시나리오의 외식 7만 = 외식 3만 5천 + 배달 3만 5천)
    expect(s.spending).toEqual({ convenience: 250000, cafe: 180000, transport: 80000, mobile: 140000, onlineShopping: 65000, dining: 35000, delivery: 35000, gas: 50000 });
    expect(s.period).toBe("2026년 9월");
    expect(s.months).toBe(1);
    expect(s.itemCount).toBe(79);
  });
  it("예시 명세서: 브랜드 금액", () => {
    const s = summarizeStatement(sample);
    expect(s.brands.cafe).toEqual({ 스타벅스: 72000, 투썸플레이스: 27000, 메가MGC커피: 21000 });
    expect(s.brands.convenience).toEqual({ GS25: 160000, CU: 50000, 세븐일레븐: 40000 });
    // 2026-11-01부터 카드 데이터의 브랜드 전부로 찾아 '네이버페이 스마트스토어'(9,700 + 10,300)도 네이버로 잡힌다
    expect(s.brands.onlineShopping).toEqual({ 쿠팡: 45000, 네이버: 20000 });
    expect(s.brands.delivery).toEqual({ 배달의민족: 35000 });
    expect(s.brands.gas).toEqual({ SK에너지: 50000 });
  });
  it("날짜·연도·시간을 금액으로 읽지 않는다", () => {
    expect(cleanLine("2026.09.03 14:22 스타벅스 강남점 6,500원")).toBe("스타벅스 강남점 6,500원");
    expect(cleanLine("09/03 GS25 역삼점 4,800")).toBe("GS25 역삼점 4,800");
    const s = summarizeStatement("2026년 9월 이용내역\n이용기간 2026.09.01 ~ 2026.09.30\n2026-09-03 스타벅스 역삼점 6,500원\n합계 6,500원");
    expect(s.spending).toEqual({ cafe: 6500 });
    expect(s.itemCount).toBe(1);
  });
  it("환불은 빼고, 두 달이면 월평균", () => {
    const s = summarizeStatement("2026.08.02 쿠팡 30,000원\n2026.09.05 쿠팡 50,000원\n2026.09.06 쿠팡 결제취소 -10,000원");
    expect(s.months).toBe(2);
    expect(s.period).toBe("2026년 8월~9월");
    expect(s.spending).toEqual({ onlineShopping: 35000 });
    expect(s.brands.onlineShopping).toEqual({ 쿠팡: 35000 });
    expect(s.refundCount).toBe(1);
  });
  it("짧은 영문 브랜드(CU)는 낱말 경계로만 찾는다", () => {
    const m = brandMatchers();
    const cu = (line: string) => m.find((x) => x.test(line))?.brand;
    expect(cu("CU 역삼점 3,000")).toBe("CU");
    expect(cu("CUCUMBER 샐러드 9,000")).toBeUndefined();
  });
});

describe("카카오뱅크 이용내역 확인서 형식(2026-10-31)", () => {
  // 번호 일시 승인상태 승인번호 가맹점번호 가맹점명 승인금액
  const kakao = [
    "카드이용내역확인서",
    "조회기간 2026-09-01~2026-09-30",
    "일시 승인상태 승인번호 가맹점 번호 가맹점명 승인금액 일시불(할부) 비고",
    "1 2026-09-30 승인 22199119 000000117261537 트레이더스 홀세일클 15,980",
    "2 2026-09-28 승인 22198539 000000091653153 (주)에프알엘코리아 29,900",
    "3 2026-09-20 승인 26197125 000000100733217 롯데쇼핑(주) 롯데몰 21,100",
    "4 2026-09-13 승인 26195951 000000117583111 빵 백화점 마곡점 15,700",
    "5 2026-09-13 승인 24196171 000000073552658 현대아울렛 김포점 152,700",
    "6 2026-09-12 승인 21195129 000000100254951 쿠팡이츠 13,100",
    "총승인금액 248,480",
    "2026년10월31일",
  ].join("\n");

  it("승인번호·가맹점 번호를 금액으로 읽지 않고, 총승인금액·발급일은 빼고 한 달로 센다", () => {
    const s = summarizeStatement(kakao);
    expect(s.itemCount).toBe(6);
    expect(s.months).toBe(1);
    expect(s.period).toBe("2026년 9월");
    // 유니클로(에프알엘코리아)는 2026-10-31부터 백화점이 아니라 의류/패션
    expect(s.spending).toEqual({ mart: 16000, department: 173800, fashion: 29900, cafe: 15700, delivery: 13100 });
  });

  it("부호 없는 승인취소: 짝이 되는 승인이 없으면 취소된 결제로 빼고, 있으면 서로 지운다", () => {
    const s = summarizeStatement(
      [
        "1 2026-09-23 승인 20291374 000000087882151 시외버스 모바일(티 23,100",
        "2 2026-09-21 승인취소 24290845 000000028524003 한국산업인력공단 34,600",
        "3 2026-09-21 승인 27290678 000000028524003 한국산업인력공단 11,300",
        "4 2026-09-20 승인 27290678 000000028524003 쿠팡(쿠페이) 5,000",
        "5 2026-09-22 승인취소 27290679 000000028524003 쿠팡(쿠페이) 5,000",
      ].join("\n"),
    );
    // 명세서 총승인금액처럼 취소된 34,600은 빠지고, 쿠팡 5,000은 승인·취소가 서로 지워진다
    expect(s.spending).toEqual({ intercity: 23100, etc: 11300 });
    expect(s.items.filter((it) => it.cancelled).map((it) => it.name)).toEqual(["한국산업인력공단"]);
    expect(s.refundCount).toBe(1);
  });

  it("사용자가 가맹점 카테고리를 바꾸면 같은 가맹점 결제가 함께 옮겨 가고 지출을 다시 계산한다", () => {
    const s = summarizeStatement(
      [
        "1 2026-09-30 승인 27293136 000000119907191 황곱 마곡나루 55,000",
        "2 2026-09-20 승인 27293137 000000119907191 황곱 마곡나루 20,000",
        "3 2026-09-21 승인 28290998 000000100254951 쿠팡이츠 9,000",
      ].join("\n"),
    );
    expect(s.spending).toEqual({ etc: 75000, delivery: 9000 });
    const t = recategorize(s, "황곱 마곡나루", "dining");
    expect(t.spending).toEqual({ dining: 75000, delivery: 9000 });
    expect(t.items.filter((it) => it.edited)).toHaveLength(2);
    // 브랜드 금액도 카테고리를 따라간다
    expect(recategorize(t, "쿠팡이츠", "dining").brands).toEqual({ dining: { 쿠팡이츠: 9000 } });
  });

  it("결제 금액 목록(엔진 건당 조건용): 취소·환불은 빼고 바꾼 카테고리를 따른다", () => {
    const s = summarizeStatement(
      [
        "1 2026-09-30 승인 28293024 000000121458019 브루다커피 마곡광장 1,800",
        "2 2026-09-17 승인 24288949 000000121458019 브루다커피 마곡광장 2,400",
        "3 2026-09-21 승인취소 24290845 000000028524003 한국산업인력공단 34,600",
        "4 2026-09-30 승인 27293136 000000119907191 황곱 마곡나루 55,000",
      ].join("\n"),
    );
    expect(ticketsOf(s.items)).toEqual({ cafe: [1800, 2400], etc: [55000] });
    expect(ticketsOf(recategorize(s, "황곱 마곡나루", "dining").items)).toEqual({ cafe: [1800, 2400], dining: [55000] });
  });

  it("구독 결제: 고른 카드와 상관없이 카드 데이터의 브랜드로 찾고, 영문 결제 이름도 알아본다(2026-11-01)", () => {
    const s = summarizeStatement(
      ["2026.09.07 ChatGPT_NICE 29,000", "2026.09.10 ANTHROPIC CLAUDE.AI 30,000", "2026.09.12 NETFLIX.COM 17,000", "2026.09.15 동네서점 12,000"].join("\n"),
    );
    expect(s.items.map((it) => [it.category, it.brand])).toEqual([
      ["subscription", "ChatGPT"],
      ["subscription", "Claude"],
      ["subscription", "넷플릭스"],
      ["books", undefined],
    ]);
    expect(s.brands.subscription).toEqual({ ChatGPT: 29000, Claude: 30000, 넷플릭스: 17000 });
  });

  it("명세서 경로 브랜드 비중: 혜택 브랜드가 없는 카테고리는 0%({})로 넘긴다(엔진이 35%로 가정하지 않게)", () => {
    const spending = { subscription: 29000, cafe: 15600, onlineShopping: 20000 };
    const share = statementBrandShare(spending, { onlineShopping: { 쿠팡: 20000 } });
    expect(share.onlineShopping).toEqual({ 쿠팡: 1 });
    expect(share.subscription).toEqual({});
    expect(share.cafe).toEqual({});
    // ChatGPT만 쓴 사람: OTT/구독에는 ChatGPT만 있다 → 넷플릭스 혜택은 0
    expect(statementBrandShare({ subscription: 29000 }, { subscription: { ChatGPT: 29000 } }).subscription).toEqual({ ChatGPT: 1 });
  });

  it("케이뱅크 이용대금명세서 형식: 상품명·카드번호 고정 칸은 이름에서 빼고, 캐시백은 소비가 아니다", () => {
    // 거래일자 상품명 카드번호 가맹점명 이용금액(카드번호는 가상)
    const row = (d: string, name: string, amt: string) => `2026.08.${d} ONE(K-패스) 1234-56**-****-7890 ${name} ${amt}`;
    const s = summarizeStatement(
      [
        "이용대금명세서",
        "거래일자 상품명 카드번호 가맹점명 이용금액",
        row("02", "메가엠지씨커피 수원", "4,300"),
        row("04", "비에이치씨 수원역점", "31,000"),
        row("05", "★웰페어클럽 캐시백", "-336"),
        row("16", "(주)신세계프라퍼티", "9,800"),
        row("29", "로쏘주식회사", "9,300"),
        row("30", "샤브로21 수원역점", "13,300"),
      ].join("\n"),
    );
    expect(s.items.map((it) => it.name)).toEqual(["메가엠지씨커피 수원", "비에이치씨 수원역점", "★웰페어클럽 캐시백", "(주)신세계프라퍼티", "로쏘주식회사", "샤브로21 수원역점"]);
    expect(s.spending).toEqual({ cafe: 13600, dining: 44300, department: 9800 });
    expect(s.items.filter((it) => it.reward)).toHaveLength(1);
    expect(s.refundCount).toBe(0);
    expect(s.period).toBe("2026년 8월");
  });

  it("신한카드 웹 명세서 형식: '가맹점 금액' 줄 + '날짜 부가정보' 줄을 한 건으로, 가린 숫자·캐시백 표시·요약·안내문은 금액이 아니다(2026-11-02)", () => {
    const S = "\u0001 "; // 신한 PDF의 낱말 사이 제어 문자
    const s = summarizeStatement(
      [
        "2026년9월",
        "623,270원",
        "결제계좌 신한은행",
        "11051*****71",
        "이용내역 최신순 고액순",
        "08월경기버스8건 11,850원",
        `2026.08.31${S}본인410*${S}일시불${S}무승인${S}캐시백${S}592원`,
        "투썸플레이스 아주대점 5,300원",
        `2026.08.31${S}본인410*${S}일시불`,
        "(주)와이비엠넷 59,000원",
        `2026.08.31${S}본인410*${S}일시불${S}캐시백${S}590원`,
        "메가박스 수원스타필드지점 20,000원",
        `2026.08.22${S}본인410*${S}일시불${S}캐시백${S}200원`,
        "CU 수원나누리점 2,400원",
        `2026.08.15${S}본인410*${S}일시불`,
        "총 5건 98,550원",
        "유통업 455,280원",
        "요식업•주점 76,100원",
        "· 2026년 2월 1일부터 ESG관점의 탄소배출 저감 캠페인의 일환으로, 플라스틱 카드 발급에 따른 환",
        "경 부담을 줄이고자 체크카드 재(추가)발급 시 연간(1.1~12.31 기준) 6회차 발급부터 건당 2,000",
        "원의 발급수수료가 부과됩니다.",
      ].join("\n"),
    );
    expect(s.items.map((it) => [it.date, it.name, it.category, it.amount])).toEqual([
      ["08.31", "08월경기버스8건", "transport", 11850],
      ["08.31", "투썸플레이스 아주대점", "cafe", 5300],
      ["08.31", "(주)와이비엠넷", "education", 59000],
      ["08.22", "메가박스 수원스타필드지점", "culture", 20000],
      ["08.15", "CU 수원나누리점", "convenience", 2400],
    ]);
    expect(s.period).toBe("2026년 8월");
    // 후불교통 8건 묶음은 건당 조건 계산에서 8번으로 나눈다
    expect(ticketsOf(s.items).transport).toEqual(Array(8).fill(1481));
  });

  it("카드 앱 이용내역 캡처(OCR 글자, 2026-11-02 NH 앱): 10건 173,500원, 검산 일치, 8/31~9/25는 한 달", () => {
    // tesseract.js(kor+eng)가 실제로 읽은 글자 그대로(카드번호 끝자리만 바꿈). '6,150원'을 '6,1508'로, 날짜·시각을 붙여 읽은 줄이 있다
    const card = "NH 모두의카드 체크0123";
    const rec = (name: string, amt: string, when: string, how: string) => [`${name}                                ${amt}`, when, card, how, "메모쓰기"];
    const ocr = [
      "    NH 모두의카드 체크                      >",
      "카드 이용내역 (총 10건)                         i",
      "173,500원",
      "2026.08.31~ 2026.09.30",
      "정상 10건                                   173,500원",
      "취소 건                                                0원",
      "분할납부                        대금결제",
      "검색어를 입력하세요              Q =",
      "총10건                        국내 *실시간 승인 ㆍ 전체",
      ...rec("(주)우아한형제들", "18,000원", "2026.09.25 20:21", "예금인출"),
      ...rec("경기인천버스(대표)", "6,1508", "2026.09.20 03:52", "일시불"),
      ...rec("(주)티머니 지하철", "4,950원", "2026.09.20 03:52", "일시불"),
      ...rec("경기인천버스(대표)", "16,250원", "2026.09.10 01:42", "일시불"),
      ...rec("(주)티머니 지하철", "10,500원", "2026.09.10 01:42", "일시불"),
      ...rec("모루네사진관", "35,000원", "2026.09.04 18:14", "예금인출"),
      ...rec("훌랄라치킨고현1점", "53,900원", "2026.09.02 19:27", "예금인출"),
      ...rec("경기인천버스(대표)", "6,700원", "2026.08.3102:02", "일시불"),
      ...rec("(주)티머니 지하철", "1550원", "2026.08.3102:02", "일시불"),
      ...rec("달로커피", "20,500원", "2026.08.3117:40", "예금인출"),
    ].join("\n");
    const s = summarizeStatement(fixOcrText(ocr));
    expect(s.items.map((it) => [it.name, it.amount])).toEqual([
      ["(주)우아한형제들", 18000],
      ["경기인천버스(대표)", 6150],
      ["(주)티머니 지하철", 4950],
      ["경기인천버스(대표)", 16250],
      ["(주)티머니 지하철", 10500],
      ["모루네사진관", 35000],
      ["훌랄라치킨고현1점", 53900],
      ["경기인천버스(대표)", 6700],
      ["(주)티머니 지하철", 1550],
      ["달로커피", 20500],
    ]);
    expect(s.check).toEqual({ declared: 173500, declaredCount: 10, read: 173500, readCount: 10 });
    expect(s.months).toBe(1);
    expect(s.spending.delivery).toBe(18000);
  });

  it("OCR 보정·검산·달 수 규칙", () => {
    expect(fixOcrText("경기인천버스(대표)   6,1508\n18,000원\n1,234,567")).toBe("경기인천버스(대표)   6,150원\n18,000원\n1,234,567");
    expect(fixOcrText("경기인천버스(대표)   6.700원\n2026.09.20 03:52")).toBe("경기인천버스(대표)   6,700원\n2026.09.20 03:52");
    // 검산이 다르면 그대로 알려 준다(읽은 합계와 명세서 합계)
    const bad = summarizeStatement(["2026.09.03 스타벅스 강남점 6,500", "2026.09.05 GS25 역삼점 4,800", "2026.09.06 쿠팡 32,000", "합계 50,000원"].join("\n"));
    expect(bad.check).toEqual({ declared: 50000, read: 43300, readCount: 3 });
    // 두 달 치(8월 초~9월 말)는 두 달 평균, 한 달 안쪽이면 달이 바뀌어도 한 달
    expect(summarizeStatement(["2026.08.02 쿠팡 30,000", "2026.09.28 쿠팡 50,000"].join("\n")).months).toBe(2);
    expect(summarizeStatement(["2026.08.15 쿠팡 30,000", "2026.09.14 쿠팡 50,000"].join("\n")).months).toBe(1);
    // 캡처 이미지는 v2 명세서 화면에서만 받는다
    const png = new File(["x"], "capture.png", { type: "image/png" });
    expect(validateStatementFile(png).isValid).toBe(false);
    expect(validateStatementFile(png, { images: true }).isValid).toBe(true);
  });

  it("작은 캡처 OCR(2026-11-02 카카오뱅크 405px): 조각 글자·쉼표 보정, 조회기간 줄, 비슷한 이름은 사진에서만", () => {
    // 줄 끝 금액의 '.'은 쉼표, 홀로 남은 영문 소문자 조각은 지운다
    expect(fixOcrText("2026.09.03 트레이더스 e 15.980")).toBe("2026.09.03 트레이더스  15,980");
    const ocr = [
      "조회기간 2026.09.01 ~ 2026.09.30",
      "2026.09.03 르레이더스 SUR 15,980",
      "2026.09.07 배스킨라번스 김해을 25,100",
      "2026.09.12 미삭토스트동서울터 7,800",
      "2026.09.15 (추)에프열겔코리아 29,900",
      "2026.09.20 (주)올리브홀딩스 12,000",
    ].join("\n");
    const cat = (s: ReturnType<typeof summarizeStatement>) => s.items.map((x) => x.category);
    expect(cat(summarizeStatement(ocr, [], {}, { ocr: true }))).toEqual(["mart", "cafe", "dining", "fashion", "etc"]);
    // PDF·CSV처럼 글자가 정확한 파일에서는 비슷한 이름으로 짐작하지 않는다('토스트'는 원래 있던 낱말 규칙)
    expect(cat(summarizeStatement(ocr))).toEqual(["etc", "etc", "dining", "etc", "etc"]);
  });

  it("비슷한 이름 찾기는 5글자 이상 브랜드의 낱말 앞부분만 본다", () => {
    expect(fuzzyCategory("르레이더스 SUR")).toBe("mart");
    for (const n of ["정성플러스 치과의원", "(주)올리브홀딩스", "황곱", "커피공장", "쿠키나라"]) expect(fuzzyCategory(n)).toBeNull();
    // 쿠팡은 '쿠팡(쿠페이)' 꼴로만 알아본다
    for (const n of ["더 쿠등 쿠케이", "쿠당(쿠케이", "El 쿠광(와우멤배심)"]) expect(fuzzyCategory(n)).toBe("onlineShopping");
  });

  it("한 가게만 쓴 명세서에서는 고정 칸을 찾다가 가게 이름을 지우지 않는다", () => {
    const s = summarizeStatement(Array.from({ length: 6 }, (_, i) => `2026.08.0${i + 1} 스타벅스 강남점 ${4500 + i * 100}`).join("\n"));
    expect(s.items[0].name).toBe("스타벅스 강남점");
  });

  it("여러 카드 명세서 합치기: 같은 달이면 한 달, 다른 달이면 평균, 취소는 명세서 안에서만 맞춘다", () => {
    const kakao = summarizeStatement(["1 2026-09-30 승인 1 2 브루다커피 1,800", "2 2026-09-12 승인 3 4 쿠팡(쿠페이) 20,000"].join("\n"));
    // 다른 카드에 같은 가맹점·같은 금액의 '승인취소'가 있어도 카카오뱅크 결제를 지우지 않는다
    const shinhan = summarizeStatement(["2026.09.05 쿠팡 20,000 승인취소", "2026.09.08 스타벅스 강남점 6,500"].join("\n"));
    const m = mergeStatements([
      { source: "카카오뱅크.pdf", summary: kakao },
      { source: "신한.csv", summary: shinhan },
    ]);
    expect(m.months).toBe(1);
    expect(m.period).toBe("2026년 9월");
    expect(m.spending).toEqual({ cafe: 8300, onlineShopping: 20000 });
    expect(m.items.filter((it) => it.cancelled).map((it) => it.source)).toEqual(["신한.csv"]);
    expect(ticketsOf(m.items)).toEqual({ cafe: [1800, 6500], onlineShopping: [20000] });

    const aug = summarizeStatement("2026-08-20 스타벅스 역삼점 4,500");
    const two = mergeStatements([
      { source: "a", summary: kakao },
      { source: "b", summary: aug },
    ]);
    expect(two.months).toBe(2);
    expect(two.period).toBe("2026년 8월~9월");
    expect(two.spending).toEqual({ cafe: 3200, onlineShopping: 10000 });
    // 한 장이면 원래 결과 그대로(출처 표시 없음)
    expect(mergeStatements([{ source: "a", summary: kakao }]).spending).toEqual(kakao.spending);
    expect(mergeStatements([{ source: "a", summary: kakao }]).items[0].source).toBeUndefined();
  });

  it("엔진에 넘길 명세서 정보: 결제 금액 + 카테고리별 요일 금액(월~일), 취소·캐시백은 빼고", () => {
    const s = summarizeStatement(
      [
        "2026.09.05 스타벅스 강남점 6,000", // 토
        "2026.09.06 스타벅스 강남점 4,000", // 일
        "2026.09.07 스타벅스 강남점 5,000", // 월
        "2026.09.08 쿠팡 결제취소 -5,000",
        "2026.09.09 ★웰페어클럽 캐시백 -300",
      ].join("\n"),
    );
    const sig = statementSignals(s.items);
    expect(sig.cafe).toEqual([6000, 4000, 5000]);
    expect(sig["_wd:cafe"]).toEqual([5000, 0, 0, 0, 0, 6000, 4000]);
    expect(Object.keys(sig).filter((k) => k.startsWith("_wd:"))).toEqual(["_wd:cafe"]);
  });

  it("칸 안에서 두 줄로 나뉜 가맹점명을 결제 줄에 붙인다", () => {
    const s = summarizeStatement(["롯데시네마 김포공항", "28 2026-09-20 승인 24290235 000000066524936 13,000", "_", "29 2026-09-19 승인 20290194 000000100370999 캐칭돌 1,000"].join("\n"));
    expect(s.items.map((it) => [it.name, it.category])).toEqual([
      ["롯데시네마 김포공항", "culture"],
      ["캐칭돌", "etc"],
    ]);
  });

  it("명세서 전용 사전: 파는 것이 장소 유형보다 먼저, 법인명은 브랜드로", () => {
    expect(statementCategory("빵 백화점 마곡점")).toBe("cafe");
    expect(statementCategory("롯데쇼핑(주) 롯데몰")).toBe("department");
    expect(statementCategory("떡볶이 대장")).toBe("dining");
    expect(statementCategory("레벨업PC방")).toBeNull();
    expect(withBrandNames("(주)에프알엘코리아 29,900")).toBe("(주)유니클로 29,900");
    expect(withBrandNames("에이치앤엠헤네스앤 68,000")).toBe("H&M 68,000");
  });

  it("카드 혜택에 나오는 브랜드는 그 혜택의 카테고리로 넣는다(brand-category.json)", () => {
    const line = (name: string) => `1 2026-09-01 승인 12345678 000000000000001 ${name} 10,000`;
    const cat = (name: string) => summarizeStatement(line(name)).items[0].category;
    expect(cat("엔제리너스 마곡점")).toBe("cafe");
    expect(cat("올리브영 강남점")).toBe("beautyFitness");
    expect(cat("오늘의집")).toBe("onlineShopping");
    // 한글 표기 → 혜택 표기
    expect(summarizeStatement(line("빕스 강남점"), ["VIPS"]).items[0]).toMatchObject({ category: "dining", brand: "VIPS" });
  });

  it("철도는 대중교통이 아니라 기차/고속버스(KTX 브랜드), 역 안 편의점은 편의점", () => {
    const line = (name: string) => `1 2026-09-08 승인 22286406 000000112874313 ${name} 15,200`;
    expect(summarizeStatement(line("한국철도공사"), ["KTX"]).items[0]).toMatchObject({ category: "intercity", brand: "KTX" });
    expect(summarizeStatement(line("레츠코레일")).items[0].category).toBe("intercity");
    expect(summarizeStatement(line("코레일유통 서울역점")).items[0].category).toBe("convenience");
    // 고속·시외버스도 기차/고속버스(대중교통 혜택 원문에 '시외·고속버스 제외'), 시내버스·지하철은 그대로 대중교통
    expect(summarizeStatement(line("시외버스 모바일(티")).items[0].category).toBe("intercity");
    expect(summarizeStatement(line("고속버스승차권(KOBUS")).items[0].category).toBe("intercity");
    // 호텔은 여행/숙박 그대로
    expect(summarizeStatement(line("신라호텔")).items[0].category).toBe("travel");
    expect(summarizeStatement(line("서울시내버스")).items[0].category).toBe("transport");
    expect(summarizeStatement(line("티머니 지하철")).items[0].category).toBe("transport");
    // 후불교통은 지역+버스로 찍힌다(NH '경기인천버스(대표)', 신한 '08월경기버스8건'). FOCUS 신한 체크 '후불교통요금 10%' 등 대중교통 혜택이 붙는다
    for (const n of ["경기인천버스(대표)", "08월경기버스8건", "부산버스", "공항철도", "광역전철"]) expect(summarizeStatement(line(n)).items[0].category).toBe("transport");
  });

  it("택시·주차는 자동차, 카드 업종 혜택에 나오는 업종 이름은 그 카테고리로", () => {
    const cat = (name: string) => summarizeStatement(`1 2026-09-01 승인 12345678 000000000000001 ${name} 10,000`).items[0].category;
    expect(cat("서울개인택시")).toBe("car");
    expect(cat("카카오T 일반택시")).toBe("car");
    expect(cat("모두의주차장")).toBe("car");
    expect(cat("행복산후조리원")).toBe("medical");
    expect(cat("밝은안경점")).toBe("medical");
    expect(cat("준오헤어 마곡점")).toBe("beautyFitness");
    expect(cat("삼성화재 자동차보험")).toBe("bills");
    expect(cat("구몬학습지")).toBe("education");
    expect(cat("서울교통공사")).toBe("transport");
    // 교통카드 충전은 주유가 아니다
    expect(cat("티머니 충전")).not.toBe("gas");
  });

  it("짧은 브랜드 이름이 다른 가게 이름 속에 섞여 걸리지 않는다", () => {
    expect(catalogCategory("설아 아이스크림")).toBeNull(); // '크림'(리셀 앱)
    expect(catalogCategory("이스턴웰스자판기")).toBeNull(); // '웰스'(렌탈)
    expect(catalogCategory("현대약국")).toBeNull(); // '현대'
    expect(catalogCategory("현대아울렛 김포점")).toBe("department"); // 혜택에 나오는 브랜드
    expect(catalogCategory("공차 강남점")).toBe("cafe");
    // 고른 카드에 KREAM('크림') 혜택이 있어도 무인 아이스크림 가게는 크림이 아니다
    const it = summarizeStatement("2026.08.06 설아아이스크림 장안 600", ["크림"], { 크림: "onlineShopping" }).items[0];
    expect(it).toMatchObject({ category: "cafe" });
    expect(it.brand).toBeUndefined();
    expect(summarizeStatement("2026.08.06 크림 리셀 30,000", ["크림"], { 크림: "onlineShopping" }).items[0]).toMatchObject({ category: "onlineShopping", brand: "크림" });
  });

  it("담은 카드 혜택의 카테고리가 카드 데이터 전체의 다수 카테고리보다 먼저다", () => {
    const line = "1 2026-09-01 승인 12345678 000000000000001 인터파크 30,000";
    expect(summarizeStatement(line, ["인터파크"]).items[0].category).toBe("onlineShopping");
    expect(summarizeStatement(line, ["인터파크"], { 인터파크: "culture" }).items[0].category).toBe("culture");
  });

  it("PDF 글자를 한 자씩 넣은 파일도 좌표로 줄을 다시 만든다", () => {
    const ch = (str: string, x: number, y: number) => ({ str, transform: [10, 0, 0, 10, x, y], width: str === " " ? 3 : 10, height: 10 });
    const items = [
      ...[..."쿠팡"].map((c, i) => ch(c, 100 + i * 10, 500)),
      ch(" ", 120, 500),
      ...[..."4,500"].map((c, i) => ch(c, 200 + i * 10, 500)),
      ...[..."합계"].map((c, i) => ch(c, 100 + i * 10, 480)),
    ];
    expect(pdfItemsToLines(items)).toBe("쿠팡 4,500\n합계");
  });
});
