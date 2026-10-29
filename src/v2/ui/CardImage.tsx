import { useState, type CSSProperties } from "react";
import { catalogBySourceId } from "@/v1/catalog";
import { shortName } from "@/v1/ui";

/**
 * 카드 그림. 카드고릴라 실물 사진(cards-catalog.json imageUrl)을 쓴다.
 *  - 국내 카드 사진은 세로형이 많아서, 불러온 뒤 세로형이면 -90° 돌려 가로 칸(1.586:1)에 맞춘다
 *  - 사진이 없거나(21장) 못 불러오면 디자인 모양의 색 카드(칩·장식 원·이름)를 보여 준다
 *  - 사진 방향은 주소별로 기억해서 다시 그릴 때 깜빡이지 않는다
 */
const RATIO = 1.586;
const orientation = new Map<string, "h" | "v" | "fail">();

const FACE_COLORS = ["#0E1F5C", "#3E8BFF", "#6E97EE", "#4338CA", "#5A79B8", "#1C3FAA", "#2457F5", "#3E6FD8", "#5B8DEF"];
export function faceColor(sid: number): string {
  return FACE_COLORS[Math.abs(sid) % FACE_COLORS.length];
}

export interface CardImageProps {
  sid: number;
  width: number;
  /** 사진이 없을 때 카드에 쓸 이름(기본: 짧은 카드 이름) */
  label?: string;
  /** 기울기(도). 홈·결과 히어로의 카드 겹침에 씀 */
  rotate?: number;
  /** 사진을 쓰지 않고 색 카드만(테스트·미리보기) */
  faceOnly?: boolean;
  /** 'NEW' 표시 */
  badge?: string;
  className?: string;
  style?: CSSProperties;
  shadow?: boolean;
  /** 사진이 없을 때 색 카드 바탕색 */
  color?: string;
}

export function CardImage({ sid, width, label, rotate, faceOnly, badge, className = "", style, shadow = true, color }: CardImageProps) {
  const entry = catalogBySourceId.get(sid);
  const url = faceOnly ? undefined : entry?.imageUrl;
  const known = url ? orientation.get(url) : "fail";
  const [state, setState] = useState<"loading" | "h" | "v" | "fail">(known ?? "loading");
  const height = Math.round(width / RATIO);
  const name = label ?? shortName(entry?.name ?? "");
  const showPhoto = !!url && state !== "fail";
  const radius = Math.max(4, Math.round(width * 0.075));

  return (
    <div
      aria-hidden="true"
      className={`relative shrink-0 ${className}`}
      style={{ width, height, transform: rotate ? `rotate(${rotate}deg)` : undefined, ...style }}
    >
      {(!showPhoto || state === "loading") && (
        <CardFaceArt width={width} radius={radius} color={color ?? faceColor(sid)} name={name} muted={state === "loading" && showPhoto} shadow={shadow} />
      )}
      {showPhoto && (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={(e) => {
            const img = e.currentTarget;
            const next = img.naturalHeight > img.naturalWidth * 1.05 ? "v" : "h";
            orientation.set(url!, next);
            setState(next);
          }}
          onError={() => {
            orientation.set(url!, "fail");
            setState("fail");
          }}
          className={shadow ? "w-card-shadow" : ""}
          style={
            state === "v"
              ? { position: "absolute", left: (width - height) / 2, top: (height - width) / 2, width: height, height: width, objectFit: "contain", transform: "rotate(-90deg)" }
              : { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", opacity: state === "loading" ? 0 : 1 }
          }
        />
      )}
      {badge && (
        <span
          className="w-num absolute z-[2] rounded-full bg-white font-bold text-w-ink"
          style={{ right: Math.round(width * 0.075), top: Math.round(width * 0.075), padding: `${Math.max(1, Math.round(width / 80))}px ${Math.round(width / 23)}px`, fontSize: Math.max(8, Math.round(width / 18)) }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

/** 디자인의 색 카드(사진이 없을 때) */
function CardFaceArt({ width, radius, color, name, muted, shadow }: { width: number; radius: number; color: string; name: string; muted?: boolean; shadow?: boolean }) {
  const pad = Math.round(width * 0.075);
  const big = Math.round(width * 0.9);
  const small = Math.round(width * 0.55);
  const showName = width >= 56;
  return (
    <div
      className="absolute inset-0 flex flex-col justify-between overflow-hidden text-white"
      style={{
        borderRadius: radius,
        background: muted ? "#E8EEFF" : color,
        padding: pad,
        boxShadow: shadow && !muted ? "0 2px 4px rgba(13, 40, 120, 0.12), 0 14px 30px -8px rgba(13, 40, 120, 0.38)" : undefined,
      }}
    >
      {!muted && (
        <>
          <span className="absolute rounded-full" style={{ width: big, height: big, right: -big * 0.42, top: -big * 0.46, background: "rgba(255,255,255,0.14)" }} />
          <span className="absolute rounded-full" style={{ width: small, height: small, right: width * 0.12, bottom: -small * 0.66, background: "rgba(255,255,255,0.09)" }} />
          <span className="relative z-[1]" style={{ width: Math.round(width * 0.15), height: Math.round(width * 0.11), borderRadius: Math.max(2, Math.round(width / 40)), background: "linear-gradient(135deg, #F2F6FF, #B7C8EC)" }} />
          {showName && (
            <span className="relative z-[1] block truncate font-bold leading-tight" style={{ fontSize: Math.max(9, Math.round(width / 13)) }}>
              {name}
            </span>
          )}
        </>
      )}
    </div>
  );
}
