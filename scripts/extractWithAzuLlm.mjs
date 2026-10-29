#!/usr/bin/env node
/**
 * 아주LLM 게이트웨이로 카드 혜택 표를 추출한다(프롬프트 v2, 양식 v0.2).
 *
 * 입력: 1_혜택정보구조화/azu/inputs.jsonl (카드별 원문 텍스트, 추천 영향 큰 순)
 * 출력: 1_혜택정보구조화/extracted_azu/<카드번호>.json   (이미 있으면 건너뜀 → 끊겨도 이어서 실행)
 *       1_혜택정보구조화/extracted_azu/_log.jsonl         (카드별 성공·실패·시간·토큰)
 *       1_혜택정보구조화/extracted_azu/_failed/<번호>.txt (JSON으로 못 읽은 응답 원문)
 *
 * 실행 예
 *   npm run extract:azu -- --pilot              정답표 52장으로 먼저 시험(채점용)
 *   npm run extract:azu -- --limit 200          추천 영향 큰 순으로 200장
 *   npm run extract:azu -- --ids 2070,191       지정한 카드만
 *   npm run extract:azu -- --check              키·주소·모델만 짧게 확인(카드 추출 없음)
 *   npm run extract:azu -- --list-models        게이트웨이에서 쓸 수 있는 모델 이름 목록
 *   npm run extract:azu -- --pilot --model <이름> --out extracted_azu_<이름>   다른 모델로 시범(결과를 따로 저장해 비교)
 *   옵션: --model <이름>  --concurrency 2  --max-tokens 16000  --force(다시 추출)  --dry-run(호출 없이 확인만)
 *
 * 게이트웨이 주소·모델: .env의 VITE_AZU_LLM_BASE_URL, VITE_AZU_LLM_MODEL (또는 --base-url, --model)
 * API 키: 환경변수 AZU_LLM_API_KEY. 없으면 실행할 때 물어본다(화면에 보이지 않게 입력, 파일에 저장하지 않음).
 * 필요한 것: Node 18 이상(추가 설치 없음).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";

const ROOT = path.resolve(import.meta.dirname, "..");
const DS = path.join(ROOT, "1_혜택정보구조화");
// ---------- 옵션 ----------
const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const v = argv[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
};
const flag = (name) => argv.includes(`--${name}`);

// --out: 결과 폴더 이름(1_혜택정보구조화 아래). 모델끼리 비교할 때 다른 폴더에 저장한다
const OUT_DIR = path.join(DS, String(opt("out", "extracted_azu")).replace(/[\\/]+/g, "_"));
const FAIL_DIR = path.join(OUT_DIR, "_failed");
const LOG = path.join(OUT_DIR, "_log.jsonl");

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
const CONCURRENCY = Math.max(1, Number(opt("concurrency", 2)));
const MAX_TOKENS = Number(opt("max-tokens", 16000));
const LIMIT = opt("limit", null) === null ? null : Number(opt("limit", 0));
const IDS = opt("ids", null);
const PILOT = flag("pilot");
const FORCE = flag("force");
const DRY = flag("dry-run");
const CHECK = flag("check");
const LIST_MODELS = flag("list-models");

function die(msg) {
  console.error(`\n[중단] ${msg}`);
  process.exit(1);
}

if (!BASE_URL) die("게이트웨이 주소가 없어요. walletfit-app의 .env를 이 폴더로 복사하거나 --base-url 을 붙여 주세요.");
if (!MODEL) die("모델 이름이 없어요. .env의 VITE_AZU_LLM_MODEL 을 채우거나 --model 을 붙여 주세요.");

// ---------- 입력 ----------
const TEMPLATE = readFileSync(path.join(DS, "prompts/extract_v2.md"), "utf-8");
const SCHEMA = readFileSync(path.join(DS, "schema/card-benefit.schema.json"), "utf-8");
const inputs = readFileSync(path.join(DS, "azu/inputs.jsonl"), "utf-8")
  .split(/\r?\n/)
  .filter(Boolean)
  .map((l) => JSON.parse(l));

let picked;
if (IDS) {
  const want = new Set(String(IDS).split(",").map((s) => Number(s.trim())));
  picked = inputs.filter((x) => want.has(x.sid));
} else if (PILOT) {
  picked = inputs.filter((x) => x.group === "pilot");
} else {
  picked = inputs.filter((x) => x.group === "main");
  if (LIMIT) picked = picked.slice(0, LIMIT);
}
const todo = picked.filter((x) => FORCE || !existsSync(path.join(OUT_DIR, `${x.sid}.json`)));

function buildPrompt(x) {
  return TEMPLATE.replace("{{SCHEMA}}", SCHEMA)
    .replace("{{CARD_INFO}}", JSON.stringify(x.card_info, null, 1))
    .replace("{{RAW}}", x.raw);
}

console.log(`모델 ${MODEL} · 대상 ${picked.length}장 · 이미 있음 ${picked.length - todo.length}장 · 이번에 추출 ${todo.length}장 · 동시 ${CONCURRENCY}개`);
if (DRY) {
  const p = todo[0] ? buildPrompt(todo[0]) : "";
  console.log(`(확인만) 첫 카드 ${todo[0]?.name ?? "-"} 프롬프트 ${p.length.toLocaleString()}자`);
  process.exit(0);
}
if (todo.length === 0 && !CHECK && !LIST_MODELS) process.exit(0);

// ---------- API 키 ----------
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.stdoutMuted = false;
    rl._writeToOutput = function (s) {
      if (rl.stdoutMuted) rl.output.write(s.includes("\n") ? "\n" : "");
      else rl.output.write(s);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer.trim());
    });
    rl.stdoutMuted = true;
  });
}
/** 붙여 넣을 때 섞이기 쉬운 것(앞뒤 공백, 따옴표, 'Bearer ', 보이지 않는 제어 문자)을 지운다 */
function cleanKey(k) {
  return String(k ?? "")
    .replace(/[\u0000-\u001f\u007f\u200b-\u200d\ufeff]/g, "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}
const KEY_FROM_ENV = Boolean(process.env.AZU_LLM_API_KEY?.trim());
const KEY = cleanKey(process.env.AZU_LLM_API_KEY || (await askHidden("아주LLM API 키를 붙여 넣고 Enter (화면에 안 보여요): ")));
if (!KEY) die("API 키가 없어요.");
console.log(`키 ${KEY.length}자를 ${KEY_FROM_ENV ? "환경변수에서" : "입력에서"} 읽었어요.`);

// ---------- 호출 ----------
mkdirSync(FAIL_DIR, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let stopAll = null;
let stopping = false;
process.on("SIGINT", () => {
  if (stopping) process.exit(130);
  stopping = true;
  console.log("\n멈추는 중이에요. 지금 처리 중인 카드까지만 끝내고 멈춰요(한 번 더 누르면 바로 종료).");
});

async function callModel(prompt, maxTokens = MAX_TOKENS) {
  const body = {
    model: MODEL,
    temperature: 0,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: "너는 카드 혜택 원문을 JSON 레코드로 옮기는 작업자다. JSON 객체 하나만 출력한다." },
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
      const detail = (await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 160);
      stopAll =
        `게이트웨이가 키를 거부했어요(${res.status}). 읽은 키는 ${KEY.length}자예요. ` +
        `앱의 카드 상담에서 같은 키로 답이 오는지 확인하거나, 키를 환경변수로 넣어 다시 실행해 보세요(사용법.md 참고).` +
        (detail ? `\n  게이트웨이 메시지: ${detail}` : "");
      throw new Error(stopAll);
    }
    if (res.status === 429 || res.status >= 500) {
      if (attempt >= 6) throw new Error(`게이트웨이 응답 ${res.status}`);
      const wait = Number(res.headers.get("retry-after")) * 1000 || Math.min(60_000, 5000 * 2 ** (attempt - 1));
      console.log(`  (게이트웨이 ${res.status}, ${Math.round(wait / 1000)}초 뒤 다시 시도)`);
      await sleep(wait);
      continue;
    }
    const text = await res.text();
    if (!res.ok) throw new Error(`게이트웨이 응답 ${res.status}: ${text.slice(0, 200)}`);
    const data = JSON.parse(text);
    return { content: data.choices?.[0]?.message?.content ?? "", usage: data.usage ?? {}, finish: data.choices?.[0]?.finish_reason };
  }
}

function parseRecord(content) {
  let s = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("응답에서 JSON을 찾지 못했어요");
  return JSON.parse(s.slice(a, b + 1));
}

let done = 0;
let okCount = 0;
let failCount = 0;
const started = Date.now();

async function work(x) {
  const t0 = Date.now();
  const tag = `[${++done}/${todo.length}] ${x.sid} ${x.name}`;
  let content = "";
  try {
    const r = await callModel(buildPrompt(x));
    content = r.content;
    const rec = parseRecord(content);
    rec.schema_version = rec.schema_version || "0.2";
    rec.card = { ...(rec.card || {}), source_id: x.sid };
    rec.source = { ...(rec.source || {}), url: x.card_info.url, extracted_by: `llm:${MODEL}` };
    writeFileSync(path.join(OUT_DIR, `${x.sid}.json`), JSON.stringify(rec, null, 1));
    okCount++;
    const sec = ((Date.now() - t0) / 1000).toFixed(1);
    const cut = r.finish === "length" ? " (출력 길이 한도에 걸림)" : "";
    console.log(`${tag} 완료 ${sec}초 · 입력 ${r.usage.prompt_tokens ?? "?"} / 출력 ${r.usage.completion_tokens ?? "?"} 토큰${cut}`);
    appendFileSync(LOG, JSON.stringify({ sid: x.sid, ok: true, ms: Date.now() - t0, usage: r.usage, finish: r.finish, model: MODEL, at: new Date().toISOString() }) + "\n");
  } catch (e) {
    failCount++;
    if (content) writeFileSync(path.join(FAIL_DIR, `${x.sid}.txt`), content);
    console.log(`${tag} 실패: ${e.message}`);
    appendFileSync(LOG, JSON.stringify({ sid: x.sid, ok: false, error: e.message, model: MODEL, at: new Date().toISOString() }) + "\n");
  }
}

if (LIST_MODELS) {
  const res = await fetch(`${BASE_URL}/models`, { headers: { Authorization: `Bearer ${KEY}` } });
  const text = await res.text();
  if (!res.ok) die(`모델 목록을 받지 못했어요(${res.status}): ${text.slice(0, 200)}`);
  const ids = (JSON.parse(text).data ?? []).map((m) => m.id).sort();
  console.log(`쓸 수 있는 모델 ${ids.length}개:\n  ${ids.join("\n  ")}`);
  process.exit(0);
}

if (CHECK) {
  try {
    const r = await callModel("연결 확인입니다. {\"ok\": true} 만 출력하세요.", 20);
    console.log(`연결 확인 완료: 모델 ${MODEL}이 응답했어요 (${(r.content || "").slice(0, 40).replace(/\s+/g, " ")})`);
    process.exit(0);
  } catch (e) {
    die(e.message);
  }
}

const queue = [...todo];
await Promise.all(
  Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (queue.length && !stopAll && !stopping) await work(queue.shift());
  }),
);
const min = ((Date.now() - started) / 60000).toFixed(1);
console.log(`\n끝났어요: 성공 ${okCount}장, 실패 ${failCount}장, ${min}분. 결과 폴더: ${path.relative(ROOT, OUT_DIR)}`);
if (stopAll) die(stopAll);
if (failCount) console.log("실패한 카드는 같은 명령을 다시 실행하면 그 카드만 다시 시도해요.");
