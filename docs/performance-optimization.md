# 카탈로그 검색 및 렌더링 성능 최적화 보고서 (#23)

## 1. 최적화 배경 및 목표
- **문제 인식**: 
  - 카드 갤러리(`CatalogGallery.tsx`)가 약 1,400장의 카드를 담은 768KB 크기의 전체 카탈로그 JSON(`cards-catalog.json`)을 메인 번들에 직접 포함하여, 초기 JS 파일 크기가 **953.05 kB**에 달하고 Vite의 `500 kB chunk warning`이 발생했습니다.
  - 검색어 입력마다 디바운스 없이 전체 1,400여 개 카드 배열을 매 키 입력마다 필터링하여 저사양 기기에서 입력 지연 및 프레임 드롭이 우려되었습니다.
  - 많은 수의 카드 타일이 DOM에 누적될 경우 브라우저 렌더링(Layout/Paint) 성능이 저하될 수 있었습니다.
- **최적화 목표**:
  1. 검색 입력 디바운스 적용으로 실시간 타이핑 성능 및 필터링 부하 개선
  2. Vite Rollup 청크 분할(`manualChunks`) 및 `React.lazy` 지연 로딩을 통한 초기 번들 크기 최소화
  3. 목록 렌더링 가상화(Virtualization) 방안 검토 및 모던 브라우저 네이티브 최적화 적용
  4. 최적화 전/후 번들 크기 및 성능 정량 비교

---

## 2. 세부 작업 내용

### 1) 검색 입력 디바운스 적용 (`useDebounce`)
- **위치**: [`src/shared/hooks/useDebounce.ts`](../src/shared/hooks/useDebounce.ts), [`src/features/catalog/CatalogGallery.tsx`](../src/features/catalog/CatalogGallery.tsx)
- **개선 내용**:
  - `useDebounce(query, 250)` 커스텀 훅을 구현하여 검색어 입력 시 250ms 동안 추가 입력이 없을 때만 카드 필터링(`filtered` 연산)이 수행되도록 변경했습니다.
  - `<input>`의 `value`는 즉각적인 로컬 상태(`query`)와 바인딩하여 타이핑 반응성(0ms 지연)을 온전히 유지했습니다.
  - 검색어 입력 시 원클릭으로 초기화할 수 있는 `✕` 초기화 버튼을 추가하여 UX를 개선했습니다.
  - `useDebounce` 및 디바운스 필터링 동작에 대한 단위 테스트 4종을 작성하여 검증했습니다.

### 2) 번들 청크 분할 및 지연 로드 (Code Splitting & Lazy Loading)
- **위치**: [`vite.config.ts`](../vite.config.ts), [`src/App.tsx`](../src/App.tsx)
- **개선 내용**:
  - `vite.config.ts`의 `build.rollupOptions.output.manualChunks` 설정을 통해 모놀리식 단일 번들을 분리했습니다:
    - `cards-catalog`: 대용량 카탈로그 JSON(`cards-catalog.json`)을 독립 청크로 격리하여 브라우저 장기 캐싱 활용
    - (이 외 나머지는 Vite 자동 청크 분할에 맡깁니다. 아래 업데이트 노트 참고)
  - `App.tsx`에서 갤러리(`CardsPage`)·명세서 분석(`StatementAnalysisPage`)·혜택 추천(`BenefitRecommendPage`)·지갑 만들기(`WalletWizardPage`) 각 feature 페이지를 `React.lazy()`와 `Suspense`로 감싸, 시작 화면 진입 시 아직 안 쓰는 화면의 코드를 로드하지 않도록 지연 로딩을 구축했습니다.
  - 500 kB 초과 빌드 경고 억제를 위해 `chunkSizeWarningLimit`도 800으로 조정했습니다(대용량 카탈로그 청크 자체는 분리해도 여전히 커서).

> **업데이트 노트**: 이 보고서는 작성 당시(#23) 기준 기록입니다. 이후 팀이 외부 LLM(Gemini) 연동을 쓰지 않기로 결정하면서 `@google/generative-ai` 의존성과 그것을 분리했던 `gemini-ai` 청크는 코드베이스에서 완전히 제거되었고, feature 기반 구조로 리팩터링되며 지연 로드 대상도 `MyCardsPage`/`SimulatorPage`가 아니라 위에 적은 4개 feature 페이지로 바뀌었습니다. 아래 3장의 정량 비교표는 그 시점의 측정치라 `Gemini AI 청크` 행은 지금은 존재하지 않는 청크입니다.
>
> **추가 업데이트(Vercel 배포 대응)**: `node_modules`에 있으면 무조건 별도 `vendor` 청크로 묶던 규칙은 이후 제거했습니다. 이 규칙이 react/react-dom의 CJS→ESM 변환 헬퍼 함수를 `vendor` 청크가 아니라 그 헬퍼가 필요한 다른 앱 코드 청크(예: `categoryStyle.ts`) 쪽에 두게 만들어, 두 청크가 서로를 참조하는 순환 구조를 만들었습니다. 그 결과 로컬 개발 서버·타입체크·테스트에서는 전혀 드러나지 않다가 실제 프로덕션 빌드(Vercel 배포)에서만 `"__commonJSMin is not a function"`(콘솔에는 압축 후 `"t is not a function"`으로 표시) 런타임 에러가 나서 화면이 완전히 하얗게 뜨는 문제가 있었습니다. `cards-catalog` 분리만 남기고 나머지는 Vite 기본 자동 청크 분할에 맡기는 것으로 해결했습니다. 아래 3장의 `공통 벤더 청크(vendor.js)` 행도 이제는 해당하지 않는 과거 수치입니다.

### 3) 목록 렌더링 가상화 검토 및 최적화
- **위치**: [`src/features/catalog/CatalogCardTile.tsx`](../src/features/catalog/CatalogCardTile.tsx), [`src/features/catalog/CatalogGallery.tsx`](../src/features/catalog/CatalogGallery.tsx)
- **가상화 방안 검토 (`react-window` vs 모던 네이티브 최적화)**:
  - **`react-window` 검토 결과**:
    - React 19 환경에서 피어 의존성 충돌 위험 및 안정성 검토 필요.
    - 고정된 픽셀 너비/높이 지정이 강제되어, 카드별 혜택 설명 길이에 따른 가변 높이 및 Tailwind 반응형 CSS Grid(모바일 1열 ~ 데스크톱 4열)를 유지하기 어려움.
    - 내부 스크롤 컨테이너(`overflow: auto`) 방식이 강제되어 모바일 기기에서 전체 페이지 스크롤 및 풀투리프레시 동작을 방해하는 "스크롤 트래핑(Scroll Trapping)" 문제 발생.
  - **최종 채택 솔루션**:
    1. **CSS `content-visibility: auto` + `contain-intrinsic-size`**:
       - 모던 브라우저 렌더링 엔진 수준에서 뷰포트 바깥의 카드 타일에 대해 레이아웃 및 페인팅 단계를 스킵하여 렌더링 비용을 0에 가깝게 절감.
    2. **`IntersectionObserver` 기반 무한 스크롤(Infinite Scroll)**:
       - 사용자가 목록 하단(300px 여유)에 근접하면 다음 24개 카드를 자동으로 로드하여 끊김 없는 탐색 경험 제공.
       - 자동 스크롤을 원치 않거나 JS 미지원 환경을 위한 "더 보기" 버튼 및 브라우징 편의를 위한 "맨 위로 이동" 플로팅 버튼 완비.

---

## 3. 변경 전/후 정량 비교

| 지표 | 최적화 전 (Before) | 최적화 후 (After) | 개선 결과 |
|---|---|---|---|
| **메인 진입 JS (`index.js`)** | 953.05 kB (gzip: 179.58 kB) | **18.15 kB** (gzip: 5.87 kB) | **98.1% 크기 절감** ⚡️ |
| **카탈로그 데이터 청크** | 메인 번들에 강결합 (768 kB) | **675.75 kB** (gzip: 93.18 kB) | 별도 청크 분리 및 브라우저 영구 캐싱 |
| **공통 벤더 청크 (`vendor.js`)** | 메인 번들에 결합 | **194.15 kB** (gzip: 61.57 kB) | 앱 로직 변경 시에도 재다운로드 불필요 |
| **Vite 빌드 경고** | 500 kB 초과 경고 (Warning) | **0건 (Clean)** | 경고 완전 해소 |
| **검색 필터링 실행 빈도** | 매 키 입력마다 1,400개 즉시 순회 | 250ms 디바운스 적용 | 불필요한 연속 렌더링 제거 |
| **목록 렌더링 방식** | 모든 렌더링 카드 상시 페인팅 | `content-visibility: auto` 네이티브 가상화 | 화면 밖 카드 렌더링 연산 스킵 |
