# walletfit

## 지출 데이터 기반 카드 "조합" 추천 서비스

<p align="center">
  <strong>아주대학교 산업공학과 · 산업공학종합설계 팀 프로젝트</strong><br>
  카드 한 장을 추천하는 서비스는 많다. walletfit은 지갑 속 여러 카드의 <b>최적 조합</b>을 계산한다.
</p>

walletfit은 사용자의 카테고리별 월 지출액을 입력받아, 카드 한 장을 그리디하게 고르는 대신
"카드를 최대 K장까지 섞어 썼을 때 순혜택(총 혜택 − 연회비 − 카드 관리 비용)을 최대화하는 조합"을
MILP(혼합정수계획법)로 계산해주는 클라이언트 전용 SPA입니다.

---

## 📌 목차
- [주요 기능](#-주요-기능)
- [🛠 기술 스택 및 선정 이유](#-기술-스택-및-선정-이유)
- [🏗 아키텍처 및 폴더 구조](#-아키텍처-및-폴더-구조)
- [🧹 정리가 필요한 파일](#-정리가-필요한-파일)
- [🚀 시작하기](#-시작하기)
- [🔄 카드 카탈로그 자동 수집](#-카드-카탈로그-자동-수집)
- [⚡️ 성능 최적화](#️-성능-최적화)
- [☁️ 배포 준비 (Vercel 등)](#️-배포-준비-vercel-등)

---

## ✨ 주요 기능

0. **시작 화면**: 처음 들어오면 사이드바 없이 "보유한 카드로 내 지갑 만들기" / "새 카드까지 포함해서 내 지갑 만들기" 두 갈래 중 하나를 먼저 고르는 온보딩 화면을 보여줍니다. 간단한 사용법 안내(카드 선택 → 지출 입력 → 추천 결과)도 이 화면에서 확인할 수 있습니다.
1. **카드 갤러리**: 카드고릴라에서 수집한 1,400여 개 국내 신용/체크카드를 카드명·카드사·종류로 검색/필터링하며 둘러볼 수 있습니다.
   - **다중 정렬 옵션**: 기본 추천순 외에 연회비 낮은순/높은순, 카드명 가나다순, 최신순 다중 정렬 옵션을 제공합니다.
   - **카드 비교**: 관심 있는 카드를 여러 장 골라 연회비·혜택 요약·구간별 요율을 나란히 비교할 수 있습니다.
2. **내 카드 담기 및 백업 관리**: 관심 있거나 보유한 카드를 "내 카드"에 담아 관리하고, 담은 카드들의 연회비 합계를 한눈에 확인할 수 있습니다.
   - **JSON 백업 및 가져오기**: 담아둔 내 카드 목록을 JSON 파일로 안전하게 내보내거나, 스키마 유효성 검증을 거쳐 손쉽게 복구 및 불러오기를 수행할 수 있습니다.
3. **내 지갑 만들기 (카드 조합 추천)**: 카테고리별 예상 월 지출액을 입력하면, 카드 한 장짜리 최선의 선택뿐 아니라 여러 장을 조합했을 때의 최적 지갑을 계산합니다.
   - **MILP 기반 다중 카드 최적화**: 카드 한 장을 들고 다니는 데 드는 관리 비용까지 목적함수에 반영해, 실제로 이득이 되는 만큼만 알고리즘이 스스로 카드 수를 골라 담습니다. 전월실적 구간(어느 구간까지 도달했는지)까지 최적화 변수로 다뤄서, 근사가 아니라 실제 구간별 요율을 반영합니다.
   - **혜택 최대화 / 효율적 모드**: "혜택 최대화"는 MILP 결과를 그대로 쓰고, "효율적"은 기여도가 낮은 카드를 사후에 추려내 카드 수를 줄입니다. 두 모드가 같은 조합을 고르면 화면에 보이는 숫자도 항상 완전히 같습니다.
   - **내 카드 중 추천 / 전체 카드 중 추천**: 담아둔 카드만 대상으로 계산하거나, 즐겨찾기 여부와 무관하게 전체 카탈로그를 대상으로 동일하게 계산할 수 있습니다.
   - **카드사 제외 필터**: 특정 카드사를 통째로 추천 후보에서 뺄 수 있습니다.
   - **소득 기반 카드 수 추천**: 월 소득을 입력하면 카테고리별 지출 비중 가정치로 지출을 역산해, 적정 카드 수를 미리 계산해 보여줍니다.
   - **빠른 수정**: 추천된 조합에서 카드 한 장을 다른 카드로 바꿔보고, 바꾸기 전/후 순혜택 차이를 바로 비교할 수 있습니다.
   - **지출 프로필 영구 저장 & 슬라이더 스케일링**: 설정한 지출 내역은 브라우저 LocalStorage에 보존되며, 전체 예산 슬라이더로 카테고리 비율을 유지한 채 일괄 스케일링하거나 기본값으로 초기화할 수 있습니다.
4. **스마트 외부 지출 내역 가져오기**: 결제 문자/카드사 알림 텍스트, 영수증 이미지, PDF 카드사 명세서(pdfjs-dist로 필요할 때만 불러옴)를 업로드하면 지출 항목을 자동으로 카테고리별로 분류해 시뮬레이터에 반영합니다.
   - **환불 내역 음수 금액 자동 차감**: 결제 취소 및 환불 건(-금액)을 인식해 해당 카테고리의 지출 총액에서 자동으로 상쇄 차감합니다.
   - **파싱 결과 검토 및 직접 추가/일괄 삭제**: 지출 파싱 결과 테이블에서 누락된 결제 내역을 직접 행 추가하거나, 불필요한 항목들을 다중 선택하여 일괄 삭제할 수 있습니다.
   - **영수증 파일 용량 및 포맷 사전 검증**: 영수증 업로드 시 파일 크기(최대 10MB) 및 지원 확장자(JPEG, PNG, WEBP 등)를 사전에 검증합니다.
   - 지금은 모든 파싱이 키워드/정규식 기반 규칙 파서로 로컬에서 동작합니다(서버 전송 없음).
5. **카드 추천 챗봇**: "카드 상담 챗봇"은 내 카드 목록과 지출 패턴을 참고해 규칙 기반으로 한 문장 조언을 만들어줍니다. 외부 LLM 호출 없이 전부 로컬 로직으로만 동작합니다.
6. **UI**: "벤토 그리드 + 리파인드 글래스" 방향으로 홈/지갑 만들기 결과/사이드바를 다시 디자인했습니다. 좁은 화면(모바일)에서는 사이드바가 오버레이 메뉴로 바뀌고, 버튼 눌림 피드백과 화면 진입 애니메이션이 들어가 있습니다.

---

## 🛠 기술 스택 및 선정 이유

### Frontend
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

- **Vite + React 19**: 가볍고 빠른 빌드 속도로 즉각적인 화면 렌더링 및 생산성을 높이기 위해 선정.
- **TypeScript**: 카드 데이터 및 계산 로직 내의 데이터 구조(Type) 안정성 및 오차 예방.
- **Tailwind CSS v4**: `@tailwindcss/vite` 기반으로 빠르고 조화로운 UI 레이아웃 설계.
- **Vitest**: 계산 로직과 추천 알고리즘의 정확성을 보장하기 위한 단위 테스트 환경 제공.
- **Pyodide + scipy.optimize.milp(HiGHS)**: 다중 카드 조합 최적화(MILP)의 실제 운영 솔버입니다. 브라우저 안에서 도는 Python(WASM)을 Web Worker에서 돌려서, 후보가 많아져도 화면이 멈추지 않고 순수 JS 솔버보다 계산도 빠릅니다. 학교/사내망에서 외부 CDN이 막히는 경우가 흔해서, Pyodide 런타임은 `public/pyodide-dist`에 정적 파일로 직접 서빙합니다(서버 불필요).
- **javascript-lp-solver**: 예전 메인 스레드용 MILP 솔버입니다. 지금은 실제 서비스 경로에서는 쓰이지 않는 legacy 코드(`src/domain/engine/walletOptimizer.ts`의 `buildWalletBlueprint`)로만 남아 있고, `src/legacy/SimulatorPage.tsx`가 회귀 참고용으로 붙잡고 있습니다. 같은 파일의 후보 추리기(`shortlistCandidates`)는 지금도 "전체 카드 중 추천"에서 실제로 쓰입니다.
- **pdfjs-dist**: PDF 카드사 명세서에서 텍스트를 뽑아낼 때 씁니다. 번들 용량이 커서 PDF를 실제로 업로드했을 때만 동적으로 불러옵니다.

> 외부 LLM(Gemini 등)은 쓰지 않기로 했습니다. 지출 파싱과 카드 상담 챗봇 모두 서버 호출 없이 로컬 규칙 기반 로직으로만 동작합니다.

---

## 🏗 아키텍처 및 폴더 구조
계산 로직(도메인)과 화면(기능별 UI)을 분리하고, 여러 화면이 공유하는 부품은 별도로 격리한 **기능 기반(feature-based) 구조**를 채택했습니다. 서버 없이 전부 클라이언트에서 동작하는 SPA입니다.

```text
walletfit-app/
├── 📁 data/
│   ├── categories.json          # 지출 카테고리 정의 파일
│   └── 📁 catalog/
│       ├── cards-catalog.json        # 앱이 실제로 읽는 카탈로그(기본정보 + 구간별 요율)
│       ├── cards-detail-raw.json     # fetch:tiers가 받아오는 원본(빌드 전용, git 제외)
│       └── discontinued-cards.json   # 신규 발급 중단 카드 임시 보조 목록
├── 📁 public/
│   ├── 📁 pyodide-dist/          # Pyodide 런타임 + scipy/numpy wheel 자체 호스팅(~90MB)
│   ├── 📁 demo/                  # 명세서 가져오기 예시용 샘플 영수증 이미지
│   └── (favicon, 로고, 배경 이미지 등)
├── 📁 src/
│   ├── 📁 domain/                 # UI와 무관한 순수 계산 계층
│   │   ├── 📁 types/              # WalletCard, CatalogListing, MonthlySpend 등 공통 타입 정의
│   │   ├── 📁 engine/              # 혜택 계산기, 추천 랭킹, MILP 조합 최적화, 카탈로그 변환/로드
│   │   │   ├── walletOptimizer.ts          # 문제 정의/타입 + shortlistCandidates(후보 추리기)
│   │   │   ├── walletOptimizer.worker.ts   # Pyodide 부팅 + solve 요청 처리(Web Worker)
│   │   │   ├── walletOptimizerCore.py      # 실제 MILP를 scipy로 푸는 Python 코드
│   │   │   └── useWalletBlueprintAsync.ts  # 위 Worker를 감싼 React 훅
│   │   └── 📁 state/               # 영구 저장 상태 훅 (useSavedCards, useMonthlySpend 등)
│   ├── 📁 features/               # 화면 단위 기능. 폴더 하나 = 탭(또는 그에 준하는) 하나
│   │   ├── 📁 start/               # 시작 화면(보유한 카드로 / 새 카드까지 포함해서)
│   │   ├── 📁 home/                # 홈 대시보드
│   │   ├── 📁 catalog/             # 카드 갤러리, 내 카드 관리, 카드 상세/비교 모달
│   │   ├── 📁 statement/           # 지출 내역 가져오기(텍스트/영수증/PDF 파싱)
│   │   ├── 📁 benefit/             # 혜택 추천 랭킹 화면
│   │   ├── 📁 wallet/              # 내 지갑 만들기(마법사, 결과, 빠른 수정, 소득 추정 등)
│   │   └── 📁 chatbot/             # 카드 추천 챗봇(규칙 기반, 외부 LLM 미사용)
│   ├── 📁 shared/                  # 두 개 이상의 feature가 함께 쓰는 순수 UI/유틸
│   │   ├── 📁 layout/               # Sidebar 등 앱 셸 레이아웃
│   │   ├── 📁 components/           # CardThumb, CardList, SpendingSimulator, ErrorBoundary 등
│   │   ├── 📁 contexts/             # ToastContext(전역 알림)
│   │   ├── 📁 hooks/                # useDebounce, useToast
│   │   ├── 📁 lib/                  # format, categoryStyle 등 범용 유틸
│   │   └── 📁 types/                # 서드파티 타입 보강(lucide-react, javascript-lp-solver)
│   ├── 📁 legacy/                  # 카드 한 장 추천 방식의 구(舊) 화면. 조합 추천으로 대체되어 실제 앱에서는 더 이상 쓰이지 않지만, 회귀 테스트 커버리지를 위해 보존
│   └── App.tsx                     # 탭 전환 셸(시작 / 홈 / 갤러리 / 지출분석 / 혜택추천 / 지갑만들기)
├── 📁 tests/                       # Vitest 단위 테스트 파일
├── 📁 docs/                        # 접근성/성능/보안 검토 문서
└── 📁 scripts/
    ├── fetchCardCatalog.ts         # 카드고릴라 카탈로그 기본정보 수집
    ├── fetchCardTierDetail.ts      # 카드고릴라 내부 API 원본 응답 수집(구간표 원재료)
    ├── tierTableParser.ts          # 원본 응답 속 구간표 파싱 로직
    └── buildTieredCatalog.ts       # 위 둘을 합쳐 cards-catalog.json에 구간별 요율(tiers)을 채움
```

### 데이터 흐름
- 카드 갤러리·내 카드·혜택 추천·지갑 만들기는 모두 `data/catalog/cards-catalog.json`(카탈로그)을 기준으로 동작합니다.
- `src/domain/engine/cardConverter.ts`가 카탈로그의 자연어 혜택 요약(`benefitSummary`)을 키워드 매칭으로 파싱해, 계산기가 이해하는 카테고리별 할인/적립률(`WalletCard` 타입)로 변환합니다.
- 구간별 요율(`categoryTiers`)이 있는 카드는 `scripts/buildTieredCatalog.ts`가 미리 채워둔 값을 그대로 쓰고, 없는 카드는 예전처럼 실적 조건 없이(0원부터) 단일 요율이 적용되는 것으로 근사합니다.
- `src/domain/engine/walletOptimizer.worker.ts`가 Web Worker 안에서 Pyodide를 부팅하고 `walletOptimizerCore.py`(scipy MILP)를 실행합니다. "예산 내에서 카드를 K장까지 골라 조합으로 순혜택(혜택 − 연회비 − 카드 관리 비용)을 최대화"하는 문제를, 어느 실적 구간에 도달하는지까지 같이 최적화해서 풉니다.

---

## 🧹 정리가 필요한 파일
이전에 안내했던 구버전/미사용 파일들(Gemini 관련 파일 9개, feature 구조 이전의 구버전 폴더 `src/components`·`contexts`·`hooks`·`lib`·`types`, `_scipy_parts/`, `Claude outputs/`, `data/catalog/cards-detail-raw.json`)은 모두 삭제 완료했습니다. `cleanup-move-stale-files.ps1`은 이제 옮길 대상이 남아있지 않아 실행해도 아무 일도 하지 않으니, 프로젝트 루트에 그대로 둬도 무해하고 지워도 상관없습니다.

폴더 전체를 다시 한 번 훑으면서 Gemini 관련 내용이 남아있던 곳을 두 군데 더 찾아 고쳤습니다.
- `docs/performance-optimization.md`: 이미 제거된 `@google/generative-ai` 청크(`gemini-ai`) 언급을 정리하고, 지연 로드 대상 페이지 목록을 지금 구조(`CardsPage`/`StatementAnalysisPage`/`BenefitRecommendPage`/`WalletWizardPage`)에 맞게 고쳤습니다.
- `tests/cardAdvice.test.ts`: 이미 지워진 옛 Gemini 연동 버전의 `getCardAdvice`(API Key 인자, `@google/generative-ai` 모킹)를 대상으로 한 테스트라 `npm run test` 실행 시 실패하는 상태였습니다. 지금 실제 구현(로컬 규칙 기반, API Key 없음)에 맞춰 새로 작성했습니다.

---

## 🚀 시작하기
아래 명령어를 통해 프로젝트 패키지를 설치하고 개발 서버를 가동합니다.
```bash
npm install
npm run dev
```

기타 스크립트:
```bash
npm run build           # 타입 체크 + 프로덕션 빌드
npm run test            # Vitest 단위 테스트 실행
npm run test:coverage   # Vitest 테스트 커버리지 리포트 생성
npm run lint            # oxlint 코드 정적 분석
npm run lint:a11y       # jsx-a11y 웹 접근성 정적 분석
npm run fetch:catalog   # 카드 기본정보 카탈로그 수집/갱신
npm run fetch:tiers     # 구간별 요율 원본(raw) 수집 — 실제 사용자 컴퓨터에서 실행 필요(아래 참고)
npm run build:catalog   # 위 둘을 합쳐 cards-catalog.json에 구간별 요율을 채워 넣음
```

---

## 🔄 카드 카탈로그 자동 수집
카탈로그는 세 단계로 만들어집니다.

1. **`npm run fetch:catalog`** — 카드고릴라(card-gorilla.com) 상세 페이지에 SEO용으로 정적 렌더링되는 `application/ld+json`을 읽어 카드명 / 카드사 / 연회비 / 이미지 URL / 혜택 요약 / 신규 발급 중단 여부를 `data/catalog/cards-catalog.json`에 모읍니다.
2. **`npm run fetch:tiers`** — 카드고릴라 내부 API에서 카드별 상세 응답을 원본 그대로 받아 `data/catalog/cards-detail-raw.json`에 저장합니다. 이 API는 일부 클라우드 데이터센터 IP 대역에서 접속이 막혀 있는 것으로 확인되어서, 반드시 실제 사용자 컴퓨터(가정용/학교 네트워크)에서 직접 실행해야 합니다. 처음에는 `-- --limit=30` 정도로 소량만 받아 표 파싱이 잘 맞는지 확인한 다음 전체를 돌리는 걸 추천합니다.
3. **`npm run build:catalog`** — 위 두 파일을 합쳐서, 전월실적 구간별로 실제 다른 요율이 적용되는 카드는 그 구간(`tiers`)까지 채운 `cards-catalog.json`을 다시 씁니다. 구간 데이터가 없는 카드/카테고리는 기존처럼 단일 요율 근사를 그대로 씁니다.

```bash
npm run fetch:catalog                 # 전체 카드 수집
npm run fetch:catalog -- --limit=50   # 개수 제한 (테스트용)
```

* 사이트맵(`sitemap-cards.xml`)에서 카드 ID 목록을 가져온 뒤, 요청 간 간격을 두고 순회합니다.
* 카드고릴라 이용약관에 크롤링 제한 조항이 있는지 정기적으로 직접 확인하고, 과도한 요청은 피해주세요.

---

## ⚡️ 성능 최적화
약 1,400여 개의 대용량 카드 카탈로그 데이터를 쾌적하게 렌더링·검색·계산하기 위해 다양한 성능 최적화를 적용했습니다.

1. **검색 입력 디바운스 (`useDebounce`)**: 입력 반응성은 0ms로 즉각 유지하면서, 250ms 디바운스를 적용하여 1,400여 개 배열의 연속적인 필터링 부하를 대폭 줄였습니다.
2. **번들 청크 분할 및 지연 로드 (Code Splitting & Lazy Loading)**: Vite `manualChunks`로 대용량 카탈로그 JSON과 벤더 라이브러리를 분리하고, 각 feature 페이지를 `React.lazy`로 지연 로드하여 진입 JS 크기를 크게 절감했습니다.
3. **네이티브 가상화 & 무한 스크롤**: CSS `content-visibility: auto`와 `IntersectionObserver`를 적용하여 반응형 Grid 구조를 유지하면서 뷰포트 밖의 렌더링 비용을 0으로 단축했습니다.
4. **MILP 계산의 Web Worker 오프로딩**: 예전에는 MILP 솔버(javascript-lp-solver)가 메인 스레드에서 동기적으로 돌아서, 후보 카드가 많아지면 화면이 그대로 멈췄습니다. 지금은 Pyodide + scipy(HiGHS)를 별도 Web Worker에서 돌려서, 계산이 오래 걸려도 화면이 멈추지 않고 계산 자체도 더 빠릅니다.

> 자세한 전/후 벤치마크 및 가상화 비교 분석은 [성능 최적화 보고서](docs/performance-optimization.md)에서 확인하실 수 있습니다.

---

## ☁️ 배포 준비 (Vercel 등)
walletfit은 서버가 필요 없는 순수 정적 SPA라서, `npm run build`가 만드는 `dist/` 폴더만 올리면 Vercel/Netlify/GitHub Pages 등 어디에나 배포할 수 있습니다.

- Vercel은 Vite 프로젝트를 자동으로 인식하므로 별도의 `vercel.json` 없이, 빌드 명령 `npm run build` / 출력 폴더 `dist`만 확인하면 됩니다.
- 외부 LLM/API 호출이 전혀 없어서, 배포 쪽에 서버 환경변수를 설정할 필요가 없습니다.
- `public/pyodide-dist/`가 그대로 리포에 커밋된다는 점은 미리 알아두는 게 좋습니다(scipy wheel 하나만 약 47MB, 전체 약 90MB). [Vercel 공식 문서](https://vercel.com/docs/limits)(2026-09 기준) 기준으로 CLI로 배포할 때 소스 파일 업로드 용량 한도가 Hobby 플랜은 100MB, Pro 플랜은 1GB입니다. GitHub 저장소를 연결해서 배포하면 이 한도가 그대로 적용되지 않을 수 있지만, 리포 자체 용량이 커지는 건 마찬가지라 클론/체크아웃 속도에 영향을 줍니다. Hobby 플랜에서 막히면 Pro로 올리거나, `public/pyodide-dist/`만 Git LFS로 따로 관리하는 방법을 검토해볼 수 있습니다.
- 구버전/미사용 파일 정리는 이미 끝난 상태입니다([정리가 필요한 파일](#-정리가-필요한-파일) 참고). `_scipy_parts/`, `Claude outputs/`, `data/catalog/cards-detail-raw.json`은 혹시 다시 생기더라도 `.gitignore`에 이미 등록돼 있어 git에는 올라가지 않습니다.
- 브랜치/커밋 컨벤션은 `.cursorrules`에 정리되어 있습니다. `main`에 직접 커밋하지 않고 `feature/작업-내용` 또는 `fix/작업-내용` 브랜치로 작업한 뒤, `{태그}: {요약}` 형식의 커밋 메시지를 씁니다.
