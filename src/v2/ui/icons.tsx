import type { ReactNode, SVGProps } from "react";
import { Building2, Car, Dumbbell, Film, Flag, GraduationCap, Globe, PawPrint, Store } from "lucide-react";

/**
 * 카테고리 아이콘. 디자인(양준서 페이지)에 그려진 8개는 원본 도형과 색을 그대로 쓰고,
 * 디자인에 없는 카테고리는 lucide 아이콘에 같은 계열 색을 쓴다.
 */
interface CatIcon {
  bg: string;
  fg: string;
  draw?: ReactNode;
  lucide?: typeof Film;
}

const CAT_ICONS: Record<string, CatIcon> = {
  convenience: {
    bg: "#E3F1FF",
    fg: "#1170D9",
    draw: (
      <>
        <path d="M4 9 5.5 4h13L20 9" />
        <path d="M4 9h16v11H4z" />
        <path d="M9 20v-6h6v6" />
      </>
    ),
  },
  cafe: {
    bg: "#E8EEFF",
    fg: "#2457F5",
    draw: (
      <>
        <path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" />
        <path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17" />
        <path d="M8 3v2M12 3v2" />
      </>
    ),
  },
  transport: {
    bg: "#E6EAF5",
    fg: "#0E1F5C",
    draw: (
      <>
        <rect x="5" y="3" width="14" height="15" rx="3" />
        <path d="M5 11h14" />
        <path d="M8 21v-3M16 21v-3" />
      </>
    ),
  },
  mobile: {
    bg: "#E6F1FF",
    fg: "#2F7FF0",
    draw: (
      <>
        <rect x="7" y="3" width="10" height="18" rx="2.5" />
        <path d="M11 18h2" />
      </>
    ),
  },
  onlineShopping: {
    bg: "#ECEBFB",
    fg: "#4338CA",
    draw: (
      <>
        <path d="M5 8h14l-1 12H6z" />
        <path d="M9 8a3 3 0 0 1 6 0" />
      </>
    ),
  },
  mart: {
    bg: "#E5EBFA",
    fg: "#1C3FAA",
    draw: (
      <>
        <circle cx="9" cy="20" r="1.4" />
        <circle cx="17" cy="20" r="1.4" />
        <path d="M3 4h2l2.4 11h11l2-8H6.2" />
      </>
    ),
  },
  dining: {
    bg: "#E7EEFC",
    fg: "#3E6FD8",
    draw: (
      <>
        <path d="M7 3v8a2 2 0 0 0 2 2v8" />
        <path d="M11 3v8a2 2 0 0 1-2 2" />
        <path d="M17 21V3c-2 1-3 3.5-3 7h3" />
      </>
    ),
  },
  gas: {
    bg: "#EDF1F8",
    fg: "#4D5F88",
    draw: (
      <>
        <path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16" />
        <path d="M4 21h12" />
        <path d="M8 8h4" />
        <path d="m15 9 3 3v6a1.5 1.5 0 0 0 3 0V9l-3-3" />
      </>
    ),
  },
  culture: { bg: "#ECEBFB", fg: "#4338CA", lucide: Film },
  car: { bg: "#EDF1F8", fg: "#4D5F88", lucide: Car },
  pet: { bg: "#E7EEFC", fg: "#3E6FD8", lucide: PawPrint },
  education: { bg: "#E5EBFA", fg: "#1C3FAA", lucide: GraduationCap },
  beautyFitness: { bg: "#E6F1FF", fg: "#2F7FF0", lucide: Dumbbell },
  golf: { bg: "#E3F1FF", fg: "#1170D9", lucide: Flag },
  department: { bg: "#E8EEFF", fg: "#2457F5", lucide: Building2 },
  etc: { bg: "#EDF1F8", fg: "#4D5F88", lucide: Store },
  overseas: { bg: "#E6EAF5", fg: "#0E1F5C", lucide: Globe },
  // 디자인의 '그 밖의 지출' 아이콘(점 세 개)
  other: {
    bg: "#EEF1F8",
    fg: "#5E6D96",
    draw: (
      <>
        <circle cx="6" cy="12" r="1.3" />
        <circle cx="12" cy="12" r="1.3" />
        <circle cx="18" cy="12" r="1.3" />
      </>
    ),
  },
};

export function catIconColors(cat: string): { bg: string; fg: string } {
  const c = CAT_ICONS[cat] ?? CAT_ICONS.other;
  return { bg: c.bg, fg: c.fg };
}

/** 둥근 네모 안의 카테고리 아이콘. size = 바깥 상자 크기(px) */
export function CategoryIcon({ cat, size = 40, radius, glyph: glyphSize }: { cat: string; size?: number; radius?: number; glyph?: number }) {
  const c = CAT_ICONS[cat] ?? CAT_ICONS.other;
  const glyph = glyphSize ?? Math.round(size * 0.5);
  const Lucide = c.lucide;
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center"
      style={{ width: size, height: size, borderRadius: radius ?? Math.round(size / 3), background: c.bg, color: c.fg }}
    >
      {Lucide ? (
        <Lucide width={glyph} height={glyph} strokeWidth={2} />
      ) : (
        <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          {c.draw}
        </svg>
      )}
    </span>
  );
}

/** 디자인의 말풍선 아이콘(카드 상담) */
export function ChatBubbleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
    </svg>
  );
}

/** 배경 없이 그림만(혜택으로 찾기 칩 등). 색은 글자색을 따른다 */
export function CategoryGlyph({ cat, size = 16 }: { cat: string; size?: number }) {
  const c = CAT_ICONS[cat] ?? CAT_ICONS.other;
  const Lucide = c.lucide;
  return Lucide ? (
    <Lucide width={size} height={size} strokeWidth={2} aria-hidden="true" />
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {c.draw}
    </svg>
  );
}

/**
 * 카드 비교·혜택별 추천 화면(디자인 F-D-Compare·F-D-Benefit)의 카테고리 도형과 색.
 * 같은 디자인이라도 이 두 화면은 통신비·외식·주유·대형마트 도형이 위 CAT_ICONS와 조금 다르다.
 */
const BAG = (
  <>
    <path d="M5 8h14l-1 12H6z" />
    <path d="M9 8a3 3 0 0 1 6 0" />
  </>
);
const PAGE_ICONS: Record<string, { bg: string; fg: string; draw: ReactNode }> = {
  cafe: { bg: "#E8EEFF", fg: "#2457F5", draw: CAT_ICONS.cafe.draw },
  convenience: { bg: "#E3F1FF", fg: "#1170D9", draw: CAT_ICONS.convenience.draw },
  transport: { bg: "#E6EAF5", fg: "#0E1F5C", draw: CAT_ICONS.transport.draw },
  mobile: {
    bg: "#E7EEFC",
    fg: "#3E6FD8",
    draw: (
      <>
        <rect x="7" y="2" width="10" height="20" rx="2.5" />
        <path d="M11 18h2" />
      </>
    ),
  },
  dining: {
    bg: "#EAF3FB",
    fg: "#1C3FAA",
    draw: (
      <>
        <path d="M7 3v8a2 2 0 0 0 4 0V3" />
        <path d="M9 11v10" />
        <path d="M16 3c-1.7 1.4-2 3.6-2 6s1 3 2 3v9" />
      </>
    ),
  },
  onlineShopping: { bg: "#ECEBFB", fg: "#4338CA", draw: BAG },
  mart: { bg: CAT_ICONS.mart.bg, fg: CAT_ICONS.mart.fg, draw: BAG },
  gas: {
    bg: "#EEF1F8",
    fg: "#4D5F88",
    draw: (
      <>
        <path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16" />
        <path d="M3 21h13" />
        <path d="M7 8h5" />
        <path d="M15 10h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V9l-3-3" />
      </>
    ),
  },
  culture: {
    bg: "#EEF1F8",
    fg: "#4D5F88",
    draw: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M7 5v14M17 5v14M3 9.5h4M3 14.5h4M17 9.5h4M17 14.5h4" />
      </>
    ),
  },
  overseas: {
    bg: "#EEF1F8",
    fg: "#4D5F88",
    draw: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18" />
      </>
    ),
  },
};

/** 비교·혜택별 추천 화면의 카테고리 그림(색은 글자색). 디자인에 없는 카테고리는 앱 공통 그림 */
export function PageGlyph({ cat, size = 16 }: { cat: string; size?: number }) {
  const own = PAGE_ICONS[cat];
  if (!own) return <CategoryGlyph cat={cat} size={size} />;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {own.draw}
    </svg>
  );
}

/** 비교 표의 둥근 네모 아이콘(36px) */
export function PageIconBox({ cat, size = 36, radius = 12, glyph = 18 }: { cat: string; size?: number; radius?: number; glyph?: number }) {
  const c = PAGE_ICONS[cat] ?? catIconColors(cat);
  return (
    <span aria-hidden="true" style={{ flexShrink: 0, width: size, height: size, borderRadius: radius, background: c.bg, color: c.fg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <PageGlyph cat={cat} size={glyph} />
    </span>
  );
}
