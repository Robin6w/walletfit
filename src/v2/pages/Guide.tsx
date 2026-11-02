import { catalogCards } from "@/v1/catalog";
import { num } from "@/v1/format";
import { paths } from "@/v2/app/paths";
import { Link } from "@/v2/app/router";
import { chatStore } from "@/v2/chat/chatStore";
import { PageMain } from "@/v2/ui/Page";
import { MenuBar } from "@/v2/ui/TopBar";

/**
 * 이용 가이드(디자인 '신재윤' 페이지 '이용가이드 선택시', 2026-11-02). 디자인 원본을 그대로 옮겼다.
 * 바꾼 곳: 링크 주소, 브랜드 로고(public/brands), 전체 카드 수, '자주 가는 곳' 답(브랜드 35%·묶음 70%·명세서는 추정 안 함)
 */
export default function Guide() {
  return (
    <>
      <MenuBar active={null} />
      <PageMain title="이용 가이드" width={1080} gap={0} padding="32px clamp(16px, 3.5vw, 48px) 72px">
  {/* 0. 히어로 */}
  <section style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "28px 40px" }}>
    <div style={{ flex: "1 1 380px" }}>
      <span style={{ display: "inline-flex", alignItems: "center", height: "30px", padding: "0 12px", borderRadius: "15px", background: "#E8EEFF", color: "#2457F5", fontSize: "14px", fontWeight: "700" }}>이용 가이드</span>
      <h1 style={{ margin: "0", fontSize: "40px", lineHeight: "1.3", letterSpacing: "-0.03em", marginTop: "14px", fontWeight: "700" }}>내 지출에 맞는 카드, <span style={{ color: "rgb(36, 87, 245)" }}>4단계</span>면 찾아요</h1>
      <p style={{ margin: "0", fontSize: "19px", lineHeight: "1.8", color: "#3A4A78", marginTop: "14px" }}>위에서부터 차례로 내려가며 보세요.</p>
      <button type="button" onClick={() => chatStore.ask()} style={{ marginTop: "20px", display: "inline-flex", alignItems: "center", gap: "8px", height: "48px", padding: "0 20px", borderRadius: "24px", background: "#fff", boxShadow: "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)", fontSize: "16px", fontWeight: "700", color: "#2457F5", textDecoration: "none", border: "none", fontFamily: "inherit", cursor: "pointer" }}>모르면 상담 창에 물어보기</button>
    </div>
  </section>

  {/* 1. 하는 일 */}
  <section style={{ marginTop: "56px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}><h2 style={{ margin: "0", fontSize: "28px", lineHeight: "1.35", letterSpacing: "-0.02em", fontWeight: "700" }}>WalletFit이 해 드리는 일</h2></div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
      <article style={{ background: "#fff", borderRadius: "24px", boxShadow: "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)", padding: "24px", display: "flex", flexDirection: "column", gap: "14px" }}>
        <div aria-hidden="true" style={{ height: "120px", borderRadius: "18px", background: "#F3F7FF", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "relative", borderRadius: "8px", overflow: "hidden", boxShadow: "0 2px 4px rgba(13, 40, 120, 0.12), 0 10px 22px -8px rgba(13, 40, 120, 0.38)", display: "flex", flexDirection: "column", justifyContent: "space-between", color: "#fff", padding: "8px", background: "#0E1F5C", width: "84px", height: "54px", transform: "rotate(-8deg)" }}>
<span style={{ position: "absolute", width: "90%", aspectRatio: "1", borderRadius: "50%", right: "-38%", top: "-45%", background: "rgba(255,255,255,.14)" }}></span><i style={{ position: "relative", width: "16px", height: "12px", borderRadius: "3px", background: "linear-gradient(135deg, #F2F6FF, #B7C8EC)" }}></i>
</div>
          <span style={{ fontFamily: "Outfit", fontSize: "28px", fontWeight: "700", color: "#2457F5" }}>+</span>
          <div style={{ position: "relative", borderRadius: "8px", overflow: "hidden", boxShadow: "0 2px 4px rgba(13, 40, 120, 0.12), 0 10px 22px -8px rgba(13, 40, 120, 0.38)", display: "flex", flexDirection: "column", justifyContent: "space-between", color: "#fff", padding: "8px", background: "#3E8BFF", width: "84px", height: "54px", transform: "rotate(6deg)" }}>
<span style={{ position: "absolute", width: "90%", aspectRatio: "1", borderRadius: "50%", right: "-38%", top: "-45%", background: "rgba(255,255,255,.14)" }}></span><i style={{ position: "relative", width: "16px", height: "12px", borderRadius: "3px", background: "linear-gradient(135deg, #F2F6FF, #B7C8EC)" }}></i>
</div>
          <span style={{ fontFamily: "Outfit", fontSize: "28px", fontWeight: "700", color: "#2457F5" }}>=</span>
          <span style={{ fontFamily: '"Outfit", sans-serif', fontVariantNumeric: "tabular-nums", fontSize: "22px", fontWeight: "700", color: "#1747D6" }}>₩↑</span>
        </div>
        <h3 style={{ margin: "0", fontSize: "21px", lineHeight: "1.4", fontWeight: "700" }}>나에게 맞는 카드 조합</h3>
        <p style={{ margin: "0", fontSize: "16px", lineHeight: "1.8", color: "#3A4A78" }}>연회비를 빼고도<br />가장 많이 받는 조합을 찾아요.</p>
      </article>
      <article style={{ background: "#fff", borderRadius: "24px", boxShadow: "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)", padding: "24px", display: "flex", flexDirection: "column", gap: "14px" }}>
        <div aria-hidden="true" style={{ height: "120px", borderRadius: "18px", background: "#F3F7FF", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", position: "relative", overflow: "hidden" }}>
          <span style={{ width: "44px", height: "44px", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", background: "#E3F1FF", color: "#1170D9" }}><svg viewBox="0 0 24 24" style={{ width: "24px", height: "24px", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }}><path d="M4 9 5.5 4h13L20 9"></path><path d="M4 9h16v11H4z"></path><path d="M9 20v-6h6v6"></path></svg></span>
          <span style={{ color: "#5E6D96", fontSize: "20px" }}>→</span>
          <div style={{ position: "relative", borderRadius: "8px", overflow: "hidden", boxShadow: "0 2px 4px rgba(13, 40, 120, 0.12), 0 10px 22px -8px rgba(13, 40, 120, 0.38)", display: "flex", flexDirection: "column", justifyContent: "space-between", color: "#fff", padding: "8px", background: "#3E8BFF", width: "64px", height: "40px" }}>
<span style={{ position: "absolute", width: "90%", aspectRatio: "1", borderRadius: "50%", right: "-38%", top: "-45%", background: "rgba(255,255,255,.14)" }}></span><i style={{ position: "relative", width: "16px", height: "12px", borderRadius: "3px", background: "linear-gradient(135deg, #F2F6FF, #B7C8EC)" }}></i>
</div>
          <span style={{ width: "12px" }}></span>
          <span style={{ width: "44px", height: "44px", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", background: "#E8EEFF", color: "#2457F5" }}><svg viewBox="0 0 24 24" style={{ width: "24px", height: "24px", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }}><path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"></path><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17"></path></svg></span>
          <span style={{ color: "#5E6D96", fontSize: "20px" }}>→</span>
          <div style={{ position: "relative", borderRadius: "8px", overflow: "hidden", boxShadow: "0 2px 4px rgba(13, 40, 120, 0.12), 0 10px 22px -8px rgba(13, 40, 120, 0.38)", display: "flex", flexDirection: "column", justifyContent: "space-between", color: "#fff", padding: "8px", background: "#0E1F5C", width: "64px", height: "40px" }}>
<span style={{ position: "absolute", width: "90%", aspectRatio: "1", borderRadius: "50%", right: "-38%", top: "-45%", background: "rgba(255,255,255,.14)" }}></span><i style={{ position: "relative", width: "16px", height: "12px", borderRadius: "3px", background: "linear-gradient(135deg, #F2F6FF, #B7C8EC)" }}></i>
</div>
        </div>
        <h3 style={{ margin: "0", fontSize: "21px", lineHeight: "1.4", fontWeight: "700" }}>어디서 어느 카드로</h3>
        <p style={{ margin: "0", fontSize: "16px", lineHeight: "1.8", color: "#3A4A78" }}>편의점은 이 카드, 카페는 저 카드.<br />결제할 카드를 정해 드려요.</p>
      </article>
      <article style={{ background: "#fff", borderRadius: "24px", boxShadow: "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)", padding: "24px", display: "flex", flexDirection: "column", gap: "14px" }}>
        <div aria-hidden="true" style={{ height: "120px", borderRadius: "18px", background: "#F3F7FF", display: "flex", alignItems: "stretch", justifyContent: "center", gap: "8px", position: "relative", overflow: "hidden", flexDirection: "column", padding: "14px 18px" }}><span style={{ alignSelf: "flex-end", background: "rgb(36, 87, 245)", color: "rgb(255, 255, 255)", fontSize: "13px", padding: "6px 12px", borderRadius: "14px 4px 14px 14px" }}>왜 이 카드예요?</span>
          <span style={{ alignSelf: "flex-start", background: "rgb(255, 255, 255)", fontSize: "13px", padding: "6px 12px", borderRadius: "4px 14px 14px", boxShadow: "rgba(13, 40, 120, 0.05) 0px 1px 2px, rgba(13, 40, 120, 0.08) 0px 10px 28px" }}>카페 할인이 가장 커요</span>
        </div>
        <h3 style={{ margin: "0", fontSize: "21px", lineHeight: "1.4", fontWeight: "700" }}>궁금하면 바로 상담</h3>
        <p style={{ margin: "0", fontSize: "16px", lineHeight: "1.8", color: "#3A4A78" }}>오른쪽 위 <b>카드 상담</b>을 누르면<br />계산 결과로 답해 드려요.</p>
      </article>
    </div>
  </section>

  {/* 2. 4단계 */}
  <section style={{ marginTop: "56px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}><h2 style={{ margin: "0", fontSize: "28px", lineHeight: "1.35", letterSpacing: "-0.02em", fontWeight: "700" }}>지갑 만들기는 4단계예요</h2></div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", counterReset: "s" }}>
      <article style={{ background: "#fff", borderRadius: "24px", boxShadow: "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)", padding: "20px", display: "flex", flexDirection: "column", gap: "14px", position: "relative" }}>
        <span style={{ width: "36px", height: "36px", borderRadius: "18px", background: "#2457F5", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Outfit", fontWeight: "700" }}>1</span>
        <div aria-hidden="true" style={{ height: "130px", borderRadius: "16px", background: "#F3F7FF", padding: "14px", display: "flex", flexDirection: "column", justifyContent: "center", gap: "8px" }}>
          <div style={{ display: "flex", gap: "6px" }}>
            <div style={{ position: "relative", borderRadius: "8px", overflow: "hidden", boxShadow: "0 2px 4px rgba(13, 40, 120, 0.12), 0 10px 22px -8px rgba(13, 40, 120, 0.38)", display: "flex", flexDirection: "column", justifyContent: "space-between", color: "#fff", padding: "8px", background: "#0E1F5C", width: "58px", height: "37px", outline: "2px solid #2457F5", outlineOffset: "2px" }}>
<span style={{ position: "absolute", width: "90%", aspectRatio: "1", borderRadius: "50%", right: "-38%", top: "-45%", background: "rgba(255,255,255,.14)" }}></span><i style={{ position: "relative", width: "16px", height: "12px", borderRadius: "3px", background: "linear-gradient(135deg, #F2F6FF, #B7C8EC)" }}></i>
</div>
            <div style={{ position: "relative", borderRadius: "8px", overflow: "hidden", boxShadow: "0 2px 4px rgba(13, 40, 120, 0.12), 0 10px 22px -8px rgba(13, 40, 120, 0.38)", display: "flex", flexDirection: "column", justifyContent: "space-between", color: "#fff", padding: "8px", background: "#3E8BFF", width: "58px", height: "37px", outline: "2px solid #2457F5", outlineOffset: "2px" }}>
<span style={{ position: "absolute", width: "90%", aspectRatio: "1", borderRadius: "50%", right: "-38%", top: "-45%", background: "rgba(255,255,255,.14)" }}></span><i style={{ position: "relative", width: "16px", height: "12px", borderRadius: "3px", background: "linear-gradient(135deg, #F2F6FF, #B7C8EC)" }}></i>
</div>
            <div style={{ position: "relative", borderRadius: "8px", overflow: "hidden", boxShadow: "none", display: "flex", flexDirection: "column", justifyContent: "space-between", color: "#fff", padding: "8px", background: "#B5C3E3", width: "58px", height: "37px" }}>
<span style={{ position: "absolute", width: "90%", aspectRatio: "1", borderRadius: "50%", right: "-38%", top: "-45%", background: "rgba(255,255,255,.14)" }}></span><i style={{ position: "relative", width: "16px", height: "12px", borderRadius: "3px", background: "linear-gradient(135deg, #F2F6FF, #B7C8EC)" }}></i>
</div>
          </div>
          <span style={{ fontSize: "13px", fontWeight: "700", color: "#2457F5" }}>✓ 2장 골랐어요</span>
        </div>
        <h3 style={{ margin: "0", fontSize: "20px", lineHeight: "1.4", fontWeight: "700" }}>카드 고르기</h3>
        <p style={{ margin: "0", fontSize: "16px", lineHeight: "1.8", color: "#3A4A78" }}><b>가진 카드</b>를 고르거나,<br /><b>새 카드 종류</b>를 골라요.</p>
      </article>
      <article style={{ background: "#fff", borderRadius: "24px", boxShadow: "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)", padding: "20px", display: "flex", flexDirection: "column", gap: "14px", position: "relative" }}>
        <span style={{ width: "36px", height: "36px", borderRadius: "18px", background: "#2457F5", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Outfit", fontWeight: "700" }}>2</span>
        <div aria-hidden="true" style={{ height: "130px", borderRadius: "16px", background: "#F3F7FF", padding: "14px", display: "flex", flexDirection: "column", justifyContent: "center", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<span style={{ width: "28px", height: "28px", borderRadius: "9px", display: "flex", alignItems: "center", justifyContent: "center", background: "#E3F1FF", color: "#1170D9" }} aria-label="편의점"><svg viewBox="0 0 24 24" style={{ width: "16px", height: "16px", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }}><path d="M4 9 5.5 4h13L20 9"></path><path d="M4 9h16v11H4z"></path><path d="M9 20v-6h6v6"></path></svg></span><div style={{ height: "14px", borderRadius: "7px", background: "#E3EAF8", position: "relative", overflow: "visible", flex: "1" }}><i style={{ position: "absolute", inset: "0 auto 0 0", borderRadius: "7px", background: "#2457F5", width: "80%" }}></i></div>
</div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<span style={{ width: "28px", height: "28px", borderRadius: "9px", display: "flex", alignItems: "center", justifyContent: "center", background: "#E8EEFF", color: "#2457F5" }} aria-label="카페"><svg viewBox="0 0 24 24" style={{ width: "16px", height: "16px", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }}><path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"></path><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17"></path><path d="M8 3v2M12 3v2"></path></svg></span><div style={{ height: "14px", borderRadius: "7px", background: "#E3EAF8", position: "relative", overflow: "visible", flex: "1" }}><i style={{ position: "absolute", inset: "0 auto 0 0", borderRadius: "7px", background: "#2457F5", width: "58%" }}></i></div>
</div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
<span style={{ width: "28px", height: "28px", borderRadius: "9px", display: "flex", alignItems: "center", justifyContent: "center", background: "#E7EEFC", color: "#3E6FD8" }} aria-label="배달"><svg viewBox="0 0 24 24" style={{ width: "16px", height: "16px", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }}><circle cx="6" cy="17" r="2.5"></circle><circle cx="18" cy="17" r="2.5"></circle><path d="M8.5 17h7"></path><path d="M15.5 17 13 9h-3"></path><path d="M13 9h3l2.5 5.5"></path><rect width="6" height="5" x="3" y="6" rx="1"></rect></svg></span><div style={{ height: "14px", borderRadius: "7px", background: "#E3EAF8", position: "relative", overflow: "visible", flex: "1" }}><i style={{ position: "absolute", inset: "0 auto 0 0", borderRadius: "7px", background: "#2457F5", width: "30%" }}></i></div>
</div>
        </div>
        <h3 style={{ margin: "0", fontSize: "20px", lineHeight: "1.4", fontWeight: "700" }}>지출 입력</h3>
        <p style={{ margin: "0", fontSize: "16px", lineHeight: "1.8", color: "#3A4A78" }}>카테고리마다<br />한 달에 쓰는 돈을 넣어요.</p>
      </article>
      <article style={{ background: "#fff", borderRadius: "24px", boxShadow: "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)", padding: "20px", display: "flex", flexDirection: "column", gap: "14px", position: "relative" }}>
        <span style={{ width: "36px", height: "36px", borderRadius: "18px", background: "#2457F5", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Outfit", fontWeight: "700" }}>3</span><span style={{ position: "absolute", top: "22px", right: "20px", fontSize: "13px", fontWeight: "700", color: "#1747D6", background: "#E6EEFF", padding: "4px 10px", borderRadius: "12px" }}>건너뛰어도 OK</span>
        <div aria-hidden="true" style={{ height: "130px", borderRadius: "16px", background: "#F3F7FF", padding: "14px", display: "flex", flexDirection: "row", justifyContent: "center", gap: "8px", alignItems: "center" }}>
          <span style={{ position: "relative", display: "block", width: "42px", height: "42px", flexShrink: "0" }}><img src="/brands/starbucks.png" alt="스타벅스 선택됨" style={{ display: "block", width: "42px", height: "42px", borderRadius: "21px", outline: "2px solid #2457F5", outlineOffset: "2px" }} /><span aria-hidden="true" style={{ position: "absolute", right: "-6px", top: "-6px", width: "18px", height: "18px", borderRadius: "9px", background: "#2457F5", border: "2px solid #FFFFFF", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10"></path></svg></span></span>
          <img src="/brands/cu.png" alt="CU" style={{ width: "42px", height: "42px", borderRadius: "21px", boxShadow: "0 1px 2px rgba(13,40,120,.05),0 10px 28px rgba(13,40,120,.08)", display: "block" }} />
          <span style={{ position: "relative", display: "block", width: "42px", height: "42px", flexShrink: "0" }}><img src="/brands/gs25.png" alt="GS25 선택됨" style={{ display: "block", width: "42px", height: "42px", borderRadius: "21px", outline: "2px solid #2457F5", outlineOffset: "2px" }} /><span aria-hidden="true" style={{ position: "absolute", right: "-6px", top: "-6px", width: "18px", height: "18px", borderRadius: "9px", background: "#2457F5", border: "2px solid #FFFFFF", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10"></path></svg></span></span>
          <img src="/brands/ediya.png" alt="이디야커피" style={{ width: "42px", height: "42px", borderRadius: "21px", boxShadow: "0 1px 2px rgba(13,40,120,.05),0 10px 28px rgba(13,40,120,.08)", display: "block" }} />
        </div>
        <h3 style={{ margin: "0", fontSize: "20px", lineHeight: "1.4", fontWeight: "700" }}>자주 가는 곳</h3>
        <p style={{ margin: "0", fontSize: "16px", lineHeight: "1.8", color: "#3A4A78" }}>스타벅스·GS25처럼<br />자주 가는 곳을 눌러요.</p>
      </article>
      <article style={{ background: "#fff", borderRadius: "24px", boxShadow: "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)", padding: "20px", display: "flex", flexDirection: "column", gap: "14px", position: "relative" }}>
        <span style={{ width: "36px", height: "36px", borderRadius: "18px", background: "#2457F5", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Outfit", fontWeight: "700" }}>4</span>
        <div aria-hidden="true" style={{ height: "130px", borderRadius: "16px", background: "#F3F7FF", padding: "14px", display: "flex", flexDirection: "column", justifyContent: "center", gap: "8px" }}>
          <span style={{ fontSize: "12px", color: "#5E6D96" }}>매달 받는 혜택</span>
          <span><span style={{ fontFamily: '"Outfit", sans-serif', fontVariantNumeric: "tabular-nums", fontSize: "36px", fontWeight: "800", color: "#1747D6" }}>33,000</span><b style={{ fontSize: "16px" }}>원</b></span>
        </div>
        <h3 style={{ margin: "0", fontSize: "20px", lineHeight: "1.4", fontWeight: "700" }}>추천 결과</h3>
        <p style={{ margin: "0", fontSize: "16px", lineHeight: "1.8", color: "#3A4A78" }}>받는 돈과 결제 방법을 봐요.<br />좋으면 <b>내 지갑에 저장</b>!</p>
      </article>
    </div>
    <div style={{ marginTop: "16px", display: "flex", alignItems: "center", gap: "12px", padding: "16px 20px", borderRadius: "18px", background: "#fff", boxShadow: "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)", fontSize: "16px", color: "#3A4A78" }}>
      <span style={{ width: "44px", height: "44px", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", background: "#E8EEFF", color: "#2457F5" }}><svg viewBox="0 0 24 24" style={{ width: "24px", height: "24px", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><path d="M14 3v6h6"></path></svg></span>
      <span><b style={{ color: "#0D1B4A" }}>명세서가 있나요?</b> 2단계에서 ‘명세서로 채우기’를 누르면 금액이 한 번에 채워지고, 바로 추천 결과로 가요.</span>
    </div>
  </section>

  {/* 3. 결과 화면 읽는 법 */}
  <section style={{ marginTop: "56px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}><h2 style={{ margin: "0", fontSize: "28px", lineHeight: "1.35", letterSpacing: "-0.02em", fontWeight: "700" }}>결과 화면, 이 3곳만 보세요</h2></div>
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: "24px" }}>
      <div aria-label="추천 결과 예시 화면" style={{ background: "#fff", borderRadius: "24px", boxShadow: "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)", flex: "0 1 420px", minWidth: "0", boxSizing: "border-box", padding: "24px 24px 26px", position: "relative" }}>
        <span style={{ display: "inline-flex", alignItems: "center", height: "30px", padding: "0 12px", borderRadius: "15px", background: "#E8EEFF", color: "#2457F5", fontSize: "14px", fontWeight: "700" }}>예시 화면</span>
        <div style={{ marginTop: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
<span style={{ width: "30px", height: "30px", borderRadius: "15px", background: "#F2994A", color: "#fff", fontFamily: "Outfit", fontWeight: "700", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "15px", flexShrink: "0", boxShadow: "0 0 0 4px rgba(242, 153, 74, 0.25)" }}>1</span><span style={{ fontSize: "14px", color: "#5E6D96" }}>매달 받는 혜택</span>
</div>
        <div style={{ margin: "4px 0 0 40px" }}>
<span style={{ fontFamily: '"Outfit", sans-serif', fontVariantNumeric: "tabular-nums", fontSize: "44px", fontWeight: "800", color: "#1747D6" }}>33,000</span><b style={{ fontSize: "18px" }}>원</b>
</div>
        <div style={{ marginTop: "22px", display: "flex", alignItems: "center", gap: "10px" }}>
<span style={{ width: "30px", height: "30px", borderRadius: "15px", background: "#F2994A", color: "#fff", fontFamily: "Outfit", fontWeight: "700", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "15px", flexShrink: "0", boxShadow: "0 0 0 4px rgba(242, 153, 74, 0.25)" }}>2</span><span style={{ fontSize: "14px", color: "#5E6D96" }}>D4카드의정석Ⅱ 실적</span>
</div>
        <div style={{ margin: "10px 0 0 40px" }}>
          <div style={{ height: "14px", borderRadius: "7px", background: "#E3EAF8", position: "relative", overflow: "visible" }}>
<i style={{ position: "absolute", inset: "0 auto 0 0", borderRadius: "7px", background: "#2457F5", width: "86%" }}></i><s style={{ position: "absolute", top: "-6px", bottom: "-6px", width: "2px", background: "#0D1B4A", left: "78%" }}></s>
</div>
          <div style={{ marginTop: "8px", display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#5E6D96" }}>
<span>32만 4천원 썼어요</span><span>| 기준 30만원</span>
</div>
        </div>
        <div style={{ marginTop: "22px", display: "flex", alignItems: "center", gap: "10px" }}>
<span style={{ width: "30px", height: "30px", borderRadius: "15px", background: "#F2994A", color: "#fff", fontFamily: "Outfit", fontWeight: "700", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "15px", flexShrink: "0", boxShadow: "0 0 0 4px rgba(242, 153, 74, 0.25)" }}>3</span><span style={{ display: "inline-flex", alignItems: "center", height: "40px", padding: "0 16px", borderRadius: "20px", background: "#F3F7FF", fontSize: "14px", fontWeight: "700" }}>계산 자세히 보기</span>
</div>
      </div>
      <div style={{ flex: "0 1 460px", minWidth: "0", display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ background: "#fff", borderRadius: "24px", boxShadow: "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)", padding: "18px 20px", display: "flex", gap: "14px", alignItems: "flex-start" }}>
<span style={{ width: "30px", height: "30px", borderRadius: "15px", background: "#F2994A", color: "#fff", fontFamily: "Outfit", fontWeight: "700", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "15px", flexShrink: "0", boxShadow: "0 0 0 4px rgba(242, 153, 74, 0.25)" }}>1</span><div>
<h3 style={{ margin: "0", fontSize: "18px", lineHeight: "1.4", fontWeight: "700" }}>매달 받는 혜택</h3>
<p style={{ margin: "0", fontSize: "16px", lineHeight: "1.8", color: "#3A4A78", marginTop: "4px" }}>연회비까지 뺀 금액이에요.<br />카드는 이 숫자로 고르세요.</p>
</div>
</div>
        <div style={{ background: "#fff", borderRadius: "24px", boxShadow: "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)", padding: "18px 20px", display: "flex", gap: "14px", alignItems: "flex-start" }}>
<span style={{ width: "30px", height: "30px", borderRadius: "15px", background: "#F2994A", color: "#fff", fontFamily: "Outfit", fontWeight: "700", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "15px", flexShrink: "0", boxShadow: "0 0 0 4px rgba(242, 153, 74, 0.25)" }}>2</span><div>
<h3 style={{ margin: "0", fontSize: "18px", lineHeight: "1.4", fontWeight: "700" }}>실적 막대</h3>
<p style={{ margin: "0", fontSize: "16px", lineHeight: "1.8", color: "#3A4A78", marginTop: "4px" }}>막대가 세로선을 넘으면<br />혜택을 받을 수 있어요.</p>
          <details className="group" style={{ background: "#F3F7FF", borderRadius: "18px", boxShadow: "none", marginTop: "10px", margin: "8px 0 0" }}><summary style={{ listStyle: "none", display: "flex", alignItems: "center", gap: "12px", minHeight: "40px", padding: "6px 12px", cursor: "pointer", fontSize: "14px", fontWeight: "600" }}>막대에 빈 공간은 왜 있는 건가요?<span className="group-open:rotate-180" style={{ marginLeft: "auto", transition: "transform 0.2s" }}>⌄</span></summary><div style={{ padding: "0 12px 12px", fontSize: "14px", lineHeight: "1.8", color: "#3A4A78" }}>할인받은 결제는 실적에서 빠지는 카드가 많아요.<br />그래서 기준보다 2만원 더 쓰도록 계산해요.</div></details>
        </div>
</div>
        <div style={{ background: "#fff", borderRadius: "24px", boxShadow: "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)", padding: "18px 20px", display: "flex", gap: "14px", alignItems: "flex-start" }}>
<span style={{ width: "30px", height: "30px", borderRadius: "15px", background: "#F2994A", color: "#fff", fontFamily: "Outfit", fontWeight: "700", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "15px", flexShrink: "0", boxShadow: "0 0 0 4px rgba(242, 153, 74, 0.25)" }}>3</span><div>
<h3 style={{ margin: "0", fontSize: "18px", lineHeight: "1.4", fontWeight: "700" }}>계산 자세히 보기</h3>
<p style={{ margin: "0", fontSize: "16px", lineHeight: "1.8", color: "#3A4A78", marginTop: "4px" }}>실적·카드 장수·계산에 쓴 값을<br />펼쳐서 볼 수 있어요.</p>
</div>
</div>
      </div>
    </div>
  </section>

  {/* 4. 메뉴 */}
  <section style={{ marginTop: "56px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}><h2 style={{ margin: "0", fontSize: "28px", lineHeight: "1.35", letterSpacing: "-0.02em", fontWeight: "700" }}>메뉴 한눈에 보기</h2></div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
      <Link to={paths.wallet} style={{ background: "#fff", borderRadius: "24px", boxShadow: "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)", padding: "20px", display: "flex", flexDirection: "column", gap: "10px", textDecoration: "none", color: "inherit" }}><span style={{ width: "44px", height: "44px", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", background: "#E8EEFF", color: "#2457F5" }}><svg viewBox="0 0 24 24" style={{ width: "24px", height: "24px", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }}><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2"></path><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"></path></svg></span><h3 style={{ margin: "0", fontSize: "18px", lineHeight: "1.4", fontWeight: "700" }}>내 지갑</h3>
<p style={{ margin: "0", fontSize: "15px", lineHeight: "1.7", color: "#3A4A78" }}>저장한 조합과<br />카드사 앱에서 할 일</p></Link>
      <Link to={paths.cards} style={{ background: "#fff", borderRadius: "24px", boxShadow: "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)", padding: "20px", display: "flex", flexDirection: "column", gap: "10px", textDecoration: "none", color: "inherit" }}><span style={{ width: "44px", height: "44px", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", background: "#E8EEFF", color: "#2457F5" }}><svg viewBox="0 0 24 24" style={{ width: "24px", height: "24px", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }}><rect x="2.5" y="5" width="19" height="14" rx="2.5"></rect><path d="M2.5 10h19"></path><path d="M6.5 15h4"></path></svg></span><h3 style={{ margin: "0", fontSize: "18px", lineHeight: "1.4", fontWeight: "700" }}>전체 카드</h3>
<p style={{ margin: "0", fontSize: "15px", lineHeight: "1.7", color: "#3A4A78" }}>카드 {num(catalogCards.length)}장 찾아보기<br />최대 3장 나란히 비교</p></Link>
      <Link to={paths.benefit} style={{ background: "#fff", borderRadius: "24px", boxShadow: "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)", padding: "20px", display: "flex", flexDirection: "column", gap: "10px", textDecoration: "none", color: "inherit" }}><span style={{ width: "44px", height: "44px", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", background: "#E8EEFF", color: "#2457F5" }}><svg viewBox="0 0 24 24" style={{ width: "24px", height: "24px", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }}><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"></path></svg></span><h3 style={{ margin: "0", fontSize: "18px", lineHeight: "1.4", fontWeight: "700" }}>혜택별 추천</h3>
<p style={{ margin: "0", fontSize: "15px", lineHeight: "1.7", color: "#3A4A78" }}>카페만, 편의점만<br />한 분야 최고 카드</p></Link>
      <button type="button" onClick={() => chatStore.ask()} style={{ background: "#fff", borderRadius: "24px", boxShadow: "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)", padding: "20px", display: "flex", flexDirection: "column", gap: "10px", textDecoration: "none", color: "inherit", border: "none", fontFamily: "inherit", textAlign: "left", cursor: "pointer" }}><span style={{ width: "44px", height: "44px", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", background: "#E8EEFF", color: "#2457F5" }}><svg viewBox="0 0 24 24" style={{ width: "24px", height: "24px", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"></path></svg></span><h3 style={{ margin: "0", fontSize: "18px", lineHeight: "1.4", fontWeight: "700" }}>카드 상담</h3>
<p style={{ margin: "0", fontSize: "15px", lineHeight: "1.7", color: "#3A4A78" }}>어느 화면에서든 열기<br />대화는 그대로 이어져요</p></button>
    </div>
  </section>

  {/* 5. FAQ */}
  <section style={{ marginTop: "56px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}><h2 style={{ margin: "0", fontSize: "28px", lineHeight: "1.35", letterSpacing: "-0.02em", fontWeight: "700" }}>자주 묻는 질문</h2></div>
    <details className="group" style={{ background: "#fff", borderRadius: "18px", boxShadow: "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)", marginTop: "10px" }}><summary style={{ listStyle: "none", display: "flex", alignItems: "center", gap: "12px", minHeight: "64px", padding: "12px 20px", cursor: "pointer", fontSize: "17px", fontWeight: "600" }}><span style={{ width: "30px", height: "30px", borderRadius: "15px", background: "#E8EEFF", color: "#2457F5", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Outfit", fontWeight: "700", flexShrink: "0" }}>Q</span>금액은 실제로 받는 돈인가요? <span className="group-open:rotate-180" style={{ marginLeft: "auto", transition: "transform 0.2s" }}>⌄</span></summary><div style={{ padding: "0 20px 18px 62px", fontSize: "16px", lineHeight: "1.8", color: "#3A4A78" }}>카드사 할인율과 한도로 계산한 <b>추정값</b>이에요.<br />카드를 만들기 전에 카드사 약관을 꼭 확인하세요.</div></details>
    <details className="group" style={{ background: "#fff", borderRadius: "18px", boxShadow: "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)", marginTop: "10px" }}><summary style={{ listStyle: "none", display: "flex", alignItems: "center", gap: "12px", minHeight: "64px", padding: "12px 20px", cursor: "pointer", fontSize: "17px", fontWeight: "600" }}><span style={{ width: "30px", height: "30px", borderRadius: "15px", background: "#E8EEFF", color: "#2457F5", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Outfit", fontWeight: "700", flexShrink: "0" }}>Q</span>자주 가는 곳을 안 고르면요? <span className="group-open:rotate-180" style={{ marginLeft: "auto", transition: "transform 0.2s" }}>⌄</span></summary><div style={{ padding: "0 20px 18px 62px", fontSize: "16px", lineHeight: "1.8", color: "#3A4A78" }}>브랜드 한 곳 할인은 그 카테고리 지출의 35%, 여러 곳을 묶은 할인은 70%를 그 가게에서 쓴다고 보고 계산해요.<br />명세서로 채우면 추정하지 않고 실제 결제한 가게로 계산해요.</div></details>
    <details className="group" style={{ background: "#fff", borderRadius: "18px", boxShadow: "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)", marginTop: "10px" }}><summary style={{ listStyle: "none", display: "flex", alignItems: "center", gap: "12px", minHeight: "64px", padding: "12px 20px", cursor: "pointer", fontSize: "17px", fontWeight: "600" }}><span style={{ width: "30px", height: "30px", borderRadius: "15px", background: "#E8EEFF", color: "#2457F5", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Outfit", fontWeight: "700", flexShrink: "0" }}>Q</span>명세서로 채우기는 어떻게 써요? <span className="group-open:rotate-180" style={{ marginLeft: "auto", transition: "transform 0.2s" }}>⌄</span></summary><div style={{ padding: "0 20px 18px 62px", fontSize: "16px", lineHeight: "1.8", color: "#3A4A78" }}>지출 입력에서 ‘명세서로 채우기’를 눌러요.<br />명세서 파일을 올리면 금액이 채워지고, 바로 결과로 가요.</div></details>
    <details className="group" style={{ background: "#fff", borderRadius: "18px", boxShadow: "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)", marginTop: "10px" }}><summary style={{ listStyle: "none", display: "flex", alignItems: "center", gap: "12px", minHeight: "64px", padding: "12px 20px", cursor: "pointer", fontSize: "17px", fontWeight: "600" }}><span style={{ width: "30px", height: "30px", borderRadius: "15px", background: "#E8EEFF", color: "#2457F5", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Outfit", fontWeight: "700", flexShrink: "0" }}>Q</span>카드 정보는 언제 기준이에요? <span className="group-open:rotate-180" style={{ marginLeft: "auto", transition: "transform 0.2s" }}>⌄</span></summary><div style={{ padding: "0 20px 18px 62px", fontSize: "16px", lineHeight: "1.8", color: "#3A4A78" }}>카드고릴라에 올라온 정보를 모아 계산해요.<br />화면마다 정보를 모은 날짜를 적어 두었어요.</div></details>
  </section>

  {/* 6. CTA */}
  <section style={{ marginTop: "56px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px", padding: "28px", borderRadius: "24px", background: "#2457F5", color: "#fff", boxShadow: "0 18px 40px -12px rgba(36, 87, 245, 0.55)" }}>
    <div>
<div style={{ fontSize: "24px", fontWeight: "700" }}>이제 내 지갑을 만들어 보세요</div>
<div style={{ marginTop: "4px", fontSize: "16px", color: "#DCE6FF" }}>지출만 넣으면 바로 결과가 나와요</div>
</div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}><Link to={paths.start("own")} style={{ display: "inline-flex", alignItems: "center", height: "52px", padding: "0px 22px", borderRadius: "26px", fontSize: "16px", fontWeight: "700", textDecoration: "none", background: "rgb(255, 255, 255)", color: "rgb(36, 87, 245)" }}>보유한 카드로 시작</Link>
      <Link to={paths.start("new")} style={{ display: "inline-flex", alignItems: "center", height: "52px", padding: "0px 22px", borderRadius: "26px", fontSize: "16px", fontWeight: "700", textDecoration: "none", border: "1px solid rgba(255, 255, 255, 0.6)", color: "rgb(255, 255, 255)" }}>새 카드를 포함하여 시작</Link>
    </div>
  </section>
      </PageMain>
    </>
  );
}
