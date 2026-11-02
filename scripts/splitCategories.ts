/**
 * 성격이 다른 소비가 섞인 카테고리 3개를 나눈다(2026-10-31). 엔진은 업종 혜택을 카테고리 지출 전체에 적용하므로,
 * 한 카테고리에 섞여 있으면 한쪽 혜택이 다른 쪽 소비에도 붙는다(예: '영화 업종 10%'가 ChatGPT 결제에, '철도 5천원 할인'이 호텔 결제에).
 *
 *   culture    → culture(영화/공연)  + subscription(OTT/구독: 넷플릭스·유튜브·ChatGPT·멜론 …)
 *   travel     → travel(여행/숙박)   + intercity(기차/고속버스: KTX·SRT·코레일·고속/시외버스)
 *   transport  → 철도만 주는 혜택('KTX/SRT 10% 할인')도 intercity로
 *   department → department(백화점/아울렛) + fashion(의류/패션: 유니클로·자라·H&M …)
 *
 * 옮기는 기준: 혜택의 가맹점(scope.merchants)이 모두 새 카테고리 것일 때. 가맹점이 없는 업종 혜택은 제목으로 본다.
 * 원래 카테고리 것과 섞인 혜택('여가 2%(항공/면세점/철도/공연)')은 옮기지 않는다(혜택 하나는 카테고리 하나).
 * 실적 제외 카테고리에 원래 카테고리가 있으면 새 카테고리도 같이 뺀다.
 *
 * 실행: npx tsx scripts/splitCategories.ts [--dry]   (npm run build:benefit 끝에서도 부른다)
 * 근거 숫자는 tests/splitCategories.test.ts와 이 파일 아래 main의 출력으로 확인한다.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildCardView } from "./buildCardView";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rec = Record<string, any>;

interface Rule {
  /** 원래 카테고리. null은 카테고리가 비어 있는 혜택(가맹점이 모두 새 카테고리 것일 때만 옮긴다) */
  from: (string | null)[];
  to: string;
  /** 새 카테고리 가맹점(구체적인 이름만. '구독'처럼 일반 낱말은 title에) */
  merchant: RegExp;
  /** 가맹점이 없는 업종 혜택의 제목에서 더 찾을 낱말 */
  title?: RegExp;
  /** 원래 카테고리에 남겨야 하는 것(섞여 있으면 옮기지 않는다) */
  stay: RegExp;
}

export const SPLIT_RULES: Rule[] = [
  {
    // 카테고리가 빈 혜택: 'AI 구독 50% 적립 [ChatGPT, Claude, Perplexity]' 등은 카테고리가 없어 엔진이 계산하지 못했다
    from: ["culture", null],
    to: "subscription",
    merchant:
      /넷플릭스|netflix|유튜브|youtube|티빙|tving|웨이브|wavve|왓챠|watcha|디즈니|disney|쿠팡\s*플레이|멜론|melon|지니\s*뮤직|^지니$|^FLO$|^플로$|^벅스$|벅스\s*뮤직|스포티파이|spotify|애플\s*(뮤직|tv)|apple\s*(music|tv)|밀리의\s*서재|리디|윌라|ChatGPT|OpenAI|챗\s*GPT|Claude|클로드|Perplexity|퍼플렉시티|Grok|Gemini|제미나이|Google\s*One|구글\s*원|Copilot|코파일럿|Midjourney|미드저니|웹툰|카카오페이지|네이버\s*시리즈|라프텔/i,
    title: /구독|정기\s*결제|디지털\s*콘텐츠|OTT|스트리밍/i,
    // '스타벅스'(벅스), 보험·가전 렌탈 구독료, 쇼핑 멤버십 구독료는 OTT/구독이 아니다
    stay: /영화|CGV|메가박스|롯데시네마|씨네|공연|티켓|뮤지컬|전시|놀이공원|테마파크|에버랜드|롯데월드|NOL|인터파크|예스24|YES24|극장|박물관|미술관|스포츠|야구|축구|스타벅스|보험|전기|요금|렌탈|LG전자|인텔릭스|코웨이|멤버십|멤버스|스마일클럽|와우/i,
  },
  {
    from: ["travel", "transport"],
    to: "intercity",
    merchant: /KTX|SRT|코레일|korail|레츠코레일|한국철도|^철도|철도\b|고속\s*철도|고속\s*버스|시외\s*버스|버스타고|코버스|KOBUS|고속버스\s*터미널|^기차|기차/i,
    stay: /호텔|숙박|항공|면세|여행|리조트|콘도|투어|렌터카|렌트카|쏘카|그린카|여객선|공항|지하철|시내\s*버스|마을\s*버스|광역|택시|따릉이|킥보드|공유|모빌리티|주유|충전/i,
  },
  {
    from: ["department"],
    to: "fashion",
    merchant:
      /유니클로|uniqlo|^자라$|ZARA|H&M|에이치앤엠|탑텐|스파오|SPAO|에잇세컨즈|8\s*seconds|^COS$|미쏘|후아유|폴햄|지오다노|나이키|아디다스|뉴발란스|휠라|FILA|ABC\s*마트|슈마커|의류|패션|잡화|신발/i,
    stay: /백화점|아울렛|몰|스타필드|갤러리아|AK\s*플라자|NC|면세|쇼핑|문화센터|관계사|그룹|멤버스|요식|외식/i,
  },
];

/** 혜택 하나의 새 카테고리(옮기지 않으면 null) */
export function splitTarget(b: Rec): string | null {
  const sc = b.scope ?? {};
  const merchants: string[] = (sc.merchants ?? []).map((m: string) => String(m).trim()).filter(Boolean);
  for (const r of SPLIT_RULES) {
    const from = sc.app_category ?? null;
    if (!r.from.includes(from)) continue;
    // 카테고리가 빈 혜택은 가맹점이 적힌 브랜드·가맹점 묶음 혜택만(제목만 보고 옮기지 않는다)
    if (from === null && (!merchants.length || !["brand", "merchant_group"].includes(sc.specificity))) continue;
    if (merchants.length) {
      if (merchants.every((m) => r.merchant.test(m) && !r.stay.test(m))) return r.to;
    } else {
      const title = String(b.title ?? "");
      if ((r.merchant.test(title) || r.title?.test(title)) && !r.stay.test(title)) return r.to;
    }
  }
  return null;
}

/** 카드 혜택 표들을 나눈다(제자리에서 바꾼다). 옮긴 혜택 수를 새 카테고리별로 돌려준다 */
export function splitCategories(cards: { record: Rec }[]): Record<string, number> {
  const moved: Record<string, number> = {};
  for (const c of cards) {
    for (const b of c.record.benefits ?? []) {
      const to = splitTarget(b);
      if (!to) continue;
      b.scope.app_category = to;
      moved[to] = (moved[to] ?? 0) + 1;
    }
    const ex: string[] | undefined = c.record.performance?.excluded_app_categories;
    if (ex?.length) {
      for (const r of SPLIT_RULES) if (r.from.some((f) => ex.includes(f)) && !ex.includes(r.to)) ex.push(r.to);
    }
  }
  return moved;
}

function main() {
  const ROOT = path.resolve(import.meta.dirname, "..");
  const file = path.join(ROOT, "data/catalog/cards-benefit.json");
  const data = JSON.parse(readFileSync(file, "utf-8")) as { generatedAt: string; cards: { sid: number; status: string; record: Rec }[] };
  const dry = process.argv.includes("--dry");
  if (dry) {
    for (const c of data.cards) {
      if (c.record.card?.discontinued) continue;
      for (const b of c.record.benefits ?? []) {
        const to = splitTarget(b);
        if (to) console.log(`${to}\t${b.scope.app_category}\t${c.record.card.name} :: ${b.title} :: ${(b.scope.merchants ?? []).join(",").slice(0, 60)}`);
      }
    }
    return;
  }
  const moved = splitCategories(data.cards);
  writeFileSync(file, JSON.stringify(data));
  writeFileSync(path.join(ROOT, "data/catalog/card-view.json"), JSON.stringify(buildCardView(data.cards, data.generatedAt)));
  console.log("카테고리 나누기:", moved);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) main();
