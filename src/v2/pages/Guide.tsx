import { catalogCards } from "@/v1/catalog";
import { num } from "@/v1/format";
import { paths } from "@/v2/app/paths";
import { Link } from "@/v2/app/router";
import { chatStore } from "@/v2/chat/chatStore";
import { CardImage } from "@/v2/ui/CardImage";
import { PageMain } from "@/v2/ui/Page";
import { MenuBar } from "@/v2/ui/TopBar";

/**
 * 이용 가이드(디자인 F-D-Guide). 디자인 원본을 그대로 옮겼다(scratchpad html2jsx.py + fixbox.py, 2026-10-29).
 * 바꾼 곳: 링크 주소, '자주 가는 곳' 답(브랜드 35%·묶음 70% 계산 기준), 전체 카드 수, 결과 예시 그림의 카드 두 장(실제 카드 사진)
 */
export default function Guide() {
  return (
    <>
      <MenuBar active={null} />
      <PageMain title="이용 가이드">
          <header style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "14px 20px" }}>
            <div style={{ flex: "1 1 420px", minWidth: "0" }}>
              <Link to={paths.home} style={{ display: "inline-flex", alignItems: "center", gap: "6px", minHeight: "32px", marginBottom: "6px", fontSize: "14px", fontWeight: "600", color: "#3A4A78", textDecoration: "none" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5"></path><path d="m11 18-6-6 6-6"></path></svg>홈</Link>
              <h1 style={{ margin: "0", fontSize: "28px", fontWeight: "700", letterSpacing: "-0.02em" }}>이용 가이드</h1>
              <p style={{ margin: "6px 0 0", fontSize: "15px", lineHeight: "1.6", color: "#5E6D96" }}>WalletFit은 한 달 지출을 기준으로 카드 조합과 결제 방법을 알려 드려요. 처음이라면 위에서부터 차례로 보세요.</p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px" }}><button type="button" onClick={() => chatStore.ask()} style={{ display: "inline-flex", alignItems: "center", gap: "7px", height: "46px", padding: "0 18px", boxSizing: "border-box", borderRadius: "23px", border: "1px solid #D3DDF2", background: "#FFFFFF", fontFamily: "inherit", fontSize: "15px", fontWeight: "700", color: "#0D1B4A", cursor: "pointer", whiteSpace: "nowrap" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#2457F5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"></path></svg>상담 창에 물어보기</button></div>
          </header>
          <section aria-labelledby="g-what" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <h2 id="g-what" style={{ margin: "0", fontSize: "22px", fontWeight: "700", letterSpacing: "-0.01em" }}>WalletFit이 하는 일</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: "16px" }}>
              <article style={{ background: "#FFFFFF", border: "1px solid transparent", borderRadius: "20px", boxShadow: "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)", padding: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <span aria-hidden="true" style={{ flexShrink: "0", width: "48px", height: "48px", borderRadius: "16px", background: "#E8EEFF", color: "#2457F5", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"></path><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"></path></svg></span>
                <h3 style={{ margin: "4px 0 0", fontSize: "18px", fontWeight: "700" }}>내 지출에 맞는 카드 조합</h3>
                <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.65", color: "#3A4A78" }}>한 달 지출을 넣으면 가진 카드나 새 카드 중에서 연회비를 빼고도 가장 많이 받는 조합을 찾아요.</p>
              </article>
              <article style={{ background: "#FFFFFF", border: "1px solid transparent", borderRadius: "20px", boxShadow: "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)", padding: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <span aria-hidden="true" style={{ flexShrink: "0", width: "48px", height: "48px", borderRadius: "16px", background: "#E8EEFF", color: "#2457F5", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"></path><path d="M4 6h.01M4 12h.01M4 18h.01"></path></svg></span>
                <h3 style={{ margin: "4px 0 0", fontSize: "18px", fontWeight: "700" }}>어디서 어느 카드로</h3>
                <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.65", color: "#3A4A78" }}>편의점·카페·교통처럼 지출마다 어느 카드로 결제할지, 카드사 앱에서 무엇을 바꿔 둘지 알려 드려요.</p>
              </article>
              <article style={{ background: "#FFFFFF", border: "1px solid transparent", borderRadius: "20px", boxShadow: "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)", padding: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <span aria-hidden="true" style={{ flexShrink: "0", width: "48px", height: "48px", borderRadius: "16px", background: "#E8EEFF", color: "#2457F5", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"></path></svg></span>
                <h3 style={{ margin: "4px 0 0", fontSize: "18px", fontWeight: "700" }}>궁금하면 바로 상담</h3>
                <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.65", color: "#3A4A78" }}>추천 이유나 실적이 궁금하면 오른쪽 위 '카드 상담'을 누르세요. 계산 결과와 카드사 원문으로 답해요.</p>
              </article>
            </div>
          </section>
          <section aria-labelledby="g-steps" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: "6px 12px" }}>
              <h2 id="g-steps" style={{ margin: "0", fontSize: "22px", fontWeight: "700", letterSpacing: "-0.01em" }}>지갑 만들기는 4단계예요</h2>
              <span style={{ fontSize: "14px", color: "#5E6D96" }}>홈에서 두 가지 방법 중 하나로 시작해요</span>
            </div>
            <ol style={{ margin: "0", padding: "0", listStyle: "none", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(250px, 100%), 1fr))", gap: "16px" }}>
              <li style={{ background: "#FFFFFF", border: "1px solid transparent", borderRadius: "20px", boxShadow: "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)", padding: "22px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "10px" }}><span style={{ width: "32px", height: "32px", borderRadius: "16px", background: "#2457F5", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Outfit, sans-serif", fontSize: "15px", fontWeight: "700" }}>1</span><span aria-hidden="true" style={{ flexShrink: "0", width: "40px", height: "40px", borderRadius: "13px", background: "#E8EEFF", color: "#2457F5", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2.5"></rect><path d="M2.5 10h19"></path><path d="M6 15h4"></path></svg></span></span>
                </div>
                <h3 style={{ margin: "0", fontSize: "18px", fontWeight: "700" }}>카드 고르기</h3>
                <p style={{ margin: "0", fontSize: "14px", lineHeight: "1.65", color: "#3A4A78" }}>어떤 카드 안에서 조합을 찾을지 정해요.</p>
                <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", lineHeight: "1.55", color: "#3A4A78" }}><span><b style={{ color: "#0D1B4A" }}>보유한 카드로</b> · 가진 카드를 골라요</span><span><b style={{ color: "#0D1B4A" }}>새 카드까지 포함해서</b> · 신용·체크 중 찾을 종류를 골라요</span></div>
              </li>
              <li style={{ background: "#FFFFFF", border: "1px solid transparent", borderRadius: "20px", boxShadow: "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)", padding: "22px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "10px" }}><span style={{ width: "32px", height: "32px", borderRadius: "16px", background: "#2457F5", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Outfit, sans-serif", fontSize: "15px", fontWeight: "700" }}>2</span><span aria-hidden="true" style={{ flexShrink: "0", width: "40px", height: "40px", borderRadius: "13px", background: "#E8EEFF", color: "#2457F5", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"></path><path d="M4 6h.01M4 12h.01M4 18h.01"></path></svg></span></span>
                </div>
                <h3 style={{ margin: "0", fontSize: "18px", fontWeight: "700" }}>지출 입력</h3>
                <p style={{ margin: "0", fontSize: "14px", lineHeight: "1.65", color: "#3A4A78" }}>편의점·카페·통신비처럼 카테고리별로 한 달에 쓰는 돈을 넣어요.</p>
                <div style={{ marginTop: "auto", display: "flex", alignItems: "flex-start", gap: "8px", padding: "12px", borderRadius: "12px", background: "#E8EEFF", fontSize: "13px", lineHeight: "1.6", color: "#1747D6" }}><span style={{ flexShrink: "0", display: "flex", marginTop: "2px" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4"></path><path d="m7 9 5-5 5 5"></path><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"></path></svg></span><span>명세서가 있다면 <b>명세서로 채우기</b>를 누르세요. 금액을 채우고 바로 추천 결과로 넘어가요.</span></div>
              </li>
              <li style={{ background: "#FFFFFF", border: "1px solid transparent", borderRadius: "20px", boxShadow: "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)", padding: "22px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "10px" }}><span style={{ width: "32px", height: "32px", borderRadius: "16px", background: "#2457F5", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Outfit, sans-serif", fontSize: "15px", fontWeight: "700" }}>3</span><span aria-hidden="true" style={{ flexShrink: "0", width: "40px", height: "40px", borderRadius: "13px", background: "#E8EEFF", color: "#2457F5", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"></path><circle cx="12" cy="10" r="2.5"></circle></svg></span></span><span style={{ display: "inline-flex", alignItems: "center", height: "24px", padding: "0 10px", borderRadius: "12px", background: "#F3F7FF", border: "1px solid #E3EAF8", fontSize: "12px", fontWeight: "700", color: "#5E6D96", boxSizing: "content-box" }}>선택 · 건너뛰어도 돼요</span>
                </div>
                <h3 style={{ margin: "0", fontSize: "18px", fontWeight: "700" }}>자주 가는 곳</h3>
                <p style={{ margin: "0", fontSize: "14px", lineHeight: "1.65", color: "#3A4A78" }}>스타벅스·GS25처럼 자주 가는 곳을 고르면 그 브랜드에서만 되는 할인까지 계산해요.</p>
              </li>
              <li style={{ background: "#FFFFFF", border: "1px solid transparent", borderRadius: "20px", boxShadow: "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)", padding: "22px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "10px" }}><span style={{ width: "32px", height: "32px", borderRadius: "16px", background: "#2457F5", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Outfit, sans-serif", fontSize: "15px", fontWeight: "700" }}>4</span><span aria-hidden="true" style={{ flexShrink: "0", width: "40px", height: "40px", borderRadius: "13px", background: "#E8EEFF", color: "#2457F5", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"></path></svg></span></span>
                </div>
                <h3 style={{ margin: "0", fontSize: "18px", fontWeight: "700" }}>추천 결과</h3>
                <p style={{ margin: "0", fontSize: "14px", lineHeight: "1.65", color: "#3A4A78" }}>연회비를 뺀 월 순혜택, 카드별로 맡는 일, 결제 순서를 보여 줘요. 마음에 들면 '내 지갑에 저장'을 누르세요.</p>
              </li>
            </ol>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))", gap: "14px" }}>
              <Link to={paths.start("own")} style={{ display: "flex", alignItems: "center", gap: "16px", padding: "20px 22px", borderRadius: "20px", background: "#2457F5", color: "#FFFFFF", textDecoration: "none", boxShadow: "0 12px 26px -10px rgba(36, 87, 245, 0.6)" }}>
                <span style={{ flex: "1", minWidth: "0" }}><span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#FFFFFF" }}>이미 쓰는 카드로만 조합하고 싶다면</span><span style={{ display: "block", marginTop: "4px", fontSize: "19px", fontWeight: "700" }}>보유한 카드로 시작</span></span>
                <span style={{ flexShrink: "0", width: "44px", height: "44px", borderRadius: "22px", background: "rgba(255, 255, 255, 0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path></svg></span>
              </Link>
              <Link to={paths.start("new")} style={{ display: "flex", alignItems: "center", gap: "16px", padding: "20px 22px", borderRadius: "20px", background: "#FFFFFF", color: "#0D1B4A", textDecoration: "none", boxShadow: "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)" }}>
                <span style={{ flex: "1", minWidth: "0" }}><span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#5E6D96" }}>새 카드 발급도 생각하고 있다면</span><span style={{ display: "block", marginTop: "4px", fontSize: "19px", fontWeight: "700" }}>새 카드까지 포함해서 시작</span></span>
                <span style={{ flexShrink: "0", width: "44px", height: "44px", borderRadius: "22px", background: "#E8EEFF", color: "#2457F5", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path></svg></span>
              </Link>
            </div>
          </section>
          <section aria-labelledby="g-read" style={{ background: "#FFFFFF", border: "1px solid transparent", boxShadow: "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)", borderRadius: "24px", padding: "28px clamp(18px, 2.6vw, 32px)", display: "flex", flexDirection: "column", gap: "20px" }}>
            <div>
              <h2 id="g-read" style={{ margin: "0", fontSize: "22px", fontWeight: "700", letterSpacing: "-0.01em" }}>추천 결과에서 볼 곳 3가지</h2>
              <p style={{ margin: "4px 0 0", fontSize: "14px", color: "#5E6D96" }}>왼쪽은 예시 화면이에요. 번호를 오른쪽 설명과 맞춰 보세요.</p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "24px 32px", alignItems: "center" }}>
              <div aria-label="추천 결과 예시" style={{ flex: "1 1 420px", minWidth: "0", padding: "24px", borderRadius: "20px", background: "#F3F7FF", border: "1px solid #E3EAF8", display: "flex", flexDirection: "column", gap: "18px", boxSizing: "content-box" }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: "700", color: "#2457F5" }}>추천 조합 · 가진 카드 6장 중 2장</div>
                    <div style={{ marginTop: "6px", display: "flex", alignItems: "center", gap: "10px" }}><span style={{ display: "flex", alignItems: "baseline", gap: "4px" }}><span style={{ fontFamily: "Outfit, sans-serif", fontSize: "44px", fontWeight: "700", lineHeight: "1", color: "#1747D6" }}>33,000</span><span style={{ fontSize: "18px", fontWeight: "700" }}>원</span></span><span aria-hidden="true" style={{ flexShrink: "0", width: "26px", height: "26px", borderRadius: "13px", background: "#F59E0B", color: "#FFFFFF", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "Outfit, sans-serif", fontSize: "13px", fontWeight: "700", boxShadow: "0 0 0 3px #FFFFFF" }}>1</span></div>
                    <div style={{ marginTop: "4px", fontSize: "13px", color: "#3A4A78" }}>카드 2장으로 매달 받는 혜택</div>
                  </div>
                  <div aria-hidden="true" style={{ position: "relative", width: "150px", height: "90px" }}><CardImage sid={2686} width={104} rotate={-8} style={{ position: "absolute", left: 0, top: 4 }} /><CardImage sid={51} width={104} rotate={6} style={{ position: "absolute", left: 44, top: 22 }} /></div>
                </div>
                <div style={{ padding: "14px 16px", borderRadius: "14px", background: "#FFFFFF", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "6px", fontSize: "13px" }}><span style={{ display: "flex", alignItems: "center", gap: "8px", color: "#3A4A78" }}>D4카드의정석Ⅱ 실적 <b style={{ color: "#0D1B4A", fontFamily: "Outfit, 'IBM Plex Sans KR', sans-serif", fontVariantNumeric: "tabular-nums" }}>32만 4천원</b><span aria-hidden="true" style={{ flexShrink: "0", width: "26px", height: "26px", borderRadius: "13px", background: "#F59E0B", color: "#FFFFFF", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "Outfit, sans-serif", fontSize: "13px", fontWeight: "700", boxShadow: "0 0 0 3px #FFFFFF" }}>2</span></span><span style={{ fontWeight: "700", color: "#1747D6" }}>여유 2만 4천원</span></div>
                  <div style={{ position: "relative", height: "10px", borderRadius: "999px", background: "#EDF2FC" }}><div style={{ width: "93%", height: "10px", borderRadius: "999px", background: "#2457F5" }}></div><span aria-hidden="true" style={{ position: "absolute", left: "86%", top: "-4px", width: "2px", height: "18px", borderRadius: "1px", background: "#0D1B4A" }}></span></div>
                  <div style={{ fontSize: "12px", color: "#5E6D96" }}>세로선 = 실적 기준 30만원</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}><span style={{ display: "inline-flex", alignItems: "center", height: "40px", padding: "0 16px", borderRadius: "20px", border: "1px solid #D3DDF2", background: "#FFFFFF", fontSize: "14px", fontWeight: "700", boxSizing: "content-box" }}>계산 자세히 보기</span><span aria-hidden="true" style={{ flexShrink: "0", width: "26px", height: "26px", borderRadius: "13px", background: "#F59E0B", color: "#FFFFFF", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "Outfit, sans-serif", fontSize: "13px", fontWeight: "700", boxShadow: "0 0 0 3px #FFFFFF" }}>3</span></div>
              </div>
              <ol style={{ flex: "1 1 380px", minWidth: "0", margin: "0", padding: "0", listStyle: "none", display: "flex", flexDirection: "column", gap: "20px" }}>
                <li style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                  <span aria-hidden="true" style={{ flexShrink: "0", width: "26px", height: "26px", borderRadius: "13px", background: "#F59E0B", color: "#FFFFFF", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "Outfit, sans-serif", fontSize: "13px", fontWeight: "700", boxShadow: "0 0 0 3px #FFFFFF" }}>1</span>
                  <span style={{ minWidth: "0" }}><span style={{ display: "block", fontSize: "17px", fontWeight: "700" }}>월 순혜택</span><span style={{ display: "block", marginTop: "4px", fontSize: "15px", lineHeight: "1.65", color: "#3A4A78" }}>할인과 적립을 모두 더하고 연회비를 12개월로 나눠 뺀 금액이에요. 카드를 고를 때는 이 금액을 보세요.</span></span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                  <span aria-hidden="true" style={{ flexShrink: "0", width: "26px", height: "26px", borderRadius: "13px", background: "#F59E0B", color: "#FFFFFF", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "Outfit, sans-serif", fontSize: "13px", fontWeight: "700", boxShadow: "0 0 0 3px #FFFFFF" }}>2</span>
                  <span style={{ minWidth: "0" }}><span style={{ display: "block", fontSize: "17px", fontWeight: "700" }}>전월실적과 실적 여유</span><span style={{ display: "block", marginTop: "4px", fontSize: "15px", lineHeight: "1.65", color: "#3A4A78" }}>혜택을 받으려면 지난달 그 카드로 기준 금액 이상 써야 해요. 할인받은 결제는 실적에서 빠지는 카드가 많아서, 기준에 아슬아슬하게 걸리지 않도록 2만원 여유를 두고 계산해요.</span></span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                  <span aria-hidden="true" style={{ flexShrink: "0", width: "26px", height: "26px", borderRadius: "13px", background: "#F59E0B", color: "#FFFFFF", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "Outfit, sans-serif", fontSize: "13px", fontWeight: "700", boxShadow: "0 0 0 3px #FFFFFF" }}>3</span>
                  <span style={{ minWidth: "0" }}><span style={{ display: "block", fontSize: "17px", fontWeight: "700" }}>계산 자세히 보기</span><span style={{ display: "block", marginTop: "4px", fontSize: "15px", lineHeight: "1.65", color: "#3A4A78" }}>실적을 채웠는지, 카드를 몇 장 쓰면 얼마인지, 계산에 쓴 값이 무엇인지 볼 수 있어요.</span></span>
                </li>
              </ol>
            </div>
          </section>
          <section aria-labelledby="g-menu" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <h2 id="g-menu" style={{ margin: "0", fontSize: "22px", fontWeight: "700", letterSpacing: "-0.01em" }}>메뉴 안내</h2>
            <ul style={{ margin: "0", padding: "0", listStyle: "none", background: "#FFFFFF", border: "1px solid transparent", borderRadius: "20px", boxShadow: "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)" }}>
              <li style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px 18px", padding: "18px 22px", borderBottom: "1px solid #EDF2FC" }}>
                <span aria-hidden="true" style={{ flexShrink: "0", width: "44px", height: "44px", borderRadius: "15px", background: "#F3F7FF", color: "#2457F5", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"></path><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"></path></svg></span>
                <span style={{ flex: "1 1 320px", minWidth: "0" }}><span style={{ display: "block", fontSize: "17px", fontWeight: "700" }}>내 지갑</span><span style={{ display: "block", marginTop: "2px", fontSize: "14px", lineHeight: "1.6", color: "#3A4A78" }}>저장한 조합, 결제할 때 쓸 카드, 카드사 앱에서 할 일을 모아 봐요. 저장 전에는 지갑 만들기로 안내해요.</span></span>
                <Link to={paths.wallet} style={{ flexShrink: "0", display: "inline-flex", alignItems: "center", gap: "6px", height: "44px", padding: "0 16px", boxSizing: "border-box", borderRadius: "22px", border: "1px solid #D3DDF2", background: "#FFFFFF", fontSize: "14px", fontWeight: "700", textDecoration: "none" }}>열기<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path></svg></Link>
              </li>
              <li style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px 18px", padding: "18px 22px", borderBottom: "1px solid #EDF2FC" }}>
                <span aria-hidden="true" style={{ flexShrink: "0", width: "44px", height: "44px", borderRadius: "15px", background: "#F3F7FF", color: "#2457F5", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect></svg></span>
                <span style={{ flex: "1 1 320px", minWidth: "0" }}><span style={{ display: "block", fontSize: "17px", fontWeight: "700" }}>전체 카드</span><span style={{ display: "block", marginTop: "2px", fontSize: "14px", lineHeight: "1.6", color: "#3A4A78" }}>카드고릴라 기준 {num(catalogCards.length)}장을 찾아보고, 비교함에 최대 3장까지 담아 나란히 비교해요.</span></span>
                <Link to={paths.cards} style={{ flexShrink: "0", display: "inline-flex", alignItems: "center", gap: "6px", height: "44px", padding: "0 16px", boxSizing: "border-box", borderRadius: "22px", border: "1px solid #D3DDF2", background: "#FFFFFF", fontSize: "14px", fontWeight: "700", textDecoration: "none" }}>열기<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path></svg></Link>
              </li>
              <li style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px 18px", padding: "18px 22px", borderBottom: "1px solid #EDF2FC" }}>
                <span aria-hidden="true" style={{ flexShrink: "0", width: "44px", height: "44px", borderRadius: "15px", background: "#F3F7FF", color: "#2457F5", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"></path></svg></span>
                <span style={{ flex: "1 1 320px", minWidth: "0" }}><span style={{ display: "block", fontSize: "17px", fontWeight: "700" }}>혜택별 추천</span><span style={{ display: "block", marginTop: "2px", fontSize: "14px", lineHeight: "1.6", color: "#3A4A78" }}>편의점·카페처럼 카테고리 하나만 골라 그 분야에서 가장 유리한 카드를 찾아요.</span></span>
                <Link to={paths.benefit} style={{ flexShrink: "0", display: "inline-flex", alignItems: "center", gap: "6px", height: "44px", padding: "0 16px", boxSizing: "border-box", borderRadius: "22px", border: "1px solid #D3DDF2", background: "#FFFFFF", fontSize: "14px", fontWeight: "700", textDecoration: "none" }}>열기<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path></svg></Link>
              </li>
              <li style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px 18px", padding: "18px 22px" }}>
                <span aria-hidden="true" style={{ flexShrink: "0", width: "44px", height: "44px", borderRadius: "15px", background: "#F3F7FF", color: "#2457F5", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"></path></svg></span>
                <span style={{ flex: "1 1 320px", minWidth: "0" }}><span style={{ display: "block", fontSize: "17px", fontWeight: "700" }}>카드 상담</span><span style={{ display: "block", marginTop: "2px", fontSize: "14px", lineHeight: "1.6", color: "#3A4A78" }}>어느 화면에서든 오른쪽 위 버튼으로 열어요. 다른 화면으로 가도 창과 대화가 그대로 이어져요.</span></span>
                <button type="button" onClick={() => chatStore.ask()} style={{ flexShrink: "0", display: "inline-flex", alignItems: "center", gap: "6px", height: "44px", padding: "0 16px", borderRadius: "22px", border: "1px solid #D3DDF2", background: "#FFFFFF", fontFamily: "inherit", fontSize: "14px", fontWeight: "700", color: "#2457F5", cursor: "pointer" }}>열기<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path></svg></button>
              </li>
            </ul>
          </section>
          <section aria-labelledby="g-faq" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <h2 id="g-faq" style={{ margin: "0", fontSize: "22px", fontWeight: "700", letterSpacing: "-0.01em" }}>알아 두세요</h2>
              <details open className="group" style={{ background: "#FFFFFF", border: "1px solid transparent", boxShadow: "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)", borderRadius: "16px", padding: "0 20px" }}>
                <summary style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", minHeight: "60px", fontSize: "16px", fontWeight: "700", cursor: "pointer", listStyle: "none" }}>금액은 실제로 받는 금액인가요?<span style={{ flexShrink: "0", display: "flex", color: "#5E6D96" }}><svg className="group-open:rotate-180" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg></span></summary>
                <p style={{ margin: "0", padding: "0 0 18px", fontSize: "15px", lineHeight: "1.7", color: "#3A4A78" }}>카드사 원문에 적힌 할인율과 한도로 계산한 추정값이에요. 실제 할인은 결제 금액과 가맹점 등록 업종에 따라 달라질 수 있으니, 카드를 만들기 전에 카드사 약관에서 확인하세요.</p>
              </details>
              <details className="group" style={{ background: "#FFFFFF", border: "1px solid transparent", boxShadow: "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)", borderRadius: "16px", padding: "0 20px" }}>
                <summary style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", minHeight: "60px", fontSize: "16px", fontWeight: "700", cursor: "pointer", listStyle: "none" }}>자주 가는 곳을 고르지 않으면 어떻게 계산해요?<span style={{ flexShrink: "0", display: "flex", color: "#5E6D96" }}><svg className="group-open:rotate-180" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg></span></summary>
                <p style={{ margin: "0", padding: "0 0 18px", fontSize: "15px", lineHeight: "1.7", color: "#3A4A78" }}>스타벅스처럼 브랜드 한 곳에서만 되는 할인은 그 카테고리 지출의 35%, '커피 4대 브랜드'처럼 여러 곳을 묶은 할인은 70%가 해당 가게에서 나온다고 보고 계산해요. 이렇게 계산했다는 내용은 추천 결과의 '계산에 쓴 값'에 적어 둬요. 자주 가는 곳을 고르면 고른 곳들이 그 카테고리 지출의 70%를 나눠 쓴다고 보고, '이 중엔 자주 가는 곳이 없어요'를 누르면 그 카테고리의 브랜드 할인은 빼고 계산해요.</p>
              </details>
              <details className="group" style={{ background: "#FFFFFF", border: "1px solid transparent", boxShadow: "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)", borderRadius: "16px", padding: "0 20px" }}>
                <summary style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", minHeight: "60px", fontSize: "16px", fontWeight: "700", cursor: "pointer", listStyle: "none" }}>명세서로 채우기는 어떻게 써요?<span style={{ flexShrink: "0", display: "flex", color: "#5E6D96" }}><svg className="group-open:rotate-180" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg></span></summary>
                <p style={{ margin: "0", padding: "0 0 18px", fontSize: "15px", lineHeight: "1.7", color: "#3A4A78" }}>지출 입력 화면에서 '명세서로 채우기'를 누르고 카드사 명세서 파일을 올리면 카테고리별 금액이 채워져요. 그다음 바로 추천 결과로 넘어가요.</p>
              </details>
              <details className="group" style={{ background: "#FFFFFF", border: "1px solid transparent", boxShadow: "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)", borderRadius: "16px", padding: "0 20px" }}>
                <summary style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", minHeight: "60px", fontSize: "16px", fontWeight: "700", cursor: "pointer", listStyle: "none" }}>카드 정보는 언제 기준이에요?<span style={{ flexShrink: "0", display: "flex", color: "#5E6D96" }}><svg className="group-open:rotate-180" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg></span></summary>
                <p style={{ margin: "0", padding: "0 0 18px", fontSize: "15px", lineHeight: "1.7", color: "#3A4A78" }}>카드고릴라에 올라온 상품 정보를 모아 계산해요. 화면마다 정보를 모은 날짜를 함께 적어 두었어요.</p>
              </details>
          </section>
          <section style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px 24px", padding: "26px 28px", borderRadius: "24px", background: "#0D1B4A", color: "#FFFFFF" }}>
            <div style={{ flex: "1 1 360px", minWidth: "0" }}><div style={{ fontSize: "22px", fontWeight: "700", letterSpacing: "-0.01em" }}>이제 내 지갑을 만들어 보세요</div><div style={{ marginTop: "4px", fontSize: "15px", color: "#C9D6F5" }}>지출 입력까지 마치면 바로 추천 결과가 나와요</div></div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
              <Link to={paths.start("own")} style={{ display: "inline-flex", alignItems: "center", height: "50px", padding: "0 22px", boxSizing: "border-box", borderRadius: "25px", background: "#FFFFFF", color: "#2457F5", fontSize: "15px", fontWeight: "700", textDecoration: "none", whiteSpace: "nowrap" }}>보유한 카드로 시작</Link>
              <Link to={paths.start("new")} style={{ display: "inline-flex", alignItems: "center", height: "50px", padding: "0 22px", boxSizing: "border-box", borderRadius: "25px", border: "1px solid rgba(255, 255, 255, 0.5)", color: "#FFFFFF", fontSize: "15px", fontWeight: "700", textDecoration: "none", whiteSpace: "nowrap" }}>새 카드까지 포함해서</Link>
            </div>
          </section>
      </PageMain>
    </>
  );
}
