# 챗봇 변경 기록 (통합용)

> 이 파일은 나중에 다른 조원 폴더/브랜치와 합칠 때 사람이나 AI가 읽도록 쓴 변경 목록이다.
> 기준(baseline)과 비교해 무엇을 왜 바꿨는지, 합칠 때 무엇을 확인해야 하는지만 짧게 적는다.
> 새 변경은 맨 아래 "변경 내역"에 날짜순으로 추가한다.

## 기준 (baseline)

- 기준 코드: 팀이 공유한 `walletfit-main.zip` (2026-10-30 저장, GitHub `Robin6w/walletfit` main 다운로드로 추정, `.git` 없음)
- 실행 화면: `src/App.tsx` → `src/v2/AppV2.tsx` (v2 화면)
- 챗봇 위치: `src/v2/chat/` (`chatModel.ts`, `ChatDock.tsx`, `chatStore.ts`)
  - 아주LLM 호출은 `src/features/chatbot/azuLlmClient.ts`, 굵게 표시는 `src/features/chatbot/chatFormatting.tsx`를 재사용
  - `src/features/chatbot/`의 `Chatbot.tsx`·`cardChatbot.ts`·`promptBuilder.ts`·`responseParser.ts`는 기준 시점에 이미 미사용
- 이 작업의 범위: **챗봇 로직·대화 체계**. 화면 디자인은 담당 아님(필요한 최소 수정만 하고 아래에 표시)

## 합칠 때 확인할 것 (요약)

1. 아래 "변경 내역"의 파일들을 상대 폴더에 반영한다. 같은 파일을 상대도 고쳤으면 덮어쓰지 말고 줄 단위로 합친다.
2. `[챗봇 폴더 밖]` 표시된 파일은 다른 조원 담당 영역이므로 특히 충돌을 확인한다.
3. 함수 시그니처가 바뀐 경우(아래 "주의" 참고) 호출하는 곳을 모두 맞춘다.
4. 합친 뒤 `npm run build`와 `npm run test`를 돌린다. 최소한 `npx vitest run tests/v2Chat.test.ts tests/v2Intents.test.ts`는 통과해야 한다.
5. 대화 규칙(`chatRules.ts`)에 정해 둔 답을 더하거나 고칠 때는 **같은 id를 의도 정의서(`intents.ts`)에도** 맞춘다. 어긋나면 `tests/v2Intents.test.ts`가 실패한다.

### 기준 zip 대비 바뀐 파일 전체 (2026-11-01, 파일 해시로 비교)

| 파일 | 상태 | 구분 |
|---|---|---|
| `src/v2/chat/chatModel.ts` | 바뀜 | 챗봇 |
| `src/v2/chat/ChatDock.tsx` | 바뀜 | 챗봇(화면) |
| `src/v2/chat/chatRules.ts` | 새 파일 | 챗봇 |
| `src/v2/chat/intents.ts` | 새 파일 | 챗봇(의도 정의서, 팀 문서 `챗봇_대화시나리오.xlsx`의 원본) |
| `src/v2/chat/Fitfit.tsx` | 새 파일 | 챗봇(캐릭터) |
| `src/v2/chat/NavTransition.tsx` | 새 파일 | 챗봇(이동 장면) |
| `src/v2/ui/TopBar.tsx` | 바뀜 | **[챗봇 폴더 밖]** 상담 버튼 커서·hover만 |
| `tests/v2Chat.test.ts` | 바뀜 | **[챗봇 폴더 밖]** 테스트 |
| `tests/v2Intents.test.ts` | 새 파일 | **[챗봇 폴더 밖]** 테스트 |
| `CHATBOT_CHANGES.md` | 새 파일 | 이 문서 |
| `.env` | 새 파일 | 로컬 전용(`.gitignore` 대상, 저장소에 안 올라감) |

지운 파일은 없다. `src/v2/chat/chatStore.ts`, `src/features/chatbot/*`(아주LLM 호출)은 그대로다.

## 로컬 전용 (저장소에 올리지 않음)

- `walletfit-main/.env` — 기준 zip에 없어서 새로 만듦. `.gitignore` 대상.
  - `VITE_AZU_LLM_BASE_URL=https://factchat-cloud.mindlogic.ai/v1/gateway`
  - `VITE_AZU_LLM_MODEL=gpt-5.4-nano` (팀 기본값, 2026-10-29)
  - API 키는 넣지 않음(앱의 '아주LLM 연결하기'에서 입력, 브라우저 저장소에만 저장)
- 상위 폴더의 `.claude/launch.json` — 개발 서버 실행 설정(포트 5174). 프로젝트 코드 아님.

---

## 변경 내역

### 2026-10-31 · 상담 창 첫 화면 단순화, 버튼 커서

| 파일 | 영역 | 변경 | 이유 |
|---|---|---|---|
| `src/v2/ui/TopBar.tsx` | **[챗봇 폴더 밖]** 화면 | 상단 '카드 상담' 버튼(`ChatToggle`의 `<button>`) className에 `cursor-pointer` 추가 | Tailwind v4는 버튼 기본 커서가 화살표라 버튼인지 알기 어려웠음 |
| `src/v2/chat/ChatDock.tsx` | 챗봇 | 헤더 제목 아래 부제 `<div>계산 결과와 카드사 원문으로 답해요</div>` 삭제 | 불필요한 설명 문구 제거(사용자 요청) |
| `src/v2/chat/ChatDock.tsx` | 챗봇 | `introText(ctx)` 호출을 `introText()`로 변경 | 아래 시그니처 변경에 맞춤 |
| `src/v2/chat/chatModel.ts` | 챗봇 | `introText`를 상황별 4문장 → 고정 한 줄 `"안녕하세요! 무엇이든 편하게 물어봐 주세요."`로 변경 | 첫 인사가 길고 딱딱했음. 답의 근거는 상단 띠(`contextLine`)가 계속 보여 줌 |
| `tests/v2Chat.test.ts` | **[챗봇 폴더 밖]** 테스트 | `introText` 기대값을 새 문장으로, 인자 없이 호출하도록 수정 | 위 변경 반영 |

- **주의 (시그니처 변경)**: `introText(ctx: ChatContext): string` → `introText(): string`. 상대 폴더에서 `introText(ctx)`를 부르는 곳이 있으면 인자를 빼야 한다. 기준 시점 호출처는 `ChatDock.tsx`, `tests/v2Chat.test.ts` 두 곳뿐. (`src/v1/chat/chatModel.ts`의 인사 문구는 별개라 건드리지 않음)
- 검증: `npx vitest run tests/v2Chat.test.ts` 10개 통과, `npx tsc -b` 통과, 브라우저에서 커서·제목·인사 확인.

### 2026-10-31 (2) · 상담 버튼 hover, 상단 띠 단순화, 답 말풍선

| 파일 | 영역 | 변경 | 이유 |
|---|---|---|---|
| `src/v2/ui/TopBar.tsx` | **[챗봇 폴더 밖]** 화면 | `ChatToggle` 버튼: 닫힌 상태 className에 `hover:border-w-primary hover:bg-w-primary hover:text-white`, 공통에 `transition-colors` 추가 | 마우스를 올려도 버튼 반응이 없었음. 메뉴의 선택된 탭처럼 파란 배경·흰 글자/아이콘으로 바뀌게(아이콘은 `currentColor`라 같이 흰색) |
| `src/v2/chat/chatModel.ts` | 챗봇 | `contextLine` 반환형을 `string` → `{ label: string; text: string }`로 변경. 기본 `label` = `"최근에 저장된 정보"`, `text` = `"카드 N장 · 월 지출 X원"`(날짜·'추천 결과/저장한 지갑' 구분 삭제). 결과 없으면 `text: "아직 없어요"`. 카드 비교 화면은 `label: "카드 비교"`, `text: "D4·TEN · 월 지출 …"` | 상단 띠 가독성. 값은 ctx(지갑·마지막 계산 결과)에서 매번 만들어지므로 지갑을 다시 짜면 자동으로 바뀜 |
| `src/v2/chat/chatModel.ts` | 챗봇 | 내부 함수 `dateText` 삭제(쓰는 곳 없어짐) | 위 변경 |
| `src/v2/chat/ChatDock.tsx` | 챗봇 | 상단 띠: `<b>상담 기준</b> · {contextLine(ctx)}` → `<b>{label}</b> · {text}` | 위 변경 반영 |
| `src/v2/chat/ChatDock.tsx` | 챗봇 | `BotMsg`: 왼쪽 말풍선 아이콘 삭제, 답 글을 연한 파랑 말풍선(`background #F7FAFF`, `border 1px #EDF2FC`, `borderRadius 16px 16px 16px 4px`, `maxWidth 85%`)에 넣음. 새 prop `extra`로 표·버튼 블록을 말풍선 밖 아래(전체 폭)에 그림 | 대화하는 느낌이 적었음(사용자 말풍선만 보였음). 표가 말풍선 안에 들어가면 배경색이 겹쳐서 밖으로 뺌 |
| `tests/v2Chat.test.ts` | **[챗봇 폴더 밖]** 테스트 | `contextLine` 기대값 4곳을 `toEqual({ label, text })` 형태로 수정 | 위 변경 반영 |

- **주의 (시그니처 변경)**: `contextLine(ctx)`가 이제 문자열이 아니라 객체를 돌려준다(최종 형태는 (5) 참고). 기준 시점 호출처는 `ChatDock.tsx`, `tests/v2Chat.test.ts`뿐.
- `ChatDock.tsx`의 `Bubble` 아이콘 컴포넌트는 헤더에서 계속 쓰므로 남겨 둠. `ChatContext.at` 필드도 타입에 그대로 둠(지금은 띠에서 안 씀).
- 검증: `npx vitest run tests/v2Chat.test.ts` 10개 통과, `npx tsc -b` 통과, 브라우저에서 hover 색·띠 문구·말풍선(아이콘 없음, 배경 #F7FAFF) 확인.

### 2026-10-31 (3) · 다시 시작 확인 창, 닫기 버튼 >와 밀려 나가기

모두 `src/v2/chat/ChatDock.tsx` 한 파일(챗봇 폴더 안).

| 변경 | 내용 | 이유 |
|---|---|---|
| 헤더 '새 상담'(+) 버튼 → '상담 다시 시작'(새로고침 아이콘) | `aria-label="상담 다시 시작"`. 아이콘 path `M3 12a9 9 0 1 0 3-6.7L3 8` + `M3 3v5h5`. 누르면 바로 지우지 않고 확인 창을 띄움(`confirmReset` 상태) | +가 무슨 뜻인지 알기 어려웠음. 실수로 대화가 지워지지 않게 |
| 새 컴포넌트 `ResetConfirm` | `createPortal`로 `document.body`에 띄움. 뒤 배경 `rgba(13,27,74,0.25)` + `backdrop-filter: blur(4px)`, 가운데 흰 창(`role="alertdialog"`): 제목 "상담을 다시 시작하시겠습니까?", 설명 "지금까지 나눈 대화가 모두 사라집니다.", 버튼 [아니오][예]. 버튼은 흰 배경·검정 글씨, hover/focus-visible 시 파랑 배경(`w-primary`)·흰 글씨(`CONFIRM_BTN` Tailwind 클래스). 처음 포커스는 창 자체(`tabIndex=-1`) | 사용자 요청 디자인. 상담 창 바깥 div에 transform이 있어 그 안의 `position: fixed`가 화면 기준이 아니게 되므로 portal 사용. 버튼에 처음 포커스를 주면 두 버튼이 동시에 파랗게 보여서 창에 포커스 |
| '예' 동작 | 기존과 같은 `chatStore.reset()` 후 입력칸 포커스. '아니오'·Esc는 확인 창만 닫음 | — |
| Esc 처리 | 기존 window keydown 핸들러가 확인 창이 떠 있으면(`confirmRef`) 확인 창만 닫고, 아니면 상담 창을 닫음 | Esc 한 번에 상담 창까지 닫히지 않게 |
| 닫기 버튼 아이콘 X → > | path `m9 6 6 6-6 6`, `aria-label`은 그대로 "카드 상담 닫기" | 오른쪽으로 밀어 닫는 동작과 맞춤 |
| 창 열기/닫기 애니메이션 | `ChatDock`이 `mounted`/`entered` 상태로 닫을 때 바로 언마운트하지 않고 `translateX(100%)`로 240ms(`SLIDE_MS`) 밀려 나간 뒤 언마운트. 열 때도 같은 방향으로 밀려 들어옴. `ChatPanel`에 `shown` prop 추가, 바깥 div에 `transform`/`transition` | 사용자 요청(옆으로 밀리며 사라지기). 열 때도 맞춰서 어색하지 않게 |
| ~~움직임 줄이기 설정 존중~~ | 처음엔 `prefers-reduced-motion: reduce`면 애니메이션을 껐으나, 같은 날 (4)에서 제거 | — |

- 검증: `npx tsc -b` 통과, `npx vitest run tests/v2Chat.test.ts` 10개 통과, `npx oxlint src/v2/chat/ChatDock.tsx` 경고 0. 브라우저에서 확인 창 문구·흐림·hover 색·Esc 동작 확인.

### 2026-10-31 (4) · 상담 창은 항상 밀려서 열고 닫기

| 파일 | 영역 | 변경 | 이유 |
|---|---|---|---|
| `src/v2/chat/ChatDock.tsx` | 챗봇 | `reduceMotion()` 함수 삭제. 닫힘 지연은 항상 `SLIDE_MS`(240ms), 바깥 div `transition`은 항상 `transform 240ms ease` | 사용자 결정: Windows '애니메이션 효과'를 끈 PC(= `prefers-reduced-motion: reduce`)에서도 슬라이드가 보여야 함. **의도적으로 접근성 설정을 무시함** — 나중에 되돌리려면 이 항목을 참고 |

- 검증: `npx tsc -b` 통과, chat 테스트 10개 통과, oxlint 경고 0. reduced-motion이 켜진 브라우저에서 열기 420→0px, 닫기 0→420px 후 언마운트 확인.

### 2026-10-31 (5) · 상단 띠 글자 강조 정리, 입력칸 안내 문구

| 파일 | 영역 | 변경 | 이유 |
|---|---|---|---|
| `src/v2/chat/chatModel.ts` | 챗봇 | `contextLine` 반환형을 다시 변경: `{ label, text }` → `{ label: string; items: ContextItem[] }`. 새 export 타입 `ContextItem { pre: string; value: string }`. 기본: `items = [{pre:"카드 ", value:"2장"}, {pre:"월 지출 ", value:"23만 9천원"}]`. 결과 없음: `[{pre:"아직 없어요", value:""}]`. 카드 비교: `[{pre:"", value:"D4, TEN"}, {pre:"월 지출 ", value:"…원"}]`(카드 이름 구분을 `·` → `, `로) | 숫자만 진하게 보이게 하려면 글자를 칸별로 나눠야 했음 |
| `src/v2/chat/ChatDock.tsx` | 챗봇 | 새 컴포넌트 `ContextStrip`: `"{label}: "` + 칸들을 `" / "`로 이음. 라벨·pre는 띠 기본색(#3A4A78) 보통 굵기, `value`만 `#0D1B4A`·`fontWeight 600`. 기존 `<b>` 굵은 라벨 제거 | 사용자 요청: "최근에 저장된 정보"는 핵심이 아니라 굵게 하지 않음, 가운데 점(·) 대신 콜론과 슬래시 |
| `src/v2/chat/ChatDock.tsx` | 챗봇 | 입력칸 placeholder `"보고 있는 화면에 대해 물어보세요"` → `"원하는 질문이 위에 없으면 직접 입력해 주세요"` | 바로 위 추천 질문 버튼과 이어지게 |
| `tests/v2Chat.test.ts` | **[챗봇 폴더 밖]** 테스트 | `contextLine` 기대값 4곳을 `{ label, items }` 형태로 수정 | 위 변경 반영 |

- **주의 (시그니처 변경)**: `contextLine`의 반환형이 (2)에 이어 한 번 더 바뀜. 지금 기준 `{ label, items }`. 호출처는 `ChatDock.tsx`(`ContextStrip`), `tests/v2Chat.test.ts`.
- 검증: `npx tsc -b` 통과, chat 테스트 10개 통과, `npx oxlint src/v2/chat` 경고 0. 브라우저에서 띠가 "최근에 저장된 정보: 카드 **2장** / 월 지출 **23만 9천원**"(굵은 라벨 없음)으로, placeholder 문구 확인.

### 2026-10-31 (6) · 상담 답 말풍선에 로고 배지

| 파일 | 영역 | 변경 | 이유 |
|---|---|---|---|
| `src/v2/chat/ChatDock.tsx` | 챗봇 | `BotMsg` 말풍선에 `position: relative`, 오른쪽 안쪽 여백 14→20px. 말풍선 오른쪽 위 모서리에 `<img src={`${BASE_URL}logo-icon.png`}>`(34×34, `top/right: -15px`, `aria-hidden`, `pointerEvents: none`)를 걸침. 상수 `LOGO_SRC` 추가 | 사용자 요청: 카카오톡 알림 말풍선처럼 브랜드 로고를 작게 붙여 상담원 답임을 드러냄. 로고 파일은 상단 바(`TopBar.tsx`의 `Logo`)가 쓰는 `public/logo-icon.png` 재사용(새 파일 없음) |

- 모든 상담 답(첫 인사, 답 쓰는 중 말풍선 포함)에 붙는다.
- `logo-icon.png`는 그림 둘레에 투명 여백이 커서, 실제 보이는 로고는 34px보다 작다(약 22px).
- 검증: `npx tsc -b` 통과, chat 테스트 10개 통과, oxlint 경고 0. 브라우저에서 이미지 로드·위치 확인.

### 2026-10-31 (7) · 선택지 트리(메뉴 → 질문 → 답) 도입, 연회비 0원 문구 수정

**핵심 구조 변경.** 입력칸 위 추천 질문 칩을 없애고, 대화 안에 버튼으로 길을 낸다.

```
첫 인사 아래 큰 정사각형 버튼 3개(누구에게나 같음)
├─ 지갑 만들기 → 가진 카드로 / 새 카드까지 / 명세서로 / (지갑 있으면) 지출 다시 입력   → 설명 + 화면 이동 버튼
├─ 지갑 확인   → 요약 / [내 카드마다] ○○는 어디에 써요? / 실적은 다 채워져요?          (지갑 없으면 안내 + 지갑 만들기)
│               요약 뒤 후속: 새 카드까지 넣으면? / 실적 여유 없이? / 카드 수를 바꾸면?(계산 결과에 카드 수별 값이 있을 때만)
└─ 자주 묻는 질문 → 추천 계산 방식 / 전월실적 / 실적 여유 / 순혜택 / 실제 혜택과 차이
모든 답 끝: 관련 질문 1~3개 + [처음으로](→ 큰 버튼 3개 다시)
```

| 파일 | 영역 | 변경 |
|---|---|---|
| `src/v2/chat/chatModel.ts` | 챗봇 | `ChatBlock`에 `{kind:"menu"}`, `{kind:"choices"; items: ChatChoice[]}` 추가. 새 export: `ChatChoice{id,label}`, `MenuId`("make"\|"check"\|"faq"), `MENUS`, `HOME_CHOICE`, `menuChoices(menu, ctx)`, `withChoices(msg, next?)`, `answerChoice(id, ctx, call)`. 내부: `LABEL`(선택지 id→질문 문구), `pick`, `cardChoice`, `countBar`(= `monotoneBar(rec.bar, pack)`, 결과 화면 막대와 같은 값), `answerCardCount`, `faqNet`, `netSentence`, `say`, `go`, `noWallet` |
| `src/v2/chat/chatModel.ts` | 챗봇 | **삭제**: `suggestions()`, `BASE_SUGGEST` (입력칸 위 칩) |
| `src/v2/chat/chatModel.ts` | 챗봇 | `answerSummary`, `answerNewCards`의 순혜택 문장을 `netSentence(pack)`로: `pack.fee < 1`이면 "연회비가 없어서 월 약 ○원을 그대로 받아요", 아니면 기존 "연회비를 빼면 월 약 ○원이에요". 요약 끝 문장 "카드 이름을 넣어 물어보시면…" 삭제(카드 선택지가 대신함) |
| `src/v2/chat/ChatDock.tsx` | 챗봇 | 새 `choose(choice)`: 누른 문구를 내 말풍선으로 넣고 `answerChoice`로 답(**아주LLM 호출 안 함**). `chooseMenu(id)`. 첫 인사 `BotMsg`의 `extra`에 `MenuGrid`. 새 컴포넌트 `MenuGrid`(3열 정사각형, 아이콘 `MENU_ICON`, 흰 배경→hover 파랑/흰 글씨), `ChoiceList`(세로 칩, '처음으로'는 회색 톤). `Block`에 `onChoose`·`onMenu`·`busy` prop 추가, `menu`/`choices` 블록 렌더링. 입력칸 위 추천 칩 줄 삭제 |
| `src/v2/chat/ChatDock.tsx` | 챗봇 | 직접 입력한 질문의 답에도 `withChoices(...)`로 '처음으로'를 붙임(`send`의 세 군데 `replaceLast`) |
| `tests/v2Chat.test.ts` | **[챗봇 폴더 밖]** 테스트 | `suggestions` 테스트 삭제, 요약 기대 문장 수정, 연회비 0원 테스트 1개 + 선택지 테스트 9개(`describe("카드 상담 선택지")`) 추가 |

- **설계 결정**: 버튼으로 고른 질문은 아주LLM을 거치지 않는다. 계산 결과로 바로 답해서 빠르고(추론 모델로 약 1분 걸리던 문제 회피), 크레딧이 들지 않고, 숫자가 항상 같다. 직접 입력한 질문만 기존처럼 아주LLM이 다듬는다.
- **자주 묻는 질문 답은 새로 쓴 고정 문구**다(숫자는 지갑이 있을 때 `pack.total/fee/net`, `ctx.margin`만 끼움). 예시 숫자 "전월실적 30만원 이상"은 예시임을 문장에 밝힘.
- 카드 비교 화면 전용 질문은 **트리에서 제외로 결정**(2026-10-31). 이유: 비교함에 카드가 2장 이상 있을 때만 쓸 수 있어 "누구에게나 같은 메뉴" 원칙과 충돌하고, 답 내용이 비교 화면이 이미 보여 주는 요약(`sumVM`·`insightsVM`)과 겹침. 비교 화면에서 직접 입력하면 기존 `classify`의 `compare` 경로로 답함(다른 화면에서는 비교 데이터가 없어 이 경로를 타지 않음).
- 대화(블록 포함)는 기존처럼 sessionStorage(`walletfit:v2:chat-msgs`)에 저장되므로, 예전 대화에 남은 버튼도 다시 누를 수 있다.
- 검증: `npx vitest run` 전체 32파일 282개 통과(chat 20개), `npx tsc -b` 통과, `npx oxlint src/v2/chat` 경고 0. 브라우저에서 큰 버튼 3개(118×118), 지갑 확인 → 요약 → 후속 선택지, 처음으로 → 큰 버튼 재표시, 입력칸 위 칩 없음 확인.

### 2026-10-31 (8) · 캐릭터 '핏핏'과 상황별 표정

| 파일 | 영역 | 변경 |
|---|---|---|
| `src/v2/chat/Fitfit.tsx` | 챗봇 | **새 파일.** 인라인 SVG 캐릭터 `Fitfit({ mood, variant, size, wave })`. `mood`: `hello`/`happy`/`thinking`/`sorry`, `variant`: `full`(몸 전체)/`face`(얼굴만). 키프레임은 SVG 안 `<style>`에 둠(`ff-wave`: 왼팔 0.9s × 3회 후 멈춤, `ff-dot`: thinking 입 자리 점 3개 무한 깜빡임). 색은 브랜드 블루(#2457F5/#1747D6) 고정. 외부 이미지 파일 없음 |
| `src/v2/chat/chatModel.ts` | 챗봇 | `ChatMood`("happy"\|"sorry") 타입, `ChatMsg.mood?` 추가. `mood: "sorry"`를 붙인 곳: `noWallet()`, `answerCardCount`의 계산값 없음, `answerLocal` free(키 없음: "딱 맞는 계산 기록을 찾지 못해서…"), `answerCompare` 계산 실패, `answerNoMargin` 기본 추천 재계산 실패 |
| `src/v2/chat/ChatDock.tsx` | 챗봇 | 헤더 파란 네모 말풍선 아이콘(`Bubble`, 삭제) → `<Fitfit variant="full" mood="hello" wave size={38}/>`(연파랑 #E8EEFF 44px 칸). 창을 열 때마다 마운트되므로 열 때마다 3번 흔듦 |
| `src/v2/chat/ChatDock.tsx` | 챗봇 | `BotMsg`의 로고 배지(`LOGO_SRC` 삭제) → `<Fitfit mood={…} size={30}/>`(top -14, right -12). 새 필수 prop `mood: FitfitMood`. 첫 인사 = `hello`, 답 쓰는 중(`pending`) = `thinking`, 그 밖 = `m.mood ?? "happy"` |
| `src/v2/chat/ChatDock.tsx` | 챗봇 | `send`의 계산 실패, 아주LLM 실패(안내 문구가 붙는 경우), `choose`의 계산 실패 답에 `mood: "sorry"` |
| `tests/v2Chat.test.ts` | **[챗봇 폴더 밖]** 테스트 | 표정 테스트 1개 추가 |

- **한계**: 아주LLM이 직접 쓴 답(자유 질문)이 "카드 상담만 할 수 있어요"처럼 거절하는 경우는 알아채지 않아서 기쁨 표정으로 나온다. 필요하면 LLM에 표시를 붙이게 하는 방식으로 확장.
- `walletfit:v2:chat-msgs`에 저장된 예전 대화에는 `mood`가 없어서 모두 기쁨으로 보인다(정상).
- 캐릭터 그림은 시안 수준(2026-10-31, Claude가 그림). 실서비스 전 디자인 담당과 확정 필요.
- 검증: `npx tsc -b` 통과, `npx vitest run` 283개 통과, `npx oxlint src/v2/chat` 경고 0. 브라우저에서 헤더 핏핏(손 흔들기 애니메이션 `ff-wave` 3회·0.9s 적용), 답 배지 표정 렌더링 확인.

### 2026-10-31 (9) · 캐릭터 이름을 인사·제목에 드러내기, AI 챗봇 표시

| 파일 | 영역 | 변경 | 이유 |
|---|---|---|---|
| `src/v2/chat/chatModel.ts` | 챗봇 | `introText()` → `"안녕하세요, 핏핏이에요! 무엇을 도와드릴까요?"` | 캐릭터 이름 알리기 |
| `src/v2/chat/ChatDock.tsx` | 챗봇 | 헤더 제목 `카드 상담` → `카드 상담사 핏핏`, 그 아래 회색 작은 글씨 `WalletFit AI 챗봇`(12px, #5E6D96) 추가 | 이름 노출 + AI가 답한다는 사실을 사용자에게 밝힘 |
| `tests/v2Chat.test.ts` | **[챗봇 폴더 밖]** 테스트 | 인사 기대 문구 수정 | 위 변경 |

- 상단 메뉴 버튼(`TopBar.tsx`)의 '카드 상담'과 상담 창 `aria-label="카드 상담"`은 그대로 둠.
- 검증: `npx tsc -b` 통과, chat 테스트 21개 통과, 브라우저에서 제목·부제·인사 확인.

### 2026-10-31 (10) · 선택지 답에 '입력 중' 대기, 상담 답 시각, 헤더 핏핏 배경

| 파일 | 영역 | 변경 | 이유 |
|---|---|---|---|
| `src/v2/chat/chatModel.ts` | 챗봇 | `ChatMsg.at?: number`(말풍선 완성 시각) 추가. 새 export `clockText(at)`(→ "오후 8:31", `Intl.DateTimeFormat("ko-KR")`), `choiceDelay(id)`(처음으로 500 / `menu:*` 600 / 그 밖 1100 ms) | 버튼 답이 즉시 떠서 대화 느낌이 없었음 |
| `src/v2/chat/ChatDock.tsx` | 챗봇 | `choose`: 대기 말풍선을 `text: ""`로 넣고 `Promise.all([answerChoice, sleep(choiceDelay)])`. 새 컴포넌트 `TypingDots`(`<output aria-label="답을 쓰는 중">`, 점 3개 `wf-typing` 키프레임). 대기 말풍선은 텍스트가 비면 점 표시(직접 입력 대기는 기존 "확인하고 있어요…" 문구 유지) | 메신저 같은 '입력 중' 느낌 |
| `src/v2/chat/ChatDock.tsx` | 챗봇 | 시각 찍기: 사용자 말풍선·완성된 답(`replaceLast`의 persist=true, `choose`, '지금 조합 유지')에 `at: Date.now()`. 스트리밍 중간 글에는 찍지 않음. `BotMsg`에 `at` prop: 말풍선 바깥 오른쪽 아래에 11px 회색(#5E6D96) 시각. **상담 답에만 표시**(사용자 말풍선은 표시 안 함). 첫 인사 시각 = 대화 첫 말풍선 시각, 대화가 없으면 창을 연(다시 시작한) 시각(`openedAt`) | 사용자 요청 |
| `src/v2/chat/ChatDock.tsx` | 챗봇 | `BotMsg` 줄(말풍선+시각)에 `width: "100%"` | **버그 수정**: 줄이 내용 폭으로 줄어든 상태에서 말풍선 `maxWidth: calc(100% - 64px)`가 그 줄 기준으로 계산돼 말풍선이 필요 이상 좁아지고 짧은 문장도 줄바꿈되던 문제 |
| `src/v2/chat/ChatDock.tsx` | 챗봇 | 헤더 핏핏 칸 배경 #E8EEFF·둥근 모서리 → 흰색(#FFFFFF), 모서리 없음 | 캐릭터가 헤더에 자연스럽게 서 있게 |
| `tests/v2Chat.test.ts` | **[챗봇 폴더 밖]** 테스트 | `choiceDelay`·`clockText` 테스트 1개 추가 | — |

- 데이터 부담: 시각은 메시지당 숫자 하나(약 20바이트), sessionStorage에만 저장되고 탭을 닫거나 다시 시작하면 지워짐. 아주LLM 메시지(`buildMessages`)에는 넣지 않음.
- 이 변경 전에 저장된 대화에는 `at`이 없어 시각이 안 보임(정상).
- 검증: `npx tsc -b` 통과, `npx vitest run` 284개 통과(chat 22개), `npx oxlint src/v2/chat` 경고 0. 브라우저에서 메뉴 답 약 0.63초 뒤 표시, 대기 중 점 말풍선(67px), 시각 "오후 8:38", 헤더 배경 흰색 확인.

### 2026-10-31 (11) · 기다리는 동안은 핏핏 없이 점만

| 파일 | 영역 | 변경 | 이유 |
|---|---|---|---|
| `src/v2/chat/ChatDock.tsx` | 챗봇 | `BotMsg`의 `mood`를 선택 prop으로 바꾸고, `mood`가 없으면 핏핏 배지를 그리지 않음. 답을 쓰는 중(`pending`)에는 `mood`를 넘기지 않음(기존엔 `"thinking"`) | 사용자 요청: 대기 중에는 캐릭터 없이 말풍선 안 점만 |
| `src/v2/chat/ChatDock.tsx` | 챗봇 | 직접 입력(`send`)의 대기 말풍선 문구 `"계산 결과와 카드사 원문을 확인하고 있어요…"`(기준 코드에 있던 고정 문구) → `text: ""`(→ `TypingDots`). 아주LLM 글이 스트리밍되기 시작하면 그 글로 바뀜 | 버튼 대기와 같은 모양으로 통일 |

- `Fitfit`의 `thinking` 표정은 지금 화면에서 쓰지 않지만 컴포넌트에는 남겨 둠.
- 주의: 추론 모델(`gpt-5.4-nano`)은 첫 글자가 오기까지 수십 초 걸릴 수 있어, 그동안 점만 보인다.
- 검증: `npx tsc -b` 통과, chat 테스트 22개 통과, oxlint 경고 0. 브라우저에서 대기 중 말풍선에 점만 있고 핏핏 없음, 답 완성 후 핏핏 표시 확인.

### 2026-10-31 (12) · 직접 입력 최소 대기 2초, 선택지 박스 모양

| 파일 | 영역 | 변경 | 이유 |
|---|---|---|---|
| `src/v2/chat/chatModel.ts` | 챗봇 | 새 export `TYPED_MIN_DELAY = 2000` | 직접 입력 답이 너무 빨리 떠서(키 없음·빠른 모델) 대화 느낌이 없었음 |
| `src/v2/chat/ChatDock.tsx` | 챗봇 | `send`: 시작 시각 기준 최소 2초 대기(`waitMin`). 키 없음(계산 결과 답)·아주LLM 완료·실패 모두 2초 전이면 2초까지 기다렸다 표시. 스트리밍은 2초 전까지 화면에 안 쓰고(`latest`에만 보관), 2초가 되는 순간(`reveal` 타이머) 그때까지 글을 한 번 보여 준 뒤 이어서 흘려 보냄. 답이 2초보다 오래 걸리면 그대로 따름. 실패 시 `catch`에서 `reveal`을 꺼서 완성된 답을 덮어쓰지 않게 함 | 사용자 요청 |
| `src/v2/chat/ChatDock.tsx` | 챗봇 | 선택지 `CHOICE_BTN`: 둥근 타원(`rounded-[18px]`, 연파랑 배경·파랑 글씨) → 살짝 둥근 네모(`rounded-lg` = 8px), 흰 배경·검정(#0D1B4A) 글씨·테두리 #D3DDF2. hover 파랑 배경·흰 글씨는 그대로. '처음으로'도 같은 모양(회색 톤 구분 삭제)에 앞쪽 되돌아가기 화살표(↩, 15px 인라인 SVG, `currentColor`라 hover 때 흰색) | 사용자 요청 |

- 대기 중 문구 "계산 결과와 카드사 원문을 확인하고 있어요…"는 (11)에서 이미 점 3개로 바뀐 상태 유지(사용자 확인).
- 검증: `npx tsc -b` 통과, `npx vitest run` 284개 통과, oxlint 경고 0. 브라우저에서 선택지 모양(8px·흰 배경·검정 글씨·테두리), 처음으로 화살표, hover 색 확인. **직접 입력 2초 최소 대기는 브라우저에서 직접 재지 않음**(키가 연결돼 있어 실제 아주LLM 호출·크레딧이 들기 때문). 코드 경로 검토만 함.

### 2026-10-31 (13) · 상담 입력칸 포커스 때 진한 테두리 없애기

| 파일 | 영역 | 변경 | 이유 |
|---|---|---|---|
| `src/v2/chat/ChatDock.tsx` | 챗봇 | 입력칸 바깥 div의 `className="w-field"` → `"transition-shadow focus-within:shadow-[0_0_0_3px_rgba(36,87,245,0.18)]"` | 공용 `.w-field:focus-within`(`src/index.css`)이 테두리를 `#2457F5 !important`로 바꿔, 연한 바깥 링 안쪽에 진한 1px 선(사용자 눈에 검은 테두리)이 생겼음. 상담 입력칸만 테두리는 그대로(#D3DDF2) 두고 같은 연한 링만 표시 |

- `src/index.css`의 `.w-field`는 다른 화면(지출 금액·카드 검색 등)이 계속 쓰므로 건드리지 않음.
- 검증: `npx tsc -b` 통과, chat 테스트 통과, oxlint 경고 0. 브라우저에서 입력칸 클릭 시 테두리 #D3DDF2 유지·연한 링만 표시 확인.

### 2026-10-31 (14) · '처음으로' 뒤 답은 기본 표정

| 파일 | 영역 | 변경 |
|---|---|---|
| `src/v2/chat/chatModel.ts` | 챗봇 | `ChatMood`에 `"hello"` 추가. `answerChoice("home")`("다른 것도 도와드릴까요?" + 큰 메뉴)에 `mood: "hello"` |
| `tests/v2Chat.test.ts` | **[챗봇 폴더 밖]** 테스트 | 처음으로 답의 `mood` 확인 추가 |

- 이유: 기본 표정(hello)이 첫 인사에만 나와서, 처음으로 돌아간 뒤에도 같은 표정이 나오게(사용자 요청).
- 참고: `thinking` 표정은 (11) 이후 화면에서 쓰지 않음(대기 중엔 핏핏 없이 점만).
- 검증: `npx tsc -b` 통과, chat 테스트 22개 통과, 브라우저에서 처음으로 뒤 말풍선 핏핏이 눈 뜬 기본 표정인지 확인.

### 2026-10-31 (15) · 연회비 0원 카드 문장

| 파일 | 영역 | 변경 |
|---|---|---|
| `src/v2/chat/chatModel.ts` | 챗봇 | `answerCard` 끝 문장: `card.annualFee < 1`이면 "연회비는 없어요.", 아니면 기존 "연회비 ○원은 월 ○원꼴이에요." |
| `tests/v2Chat.test.ts` | **[챗봇 폴더 밖]** 테스트 | 연회비 0원 카드 테스트 추가 |

- 이유: "연회비 0원은 월 0원꼴이에요."가 어색함(사용자 발견).
- 검증: `npx tsc -b` 통과, chat 테스트 23개 통과, 브라우저에서 토스뱅크 체크카드 답이 "…월 14,552원을 맡아요. 연회비는 없어요."로 나오는 것 확인.

### 2026-10-31 (16) · 대화 규칙 파일(chatRules.ts), 직접 입력 처리 재설계, 개인정보 막기

**핵심 구조 변경.** 직접 입력은 이제 엔진 답을 아주LLM이 다시 쓰지 않는다. 같은 뜻의 질문이면 버튼과 똑같은 답이 나가고, 아주LLM은 분류와 짧은 답에만 쓴다.

```
직접 입력 → ⓪ 개인정보(카드 번호·주민번호·비밀번호/CVC 숫자) → 고정 경고, AI로 안 보냄, 내 말풍선 숫자 •로 가림
          → ① 인사·감사·작별(정규식) → 고정 한 줄(안녕은 큰 메뉴 붙임), AI 없음
          → ② 뜻 없는 입력(한글·영문 2글자 이상이 없음) → 고정 "잘 모르겠어요", AI 없음
          → ③ 메뉴 질문과 같은 뜻(버튼 문구 일치 → 내 카드 이름+쓰임새 낱말 → MENU_KEYWORDS) → answerChoice(버튼과 동일), AI 없음
          → (엔진 답이 있는 기존 의도: 카드 비교 화면 compare, 통신비 mobile, 실적 여유 대안 noMargin) → 엔진 답 그대로
          → ④ 아주LLM 분류기(routerSystem): 첫 단어 MENU <번호> / CARD <3문장 이하 답> / TALK <한 문장> / OUT <한 문장 거절>
                MENU → answerChoice(그 메뉴) · CARD → 3문장까지 자름 · TALK → 첫 문장(50자 넘으면 FIXED.talk) · OUT → 첫 문장(50자 넘으면 FIXED.offTopic)
          키 없음 → FIXED.unknown, AI 실패 → FIXED.aiFailed + (이유)
```

| 파일 | 영역 | 변경 |
|---|---|---|
| `src/v2/chat/chatRules.ts` | 챗봇 | **새 파일.** 핏핏의 대화 규칙 모음: `LIMITS`(3문장·50자·대화 4개·토큰 600), `FIXED`(정해 둔 문장 6개), `PRIVATE_INFO`, `QUICK_TALK`, `MEANINGFUL`, `MENU_KEYWORDS`(14개), `CARD_USE_WORDS`, `routerSystem(menu, record)`(AI 지시문) |
| `src/v2/chat/chatModel.ts` | 챗봇 | **삭제**: `freeSystem`, `buildMessages`(엔진 답을 AI가 다듬던 경로와 "짧게(3~6문장)"/"(3~5문장)" 지시문). **추가**: `AskAi` 타입, `routerMenu`, `matchChoice`, `routerMessages`, `Route`, `parseRoute`, `firstSentences`, `hasPrivateInfo`, `maskPrivateInfo`, `answerTyped`. `answerLocal`·`classify`는 남김(answerTyped 안에서 compare/mobile/noMargin 판단에 사용) |
| `src/v2/chat/ChatDock.tsx` | 챗봇 | `send`를 `answerTyped` 한 번 호출로 단순화. 스트리밍(`requestAzuLlmChatStream`)·2초 전 글 숨기기 타이머 삭제 → `requestAzuLlmChat`(비스트리밍)으로 다 받은 뒤 최소 2초 맞춰 표시. AI 실패는 `azuLlmErrorReason`을 담은 Error로 넘김. 사용자 말풍선은 `maskPrivateInfo` 적용 |
| `tests/v2Chat.test.ts` | **[챗봇 폴더 밖]** 테스트 | `buildMessages` 테스트 → `routerMessages` 테스트로 교체. `describe("카드 상담 직접 입력")` 10개 추가: 개인정보, 뜻 없는 입력, 인사, **메뉴 문구 그대로 입력 = 버튼 답(지갑 있음/없음 모든 메뉴)**, 말 바꿔도 같은 답, AI MENU/OUT/TALK/CARD 처리, AI 없음·실패, 형식 읽기 |

- **주의 (삭제된 export)**: `buildMessages`가 없어짐. 상대 폴더 v2 코드에서 쓰는 곳이 있으면 `answerTyped`로 바꿔야 함(v1의 `src/v1/chat/chatModel.ts`의 같은 이름 함수는 별개라 그대로).
- **주의 (합칠 때)**: AI 지시문은 이제 `chatRules.ts`에만 있다. 상대가 `chatModel.ts`의 옛 지시문(`freeSystem` 등)을 고쳤다면 그 내용은 `routerSystem`으로 옮겨야 한다.
- AI 답은 짧아서 스트리밍을 그만뒀다(첫 단어가 분류 표시라 흘려 보여 주면 표시가 잠깐 보임).
- 검증: `npx vitest run` 32파일 295개 통과(chat 33개), `npx tsc -b` 통과, `npx oxlint src/v2/chat` 경고 0. 브라우저에서 직접 입력 "토스뱅크 체크카드 어따 써?" → 버튼 답과 같은 문장·표·후속 선택지, "ㅇ" → 잘 모르겠어요, 가짜 카드 번호 → 경고 + 말풍선 숫자 가림, 세 경우 모두 게이트웨이 요청 없음 확인. **AI 분류(④) 경로는 실제 아주LLM으로 시험하지 않음**(크레딧). 단위 테스트의 가짜 AI로만 확인.

### 2026-10-31 (17) · 실제 아주LLM(gpt-5.4-nano)으로 분류기 시험 후 고친 것

시험 질문 7개(저녁 뭐 먹지 / 밥 먹고 올게요 / 날씨 안 좋네 / 주식 뭐 사 / 이 카드 영화 할인 돼? / 연회비 면제 조건 / 한 달에 전부 합쳐서 얼마 아껴?)를 화면에서 직접 입력하고, 게이트웨이 응답 원문을 가로채 확인함. 응답 시간은 매번 약 2.2~3.4초(최소 2초 포함).

| 찾은 문제(실제 응답) | 고친 곳 |
|---|---|
| 형식 설명 `<한 문장>`을 따라 "OUT 한 문장: …"처럼 머리말을 씀 | `routerSystem`: 꺾쇠 자리표시 대신 실제 예시 줄(`OUT 저녁 메뉴 추천은 …`)로 형식 설명. `AI_TEXT_FIXES`로 "한 문장:", "답:" 머리말 삭제 |
| 거절이 모두 "그 내용은 … 범위가 아니라서 …"로 똑같음 | `routerSystem`: "사용자가 말한 주제를 넣어서" + 주제별 예시 3개 |
| "[계산 기록]", "자료" 같은 내부 용어가 답에 나옴 | 자료 이름표를 `[자료]`로 바꾸고 "필요하면 '계산 결과'라고 해" 지시. `AI_TEXT_FIXES`: "계산 기록"→"계산 결과", "자료"→"정보". 안내 문구도 "핏핏이가 가진 정보에 없어요"로 |
| 카드 이름이 아닌 말("영화·공연·OTT 할인")을 굵게 씀 | 새 `cleanAiText`: 내 지갑 카드 이름이 아닌 `**…**`는 굵게를 뺌 |
| "0.3%"의 점에서 문장을 잘라 마지막 문장이 사라짐 | `firstSentences`: 마침표·느낌표·물음표 **뒤에 띄어쓰기가 있을 때만** 문장 끝으로 봄 |
| "한 달에 전부 합쳐서 얼마 아끼는 거야?"를 MENU가 아닌 CARD로 답함 | `MENU_KEYWORDS`에 요약 규칙 추가(전부/모두/합쳐/총 + 얼마/아끼/받) → AI 없이 요약 버튼 답. 지시문에도 "같은 정보를 묻는 질문이면 표현이 달라도 MENU" + 예시 |
| 앞선 핏핏 답(종류 표시 없음)을 넘기면 AI가 종류를 빼먹음 → 거절인데 기쁨 표정 | 앞선 대화를 보내지 않음(`LIMITS.historyMessages = 0`). 종류를 빼먹어도 `REFUSAL_HINT`("도와드릴 수 없" 등)가 있으면 OUT으로 봄 |
| 사용자 말만 넘기자 앞 질문들까지 여러 줄로 한꺼번에 답함 | 위와 같이 앞선 대화를 보내지 않음. `parseRoute`는 종류가 여러 줄이면 첫 번째만 씀. 지시문에 "마지막 사용자 말 하나에만, 답 하나만" |

- 고친 뒤 같은 7개를 다시 실제로 물어 모두 의도대로: 저녁·날씨·주식 → 주제를 넣은 한 문장 거절 + 아쉬움 표정, 밥 먹고 올게요 → "밥 맛있게 드세요!" + 기본 표정, 영화 할인·연회비 면제 → 3문장 이하·"정보에 없어요", 전부 합쳐서 얼마 → 요약 버튼과 같은 답(AI 호출 없음).
- 파일: `src/v2/chat/chatRules.ts`(LIMITS.historyMessages, MENU_KEYWORDS 1개, REFUSAL_HINT, AI_TEXT_FIXES, routerSystem 문구), `src/v2/chat/chatModel.ts`(routerMessages, parseRoute, firstSentences, cleanAiText, answerTyped의 종류 빠짐 처리), `tests/v2Chat.test.ts`(실제 시험에서 찾은 문제마다 테스트 추가).
- **잃은 것**: AI가 앞선 대화를 모름. "그럼 그 카드는?" 같은 이어지는 질문은 맥락 없이 판단된다(버튼 흐름은 영향 없음).
- 검증: `npx vitest run` 298개 통과, `npx tsc -b` 통과, oxlint 경고 0.

### 2026-11-01 (18) · 화면 이동 버튼 표시와 핏핏 완성 이동 장면

| 파일 | 영역 | 변경 | 이유 |
|---|---|---|---|
| `src/v2/chat/chatModel.ts` | 챗봇 | 새 export `screenName(to)`: 이동 경로 → 화면 이름(카드 선택 / 카드 종류 선택 / 지출 입력 / 자주 가는 곳 / 명세서로 지출 채우기 / 추천 결과 / 홈 / 내 지갑 / 전체 카드 / 혜택별 추천 / 카드 비교 / 이용 가이드) | 버튼 안내·이동 문구 |
| `src/v2/chat/NavTransition.tsx` | 챗봇 | **새 파일.** 화면 전체(뒤 흐림, `createPortal`→body, z-index 60)에 1.5초(`MOVE_MS`) 장면: 카드가 위에서 내려와 지갑에 꽂힘(0~30%) → 얼굴 나타남(30~47%) → 체크 배지 튀어나옴(47~63%) → 끝에서 사라짐. 아래 점 3개 + `"○○ 화면으로 이동하고 있어요"`. 0.3초(`NAVIGATE_AT`)에 뒤에서 `onNavigate` 호출 | 사용자 요청: 누르면 바로 넘어가지 않고 핏핏이 완성되며 이동하는 느낌 |
| `src/v2/chat/ChatDock.tsx` | 챗봇 | `act`: `to`/`pin` 액션은 바로 `navigate`하지 않고 `moving` 상태로 `NavTransition`을 띄움(pin은 `conditionsStore.set`을 이동 직전에 실행). 장면 도중 다른 이동 버튼 무시. **상담 창은 닫지 않음** | 사용자 결정(열어 둠) |
| `src/v2/chat/ChatDock.tsx` | 챗봇 | `Block`의 actions: 세로 배치로 바꾸고, 화면을 옮기는 버튼(`to`, `pin`)에는 글자 뒤 ↗ 아이콘 + 아래 12px 회색 안내 `누르면 '○○' 화면으로 이동해요`. '지금 조합 유지' 같은 대화용 버튼은 그대로 | 확인 창 대신 버튼 자체로 이동을 미리 알림(사용자 결정) |
| `tests/v2Chat.test.ts` | **[챗봇 폴더 밖]** 테스트 | `screenName` 테스트 1개 추가 | — |

- 확인 창(예/아니오) 방식은 검토 후 쓰지 않음: 이동은 잃는 게 없는 동작이라 매번 묻는 건 번거롭고, 새로고침 확인 창의 무게를 떨어뜨림.
- "전체 화면으로 해 보고 별로면 상담 창 안에서만" 하기로 함. 지금은 전체 화면.
- 검증: `npx tsc -b` 통과, `npx vitest run` 299개 통과, oxlint 경고 0. 브라우저에서 '가진 카드로 시작하기 ↗' + 안내 표시, 누르면 0.9초 시점에 완성된 핏핏·점·문구가 보이고 뒤 화면은 이미 카드 선택(`#/make/own/cards`), 1.5초 뒤 장면이 사라지고 상담 창은 열린 채 확인.

### 2026-11-01 (19) · '도와줘'와 새 카드 추천 요청 처리

실제 사용에서 찾은 문제: "도와줘" → AI가 잡담(TALK)으로 보고 "지금 도와드릴게요!"로만 끝냄. "취업 준비생에게 적합한 카드 추천", "쌩 상태에서 추천해달라고" → AI가 가진 자료가 지금 지갑 계산 결과뿐이라 **이미 고른 지갑을 새 추천인 것처럼** 반복함.

| 파일 | 영역 | 변경 |
|---|---|---|
| `src/v2/chat/chatRules.ts` | 챗봇 | `QUICK_TALK`에 도움 요청 규칙(도와줘/도와주세요/도움말/메뉴/뭐 할 수 있어/사용법 …, 문장 전체가 그 말일 때) → "네! 아래에서 도움이 필요한 걸 골라 주세요." + 큰 메뉴. 새 `NEW_CARD_REQUEST`(추천·골라·만들·발급 + 해줘/줘/할까/받고 싶 …, 또는 '카드/뭐/무슨/어떤 … 추천'으로 끝남)와 제외 `NEW_CARD_REQUEST_EXCEPT`(왜/이유/어떻게 계산/방식). `routerSystem`에 "[자료]의 조합은 이미 계산한 결과야. 새로 추천하는 카드처럼 말하지 마. 새 카드를 골라 달라면 '새 카드를 추천받고 싶어요' 메뉴 번호" 추가 |
| `src/v2/chat/chatModel.ts` | 챗봇 | 숨은 메뉴 `make:recommend`("새 카드를 추천받고 싶어요") 추가: 버튼으로는 안 보이고 `routerMenu`(직접 입력·AI 분류)에만 들어감. 답: "대화로 새 카드를 골라 드리는 건 아직 준비 중이에요. 새 카드까지 넣어서 계산하면 전체 카드 중에서 내 지출에 맞는 조합을 찾아 드려요." + [새 카드까지 넣어서 시작하기 ↗] + 후속 '추천은 어떻게 계산해요?'. `matchChoice`: 메뉴 낱말 규칙 다음에 `NEW_CARD_REQUEST`면 `make:recommend` |
| `tests/v2Chat.test.ts` | **[챗봇 폴더 밖]** 테스트 | 도움 요청 테스트, 새 카드 요청 5문장·제외 문장 테스트 추가 |

- 이건 **임시 안내**다. 새 카드 추천 알고리즘이 생기면 `make:recommend` 답 자리에 그 기능을 넣으면 된다.
- `NEW_CARD_REQUEST_EXCEPT`에 카드가 아닌 추천 주제(보험·대출·주식·코인·펀드·적금·예금·맛집·메뉴·음식·노래·책)도 넣음: "보험 추천해줘"가 새 카드 안내로 가지 않고 AI가 범위 밖으로 거절하게.
- 사용자가 대응을 직접 적을 수 있게 상위 폴더에 `챗봇_대화시나리오.md`(입력 예시 약 100개, 18묶음, 지금 반응 표시)를 만듦. 채워지면 규칙과 테스트로 반영 예정.
- 검증: `npx vitest run` 301개 통과, `npx tsc -b` 통과, oxlint 경고 0. 브라우저에서 스크린샷과 같은 세 문장을 입력해 기대한 답 확인, 게이트웨이 호출 0회.

### 2026-11-01 (20) · 시나리오 229개를 실제 코드로 돌려 찾은 오분류 2개 수정

시나리오 목록(사용자 입력 예시 229개)을 `answerTyped`(AI 없이)로 전부 돌려 지금 반응을 확인하다가 찾음.

| 찾은 문제 | 고친 곳 |
|---|---|
| "영화 추천해줘", "여행지 추천해줘"가 '추천해줘' 규칙에 걸려 **새 카드 안내**로 감 | `chatRules.ts`: 새 `NEW_CARD_CONTEXT`(카드·체크·신용·연회비·혜택·만들·발급·쌩·처음부터·아무것도). `matchChoice`는 `NEW_CARD_REQUEST` **그리고** `NEW_CARD_CONTEXT`가 있을 때만 `make:recommend`. 나머지는 AI가 판단(범위 밖이면 거절) |
| "실적 여유는 왜 둬?", "실적 여유 바꾸고 싶어"가 **여유 없이 계산 답**으로 감(`classify`의 noMargin이 '여유'만 있어도 걸림) | `answerTyped`에서 `classify`의 noMargin 경로 삭제('여유 없이 계산'은 `MENU_KEYWORDS`가 잡음). `faq:margin` 규칙에 '왜' 추가 → "실적 여유는 왜 둬?"는 실적 여유 설명 버튼답 |

- `tests/v2Chat.test.ts`: 위 문장들 테스트 추가. `npx vitest run` 302개 통과, `npx tsc -b` 통과, oxlint 경고 0.
- 시나리오 점검용 임시 테스트는 `tests/`에 잠깐 넣었다가 지움(저장소에 남지 않음).
- 결과물: 상위 폴더 `챗봇_대화시나리오_제안.xlsx`(입력 229개, 지금 반응·Claude 제안 대응·표정·처리 방식). 처리 방식 집계: 고정 문장 추가 91 · 됨 48 · AI 지시 35 · 규칙 추가/확장 33 · 엔진 답 추가 10 · 숨은 FAQ 9 · 기타 3.

### 2026-11-01 (21) · 대화 시나리오 229개 제안 대응을 전부 반영

사용자가 `챗봇_대화시나리오_제안.xlsx`를 검토하고 의견 없이(=전부 OK) 적용을 요청. 229개를 다시 실제 코드로 돌려 **전부 제안대로** 나오는 것을 확인함(189개는 AI 없이 정해 둔 답·버튼답·엔진 답, 40개는 제안 자체가 'AI 판단'인 범위 밖 거절·잡담 받기·정보에 없음).

**직접 입력 처리 순서(새로 바뀐 부분)** — `chatRules.ts` 맨 위 주석과 같다. AI는 맨 마지막 ④에서만 쓴다.

```
ⓐ 위기 표현(CRISIS) → 109 안내, 버튼 없음, AI로 안 보냄(빚 이야기가 있으면 서민금융진흥원 한 줄 추가)
ⓑ 개인정보(PRIVATE_INFO) → 카드·계좌·휴대전화 번호, 주민번호, 비밀번호, 이메일까지
ⓒ 안전(SAFETY) → 분실·도난 / 모르는 결제 / 사기 문자·링크 / 카드값 걱정 / 결제 오류
ⓓ GUARD → 욕설 / 설정 캐기 / 지시 무시·개발자 모드 / 역할 바꾸기 / 비난(+큰 메뉴) / 불만 / '너무 느려'
ⓔ 300자 넘는 글 / 링크 / 같은 말 4번째 반복(+큰 메뉴)
① QUICK_TALK(인사·감사·작별·맞장구) → ①-2 FOLLOW_UP('왜?', '그 카드는?' 등 → 다시 적어 달라고)
② 이모지만 → 큰 메뉴 / 한글 없는 영문 문장 → '한국어로만' / 영문 한 낱말·뜻 없는 입력 → 잘 모르겠어요
②-2 '편의점 자주 가'(OFTEN_GO) / TOPIC_REPLIES(서비스 소개·사용법·카드 상식 9개·카드사 업무·새 카드 관련)
    / 카드 비교 화면이 아닌데 '비교해줘' → 비교함 사용법
②-3 answerEngine: 카드 이름이 있으면 발급 중단·카드사·연회비, 지갑에 없는 카드 질문 → '지갑에 없어서…' + 전체 카드
     이름이 없으면 연회비 합계·1년 혜택·가장 큰 카드·결제 가이드·업종별 카드(지갑 없으면 '지갑부터 만들어 볼까요?')
③ matchChoice(메뉴 버튼답) → 카드 비교·통신비(classify) → ④ AI
```

| 파일 | 구분 | 바뀐 내용 |
|---|---|---|
| `src/v2/chat/chatRules.ts` | 챗봇 | 새 표: `CRISIS`·`SAFETY`·`GUARD`·`LINK`·`FOLLOW_UP`·`EMOJI_ONLY`·`OFTEN_GO`·`TOPIC_REPLIES`, 엔진 질문 낱말(`ASK_*`, `CATEGORY_WORDS`), `FIXED`에 6문장 추가, `LIMITS`에 `maxInputChars`(300)·`repeatCount`(3). 정해 둔 답의 모양 `FixedReply`(test/except/reply/mood/menu/next/go/bare/needWallet). `QUICK_TALK`이 `FixedReply[]`로 바뀌고(옛 `showMenu` → `menu`) 반가워·좋은 아침·처음이에요·덕분에·수고했어·이제 됐어·ㅇㅋ·좋아·응·필요 없어 추가. `PRIVATE_INFO`에 계좌·휴대전화·이메일. `MENU_KEYWORDS`에 home·menu:make·카드 n장·실적 기준/남은·요약(한 달 혜택/조합 괜찮/왜 이렇게)·정확해. `NEW_CARD_REQUEST` 확장('좋은 카드', '카드 알려줘', '아끼는 카드', '없는 카드', '뭐가 좋아'). `CARD_USE_WORDS`에 왜·이유·들어가·혜택·알려·설명. `routerSystem`에 '정보에 없어요. 카드사에서 확인해 주세요' 형식과 예시 추가 |
| `src/v2/chat/chatModel.ts` | 챗봇 | `answerTyped` 순서 재구성(위 그림). 새 함수 `goBlock`(이동 버튼, 지갑 없으면 '가진 카드로 시작하기'), `availableChoices`, `findRule`, `fixedAnswer`, `isRepeat`, `findCatalogCard`(카드 목록 이름 검색, 5글자 미만·'체크카드'는 제외), `answerCategory`, `answerEngine`. `cardsBlock(pack, maxCats)`. `maskPrivateInfo`가 이메일도 가림. `recordLines`의 `[카드]` 줄에 카드사·발급 여부 추가. AI CARD 답에 '정보에 없'이 있으면 아쉬운 표정, TALK 답이 고마운 말이면 기쁜 표정 |
| `tests/v2Chat.test.ts` | **[챗봇 폴더 밖]** 테스트 | '카드 상담 대화 시나리오' 묶음 12개 추가(바꿔 말한 표현, 잘못 걸리면 안 되는 말 포함). 바뀐 동작에 맞춰 기존 3개 수정('이 조합 괜찮은 거야?'는 이제 규칙이 요약으로 잇고, '실적 여유 바꾸고 싶어'는 정해 둔 안내) |

- **주의(시그니처)**: `QUICK_TALK` 항목 모양이 `{ test, reply, showMenu }` → `FixedReply`(`menu`)로 바뀜. `chatModel.ts` 밖에서 쓰는 곳은 없음.
- 잘못 걸림 막기: 욕설은 붙여 쓴 모양만 봄('1개 새로'·'신청 시 발급' 안 걸림), '힘들다'만으로는 위기 아님, '많이 쓰는'은 인기 카드 질문 아님, 날짜 '2026-11-01'은 개인정보 아님, '실적 여유 빼면'은 카드 빼기가 아니라 여유 없이 계산.
- 확인할 문구(팀): 명세서 형식(PDF·CSV, 엑셀 안 됨), '조건 바꾸기'에서 카드 수·실적 여유·월 소득을 바꾼다는 안내, 카드 정보 수집 시점은 UI·사실 확정 후 다시 볼 것.
- 검증: `npx vitest run` 314개 통과, `npx tsc -b` 통과, oxlint 경고 0. 시나리오 229개 재실행 결과 전부 제안대로. 브라우저(5174)에서 '카드 잃어버렸어'·'1년이면 얼마야?'·전화번호 입력을 직접 넣어 확인(전화번호는 말풍선에서 가려짐, 콘솔 오류 없음, 게이트웨이 호출 0회).

### 2026-11-01 (22) · 입력 판단을 'AI가 먼저, 앞 대화까지 보고'로 바꿈 + 의도 정의서

사용자 결정: AI 호출 비용·시간(질문마다 2~3초)을 감수하고, 업계 방식(입력 판단은 AI, 의도가 정해지면 답은 설계자가 정함)으로 바꾼다. 조사 근거: Google Dialogflow CX, Rasa CALM, Intercom Fin, Amazon Lex 문서(개발일지에 출처).

**처리 순서(새 구조)**
```
① [코드가 먼저] 위기(109)·개인정보·안전(SAFETY)·악용(GUARD)·300자 넘는 글·링크·반복·이모지·한글 글자 없는 입력
   + 버튼 문구를 그대로 입력하면 그 버튼(AI 안 부름)
② [AI 입력 판단] intentMessages → intentSystem: 의도 목록(intents.ts, 코드 처리 의도 제외) + 질문과 글자가 겹치는 예시 말 최대 24개
   + 앞 대화 최근 10개('[앞 대화]' 칸에 짧게, 핏핏 답은 80자까지) + 계산 결과 → JSON 한 줄 {intent, card, category, q, text}
③ [답] answerIntent: fixed=chatRules의 같은 id 답 / choice=버튼답 / card=그 카드 버튼답 / engine=계산 결과 답
   / ai=AI가 쓴 text를 코드가 다듬고 자름(자료 밖 카드 질문·범위 밖·잡담 3개뿐) / followup·unclear=정해 둔 문장
④ [예비] AI 키 없음·호출 실패·JSON 아님·없는 의도 → answerByRules(예전 규칙 순서). 규칙으로도 모르면 FIXED.unknown(실패면 이유 붙임)
```

| 파일 | 바뀐 내용 |
|---|---|
| `src/v2/chat/intents.ts` (새 파일) | **의도 정의서**: 의도 119개(묶음 A~T), 의도마다 id·이름·AI가 읽는 설명·예시 말(총 493개)·필요한 값(card/category)·답 방식. 여러 턴 대화 예시 `DIALOGS` 12개 |
| `src/v2/chat/chatRules.ts` | `FixedReply`에 `id` 필수(의도 id와 같음). SAFETY·GUARD·QUICK_TALK·TOPIC_REPLIES 81개 항목에 id. **`routerSystem`·`REFUSAL_HINT` 삭제**, 새 `intentSystem`·`AI_WRITES`. `LIMITS.historyMessages` 0→10(의미: 앞 대화 수), `historyBotChars` 80, `intentExamples` 24. `FIXED`에 `followUpUnresolved`·`whichCard`. 새 `UNCLEAR_STEPS`(못 알아들을 때 3단계). 규칙 2개 고침: 명세서 '무슨 파일', 저장한 지갑 '다른데' |
| `src/v2/chat/chatModel.ts` | **`routerMessages`·`parseRoute`·`Route` 삭제**, 새 `exactChoice`·`similarExamples`·`historyLines`·`intentMessages`·`IntentPick`·`parsePick`·`answerIntent`. `answerTyped`를 위 순서로 재구성(`answerFirst`·`answerByRules`로 나눔). 엔진 답을 `cardInfo`·`walletAnswer`·`categoryOf`로 나눠 의도에서도 부름. 못 알아들을 때 단계 대응(`failStreak`: '모르겠어요'·'답하기 어려워요'가 연달아 나오면 다음 단계, 두 번째부터 큰 메뉴) |
| `src/v2/chat/ChatDock.tsx` | 주석 한 줄만(아주LLM 쓰임 설명) |
| `tests/v2Chat.test.ts` | **[챗봇 폴더 밖]** 예전 AI 형식(MENU/CARD/TALK/OUT) 테스트를 JSON 의도 형식으로 바꿈. 'AI 입력 판단' 묶음 8개 추가(앞 대화·사투리, 업종·카드 값, 지갑 없을 때 '응', 단계 대응, AI 전에 막기, AI 실패 시 예비 규칙) |
| `tests/v2Intents.test.ts` (새 파일) | **[챗봇 폴더 밖]** 의도 정의서 검사: id 중복, 규칙 표와 id 일치, 버튼 id 유효, 예시 3개 이상·중복 없음, 모든 의도가 답을 만듦, 비슷한 예시 고르기, 대화 예시 의도 유효 |

- **주의(시그니처)**: `answerTyped(q, ctx, call, ai, history)` 모양은 그대로(ChatDock 수정 없음). `AskAi`가 받는 메시지 내용과 기대하는 답 형식이 바뀜(텍스트 → JSON 한 줄). `FixedReply.id` 필수.
- **비용**: AI 키가 있으면 ①에 안 걸린 모든 직접 입력이 AI를 한 번 부른다. 지시문은 약 9천 자(질문 하나에 대략 5~6천 토큰). 버튼은 여전히 AI를 안 부른다.
- 검증
  - `npx vitest run` 329개 통과, `npx tsc -b` 통과, oxlint 경고 0, `npm run build` 성공.
  - 예비 규칙만으로 의도 정의서 예시 493개 중 454개(92%)를 맞힘. 잘못된 답으로 보낸 것 0개, 나머지 39개는 바꿔 말한 표현(AI가 맡을 몫). 대화 시나리오 229개 모두 정의서 예시에 들어 있음.
  - 브라우저(5174, AI 키 없음)에서 직접 써 보다 찾은 문제: 모르는 말이 이어지면 '답하기 어려워요'가 같은 문장으로 반복됨 → 단계 대응으로 고치고 테스트 추가.
  - AI 지시문을 대화 예시 12개로 뽑아 직접 읽어 보고 고친 것: 겹치는 글자가 없는 예시가 빈자리를 채우던 것(잡음) 제거, '지갑부터 만들어 볼까요?' 뒤 '응' 예시 추가.
  - **실제 아주LLM 시험은 아직**(화면에 키가 없음). 키를 넣으면 `챗봇_의도정의서.xlsx`의 '여러 턴 대화' 12개와 예비 규칙이 놓친 39개로 시험할 것.
- 결과물: 상위 폴더 `챗봇_의도정의서.xlsx`(의도 목록·여러 턴 대화·못 알아들을 때·새 문장 검토). `intents.ts`에서 뽑은 것이라 코드와 내용이 같다.

### 2026-11-02 (23) · '그중에 제일 많이 받는 건?' 예비 규칙 빈틈, 카드 1장일 때 문장

사용자가 직접 써 보다 찾음(아주LLM 연결 전이라 예비 규칙으로 답하던 상태). 카드 1장 결과에서 '그중에 제일 많이 받는 건?' → 단계 대응 2번째 문장('아직 잘 모르겠어요…')이 나옴.

| 파일 | 바뀐 내용 |
|---|---|
| `src/v2/chat/chatRules.ts` | `ASK_BEST_CARD`가 '많이 받는/주는'과 끝말 '건·게'도 받음 |
| `src/v2/chat/chatModel.ts` | `walletAnswer("best")`: 카드가 1장이면 "지금 조합은 **○○** 한 장이라, 이 카드가 월 ○원을 모두 맡아요." |
| `src/v2/chat/intents.ts` | `wallet.best` 예시 2개 추가 |
| `tests/v2Chat.test.ts` | **[챗봇 폴더 밖]** 위 두 경우 테스트 |

- 검증: `tests/v2Chat.test.ts`·`tests/v2Intents.test.ts` 67개 통과, `npx tsc -b` 통과, oxlint 경고 0. 브라우저에서 같은 문장을 넣어 새 문장 확인, 콘솔 오류 없음.
- 확인한 사실: 이때 화면은 **'아주LLM 연결하기'(연결 안 됨)** 상태였다. 새 AI 입력 판단은 아직 실제로 돈 적이 없고 크레딧도 쓰지 않았다.

### 2026-11-02 (24) · 새 AI 입력 판단 첫 실제 시험(코드 변경 없음)

사용자가 아주LLM을 연결하고 직접 입력 3개를 보냄(카드 1장 지갑): "지갑 요약" → 요약 버튼답, "그 중 젤 많이 받는건?" → 1장 문장, "1년이믄 을마고?" → "1년이면 약 22만원이에요(월 순혜택 18,333원 × 12)." 세 개 모두 맞게 답함.
- "1년이믄 을마고?"는 오타('을마')가 있어 예비 규칙(`ASK_YEARLY`)으로는 못 잡는 말 → AI 입력 판단이 의도를 고른 것이 확인됨.
- 크레딧: 7,995 → 7,993(질문 3개에 2크레딧, 질문당 약 0.7크레딧). 월 한도 약 8,000이면 질문 1만 개 이상 가능 → 지시문 줄이기(질문과 비슷한 의도 후보만 보내기)는 보류. 크레딧이 정수로 보여 오차가 크므로 시험이 쌓이면 다시 계산.

### 2026-11-02 (25) · 여러 턴 대화 실제 시험, 고친 것 2개

아주LLM 연결 상태에서 `DIALOGS`를 지금 지갑(iD ON 1장)에 맞게 카드 이름만 바꿔 직접 입력함(약 20개 질문).
- 앞 대화가 필요한 질문 10개 중 **9개를 처음부터 맞힘**: '그럼 연회비는?', '그러문 연회비는뭐꼬?'(사투리), '그거 어느 카드사 거야?', '편의점은?', '마트는', '그럼 1년이면?', '내 건 다 채워져?', '그럼 주식은 뭐 사?'(범위 밖 거절), '안녕' 뒤 '그건?'(다시 물어보기).
- 틀린 1개: '실적 여유가 뭐야?' 뒤 '그거 없이 계산하면?' → '어떤 걸 말씀하시는지…'.

| 파일 | 바뀐 내용 |
|---|---|
| `src/v2/chat/chatRules.ts` | `intentSystem`에 예시 한 줄('핏핏이 실적 여유를 설명했고 그거 없이 계산하면? → perf.nomargin')과 규칙 한 줄('그거·그건·그럼'은 먼저 바로 앞 핏핏 답의 주제로 풀고, 그래도 모를 때만 followup.unresolved) |
| `src/v2/chat/chatModel.ts` | `shareWord`: 혜택 비중이 100%면 '이 조합 혜택 전부인'(카드 1장인데 '절반이 넘는'이라고 했음) |
| `src/v2/chat/intents.ts` | `DIALOGS` 7번 문장을 '그중에 제일 많이 받는 거는?'으로(예시와 겹치지 않게) |
| `tests/v2Chat.test.ts` | **[챗봇 폴더 밖]** 카드 1장 '전부인' 테스트 |

- 고친 뒤 실제 AI로 다시 시험: '그거 없이 계산하면?' → '실적 여유를 없애도 순혜택이 거의 늘지 않아요…' ✓, 'iD ON 혜택 뭐야?' → '이 조합 혜택 전부인 월 20,000원' ✓.
- 검증: `npx vitest run` 전체 통과, `npx tsc -b` 통과, oxlint 경고 0. 예비 규칙 점수 457/495(92%).
- `챗봇_의도정의서.xlsx`를 최신 코드로 다시 만들고 '여러 턴 대화' 시트에 실제 시험 결과를 채움(사용자 의견 칸이 비어 있는 것을 확인한 뒤 덮어씀).

### 2026-11-02 (26) · 회의 결과 1: 대화 시나리오 파일 이름과 묶음 정리

팀 회의 결과: 기본 UX/UI는 합격(건드리지 않음). 할 일 3개 — ① 대화 시나리오 파일 이름·내용 정리 ② AI 지침 파일 명시·내용 확인 ③ 챗봇에서 카드 추천 안 하기. 이번 항목은 ①.

| 파일 | 바뀐 내용 |
|---|---|
| `src/v2/chat/intents.ts` | 묶음을 A~T 19개(P가 빠져 있었음)에서 **6갈래 아래 묶음 24개**로 다시 나눔: 1 대화 시작·마무리(1-1~1-5) · 2 사이트 사용법(2-1~2-3) · 3 내 지갑 상담(3-1~3-4) · 4 카드 정보·지식(4-1~4-3) · 5 서비스·카드사 안내(5-1~5-3) · 6 안전·예외 처리(6-1~6-6). 의도 줄은 `group`만 바뀌고 순서를 묶음 순으로 옮김(id·설명·예시·답은 그대로) |

- 상위 폴더 문서 정리: 시나리오 파일 4개(`챗봇_대화시나리오.md`·`.xlsx`, `챗봇_대화시나리오_제안.xlsx`, `챗봇_의도정의서.xlsx`)를 `지난 버전` 폴더로 옮기고(이름 뒤에 `(2026-11-01~02)`), **`챗봇_대화시나리오.xlsx` 하나**로 합침. 시트: 읽는 방법 · 목차(6갈래→묶음→상황 수) · 대화 시나리오(번호 `3-1-04`, 사용자 말 → 핏핏 답 → 버튼, 개발용 칸은 회색) · 여러 턴 대화 · 못 알아들을 때.
- 합칠 때: 상대가 `intents.ts`를 고쳤다면 묶음 이름(`group`)과 순서만 바뀐 것이니 의도 줄 단위로 비교하면 된다.
- 검증: `npx vitest run tests/v2Intents.test.ts tests/v2Chat.test.ts` 68개 통과, `npx tsc -b` 통과.

### 알려진 문제 (아직 안 고침)

- 새 입력 판단은 실제 아주LLM으로 약 25개 질문만 시험함. 여러 턴 대화 중 '지갑 없을 때 응'은 지갑이 있는 상태라 아직 시험 못 함. 예비 규칙이 놓친 38개(바꿔 말한 표현)도 AI로 더 시험할 것. 형식이 깨지면 예비 규칙으로 답하므로 화면이 멈추지는 않음
- 질문마다 AI를 부르므로 응답이 2~3초 더 걸리고 크레딧을 씀(사용자가 감수하기로 함)
- 의도 정의서 예시는 의도마다 3~11개(업계 권장 10~20개보다 적음). 실제 사용자 대화로 늘려 갈 것
- `gpt-5.4-nano` + `REASONING_EFFORT = "medium"`(`azuLlmClient.ts`): 이번 시험에선 AI를 거쳐도 약 2~3초였음. 처음 연결 때 약 1분 사례가 있어 가끔 느릴 수는 있음
- `Fitfit`의 `thinking` 표정은 화면에서 쓰지 않음
- **새 카드 추천**("카페 많이 쓰면 뭐 만들까?")은 아직 없음. 메뉴는 새 카드 계산 화면으로 보내기만 함(알고리즘 설계 후 구현 예정)
