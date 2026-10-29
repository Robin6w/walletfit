#!/usr/bin/env node
/**
 * 아주LLM 게이트웨이로 혜택 표를 '쪼개서' 추출한다(프롬프트 v3).
 *   1단계 카드 공통 규칙(카드당 1번) → 2단계 혜택 영역마다 1번. 조립은 v3/v3.py assemble 이 한다.
 *
 * 입력: 1_혜택정보구조화/v3/inputs_eval52.jsonl (preprocess.py 결과)
 * 출력: 1_혜택정보구조화/v3/out_<모델>/<카드번호>/card.json, sec_<번호>.json   (이미 있으면 건너뜀 → 끊겨도 이어서)
 *       1_혜택정보구조화/v3/out_<모델>/_log.jsonl, _failed/
 *
 * 실행 예 (walletfit-ds 폴더에서)
 *   node scripts/extractV3WithAzuLlm.mjs --check                 키·주소·모델 확인
 *   node scripts/extractV3WithAzuLlm.mjs --list-models           쓸 수 있는 모델 목록
 *   node scripts/extractV3WithAzuLlm.mjs --ids 51,650            지정 카드만
 *   node scripts/extractV3WithAzuLlm.mjs                         inputs 파일의 카드 전부
 *   node scripts/extractV3WithAzuLlm.mjs --model <이름>          다른 모델(결과 폴더가 모델 이름별로 따로 생김)
 *   옵션: --inputs <파일>  --rules c1(카테고리 관례 추가)  --concurrency 2  --max-tokens 8000  --force  --dry-run
 *
 * 게이트웨이 주소·모델: .env의 VITE_AZU_LLM_BASE_URL, VITE_AZU_LLM_MODEL. API 키: 환경변수 AZU_LLM_API_KEY(없으면 물어봄)
 * 필요한 것: Node 18 이상(추가 설치 없음).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";

const ROOT = path.resolve(import.meta.dirname, "..");
const V3 = path.join(ROOT, "1_혜택정보구조화", "v3");
const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const v = argv[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
};
const flag = (name) => argv.includes(`--${name}`);

function readEnvFile() {
  const p = path.join(ROOT, ".env");
  if (!existsSync(p)) return {};
  const env = {};
  for (const line of readFileSync(p, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}
const ENV = readEnvFile();
const BASE_URL = String(opt("base-url", ENV.VITE_AZU_LLM_BASE_URL || "")).replace(/\/$/, "");
const MODEL = String(opt("model", ENV.VITE_AZU_LLM_MODEL || ""));
const RULES = opt("rules", null);
const CONCURRENCY = Math.max(1, Number(opt("concurrency", 2)));
const MAX_TOKENS = Number(opt("max-tokens", 8000));
const INPUTS = path.resolve(V3, String(opt("inputs", "inputs_eval52.jsonl")));
const IDS = opt("ids", null);
const FORCE = flag("force");
const DRY = flag("dry-run");
const OUT = path.join(V3, `out_${MODEL.replace(/[^A-Za-z0-9._-]+/g, "_")}${RULES ? `_${RULES}` : ""}`);
const LOG = path.join(OUT, "_log.jsonl");
const FAIL = path.join(OUT, "_failed");

const die = (m) => {
  console.error(`\n[중단] ${m}`);
  process.exit(1);
};
if (!BASE_URL) die("게이트웨이 주소가 없어요. walletfit-app의 .env를 이 폴더로 복사하거나 --base-url 을 붙여 주세요.");
if (!MODEL) die("모델 이름이 없어요. .env의 VITE_AZU_LLM_MODEL 을 채우거나 --model 을 붙여 주세요.");

// ---------- 프롬프트 (v3.py와 같은 규칙) ----------
const CARD_T = readFileSync(path.join(V3, "prompts", "card.md"), "utf-8");
const SEC_T = readFileSync(path.join(V3, "prompts", "section.md"), "utf-8");
const C1_RULES = readFileSync(path.join(V3, "prompts", "c1_rules.md"), "utf-8");
const inputs = readFileSync(INPUTS, "utf-8").split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));

function cardPrompt(x) {
  const secs = x.sections.map((s) => `${s.i}. [${s.title}] ${s.comment}`.trimEnd()).join("\n") || "(없음)";
  const titles = Object.fromEntries(x.sections.map((s) => [s.i, s.title]));
  const rules =
    x.rule_lines
      .map((r) => {
        const where = `(${r.sections.map((i) => `영역 ${i} ${titles[i] ?? ""}`.trimEnd()).join(", ")})`;
        return r.line.includes("\n") ? `- ${where}\n${r.line}` : `- ${r.line}  ${where}`;
      })
      .join("\n") || "(없음)";
  return CARD_T.replace("{{CARD_INFO}}", JSON.stringify(x.card_info))
    .replace("{{SECTION_LIST}}", secs)
    .replace("{{RULE_LINES}}", rules)
    .replace("{{NOTES}}", x.notes || "(없음)");
}
function cardRulesText(card) {
  const p = card.performance || {};
  return JSON.stringify({
    "전월실적 기준": p.basis ?? null,
    구간: p.tiers || [],
    "통합 한도": (card.shared_caps || []).map((c) => ({ label: c.label, period: c.period, by_tier: c.by_tier, sections: c.sections })),
    "실적 제외 카테고리": p.excluded_app_categories || [],
  });
}
function sectionPrompt(x, s, card) {
  const title = `${s.i}. [${s.title}] ${s.comment}`.trimEnd();
  return SEC_T.replace("{{EXTRA_RULES}}", RULES === "c1" ? C1_RULES : "")
    .replace("{{CARD_RULES}}", cardRulesText(card))
    .replace("{{SECTION_TITLE}}", title)
    .replace("{{SECTION_TEXT}}", s.text || "(없음)");
}

let picked = inputs;
if (IDS) {
  const want = new Set(String(IDS).split(",").map((v) => Number(v.trim())));
  picked = inputs.filter((x) => want.has(x.sid));
}
const totalCalls = picked.reduce((n, x) => n + 1 + x.sections.length, 0);
console.log(`모델 ${MODEL} · 카드 ${picked.length}장 · 호출 최대 ${totalCalls}번 · 결과 ${path.relative(ROOT, OUT)}`);
if (DRY) {
  const x = picked[0];
  if (x) console.log(`(확인만) ${x.name}: 카드 프롬프트 ${cardPrompt(x).length.toLocaleString()}자, 영역 ${x.sections.length}개`);
  process.exit(0);
}

// ---------- API 키 ----------
function askHidden(q) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.stdoutMuted = false;
    rl._writeToOutput = function (s) {
      if (rl.stdoutMuted) rl.output.write(s.includes("\n") ? "\n" : "");
      else rl.output.write(s);
    };
    rl.question(q, (a) => {
      rl.close();
      process.stdout.write("\n");
      resolve(a.trim());
    });
    rl.stdoutMuted = true;
  });
}
const cleanKey = (k) =>
  String(k ?? "")
    .replace(/[\u0000-\u001f\u007f​-‍﻿]/g, "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/^Bearer\s+/i, "")
    .trim();
const KEY = cleanKey(process.env.AZU_LLM_API_KEY || (await askHidden("아주LLM API 키를 붙여 넣고 Enter (화면에 안 보여요): ")));
if (!KEY) die("API 키가 없어요.");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let stopAll = null;
async function callModel(prompt, maxTokens = MAX_TOKENS) {
  const body = {
    model: MODEL,
    temperature: 0,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: "너는 카드 혜택 원문을 JSON으로 옮기는 작업자다. JSON 객체 하나만 출력한다." },
      { role: "user", content: prompt },
    ],
  };
  for (let attempt = 1; ; attempt++) {
    let res;
    try {
      res = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(300_000),
      });
    } catch (e) {
      if (attempt >= 4) throw new Error(`연결 실패: ${e.message}`);
      await sleep(3000 * attempt);
      continue;
    }
    if (res.status === 401 || res.status === 403) {
      stopAll = `게이트웨이가 키를 거부했어요(${res.status}). azu/사용법.md의 '키가 거부될 때'를 참고하세요.`;
      throw new Error(stopAll);
    }
    if (res.status === 429 || res.status >= 500) {
      if (attempt >= 6) throw new Error(`게이트웨이 응답 ${res.status}`);
      const wait = Number(res.headers.get("retry-after")) * 1000 || Math.min(60_000, 5000 * 2 ** (attempt - 1));
      await sleep(wait);
      continue;
    }
    const text = await res.text();
    if (!res.ok) throw new Error(`게이트웨이 응답 ${res.status}: ${text.slice(0, 200)}`);
    const data = JSON.parse(text);
    return { content: data.choices?.[0]?.message?.content ?? "", usage: data.usage ?? {}, finish: data.choices?.[0]?.finish_reason };
  }
}
/** 응답에서 JSON 객체를 꺼낸다. 중간에 '}'가 하나 더 찍힌 경우 오류 위치 앞의 '}'를 지워 다시 읽는다(최대 20번) */
function parseJson(content) {
  let s = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("응답에서 JSON을 찾지 못했어요");
  s = s.slice(a, b + 1);
  for (let k = 0; k < 20; k++) {
    try {
      return JSON.parse(s);
    } catch (e) {
      const m = String(e.message).match(/position (\d+)/);
      if (!m) throw e;
      const pos = Number(m[1]);
      const cut = s.lastIndexOf("}", pos);
      if (cut < 0) throw e;
      s = s.slice(0, cut) + s.slice(cut + 1);
    }
  }
  throw new Error("JSON을 고치지 못했어요");
}

mkdirSync(FAIL, { recursive: true });
async function step(file, prompt, tag) {
  if (!FORCE && existsSync(file)) return JSON.parse(readFileSync(file, "utf-8"));
  const t0 = Date.now();
  let content = "";
  try {
    const r = await callModel(prompt);
    content = r.content;
    const obj = parseJson(content);
    writeFileSync(file, JSON.stringify(obj, null, 1));
    appendFileSync(LOG, JSON.stringify({ tag, ok: true, ms: Date.now() - t0, usage: r.usage, finish: r.finish, model: MODEL, at: new Date().toISOString() }) + "\n");
    return obj;
  } catch (e) {
    if (content) writeFileSync(path.join(FAIL, `${tag.replace(/[^\w.-]+/g, "_")}.txt`), content);
    appendFileSync(LOG, JSON.stringify({ tag, ok: false, error: e.message, model: MODEL, at: new Date().toISOString() }) + "\n");
    throw e;
  }
}

let done = 0;
async function work(x) {
  const dir = path.join(OUT, String(x.sid));
  mkdirSync(dir, { recursive: true });
  const tag = `[${++done}/${picked.length}] ${x.sid} ${x.name}`;
  try {
    const card = await step(path.join(dir, "card.json"), cardPrompt(x), `${x.sid}_card`);
    let fails = 0;
    for (const s of x.sections) {
      try {
        await step(path.join(dir, `sec_${s.i}.json`), sectionPrompt(x, s, card), `${x.sid}_sec_${s.i}`);
      } catch (e) {
        if (stopAll) throw e;
        fails++;
      }
    }
    console.log(`${tag} 완료${fails ? ` (영역 ${fails}개 실패 → 다시 실행하면 그 영역만 재시도)` : ""}`);
  } catch (e) {
    console.log(`${tag} 실패: ${e.message}`);
  }
}

if (flag("list-models")) {
  const res = await fetch(`${BASE_URL}/models`, { headers: { Authorization: `Bearer ${KEY}` } });
  const text = await res.text();
  if (!res.ok) die(`모델 목록을 받지 못했어요(${res.status}): ${text.slice(0, 200)}`);
  console.log((JSON.parse(text).data ?? []).map((m) => m.id).sort().join("\n"));
  process.exit(0);
}
if (flag("check")) {
  try {
    const r = await callModel('연결 확인입니다. {"ok": true} 만 출력하세요.', 20);
    console.log(`연결 확인 완료: ${MODEL} 응답 (${(r.content || "").slice(0, 40)})`);
    process.exit(0);
  } catch (e) {
    die(e.message);
  }
}
const queue = [...picked];
await Promise.all(
  Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (queue.length && !stopAll) await work(queue.shift());
  }),
);
if (stopAll) die(stopAll);
console.log(`\n끝났어요. 조립: python 1_혜택정보구조화/v3/v3.py assemble 1_혜택정보구조화/v3/${path.basename(INPUTS)} ${path.relative(ROOT, OUT)} --model ${MODEL}\n점검·채점 명령은 1_혜택정보구조화/v3/README.md 4번을 보세요.`);
