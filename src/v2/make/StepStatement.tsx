import { useMemo, useRef, useState, type CSSProperties } from "react";
import { isStatementImage, readStatementFileAsText, StatementPasswordError, validateStatementFile, type ImageReadInfo } from "@/features/statement/importerParser";
import { Link } from "@/v2/app/router";
import { mergeStatements, recategorize, summarizeStatement, type StatementSummary } from "@/v2/model/statement";
import { StatementItems } from "@/v2/make/StatementItems";

/*
 * 디자인 원본 F-D-Statement(A2′·B2′) 값을 그대로 옮김. 지원 형식은 PDF(비밀번호 포함)·CSV·TXT(2026-10-28 결정).
 * 2026-10-31: 카드가 여러 장인 사람을 위해 명세서를 여러 장 받아 전체 소비로 합친다(파일마다 따로 열고 비밀번호도 따로)
 */

const SHADOW = "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)";
const SAMPLE_URL = `${import.meta.env.BASE_URL}samples/walletfit-sample-statement.csv`;

type Status = "reading" | "locked" | "opened" | "error";

interface Entry {
  id: number;
  name: string;
  meta: string;
  sample: boolean;
  file: File | null;
  status: Status;
  error: string;
  pw: string;
  summary: StatementSummary | null;
  /** 읽은 글자로 만든 지문(같은 명세서를 두 번 올렸는지 가린다) */
  print?: string;
  /** 캡처 이미지(글자 인식으로 읽음, 2026-11-02) */
  image?: boolean;
  /** 글자 인식 진행률 0~1 */
  progress?: number;
  /** 글자 인식 품질(신뢰도·원본 가로 크기) */
  quality?: ImageReadInfo;
}

/**
 * 사진 글자를 믿기 어려운 경우(2026-11-02): 인식 신뢰도 80% 미만이거나 가로 500px 미만.
 * 측정: NH 앱 캡처(576px) 신뢰도 87% → 10건 모두 정확, 카카오뱅크 확인서를 작게 캡처(405px) 69% → 가맹점 이름 대부분·금액 일부 틀림
 */
const lowQuality = (q?: ImageReadInfo) => !!q && (q.confidence < 80 || (q.width > 0 && q.width < 500));

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

/** 글자 지문(djb2). 같은 명세서를 다시 올리면 지출이 두 배가 되므로 막는다 */
function fingerprint(text: string): string {
  let h = 5381;
  const s = text.replace(/\s+/g, "");
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${s.length}:${h}`;
}

const won = (v: number) => `${v.toLocaleString("ko-KR")}원`;

/** 명세서 합계 검산 한 줄: 일치하면 초록, 다르면 경고 */
function CheckLine({ check, image }: { check: NonNullable<StatementSummary["check"]>; image: boolean }) {
  const ok = check.read === check.declared && (check.declaredCount === undefined || check.declaredCount === check.readCount);
  const declared = `${won(check.declared)}${check.declaredCount !== undefined ? `(${check.declaredCount}건)` : ""}`;
  return ok ? (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#0F6B3D" }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m5 12 5 5 9-10" />
      </svg>
      명세서 합계 {declared}과 일치해요
    </div>
  ) : (
    <div role="alert" style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.6, color: "#7A4F00", background: "#FFF4D6", borderRadius: 10, padding: "8px 12px" }}>
      명세서 합계는 {declared}인데 읽은 합계는 {won(check.read)}({check.readCount}건)이에요. {image ? "사진 글자 인식이 틀렸을 수 있어요. " : ""}아래 표에서 금액을 확인해 주세요.
    </div>
  );
}

const badgeBase: CSSProperties ={ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 12px", borderRadius: 15, fontSize: 13, fontWeight: 700 };

let nextId = 1;

export function StepStatement({
  back,
  extraBrands,
  brandCats,
  onApply,
}: {
  /** 직접 입력으로 돌아가기 */
  back: string;
  /** 브랜드로 묶을 이름(담은 카드의 브랜드 한정 혜택에 나오는 가게) */
  extraBrands: string[];
  /** 그 브랜드가 담은 카드 혜택에서 속한 카테고리 */
  brandCats: Record<string, string>;
  onApply: (summary: StatementSummary, fileName: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  /** 사용자가 바꾼 가맹점 카테고리. 명세서를 더 올리거나 빼도 유지한다 */
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [dragOver, setDragOver] = useState(false);

  const patch = (id: number, p: Partial<Entry>) => setEntries((list) => list.map((e) => (e.id === id ? { ...e, ...p } : e)));

  const finish = (id: number, text: string, ocr = false) => {
    const s = summarizeStatement(text, extraBrands, brandCats, { ocr });
    if (s.itemCount === 0 || Object.keys(s.spending).length === 0) {
      patch(id, {
        status: "error",
        error: "결제 내역을 찾지 못했어요. 카드사에서 받은 이용대금명세서나 카드 앱 이용내역 캡처인지 확인해 주세요. 스캔한 PDF와 흐리게 찍은 사진은 읽지 못해요.",
      });
      return;
    }
    const print = fingerprint(text);
    setEntries((list) => {
      const dup = list.find((e) => e.id !== id && e.status === "opened" && e.print === print);
      return list.map((e) =>
        e.id !== id
          ? e
          : dup
            ? { ...e, status: "error", error: `이미 올린 명세서(${dup.name})와 내용이 같아요. 같은 명세서를 두 번 넣으면 지출이 두 배로 계산돼요.`, print }
            : { ...e, status: "opened", error: "", pw: "", summary: s, print },
      );
    });
  };

  const open = async (id: number, file: File, password?: string) => {
    patch(id, { status: "reading" });
    try {
      finish(
        id,
        await readStatementFileAsText(
          file,
          password,
          (progress) => patch(id, { progress }),
          (quality) => patch(id, { quality }),
        ),
        isStatementImage(file),
      );
    } catch (e) {
      if (e instanceof StatementPasswordError) {
        patch(id, { status: "locked", error: e.reason === "wrong" ? "비밀번호가 맞지 않아요. 다시 입력해 주세요." : password !== undefined ? "비밀번호를 입력해 주세요." : "" });
      } else {
        patch(id, { status: "error", error: e instanceof Error ? e.message : "파일을 읽지 못했어요." });
      }
    }
  };

  const pick = (files: FileList | null | undefined) => {
    for (const file of Array.from(files ?? [])) {
      const id = nextId++;
      const v = validateStatementFile(file, { images: true });
      const entry: Entry = { id, name: file.name, meta: fileMeta(file), sample: false, file, status: "reading", error: "", pw: "", summary: null, image: isStatementImage(file) };
      if (!v.isValid) {
        entry.status = "error";
        entry.error = v.error?.startsWith("지원하지 않는") ? "명세서 PDF·CSV·TXT 파일이나 카드 앱 이용내역 캡처(PNG·JPG)만 읽을 수 있어요." : "파일이 10MB보다 커요. 한 달치 명세서만 올려 주세요.";
      }
      setEntries((list) => [...list, entry]);
      if (v.isValid) void open(id, file);
    }
  };

  const loadSample = async () => {
    if (entries.some((e) => e.sample)) return;
    const id = nextId++;
    setEntries((list) => [...list, { id, name: "예시 명세서.csv", meta: "CSV · 예시 파일", sample: true, file: null, status: "reading", error: "", pw: "", summary: null }]);
    try {
      const res = await fetch(SAMPLE_URL);
      finish(id, await res.text());
    } catch {
      patch(id, { status: "error", error: "예시 명세서를 불러오지 못했어요." });
    }
  };

  const openWithPw = (e: Entry) => {
    if (!e.file) return;
    if (!e.pw) {
      patch(e.id, { error: "비밀번호를 입력해 주세요." });
      return;
    }
    void open(e.id, e.file, e.pw);
  };

  const remove = (id: number) => setEntries((list) => list.filter((e) => e.id !== id));

  const openedEntries = entries.filter((e) => e.status === "opened" && e.summary);
  const summary = useMemo(() => {
    if (!openedEntries.length) return null;
    let s = mergeStatements(openedEntries.map((e) => ({ source: e.name, summary: e.summary! })));
    for (const [name, cat] of Object.entries(edits)) if (s.items.some((it) => it.name === name)) s = recategorize(s, name, cat);
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, edits]);

  const reading = entries.some((e) => e.status === "reading");
  const onlySample = openedEntries.length === 1 && openedEntries[0].sample;
  const openedText = !summary
    ? ""
    : onlySample
      ? "예시 명세서를 읽었어요"
      : `${openedEntries.length > 1 ? `명세서 ${openedEntries.length}장을 합쳤어요 · ` : "열렸어요 · "}${summary.period ? `${summary.period} 이용 내역` : `이용 내역 ${summary.itemCount}건`}을 읽었어요${summary.months > 1 ? "(월평균으로 계산)" : ""}`;
  const fileName = openedEntries.length > 1 ? `${openedEntries[0].name} 외 ${openedEntries.length - 1}장` : (openedEntries[0]?.name ?? "");

  const badgeOf = (e: Entry) =>
    e.status === "opened"
      ? { text: "열림", style: { ...badgeBase, background: "#E9F7EF", color: "#0F6B3D" } }
      : e.status === "locked"
        ? { text: "비밀번호로 잠겨 있어요", style: { ...badgeBase, background: "#FFF4D6", color: "#7A4F00" } }
        : e.status === "error"
          ? { text: "열지 못했어요", style: { ...badgeBase, background: "#FFF4D6", color: "#7A4F00" } }
          : {
              text: e.sample ? "잠금 없음" : e.image ? `사진 글자 읽는 중${e.progress ? ` ${Math.round(e.progress * 100)}%` : ""}` : "읽는 중",
              style: { ...badgeBase, background: "#E8EEFF", color: "#2457F5" },
            };

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
        <p style={{ margin: "6px 0 0", fontSize: 15, color: "#5E6D96" }}>카드사 앱이나 홈페이지에서 받은 이용대금명세서를 올리면 카테고리별 지출을 대신 채워 드려요. 카드가 여러 장이면 명세서를 모두 올려 주세요</p>
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
            pick(e.dataTransfer.files);
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
          <div style={{ fontSize: 18, fontWeight: 700 }}>{entries.length ? "다른 카드 명세서도 여기에 놓으세요" : "명세서 파일을 여기에 놓으세요"}</div>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: 4 }}>
            <input
              ref={input}
              type="file"
              multiple
              accept=".pdf,.csv,.txt,.png,.jpg,.jpeg,.webp,application/pdf,text/csv,text/plain,image/png,image/jpeg,image/webp"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                pick(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => input.current?.click()}
              style={{ height: 46, padding: "0 20px", borderRadius: 12, border: "none", background: "#2457F5", fontFamily: "inherit", fontSize: 15, fontWeight: 700, color: "#FFFFFF", cursor: "pointer" }}
            >
              {entries.length ? "명세서 더 추가" : "파일 선택"}
            </button>
            <button
              type="button"
              onClick={() => void loadSample()}
              disabled={entries.some((e) => e.sample)}
              style={{ height: 46, padding: "0 20px", borderRadius: 12, border: "1px solid #D3DDF2", background: "#FFFFFF", fontFamily: "inherit", fontSize: 15, fontWeight: 700, color: "#0D1B4A", cursor: "pointer" }}
            >
              예시 명세서로 해보기
            </button>
          </div>
        </div>

        {entries.length > 0 && (
          <div aria-live="polite" style={{ border: "1px solid #D3DDF2", borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 14 }}>
              {entries.map((e) => {
                const badge = badgeOf(e);
                const pwId = `stmt-pw-${e.id}`;
                return (
                  <li key={e.id} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
                        <div style={{ fontSize: 15, fontWeight: 700, overflowWrap: "anywhere" }}>{e.name}</div>
                        <div style={{ fontSize: 13, color: "#5E6D96" }}>
                          {e.meta}
                          {e.status === "opened" && e.summary ? ` · ${e.summary.itemCount}건` : ""}
                        </div>
                      </div>
                      <span style={badge.style}>
                        <Lock size={14} />
                        {badge.text}
                      </span>
                      <button
                        type="button"
                        aria-label={`${e.name} 빼기`}
                        onClick={() => remove(e.id)}
                        style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 18, border: "1px solid #D3DDF2", background: "#FFFFFF", color: "#5E6D96", fontFamily: "inherit", fontSize: 18, lineHeight: 1, cursor: "pointer" }}
                      >
                        ×
                      </button>
                    </div>

                    {e.status === "locked" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <label htmlFor={pwId} style={{ fontSize: 15, fontWeight: 700 }}>
                          파일 비밀번호
                        </label>
                        <form
                          onSubmit={(ev) => {
                            ev.preventDefault();
                            openWithPw(e);
                          }}
                          style={{ display: "flex", flexWrap: "wrap", gap: 10 }}
                        >
                          <input
                            id={pwId}
                            type="password"
                            autoComplete="off"
                            placeholder="예: 생년월일 6자리"
                            value={e.pw}
                            aria-invalid={!!e.error}
                            aria-describedby={e.error ? `${pwId}-err` : undefined}
                            onChange={(ev) => patch(e.id, { pw: ev.target.value, error: "" })}
                            style={{ flex: "1 1 260px", minWidth: 0, height: 48, boxSizing: "border-box", padding: "0 14px", borderRadius: 12, background: "#FFFFFF", fontFamily: "inherit", fontSize: 16, color: "#0D1B4A", border: e.error ? "2px solid #C62828" : "1px solid #B5C3E3" }}
                          />
                          <button type="submit" style={{ height: 48, padding: "0 24px", border: "none", borderRadius: 12, background: "#2457F5", fontFamily: "inherit", fontSize: 15, fontWeight: 700, color: "#FFFFFF", cursor: "pointer" }}>
                            열기
                          </button>
                        </form>
                        {e.error && (
                          <div id={`${pwId}-err`} role="alert" style={{ fontSize: 14, fontWeight: 600, color: "#C62828" }}>
                            {e.error}
                          </div>
                        )}
                        <div style={{ fontSize: 13, lineHeight: 1.6, color: "#5E6D96" }}>카드사·은행이 파일을 보낼 때 안내한 비밀번호예요. 파일을 여는 데만 쓰고 저장하지 않아요. 잠기지 않은 파일은 이 칸 없이 바로 열려요.</div>
                      </div>
                    )}

                    {e.status === "error" && (
                      <div role="alert" style={{ fontSize: 14, fontWeight: 600, color: "#C62828", lineHeight: 1.6 }}>
                        {e.error}
                      </div>
                    )}

                    {/* 검산(2026-11-02): 명세서에 적힌 합계와 읽은 합계. 처음 보는 형식이나 사진 글자 인식이 틀렸을 때 알아채게 한다 */}
                    {e.status === "opened" && e.image && lowQuality(e.quality) && (
                      <div role="alert" style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.6, color: "#7A4F00", background: "#FFF4D6", borderRadius: 10, padding: "8px 12px" }}>
                        사진 글자가 작거나 흐려서 가맹점 이름·금액이 틀렸을 수 있어요(인식 신뢰도 {Math.round(e.quality!.confidence)}%). 원본 PDF가 있으면 PDF를 올려 주시고, 없으면 화면을 확대해 글자가 크게 보이게 다시 캡처해 주세요.
                      </div>
                    )}
                    {e.status === "opened" && e.summary?.check && <CheckLine check={e.summary.check} image={!!e.image} />}
                    {e.status === "opened" && e.image && !e.summary?.check && !lowQuality(e.quality) && (
                      <div style={{ fontSize: 13, lineHeight: 1.6, color: "#7A4F00" }}>사진은 글자를 인식해 읽어서 틀릴 수 있어요. 아래 표에서 금액을 확인해 주세요.</div>
                    )}
                  </li>
                );
              })}
            </ul>

            {summary && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12, background: "#E9F7EF", fontSize: 15, fontWeight: 600, color: "#0F6B3D" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m5 12 5 5 9-10" />
                </svg>
                {openedText}
              </div>
            )}

            {summary && <StatementItems summary={summary} onRecategorize={(name, cat) => setEdits((m) => ({ ...m, [name]: cat }))} />}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          {summary && !reading ? (
            <button
              type="button"
              onClick={() => onApply(summary, fileName)}
              style={{ width: "min(400px, 100%)", height: 56, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: "none", borderRadius: 28, background: "#2457F5", color: "#FFFFFF", fontFamily: "inherit", fontSize: 17, fontWeight: 700, cursor: "pointer", boxShadow: "0 12px 28px rgba(36, 87, 245, 0.22)" }}
            >
              {openedEntries.length > 1 ? `명세서 ${openedEntries.length}장으로 추천 결과 보기` : "이 명세서로 추천 결과 보기"}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14" />
                <path d="m13 6 6 6-6 6" />
              </svg>
            </button>
          ) : (
            <button type="button" disabled style={{ width: "min(400px, 100%)", height: 56, border: "none", borderRadius: 28, background: "#DDE5F5", color: "#5E6D96", fontFamily: "inherit", fontSize: 16, fontWeight: 700 }}>
              {reading ? "명세서를 읽고 있어요" : "명세서를 열면 추천 결과를 볼 수 있어요"}
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
