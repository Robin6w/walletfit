import { describe, expect, it } from "vitest";
import { mergeStatements, summarizeStatement } from "@/v2/model/statement";
import { decodeSplitFont, pdfItemsToLines, pdfPageToLines, readSpreadsheetStatement, type PdfTextItem } from "@/features/statement/importerParser";

/*
 * KB국민·삼성카드 신용카드 이용대금명세서(2026-11-24). 실제 명세서 4장(국민 9·10월, 삼성 9·10월)으로 양식을 확인하고,
 * 여기에는 같은 양식의 가상 명세서만 둔다(이름·가맹점·금액은 지어낸 것). 실제 4장은 합계·건수가 모두 명세서와 일치했다
 */

/** KB국민 양식: 날짜 '26.08.09'(두 자리 연도), 금액 칸 '이용금액 / 이번 달 결제 원금 / 수수료 / 결제 후 잔액 / 적립 포인트' */
const KB = [
  "홍길동 고객님의 9월 이용대금명세서",
  "216,700 원 4,600 원",
  "할인서비스 4,600 원",
  "작성기준일 2026.09.08 일시불/할부 카드이용한도 범위 내",
  "1,000 만원",
  "결제일 2026.09.20 해외이용 0 만원",
  "모바일 KB Pay 홈페이지 www.kbcard.com 고객센터 1588-1688",
  "본인 국내123 KB국민 굿데이카드 216,700 0",
  "> 카드 이용내역 [일시불ㆍ할부] 2026.08.07~2026.09.06 [단기카드대출(현금서비스)] 2026.07.21~2026.08.20",
  "이용일 이용카드 구분 이용가맹점 이용금액 할부 결제 후 잔액",
  "26.08.09 국내123 일시불 스타벅스코리아 6,300 6,300",
  "26.08.10 국내123 일시불 SK텔레콤-자동납부(12**34**) 55,000 52,000",
  "굿데이통신할인 -3,000",
  "26.08.15 국내123 일시불 GSSHOP(지에스리테일홈쇼핑)-지에스리테 P 40,000 40,000 35",
  "26.08.20 국내123 일시불 행복주유소 50,000 48,400",
  "굿데이주유할인 -1,600",
  "26.07.20 국내123 할부 이니시스(일반)-테스트상점 120,000 2/3 40,000 1,100 40,000",
  "무이자혜택금액 -1,100",
  "26.09.01 국내123 할부 CJ온스타일무이자 90,000 1/3 30,000 700 60,000",
  "무이자혜택금액 -700",
  "본인회원 님의 이 용 소 계 6 건 216,700 100,000 35",
  "합 계 6 건 216,700 100,000 35",
  "> 할부가격 안내",
  "09.01 CJ온스타일무이자 90,000 3 90,000",
].join("\n");

/** 삼성카드 양식: 날짜 '09-05'(연도 없음), 이용자 칸 '본 인', 해외 이용 상세에 같은 결제가 한 번 더 */
const SAMSUNG = [
  "2026년 10월",
  "70112345678 30098765432",
  "홍길동 귀하",
  "301,000원",
  "일시불 271,000",
  "할부 30,000",
  "결제일 : 2026년10월13일 카드 이용한도 600만원",
  "이용내역 [일시불/할부 이용기간] 2026년 09월 01일-2026년 09월 30일 [단기카드대출(현금서비스) 이용기간] 2026년 08월 14일-2026년 09월 14일",
  "이용일 이용카드 가 맹 점 이용금액 할부가격 / 이용혜택 혜택금액 포인트명 적립금액",
  "09-05 본 인 123 철도승차권결제 40,000 40,000",
  "09-12 본 인 123 Grab* A-TEST1 11,000 11,000",
  "09-20 본 인 123 테스트의원 220,000 220,000",
  "일시불 합계 271,000",
  "09-21 본 인 123 네이버페이 네이버 90,000 90,000 3/1 30,000 60,000 이자면제 -800",
  "할 부 합계 30,000 60,000",
  "이용금액합계 301,000 60,000",
  "해외매출 상세내역",
  "이용일 접수일 가 맹 점 업 종 국 가 환 율 원화환산 청구금액(￦)",
  "09-12 09-14 Grab* A-TEST1 택시요금 베트남 200,000.00 VND 7.70 1,428.00 10,978 22 11,000",
  "ㆍ삼성카드 홈페이지 또는 대표전화(1588-8700)",
].join("\n");

describe("KB국민 신용카드 명세서", () => {
  const s = summarizeStatement(KB);

  it("이번 달 결제 원금으로 읽어 명세서 합계·건수와 맞는다(할인 뒤 금액, 할부는 이번 달 회차분)", () => {
    expect(s.check).toEqual({ declared: 216700, declaredCount: 6, read: 216700, readCount: 6 });
    expect(s.items.map((it) => it.amount)).toEqual([6300, 52000, 40000, 48400, 40000, 30000]);
  });

  it("맨 위 요약·한도(만원)·할인 줄은 결제가 아니고, 가맹점 이름에서 카드 칸·스타샵 'P'·적립 포인트를 뺀다", () => {
    expect(s.items.map((it) => it.name)).toEqual([
      "스타벅스코리아",
      "SK텔레콤-자동납부",
      "GSSHOP(지에스리테일홈쇼핑)-지에스리테",
      "행복주유소",
      "이니시스(일반)-테스트상점",
      "CJ온스타일무이자",
    ]);
    expect(s.items.find((it) => it.name === "SK텔레콤-자동납부")?.category).toBe("mobile");
  });

  it("달 수·기간은 이용 기간(8/7~9/6)으로 센다: 지난달 산 할부(7/20)가 있어도 한 달", () => {
    expect(s.months).toBe(1);
    expect(s.period).toBe("2026년 8월");
    expect(s.items.find((it) => it.name.startsWith("이니시스"))).toMatchObject({ date: "07.20", month: "2026-07", cycle: "2026-08" });
  });
});

describe("삼성카드 신용카드 명세서", () => {
  const s = summarizeStatement(SAMSUNG);

  it("연도 없는 날짜에 이용 기간의 연도를 붙이고, 해외 이용 상세의 같은 결제는 다시 세지 않는다", () => {
    expect(s.items.map((it) => [it.date, it.month, it.amount])).toEqual([
      ["09.05", "2026-09", 40000],
      ["09.12", "2026-09", 11000],
      ["09.20", "2026-09", 220000],
      ["09.21", "2026-09", 30000],
    ]);
  });

  it("고객번호를 금액으로 읽지 않고, '일시불 합계'가 아니라 '이용금액합계'로 검산한다", () => {
    expect(s.check).toEqual({ declared: 301000, declaredCount: undefined, read: 301000, readCount: 4 });
    expect(s.period).toBe("2026년 9월");
  });

  it("이용자 칸 '본 인'을 이름에서 빼고, 철도승차권은 기차, Grab은 택시로 나눈다", () => {
    expect(s.items.map((it) => [it.name, it.category])).toEqual([
      ["철도승차권결제", "intercity"],
      ["Grab* A-TEST1", "car"],
      ["테스트의원", "medical"],
      ["네이버페이 네이버", "onlineShopping"],
    ]);
  });
});

describe("여러 신용카드 명세서 합치기(기준 달)", () => {
  it("다른 달 명세서는 두 달 평균, 같은 달 명세서 두 장은 한 달", () => {
    const kb = summarizeStatement(KB); // 기준 달 2026-08
    const ss = summarizeStatement(SAMSUNG); // 기준 달 2026-09
    expect(mergeStatements([{ source: "kb", summary: kb }, { source: "ss", summary: ss }]).months).toBe(2);
    expect(mergeStatements([{ source: "ss1", summary: ss }, { source: "ss2", summary: ss }]).months).toBe(1);
  });
});

/*
 * 카드사 엑셀(xls) 명세서(2026-11-24). 롯데·현대카드 '엑셀 다운로드'는 웹 표(HTML)를 xls 이름으로 준다.
 * 실제 4장(롯데 9·10월, 현대 9·10월)은 합계가 명세서와 모두 일치했다. 아래는 같은 표 모양의 가상 명세서
 */
const utf8 = (s: string) => new TextEncoder().encode(s);

/** 롯데 모양: 요약 표의 '합계', 두 줄 머리글('이번 달 입금하실 금액' 아래 '원금'·'수수료'), '회차'·'할부' 칸이 따로 */
const LOTTE = `
<html><head><meta charset="utf-8"></head><body>
<table><tr><th>이용내역</th><th>금액</th></tr>
<tr><td rowspan="2">이번달</td><td>일시불</td><td>212,000</td></tr><tr><td>할부</td><td>50,000</td></tr>
<tr class="x-total"><td>합계</td><td>262,000</td></tr></table>
<h2>■ 상세내역</h2>
<table><thead>
<tr><th rowspan="2">이용일</th><th rowspan="2">이용카드</th><th rowspan="2">이용가맹점</th><th rowspan="2">이용총액</th><th rowspan="2">회차</th><th rowspan="2">할부</th>
<th colspan="2">이번 달 입금하실 금액</th><th rowspan="2">이용혜택</th><th rowspan="2">혜택금액</th><th rowspan="2">결제 후 잔액</th></tr>
<tr><th>원금</th><th>수수료</th></tr></thead><tbody>
<tr><td>2026.07.10</td><td>본인테스트카드</td><td>테스트전자몰</td><td> 250,000원 </td><td>2</td><td>5</td><td>50,000</td><td></td><td>무이자할부</td><td>3,000</td><td>150,000</td></tr>
<tr><td>2026.07.10</td><td>본인테스트카드</td><td>테스트전자몰</td><td></td><td></td><td></td><td></td><td></td><td>결제일 할인</td><td>1,000</td><td></td></tr>
<tr><td>2026.09.05</td><td>본인테스트카드</td><td>LG U+ 통신요금 자동이체 09월 **12-**34</td><td>60,000원</td><td></td><td></td><td>55,000</td><td></td><td>테스트할인</td><td>5,000</td><td></td></tr>
<tr><td>2026.09.20</td><td>본인테스트카드</td><td>아파트 관리비</td><td></td><td></td><td></td><td>157,000</td><td></td><td></td><td></td><td></td></tr>
</tbody></table></body></html>`;

/** 현대 모양: 닫는 태그 '</td >', '할부/회차' 한 칸, 결제원금 0원 줄(수수료·감면), 마지막 '총 합계' 줄 */
const HYUNDAI = `
<html><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"></head><body>
<div>2026년 10월 이용대금명세서</div>
<table><tr><th>이용일</th><th>이용카드</th><th>이용가맹점</th><th>이용금액</th><th>할부/회차</th><th>적립/할인율(%)</th><th>예상적립/할인</th><th>결제원금</th><th>결제후잔액</th><th>수수료(이자)</th></tr>
<tr><td>2026년 10월 03일</td><td>본인 테스트카드</td><td>카드이용알림수수료10월</td ><td>300</td><td></td><td>0%</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>
<tr><td>2026년 10월 03일</td><td>본인 테스트카드</td><td>이메일이용 감면</td ><td>-300</td><td></td><td>0%</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>
<tr><td>2026년 08월 15일</td><td>본인 테스트카드</td><td>테스트페이먼츠 - 테스트상점</td ><td>90,000</td><td>3/2</td><td>0%</td><td>0</td><td>30,000</td><td>30,000</td><td>0</td></tr>
<tr><td>2026년 09월 06일</td><td>본인 테스트카드</td><td>테스트식자재도매유통</td ><td>40,000</td><td></td><td>1.5%</td><td>600</td><td>40,000</td><td>0</td><td>0</td></tr>
<tr><td>2026년 09월 19일</td><td>본인 테스트카드 하이</td><td>한국도로공사 0003건</td ><td>4,500</td><td></td><td>0%</td><td>60</td><td>4,500</td><td>0</td><td>0</td></tr>
<tr><td>2026년 09월 25일</td><td>본인 테스트카드</td><td>나이스 - 이지차저</td ><td>10,000</td><td></td><td>30.0%</td><td>-3,000</td><td>7,000</td><td>0</td><td>0</td></tr>
<tr><td>-</td><td></td><td>총 합계 5 건</td><td>0</td><td></td><td></td><td>0</td><td>81,500</td><td>0</td><td>0</td></tr>
</table></body></html>`;

describe("카드사 엑셀(xls) 명세서", () => {
  it("롯데 모양: 두 줄 머리글에서 '이번 달 입금하실 금액 원금' 칸을 찾고, 혜택만 있는 줄은 빼고, 요약 표 합계로 검산한다", () => {
    const s = summarizeStatement(readSpreadsheetStatement(utf8(LOTTE)));
    expect(s.check).toEqual({ declared: 262000, declaredCount: undefined, read: 262000, readCount: 3 });
    expect(s.items.map((it) => [it.date, it.name, it.amount, it.category])).toEqual([
      ["07.10", "테스트전자몰", 50000, "etc"],
      ["09.05", "LG U+ 통신요금 자동이체 09월", 55000, "mobile"],
      ["09.20", "아파트 관리비", 157000, "bills"],
    ]);
    // 지난달 산 할부(7/10)가 있어도 명세서 한 장은 한 달
    expect(s.months).toBe(1);
    expect(s.period).toBe("2026년 9월");
  });

  it("현대 모양: 결제원금 칸을 쓰고 0원 줄(수수료·감면)은 빼고, '총 합계' 줄로 검산한다. 할부/회차·건수도 읽는다", () => {
    const s = summarizeStatement(readSpreadsheetStatement(utf8(HYUNDAI)));
    expect(s.check).toEqual({ declared: 81500, declaredCount: undefined, read: 81500, readCount: 4 });
    expect(s.items.map((it) => [it.name, it.amount, it.category, it.count ?? 1])).toEqual([
      ["테스트페이먼츠 테스트상점", 30000, "etc", 1],
      ["테스트식자재도매유통", 40000, "mart", 1],
      ["한국도로공사 3건", 4500, "car", 3],
      ["나이스 이지차저", 7000, "gas", 1],
    ]);
    expect(s.months).toBe(1);
  });

  it("EUC-KR로 저장한 표도 읽고, 진짜 엑셀(xls 원본·xlsx)은 CSV로 저장하라고 안내한다", () => {
    const euc = new Uint8Array([...utf8('<meta charset="euc-kr"><table><tr><td>'), 0xc7, 0xd5, 0xb0, 0xe8, ...utf8("</td><td>1,000</td></tr></table>")]);
    expect(readSpreadsheetStatement(euc)).toContain("[표 명세서]");
    expect(() => readSpreadsheetStatement(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0]))).toThrow(/CSV UTF-8/);
    expect(() => readSpreadsheetStatement(new Uint8Array([0x50, 0x4b, 3, 4, 0, 0]))).toThrow(/CSV UTF-8/);
  });
});

describe("PDF 글자 읽기(삼성카드 PDF, 2026-11-24)", () => {
  it("한글 글꼴을 EUC-KR 앞 바이트별로 쪼갠 PDF를 되돌린다(글꼴 이름 끝 = 앞 바이트, 글자 = 맥 문자로 쓴 뒤 바이트)", () => {
    expect(decodeSplitFont("‚", "KXEOIF+SCGodicM_b3")).toBe("년");
    expect(decodeSplitFont("˘", "KDYDZS+SCGodicM_bf")).toBe("월");
    expect(decodeSplitFont("2026", "EYBJEA+SCGodicM_e")).toBe("2026");
    expect(decodeSplitFont("‚", "Helvetica")).toBe("‚");
  });

  it("그리기 목록의 원래 바이트로 되돌린다: 같은 '¨'라도 0xA8이면 '감'(글자만 보고 맥 문자표로 짐작하면 0xAC '갔')", async () => {
    const item = (str: string, x: number, fontName: string) => ({ str, fontName, transform: [8, 0, 0, 8, x, 100], width: 7, height: 8 });
    // f1은 보통 글꼴('차' 그대로), f2는 앞 바이트 0xB0으로 쪼갠 글꼴. 그리기 목록에는 f2 글자의 원래 바이트 0xA8이 남아 있다
    const page = {
      getTextContent: async () => ({ items: [item("차", 10, "f1"), item("¨", 18, "f2")] }),
      getOperatorList: async () => ({
        fnArray: [1, 2, 1, 2],
        argsArray: [["f1"], [[{ unicode: "차", originalCharCode: 0x31 }]], ["f2"], [[{ unicode: "¨", originalCharCode: 0xa8 }]]],
      }),
      commonObjs: {
        has: () => true,
        get: (id: string) => ({ name: id === "f1" ? "AAAAAA+Plain" : "BBBBBB+SCGodicL_b0" }),
      },
    };
    expect(await pdfPageToLines(page, { setFont: 1, showText: 2, showSpacedText: 3 })).toBe("차감");
  });

  it("살짝 비켜 두 번 찍은 굵은 글자는 한 번만, 옆으로 세운 글자는 뺀다", () => {
    const items: PdfTextItem[] = [
      { str: "합계", transform: [8, 0, 0, 8, 10, 50], width: 16 },
      { str: "762,557", transform: [8, 0, 0, 8, 40, 50], width: 30 },
      { str: "762,557", transform: [8, 0, 0, 8, 40.3, 50], width: 30 },
      { str: "다", transform: [0, 8, -8, 0, 500, 300], width: 8 },
    ];
    expect(pdfItemsToLines(items)).toBe("합계 762,557");
  });
});
