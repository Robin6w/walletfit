import { catalogCards } from "@/v1/catalog";
import { num } from "@/v1/format";
import { paths } from "@/v2/app/paths";
import { Link } from "@/v2/app/router";

/* 디자인 원본 F-D-Wallet-Empty를 그대로 옮김(저장한 지갑이 없을 때). 그림은 특정 카드가 아닌 안내 그림이라 디자인 그대로 */
export function WalletEmpty() {
  return (
    <>
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: "14px 20px",
        }}
      >
        <div style={{ flex: "1 1 420px", minWidth: "0" }}>
          <h1
            style={{
              margin: "0",
              fontSize: "28px",
              fontWeight: "700",
              letterSpacing: "-0.02em",
            }}
          >
            내 지갑
          </h1>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: "15px",
              lineHeight: "1.6",
              color: "#5E6D96",
            }}
          >
            아직 저장한 지갑이 없어요. 추천 결과에서 '내 지갑에 저장'을 누르면
            여기에 모여요.
          </p>
        </div>
      </header>
      <section
        aria-labelledby="we-hero"
        style={{
          background: "#FFFFFF",
          border: "1px solid transparent",
          boxShadow:
            "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)",
          borderRadius: "24px",
          padding: "32px clamp(18px, 2.6vw, 36px)",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px 24px",
        }}
      >
        <div
          style={{
            flex: "1 1 460px",
            minWidth: "0",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div
            style={{ fontSize: "14px", fontWeight: "700", color: "#5E6D96" }}
          >
            저장한 조합 없음
          </div>
          <h2
            id="we-hero"
            style={{
              margin: "0",
              fontSize: "30px",
              lineHeight: "1.3",
              fontWeight: "700",
              letterSpacing: "-0.02em",
            }}
          >
            지갑을 만들면
            <br />
            이번 달 받을 혜택이 여기에 보여요
          </h2>
          <p
            style={{
              margin: "0",
              fontSize: "16px",
              lineHeight: "1.6",
              color: "#3A4A78",
            }}
          >
            가진 카드로 만들거나, 새 카드까지 넣어서 비교할 수 있어요.
          </p>
          <div
            style={{
              marginTop: "8px",
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <Link
              to={paths.start("own")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                height: "48px",
                padding: "0 20px",
                boxSizing: "border-box",
                borderRadius: "24px",
                background: "#2457F5",
                color: "#FFFFFF",
                border: "1px solid #2457F5",
                fontSize: "15px",
                fontWeight: "700",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14"></path>
                <path d="m13 6 6 6-6 6"></path>
              </svg>
              보유한 카드로 지갑 만들기
            </Link>
            <Link
              to={paths.start("new")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                height: "48px",
                padding: "0 20px",
                boxSizing: "border-box",
                borderRadius: "24px",
                background: "#FFFFFF",
                color: "#0D1B4A",
                border: "1px solid #D3DDF2",
                fontSize: "15px",
                fontWeight: "700",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              새 카드까지 포함해서
            </Link>
          </div>
        </div>
        <div
          aria-hidden="true"
          style={{
            flex: "0 1 340px",
            minWidth: "0",
            height: "220px",
            position: "relative",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: "210px",
              height: "133px",
              boxSizing: "border-box",
              flexShrink: "0",
              borderRadius: "16px",
              border: "2px dashed #B5C3E3",
              background: "rgba(255, 255, 255, 0.7)",
              position: "absolute",
              left: "30px",
              top: "26px",
              transform: "rotate(-8deg)",
            }}
          ></div>
          <div
            aria-hidden="true"
            style={{
              width: "210px",
              height: "133px",
              boxSizing: "border-box",
              flexShrink: "0",
              borderRadius: "16px",
              border: "2px dashed #B5C3E3",
              background: "rgba(255, 255, 255, 0.7)",
              position: "absolute",
              left: "110px",
              top: "60px",
              transform: "rotate(6deg)",
            }}
          ></div>
          <span
            style={{
              position: "absolute",
              left: "185px",
              top: "98px",
              width: "56px",
              height: "56px",
              borderRadius: "28px",
              background: "#2457F5",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 10px 24px -8px rgba(36, 87, 245, 0.7)",
            }}
          >
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 5v14"></path>
              <path d="M5 12h14"></path>
            </svg>
          </span>
        </div>
      </section>
      <section
        aria-labelledby="we-prev"
        style={{ display: "flex", flexDirection: "column", gap: "14px" }}
      >
        <h2
          id="we-prev"
          style={{
            margin: "0",
            fontSize: "22px",
            fontWeight: "700",
            letterSpacing: "-0.01em",
          }}
        >
          저장하면 여기서 볼 수 있어요
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(300px, 100%), 1fr))",
            gap: "16px",
          }}
        >
          <article
            style={{
              background: "#FFFFFF",
              border: "1px solid transparent",
              borderRadius: "20px",
              boxShadow:
                "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)",
              padding: "22px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span
                aria-hidden="true"
                style={{
                  flexShrink: "0",
                  width: "44px",
                  height: "44px",
                  borderRadius: "15px",
                  background: "#E8EEFF",
                  color: "#2457F5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  width="21"
                  height="21"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 18a8 8 0 1 1 16 0"></path>
                  <path d="m12 18 4-6"></path>
                </svg>
              </span>
              <h3 style={{ margin: "0", fontSize: "17px", fontWeight: "700" }}>
                이번 달 예상 순혜택
              </h3>
            </div>
            <p
              style={{
                margin: "0",
                fontSize: "14px",
                lineHeight: "1.6",
                color: "#3A4A78",
              }}
            >
              연회비를 뺀 금액과 1년 동안 받는 금액, 1장만 쓸 때와의 차이
            </p>
            <div
              aria-hidden="true"
              style={{
                marginTop: "auto",
                padding: "14px",
                borderRadius: "14px",
                background: "#F3F7FF",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <span
                style={{
                  display: "block",
                  width: "40%",
                  height: "10px",
                  borderRadius: "999px",
                  background: "#EDF2FC",
                }}
              ></span>
              <span
                style={{ display: "flex", alignItems: "baseline", gap: "6px" }}
              >
                <span
                  style={{
                    display: "block",
                    width: "58%",
                    height: "30px",
                    borderRadius: "10px",
                    background: "#E3EAF8",
                  }}
                ></span>
                <span
                  style={{
                    fontSize: "16px",
                    fontWeight: "700",
                    color: "#5E6D96",
                  }}
                >
                  원
                </span>
              </span>
              <span
                style={{
                  display: "block",
                  width: "70%",
                  height: "8px",
                  borderRadius: "999px",
                  background: "#EDF2FC",
                }}
              ></span>
            </div>
          </article>
          <article
            style={{
              background: "#FFFFFF",
              border: "1px solid transparent",
              borderRadius: "20px",
              boxShadow:
                "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)",
              padding: "22px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span
                aria-hidden="true"
                style={{
                  flexShrink: "0",
                  width: "44px",
                  height: "44px",
                  borderRadius: "15px",
                  background: "#E8EEFF",
                  color: "#2457F5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  width="21"
                  height="21"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9 6h11M9 12h11M9 18h11"></path>
                  <path d="M4 6h.01M4 12h.01M4 18h.01"></path>
                </svg>
              </span>
              <h3 style={{ margin: "0", fontSize: "17px", fontWeight: "700" }}>
                결제할 때 이 순서로
              </h3>
            </div>
            <p
              style={{
                margin: "0",
                fontSize: "14px",
                lineHeight: "1.6",
                color: "#3A4A78",
              }}
            >
              편의점·카페·교통마다 어느 카드로 결제하면 되는지
            </p>
            <div
              aria-hidden="true"
              style={{
                marginTop: "auto",
                padding: "14px",
                borderRadius: "14px",
                background: "#F3F7FF",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <span
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <span
                  style={{
                    flexShrink: "0",
                    width: "28px",
                    height: "28px",
                    borderRadius: "9px",
                    background: "#E3EAF8",
                  }}
                ></span>
                <span
                  style={{
                    display: "block",
                    width: "55%",
                    height: "9px",
                    borderRadius: "999px",
                    background: "#EDF2FC",
                  }}
                ></span>
                <span
                  style={{
                    marginLeft: "auto",
                    flexShrink: "0",
                    width: "44px",
                    height: "20px",
                    borderRadius: "10px",
                    background: "#FFFFFF",
                    border: "1px solid #E3EAF8", boxSizing: "content-box" }}
                ></span>
              </span>
              <span
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <span
                  style={{
                    flexShrink: "0",
                    width: "28px",
                    height: "28px",
                    borderRadius: "9px",
                    background: "#E3EAF8",
                  }}
                ></span>
                <span
                  style={{
                    display: "block",
                    width: "40%",
                    height: "9px",
                    borderRadius: "999px",
                    background: "#EDF2FC",
                  }}
                ></span>
                <span
                  style={{
                    marginLeft: "auto",
                    flexShrink: "0",
                    width: "44px",
                    height: "20px",
                    borderRadius: "10px",
                    background: "#FFFFFF",
                    border: "1px solid #E3EAF8", boxSizing: "content-box" }}
                ></span>
              </span>
              <span
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <span
                  style={{
                    flexShrink: "0",
                    width: "28px",
                    height: "28px",
                    borderRadius: "9px",
                    background: "#E3EAF8",
                  }}
                ></span>
                <span
                  style={{
                    display: "block",
                    width: "48%",
                    height: "9px",
                    borderRadius: "999px",
                    background: "#EDF2FC",
                  }}
                ></span>
                <span
                  style={{
                    marginLeft: "auto",
                    flexShrink: "0",
                    width: "44px",
                    height: "20px",
                    borderRadius: "10px",
                    background: "#FFFFFF",
                    border: "1px solid #E3EAF8", boxSizing: "content-box" }}
                ></span>
              </span>
            </div>
          </article>
          <article
            style={{
              background: "#FFFFFF",
              border: "1px solid transparent",
              borderRadius: "20px",
              boxShadow:
                "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)",
              padding: "22px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span
                aria-hidden="true"
                style={{
                  flexShrink: "0",
                  width: "44px",
                  height: "44px",
                  borderRadius: "15px",
                  background: "#E8EEFF",
                  color: "#2457F5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  width="21"
                  height="21"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="4" y="4" width="16" height="16" rx="3"></rect>
                  <path d="m8.5 12 2.5 2.5 4.5-5"></path>
                </svg>
              </span>
              <h3 style={{ margin: "0", fontSize: "17px", fontWeight: "700" }}>
                할 일과 실적 여유
              </h3>
            </div>
            <p
              style={{
                margin: "0",
                fontSize: "14px",
                lineHeight: "1.6",
                color: "#3A4A78",
              }}
            >
              패키지 바꾸기·후불교통 등록처럼 카드사 앱에서 해 둘 일과 카드별
              실적
            </p>
            <div
              aria-hidden="true"
              style={{
                marginTop: "auto",
                padding: "14px",
                borderRadius: "14px",
                background: "#F3F7FF",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <span
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <span
                  style={{
                    flexShrink: "0",
                    width: "18px",
                    height: "18px",
                    borderRadius: "5px",
                    border: "2px solid #C3CEE6",
                    background: "#FFFFFF", boxSizing: "content-box" }}
                ></span>
                <span
                  style={{
                    display: "block",
                    width: "70%",
                    height: "9px",
                    borderRadius: "999px",
                    background: "#EDF2FC",
                  }}
                ></span>
              </span>
              <span
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <span
                  style={{
                    flexShrink: "0",
                    width: "18px",
                    height: "18px",
                    borderRadius: "5px",
                    border: "2px solid #C3CEE6",
                    background: "#FFFFFF", boxSizing: "content-box" }}
                ></span>
                <span
                  style={{
                    display: "block",
                    width: "58%",
                    height: "9px",
                    borderRadius: "999px",
                    background: "#EDF2FC",
                  }}
                ></span>
              </span>
              <span
                style={{
                  position: "relative",
                  display: "block",
                  height: "8px",
                  borderRadius: "999px",
                  background: "#EDF2FC",
                }}
              >
                <span
                  style={{
                    display: "block",
                    width: "62%",
                    height: "8px",
                    borderRadius: "999px",
                    background: "#C3CEE6",
                  }}
                ></span>
              </span>
            </div>
          </article>
        </div>
      </section>
      <section
        aria-labelledby="we-more"
        style={{ display: "flex", flexDirection: "column", gap: "14px" }}
      >
        <h2
          id="we-more"
          style={{ margin: "0", fontSize: "20px", fontWeight: "700" }}
        >
          지갑을 만들기 전에 둘러보기
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(340px, 100%), 1fr))",
            gap: "14px",
          }}
        >
          <Link
            to={paths.cards}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              padding: "20px 22px",
              borderRadius: "20px",
              background: "#FFFFFF",
              color: "#0D1B4A",
              textDecoration: "none",
              boxShadow:
                "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                flexShrink: "0",
                width: "44px",
                height: "44px",
                borderRadius: "15px",
                background: "#F3F7FF",
                color: "#2457F5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="21"
                height="21"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="7" height="7" rx="1.5"></rect>
                <rect x="14" y="3" width="7" height="7" rx="1.5"></rect>
                <rect x="3" y="14" width="7" height="7" rx="1.5"></rect>
                <rect x="14" y="14" width="7" height="7" rx="1.5"></rect>
              </svg>
            </span>
            <span style={{ flex: "1", minWidth: "0" }}>
              <span
                style={{
                  display: "block",
                  fontSize: "17px",
                  fontWeight: "700",
                }}
              >
                전체 카드 둘러보기
              </span>
              <span
                style={{
                  display: "block",
                  marginTop: "2px",
                  fontSize: "14px",
                  lineHeight: "1.5",
                  color: "#3A4A78",
                }}
              >
                {num(catalogCards.length)}장을 찾아보고 최대 3장까지 나란히
                비교해요
              </span>
            </span>
            <span
              style={{ flexShrink: "0", display: "flex", color: "#2457F5" }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14"></path>
                <path d="m13 6 6 6-6 6"></path>
              </svg>
            </span>
          </Link>
          <Link
            to={paths.benefit}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              padding: "20px 22px",
              borderRadius: "20px",
              background: "#FFFFFF",
              color: "#0D1B4A",
              textDecoration: "none",
              boxShadow:
                "0 1px 2px rgba(13, 40, 120, 0.05), 0 10px 28px rgba(13, 40, 120, 0.08)",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                flexShrink: "0",
                width: "44px",
                height: "44px",
                borderRadius: "15px",
                background: "#F3F7FF",
                color: "#2457F5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="21"
                height="21"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"></path>
              </svg>
            </span>
            <span style={{ flex: "1", minWidth: "0" }}>
              <span
                style={{
                  display: "block",
                  fontSize: "17px",
                  fontWeight: "700",
                }}
              >
                한 카테고리만 보기
              </span>
              <span
                style={{
                  display: "block",
                  marginTop: "2px",
                  fontSize: "14px",
                  lineHeight: "1.5",
                  color: "#3A4A78",
                }}
              >
                편의점·카페처럼 한 분야에서 가장 유리한 카드를 찾아요
              </span>
            </span>
            <span
              style={{ flexShrink: "0", display: "flex", color: "#2457F5" }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14"></path>
                <path d="m13 6 6 6-6 6"></path>
              </svg>
            </span>
          </Link>
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "12px 16px",
            padding: "16px 20px",
            borderRadius: "16px",
            background: "#E8EEFF",
            border: "1px solid #C9D6F5",
          }}
        >
          <span style={{ flexShrink: "0", display: "flex", color: "#1747D6" }}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 16V4"></path>
              <path d="m7 9 5-5 5 5"></path>
              <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"></path>
            </svg>
          </span>
          <span
            style={{
              flex: "1 1 360px",
              minWidth: "0",
              fontSize: "14px",
              lineHeight: "1.6",
              color: "#0D1B4A",
            }}
          >
            카드 명세서가 있으면 더 빨라요. 지출 입력에서 <b>명세서로 채우기</b>
            를 누르면 금액이 채워지고 바로 추천 결과로 넘어가요.
          </span>
          <Link
            to={paths.guide}
            style={{
              flexShrink: "0",
              display: "inline-flex",
              alignItems: "center",
              minHeight: "44px",
              fontSize: "14px",
              fontWeight: "700",
            }}
          >
            이용 가이드 보기
          </Link>
        </div>
      </section>
    </>
  );
}
