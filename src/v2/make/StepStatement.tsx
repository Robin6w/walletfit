import { useRef, useState, type CSSProperties } from "react";
import { readStatementFileAsText, StatementPasswordError, validateStatementFile } from "@/features/statement/importerParser";
import { Link } from "@/v2/app/router";
import { summarizeStatement, type StatementSummary } from "@/v2/model/statement";

/* 디자인 원본 F-D-Statement(A2′·B2′) 값을 그대로 옮김. 지원 형식은 PDF(비밀번호 포함)·CSV·TXT(2026-10-28 결정) */

const SHADOW = "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)";
const SAMPLE_URL = `${import.meta.env.BASE_URL}samples/walletfit-sample-statement.csv`;

type Status = "reading" | "locked" | "opened" | "error";

interface Picked {
  name: string;
  meta: string;
  sample: boolean;
  file: File | null;
}

function Lock({ size, color = "currentColor" }: { size: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={size === 14 ? 2.2 : 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function fileMeta(f: File): string {
  const ext = (f.name.split(".").pop() || "").toUpperCase();
  const kb = Math.max(1, Math.round(f.size / 1024));
  return `${ext} 파일 · ${kb >= 1024 ? `${(kb / 1024).toFixed(1)}MB` : `${kb}KB`}`;
}

const badgeBase: CSSProperties = { flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 12px", borderRadius: 15, fontSize: 13, fontWeight: 700 };

export function StepStatement({
  back,
  extraBrands,
  onApply,
}: {
  /** 직접 입력으로 돌아가기 */
  back: string;
  /** 브랜드로 묶을 이름(담은 카드의 브랜드 한정 혜택에 나오는 가게) */
  extraBrands: string[];
  onApply: (summary: StatementSummary, fileName: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<StatementSummary | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const finish = (text: string) => {
    const s = summarizeStatement(text, extraBrands);
    if (s.itemCount === 0 || Object.keys(s.spending).length === 0) {
      setStatus("error");
      setError("결제 내역을 찾지 못했어요. 카드사에서 받은 이용대금명세서인지 확인해 주세요. 사진으로 찍거나 스캔한 PDF는 읽지 못해요.");
      return;
    }
    setSummary(s);
    setStatus("opened");
    setError("");
  };

  const open = async (file: File, password?: string) => {
    setStatus("reading");
    try {
      finish(await readStatementFileAsText(file, password));
      setPw("");
    } catch (e) {
      if (e instanceof StatementPasswordError) {
        setStatus("locked");
        setError(e.reason === "wrong" ? "비밀번호가 맞지 않아요. 다시 입력해 주세요." : password !== undefined ? "비밀번호를 입력해 주세요." : "");
      } else {
        setStatus("error");
        setError(e instanceof Error ? e.message : "파일을 읽지 못했어요.");
      }
    }
  };

  const pick = (file: File | undefined) => {
    if (!file) return;
    setSummary(null);
    setPw("");
    const v = validateStatementFile(file);
    setPicked({ name: file.name, meta: fileMeta(file), sample: false, file });
    if (!v.isValid) {
      setStatus("error");
      setError(v.error === "지원하지 않는 파일 형식입니다. PDF, TXT, CSV 파일만 지원합니다." ? "PDF·CSV·TXT 파일만 읽을 수 있어요." : "파일이 10MB보다 커요. 한 달치 명세서만 올려 주세요.");
      return;
    }
    void open(file);
  };

  const loadSample = async () => {
    setPicked({ name: "예시 명세서.csv", meta: "CSV · 예시 파일", sample: true, file: null });
    setStatus("reading");
    try {
      const res = await fetch(SAMPLE_URL);
      finish(await res.text());
    } catch {
      setStatus("error");
      setError("예시 명세서를 불러오지 못했어요.");
    }
  };

  const openWithPw = () => {
    if (!picked?.file) return;
    if (!pw) {
      setError("비밀번호를 입력해 주세요.");
      return;
    }
    void open(picked.file, pw);
  };

  const opened = status === "opened" && summary;
  const badge = opened
    ? { text: "열림", style: { ...badgeBase, background: "#E9F7EF", color: "#0F6B3D" } }
    : status === "locked"
      ? { text: "비밀번호로 잠겨 있어요", style: { ...badgeBase, background: "#FFF4D6", color: "#7A4F00" } }
      : status === "error"
        ? { text: "열지 못했어요", style: { ...badgeBase, background: "#FFF4D6", color: "#7A4F00" } }
        : { text: picked?.sample ? "잠금 없음" : "읽는 중", style: { ...badgeBase, background: "#E8EEFF", color: "#2457F5" } };
  const openedText = !summary
    ? ""
    : picked?.sample
      ? "예시 명세서를 읽었어요"
      : summary.period
        ? `열렸어요 · ${summary.period} 이용 내역을 읽었어요${summary.months > 1 ? "(월평균으로 계산)" : ""}`
        : `열렸어요 · 이용 내역 ${summary.itemCount}건을 읽었어요`;

  return (
    <>
      <Link
        to={back}
        style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6, height: 44, padding: "0 14px 0 8px", borderRadius: 22, fontSize: 15, fontWeight: 500, color: "#3A4A78", textDecoration: "none" }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19 12H5" />
          <path d="m11 6-6 6 6 6" />
        </svg>
        직접 입력으로 돌아가기
      </Link>
      <header>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>명세서로 지출 채우기</h1>
        <p style={{ margin: "6px 0 0", fontSize: 15, color: "#5E6D96" }}>카드사 앱이나 홈페이지에서 받은 이용대금명세서를 올리면 카테고리별 지출을 대신 채워 드려요</p>
      </header>

      <section style={{ background: "#FFFFFF", border: "1px solid transparent", borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 18, boxShadow: SHADOW }}>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            pick(e.dataTransfer.files?.[0]);
          }}
          style={{ border: `2px dashed ${dragOver ? "#2457F5" : "#B5C3E3"}`, borderRadius: 16, padding: "28px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center", background: dragOver ? "#E8EEFF" : "#F7FAFF" }}
        >
          <div style={{ width: 52, height: 52, borderRadius: 16, background: "#E8EEFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2457F5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 16V4" />
              <path d="m7 9 5-5 5 5" />
              <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
            </svg>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>명세서 파일을 여기에 놓으세요</div>
          <div style={{ fontSize: 14, color: "#5E6D96" }}>CSV · PDF · TXT · 최대 10MB</div>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: 4 }}>
            <input
              ref={input}
              type="file"
              accept=".pdf,.csv,.txt,application/pdf,text/csv,text/plain"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                pick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => input.current?.click()}
              style={{ height: 46, padding: "0 20px", borderRadius: 12, border: "none", background: "#2457F5", fontFamily: "inherit", fontSize: 15, fontWeight: 700, color: "#FFFFFF", cursor: "pointer" }}
            >
              파일 선택
            </button>
            <button
              type="button"
              onClick={() => void loadSample()}
              style={{ height: 46, padding: "0 20px", borderRadius: 12, border: "1px solid #D3DDF2", background: "#FFFFFF", fontFamily: "inherit", fontSize: 15, fontWeight: 700, color: "#0D1B4A", cursor: "pointer" }}
            >
              예시 명세서로 해보기
            </button>
          </div>
        </div>

        {picked && (
          <div aria-live="polite" style={{ border: "1px solid #D3DDF2", borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
              <div aria-hidden="true" style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 12, background: "#F3F7FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2457F5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                  <path d="M14 3v6h6" />
                  <path d="M8 13h8" />
                  <path d="M8 17h5" />
                </svg>
              </div>
              <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, overflowWrap: "anywhere" }}>{picked.name}</div>
                <div style={{ fontSize: 13, color: "#5E6D96" }}>{picked.meta}</div>
              </div>
              <span style={badge.style}>
                <Lock size={14} />
                {badge.text}
              </span>
            </div>

            {status === "locked" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label htmlFor="stmt-pw" style={{ fontSize: 15, fontWeight: 700 }}>
                  파일 비밀번호
                </label>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    openWithPw();
                  }}
                  style={{ display: "flex", flexWrap: "wrap", gap: 10 }}
                >
                  <input
                    id="stmt-pw"
                    type="password"
                    autoComplete="off"
                    placeholder="예: 생년월일 6자리"
                    value={pw}
                    aria-invalid={!!error}
                    aria-describedby={error ? "stmt-pw-err" : undefined}
                    onChange={(e) => {
                      setPw(e.target.value);
                      setError("");
                    }}
                    style={{ flex: "1 1 260px", minWidth: 0, height: 48, boxSizing: "border-box", padding: "0 14px", borderRadius: 12, background: "#FFFFFF", fontFamily: "inherit", fontSize: 16, color: "#0D1B4A", border: error ? "2px solid #C62828" : "1px solid #B5C3E3" }}
                  />
                  <button type="submit" style={{ height: 48, padding: "0 24px", border: "none", borderRadius: 12, background: "#2457F5", fontFamily: "inherit", fontSize: 15, fontWeight: 700, color: "#FFFFFF", cursor: "pointer" }}>
                    열기
                  </button>
                </form>
                {error && (
                  <div id="stmt-pw-err" role="alert" style={{ fontSize: 14, fontWeight: 600, color: "#C62828" }}>
                    {error}
                  </div>
                )}
                <div style={{ fontSize: 13, lineHeight: 1.6, color: "#5E6D96" }}>카드사·은행이 파일을 보낼 때 안내한 비밀번호예요. 파일을 여는 데만 쓰고 저장하지 않아요. 잠기지 않은 파일은 이 칸 없이 바로 열려요.</div>
              </div>
            )}

            {status === "error" && (
              <div role="alert" style={{ fontSize: 14, fontWeight: 600, color: "#C62828", lineHeight: 1.6 }}>
                {error}
              </div>
            )}

            {opened && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12, background: "#E9F7EF", fontSize: 15, fontWeight: 600, color: "#0F6B3D" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m5 12 5 5 9-10" />
                </svg>
                {openedText}
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          {opened ? (
            <button
              type="button"
              onClick={() => onApply(summary, picked?.name ?? "")}
              style={{ width: "min(400px, 100%)", height: 56, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: "none", borderRadius: 28, background: "#2457F5", color: "#FFFFFF", fontFamily: "inherit", fontSize: 17, fontWeight: 700, cursor: "pointer", boxShadow: "0 12px 28px rgba(36, 87, 245, 0.22)" }}
            >
              이 명세서로 추천 결과 보기
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14" />
                <path d="m13 6 6 6-6 6" />
              </svg>
            </button>
          ) : (
            <button type="button" disabled style={{ width: "min(400px, 100%)", height: 56, border: "none", borderRadius: 28, background: "#DDE5F5", color: "#5E6D96", fontFamily: "inherit", fontSize: 16, fontWeight: 700 }}>
              {status === "reading" ? "명세서를 읽고 있어요" : "명세서를 열면 추천 결과를 볼 수 있어요"}
            </button>
          )}
          <span style={{ fontSize: 13, color: "#5E6D96" }}>명세서로 채우면 지출 입력과 자주 가는 곳 단계를 건너뛰고 바로 결과로 가요</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12, background: "#F3F7FF", fontSize: 14, color: "#3A4A78" }}>
          <Lock size={18} color="#1747D6" />
          파일과 비밀번호는 이 브라우저 안에서만 써요. 서버로 보내거나 저장하지 않아요.
        </div>
      </section>
    </>
  );
}
