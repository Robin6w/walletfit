import { shortName } from "@/v1/ui";
import { catLabel } from "@/v1/catalog";

/**
 * 화면 문장에 쓰는 도우미(조사·금액·카드 이름). 계산은 하지 않는다.
 * 2026-10-28 v2 결과·지갑 화면용
 */

type Final = "none" | "rieul" | "other";

/** 영문 글자를 한국어로 읽었을 때 받침: L(엘)·R(알)=ㄹ, M(엠)·N(엔)=다른 받침, 나머지는 받침 없음 */
const LATIN: Record<string, Final> = { l: "rieul", r: "rieul", m: "other", n: "other" };
/** 숫자 읽기: 0 영, 1 일, 3 삼, 6 육, 7 칠, 8 팔 */
const DIGIT: Record<string, Final> = { "0": "other", "1": "rieul", "3": "other", "6": "other", "7": "rieul", "8": "rieul" };

/**
 * 영문 낱말 끝의 받침(2026-10-29).
 *  - 대문자 4자 이하는 약어로 보고 글자 이름으로 읽는다: TEN(엔)·ON(엔)=받침, SSG(지)·KB(비)=없음
 *  - 그 밖에는 낱말로 읽는다: BAZIC(직)·Black(랙)·Deep(딥)=받침, Prime(임)·Zone(존)=받침, Life(프)·Card(드)·Point(트)=없음
 */
function latinWordFinal(run: string): Final {
  const w = run.toLowerCase();
  const last = w[w.length - 1];
  if (run === run.toUpperCase() && run.length <= 4) return LATIN[last] ?? "none";
  if (last === "e" && w.length > 1) {
    const prev = w[w.length - 2];
    return prev === "m" || prev === "n" ? "other" : prev === "l" ? "rieul" : "none";
  }
  if (last === "l") return "rieul";
  if (last === "m" || last === "n") return "other";
  if (last === "g" && w[w.length - 2] === "n") return "other";
  let i = w.length - 1;
  if (last === "k" && w[i - 1] === "c") i--;
  if ("bcgkpt".includes(last)) return i > 0 && "aeiou".includes(w[i - 1]) ? "other" : "none";
  return "none";
}

/** 낱말 끝 글자의 받침 종류. 괄호·따옴표·공백은 건너뛴다 */
export function finalOf(word: string): Final {
  const chars = Array.from(word.trim());
  for (let i = chars.length - 1; i >= 0; i--) {
    const ch = chars[i];
    if (/[\s)\]}'"’”」』.,!?~·-]/.test(ch)) continue;
    const code = ch.codePointAt(0)!;
    if (code >= 0xac00 && code <= 0xd7a3) {
      const jong = (code - 0xac00) % 28;
      return jong === 0 ? "none" : jong === 8 ? "rieul" : "other";
    }
    if (/[0-9]/.test(ch)) return DIGIT[ch] ?? "none";
    if (/[a-zA-Z]/.test(ch)) {
      let j = i;
      while (j > 0 && /[a-zA-Z]/.test(chars[j - 1])) j--;
      return latinWordFinal(chars.slice(j, i + 1).join(""));
    }
    if (ch === "%") return "none"; // 퍼센트
    if (ch === "Ⅰ") return "other"; // 원
    return "none";
  }
  return "none";
}

export type JosaKind = "을/를" | "이/가" | "은/는" | "으로/로" | "과/와" | "이에요/예요" | "이라/라";

/** 낱말에 맞는 조사를 붙인다. 예: josa('D4', '을/를') → 'D4를', josa('iD ON', '으로/로') → 'iD ON으로' */
export function josa(word: string, kind: JosaKind): string {
  const f = finalOf(word);
  const has = f !== "none";
  switch (kind) {
    case "을/를":
      return word + (has ? "을" : "를");
    case "이/가":
      return word + (has ? "이" : "가");
    case "은/는":
      return word + (has ? "은" : "는");
    case "과/와":
      return word + (has ? "과" : "와");
    case "으로/로":
      return word + (f === "other" ? "으로" : "로");
    case "이에요/예요":
      return word + (has ? "이에요" : "예요");
    case "이라/라":
      return word + (has ? "이라" : "라");
  }
}

function n(v: number): string {
  return Math.round(v).toLocaleString("ko-KR");
}

/**
 * 백 원 단위까지 한글 단위로: 4만 9천 5백원 / 8만원 / 3천 3백원.
 * 1천원 미만은 원 단위 그대로(390원)
 */
export function korWonDetail(value: number): string {
  if (Math.abs(value) < 1000) return `${n(value)}원`;
  const v = Math.round(value / 100) * 100;
  const sign = v < 0 ? "-" : "";
  const a = Math.abs(v);
  const man = Math.floor(a / 10000);
  const cheon = Math.floor((a % 10000) / 1000);
  const baek = Math.round((a % 1000) / 100);
  const parts = [man ? `${man.toLocaleString("ko-KR")}만` : "", cheon ? `${cheon}천` : "", baek ? `${baek}백` : ""].filter(Boolean);
  return `${sign}${parts.join(" ")}원`;
}

/** 천 원 단위, '원' 없이: 7만 2천 / 9천 / 12만 (명세서 금액 나열용) */
export function korAmount(value: number): string {
  const v = Math.round(value / 1000) * 1000;
  if (v === 0) return `${n(value)}원`;
  const man = Math.floor(v / 10000);
  const cheon = Math.round((v % 10000) / 1000);
  if (man === 0) return `${cheon}천`;
  return `${man.toLocaleString("ko-KR")}만${cheon ? ` ${cheon}천` : ""}`;
}

/** 비율: 55% / 3.3% / 0.7% */
export function pctText(x: number): string {
  const p = x * 100;
  const r = Math.round(p * 10) / 10;
  return `${Number.isInteger(r) ? r : r.toFixed(1)}%`;
}

/** 금액 차이: +10원 / −1천 3백원 / 차이 없음 */
export function deltaText(d: number): string {
  if (Math.abs(d) < 5) return "차이 없음";
  return `${d > 0 ? "+" : "−"}${korWonDetail(Math.abs(d))}`;
}

/** 화면용 카드 이름(카드사 접두어·'카드' 접미어를 뺀 이름): taptap O, D4카드의정석Ⅱ, iD ON */
export function cardShort(name: string): string {
  const s = shortName(name) || name;
  // '럭키 유카드', '꿀카드'처럼 '카드'를 떼면 한 글자만 남는 이름은 '카드'를 그대로 둔다
  const last = s.split(" ").pop() ?? "";
  if (Array.from(last).length <= 1 && /\S카드$/.test(name)) return `${s}카드`;
  return s;
}

/**
 * 문장 속 카드 별칭: 'D4카드의정석Ⅱ' → 'D4', '카드의정석 TEN' → 'TEN', 나머지는 짧은 이름
 */
export function cardNick(name: string): string {
  const s = cardShort(name);
  const head = s.match(/^(\S+?)카드의정석/);
  if (head) return head[1];
  const tail = s.match(/카드의정석\s+(\S+)/);
  if (tail) return tail[1];
  return s;
}

const KOR_COUNT = ["", "한", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉", "열"];
/** 두 카드, 세 혜택 */
export function countWord(k: number): string {
  return KOR_COUNT[k] ?? String(k);
}

/** 문장에 쓰는 짧은 카테고리 이름(카페, 마트) */
const CAT_SHORT: Record<string, string> = {
  cafe: "카페",
  mart: "마트",
  culture: "문화·OTT",
  car: "자동차",
  education: "교육",
  beautyFitness: "뷰티",
  department: "백화점",
  etc: "그 밖의 결제",
};
export function catShort(cat: string): string {
  return CAT_SHORT[cat] ?? catLabel(cat);
}

/** '카페·편의점' 식으로 잇기 */
export function joinDot(items: string[]): string {
  return items.filter(Boolean).join("·");
}
