import { describe, it, expect } from "vitest";
import {
  parseTextLocally,
  validateStatementFile,
  readStatementFileAsText,
  MAX_STATEMENT_FILE_SIZE,
  ALLOWED_STATEMENT_MIME_TYPES,
  ALLOWED_STATEMENT_EXTENSIONS,
} from "@/features/statement/importerParser";

describe("parseTextLocally", () => {
  it("카드 승인 문자 포맷에서 편의점 결제 건을 올바르게 파싱한다", () => {
    const text = "[신한체크승인] 홍길동 08/23 14:15 GS25강남역점 4,500원";
    const result = parseTextLocally(text);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      merchant: "GS25강남역점",
      amount: 4500,
      category: "convenience",
    });
  });

  it("현대카드 승인 포맷에서 카페 결제 건을 올바르게 파싱한다", () => {
    const text = "[현대카드] 홍길동 08/22 19:30 스타벅스 12,000원 일시불";
    const result = parseTextLocally(text);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      merchant: "스타벅스",
      amount: 12000,
      category: "cafe",
    });
  });

  it("대중교통 티머니 내역을 올바르게 파싱한다", () => {
    const text = "티머니 대중교통 55,000원";
    const result = parseTextLocally(text);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      merchant: "대중교통",
      amount: 55000,
      category: "transport",
    });
  });

  it("쿠팡 온라인 쇼핑 내역을 올바르게 파싱한다", () => {
    const text = "쿠팡 결제 42,900원";
    const result = parseTextLocally(text);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      merchant: "쿠팡",
      amount: 42900,
      category: "onlineShopping",
    });
  });

  it("쿠팡이츠 배달 내역은 '쿠팡'이 아니라 외식으로 분류한다", () => {
    const text = "쿠팡이츠 결제 24,000원";
    const result = parseTextLocally(text);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe("dining");
  });

  it("여러 행의 지출 텍스트를 동시에 처리할 수 있다", () => {
    const text = `
      [신한체크승인] GS25강남역점 4,500원
      [현대카드] 스타벅스 12,000원
      쿠팡 결제 42,900원
    `;
    const result = parseTextLocally(text);
    expect(result).toHaveLength(3);
    expect(result[0].category).toBe("convenience");
    expect(result[1].category).toBe("cafe");
    expect(result[2].category).toBe("onlineShopping");
  });

  it("금액이 매칭되지 않는 행은 건너뛴다", () => {
    const text = "이것은 지출이 아닌 일반 텍스트입니다.";
    const result = parseTextLocally(text);
    expect(result).toHaveLength(0);
  });

  describe("결제 취소 및 환불 내역 파싱", () => {
    it("승인취소 키워드가 포함된 경우 금액을 음수로 파싱한다", () => {
      const text = "[신한체크취소] 09/04 11:20 스타벅스 5,500원 승인취소";
      const result = parseTextLocally(text);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        merchant: "스타벅스",
        amount: -5500,
        category: "cafe",
      });
    });

    it("결제취소 키워드와 인명이 포함된 경우 상호명과 음수 금액을 올바르게 파싱한다", () => {
      const text = "[KB국민카드] 결제취소 홍길동 15,000원 스타벅스";
      const result = parseTextLocally(text);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        merchant: "스타벅스",
        amount: -15000,
        category: "cafe",
      });
    });

    it("마이너스 부호(-)가 포함된 결제 건의 금액을 음수로 변환한다", () => {
      const text = "[현대카드] 스타벅스 -12,000원 결제취소";
      const result = parseTextLocally(text);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        merchant: "스타벅스",
        amount: -12000,
        category: "cafe",
      });
    });

    it("특수 음수 부호(▲)가 포함된 환불 건을 음수로 변환한다", () => {
      const text = "쿠팡 ▲42,900원 환불";
      const result = parseTextLocally(text);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        merchant: "쿠팡",
        amount: -42900,
        category: "onlineShopping",
      });
    });

    it("정상 결제와 결제 취소가 혼합된 멀티라인 텍스트를 각각 올바른 부호로 파싱한다", () => {
      const text = `
        [신한체크승인] GS25강남역점 4,500원
        [신한체크취소] 09/04 11:20 스타벅스 5,500원 승인취소
        쿠팡 결제 42,900원
        [롯데카드] 배달의민족 24,000원 환불
      `;
      const result = parseTextLocally(text);
      expect(result).toHaveLength(4);
      expect(result[0]).toEqual({ merchant: "GS25강남역점", amount: 4500, category: "convenience" });
      expect(result[1]).toEqual({ merchant: "스타벅스", amount: -5500, category: "cafe" });
      expect(result[2]).toEqual({ merchant: "쿠팡", amount: 42900, category: "onlineShopping" });
      expect(result[3]).toEqual({ merchant: "배달의민족", amount: -24000, category: "dining" });
    });
  });
});

describe("validateStatementFile", () => {
  it("허용 MIME 타입 및 확장자 목록이 올바르게 정의되어 있어야 한다", () => {
    expect(ALLOWED_STATEMENT_MIME_TYPES).toContain("application/pdf");
    expect(ALLOWED_STATEMENT_MIME_TYPES).toContain("text/plain");
    expect(ALLOWED_STATEMENT_MIME_TYPES).toContain("text/csv");
    expect(ALLOWED_STATEMENT_EXTENSIONS).toContain(".pdf");
    expect(ALLOWED_STATEMENT_EXTENSIONS).toContain(".txt");
    expect(ALLOWED_STATEMENT_EXTENSIONS).toContain(".csv");
  });

  it("허용된 명세서 형식(PDF, TXT, CSV)의 10MB 이하 파일은 유효성 검사를 통과한다", () => {
    const formats = [
      { name: "statement.pdf", type: "application/pdf" },
      { name: "statement.txt", type: "text/plain" },
      { name: "statement.csv", type: "text/csv" },
    ];

    for (const fmt of formats) {
      const file = new File(["dummy content"], fmt.name, { type: fmt.type });
      const result = validateStatementFile(file);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    }
  });

  it("10MB 이하의 경계값 파일은 통과하고, 10MB를 초과하는 파일은 차단한다", () => {
    const validFile = new File(["a"], "valid.pdf", { type: "application/pdf" });
    Object.defineProperty(validFile, "size", { value: MAX_STATEMENT_FILE_SIZE });
    expect(validateStatementFile(validFile).isValid).toBe(true);

    const exceedFile = new File(["b"], "large.pdf", { type: "application/pdf" });
    Object.defineProperty(exceedFile, "size", { value: MAX_STATEMENT_FILE_SIZE + 1 });
    const result = validateStatementFile(exceedFile);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("최대 10MB");

    // 30MB 고화질 스캔 PDF 테스트
    const hugeFile = new File(["c"], "huge-scan.pdf", { type: "application/pdf" });
    Object.defineProperty(hugeFile, "size", { value: 30 * 1024 * 1024 });
    const hugeResult = validateStatementFile(hugeFile);
    expect(hugeResult.isValid).toBe(false);
    expect(hugeResult.error).toContain("최대 10MB");
  });

  it("지원하지 않는 MIME 타입 또는 확장자의 파일은 차단한다", () => {
    const unsupportedFiles = [
      new File(["jpg"], "receipt.jpg", { type: "image/jpeg" }),
      new File(["png"], "receipt.png", { type: "image/png" }),
      new File(["docx"], "memo.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    ];

    for (const file of unsupportedFiles) {
      const result = validateStatementFile(file);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("지원하지 않는 파일 형식");
    }
  });

  it("MIME 타입이 비어있거나 generic이어도 확장자가 유효한 포맷이면 통과한다", () => {
    // 일부 브라우저/OS에서 파일 type이 빈 문자열로 전달되는 케이스
    const pdfFile = new File(["pdf"], "statement.PDF", { type: "" });
    expect(validateStatementFile(pdfFile).isValid).toBe(true);

    const csvFile = new File(["csv"], "export.csv", { type: "application/octet-stream" });
    expect(validateStatementFile(csvFile).isValid).toBe(true);
  });
});

describe("readStatementFileAsText", () => {
  it("TXT/CSV 파일은 파일 내용을 그대로 텍스트로 읽어온다", async () => {
    const file = new File(["스타벅스 10,000원"], "export.csv", { type: "text/csv" });
    const text = await readStatementFileAsText(file);
    expect(text).toBe("스타벅스 10,000원");
  });
});

