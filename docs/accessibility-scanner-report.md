# CI 접근성(a11y) 스캐너 재도입 및 점검 보고서

- **관련 이슈**: #24 ([Feat] CI 접근성(a11y) 스캐너 재도입)
- **작업 브랜치**: `BE-홍길동-24`
- **작성일자**: 2026-09-03

---

## 1. 배경 및 목적
과거 커밋(`6fbe701`)에서 CI 워크플로우(`.github/workflows/ci.yml`)에 포함되어 있던 접근성(a11y) 스캐너 단계가 제거된 이후, 장기간 복원되지 않아 코드 변경 시 접근성 회귀(Accessibility Regression)를 감지할 수 있는 자동화 장치가 부재한 상태였습니다.

이에 따라 과거 제거 사유를 면밀히 분석하고, 현재 프로젝트 환경(React 19, Vite, Oxlint, Vitest)에 최적화된 대체 접근성 검사 도구를 도입하여 CI 파이프라인에 재구축하고 주요 화면의 접근성 결함을 1차 점검 및 개선하였습니다.

---

## 2. 과거 접근성 스캐너 제거 사유 분석 (`6fbe701`)

### 2.1 커밋 내역 및 워크플로우 실행 이력
- **제거 커밋**: `6fbe701` (`🔧 Chore: CI에서 접근성 스캐너 단계 제거 구현`)
- **당시 사용 액션**: `uses: github/accessibility-scanner@v3.1.0`
- **CI 실패 기록**: 액션 실행 시 지속적으로 `failure` 발생 (`job/96386931473`)

### 2.2 실패 원인 분석
1. **정적/배포 서버 미구동**: `github/accessibility-scanner`는 실행 시 브라우저 또는 타깃 웹 URL을 직접 방문하여 스캔하도록 설계되어 있습니다. 당시 CI 단계는 정적 테스트 환경이었으며 로컬 서버나 URL이 전달되지 않아 스캔 실패를 초래했습니다.
2. **권한 및 토큰 문제**: 해당 액션은 이슈 자동 생성 및 Copilot 제안 기능 등을 위해 기본 `GITHUB_TOKEN`이 아닌 추가 권한(`issues: write`, `pull_requests: write`, `contents: write`)을 지닌 Personal Access Token(PAT)을 요구합니다. 기본 CI 러너 환경에서는 권한 부족으로 비정상 종료되었습니다.
3. **결론**: CI 빌드 파이프라인 안정성을 위해 당시 임시 제거되었으나, 정적 분석 및 단위 테스트 단계에서 실행 가능한 대안이 마련되지 않았던 상태였습니다.

---

## 3. 대체 접근성 도구 비교 조사

| 비교 항목 | GitHub Accessibility Scanner | ESLint JSX-A11y (Oxlint 내장) | Axe-Core (Vitest 결합) |
| :--- | :--- | :--- | :--- |
| **검사 방식** | 런타임 URL/AI 기반 스캐닝 | 정적 JSX AST 파싱 및 규칙 검사 | 컴포넌트 렌더링 DOM 기반 WCAG 검사 |
| **실행 속도** | 느림 (네트워크, AI 의존) | **매우 빠름 (수십 ms 단위, Rust 기반)** | **빠름 (수백 ms 단위)** |
| **추가 비용/권한** | 외부 PAT, Copilot 권한 필요 | **불필요 (오프라인 로컬/CI 완벽 구동)** | **불필요 (개발 의존성 설치로 구동)** |
| **탐지 범위** | 렌더링된 라이브 사이트 이슈 | 정적 코드 레벨의 ARIA/시맨틱 위반 | 실제 DOM 노드 대상 표준 WCAG 위반 |
| **채택 여부** | 미채택 (CI 종속성 높음) | **채택 (1차 정적 린트)** | **채택 (2차 컴포넌트 단위 테스트)** |

### 최종 도구 선정 전략: **2단계 계층형 방어(Defense in Depth)**
1. **1차 방어 (정적 린터)**: 프로젝트에 기구축된 Rust 기반 초고속 Linter인 `oxlint`의 `jsx-a11y` 플러그인을 활성화(`lint:a11y`)하여, 빌드 전 JSX 수준의 접근성 규칙 위반을 20~30ms 만에 즉각 차단.
2. **2차 방어 (DOM 렌더링 단위 테스트)**: 표준 접근성 엔진인 `axe-core`를 설치하고 Vitest 테스트 스위트(`tests/a11y.test.tsx`)를 구축하여, 주요 컴포넌트 렌더링 시 WCAG 2.1 Level A/AA 표준을 자동으로 검증.

---

## 4. CI 워크플로우 재도입 및 구성 내역

### 4.1 워크플로우 구성 (`.github/workflows/ci.yml`)
Lint 단계 직후 `Check Accessibility (a11y)` 단계를 추가하여 회귀를 엄격히 차단하도록 구성하였습니다.

```yaml
    - name: Check Lint (Optional)
      if: steps.check_package.outputs.exists == 'true'
      run: npm run lint --if-present

    - name: Check Accessibility (a11y)
      if: steps.check_package.outputs.exists == 'true'
      run: npm run lint:a11y --if-present
      
    - name: Run Tests & Coverage (Optional)
      if: steps.check_package.outputs.exists == 'true'
      run: npm run test:coverage --if-present
```

### 4.2 스크립트 및 린터 설정
- `package.json`: `"lint:a11y": "oxlint -D jsx-a11y"` 추가 (위반 발생 시 즉시 빌드 실패 처리)
- `.oxlintrc.json`: `"plugins": ["react", "typescript", "oxc", "jsx-a11y"]` 구성

---

## 5. 기존 주요 화면 대상 접근성(a11y) 1차 점검 및 개선 결과

Oxlint JSX-A11y 및 Axe-core 점검을 통해 기존 주요 컴포넌트들의 접근성 결함을 도출하고 전면 수정하였습니다.

| 대상 컴포넌트 | 기존 결함 및 위반 사항 | 개선 내용 |
| :--- | :--- | :--- |
| **`ParsedItemsTable`** | input 및 select 태그에 레이블 부재 (`control-has-associated-label`) | `aria-label="가맹점명"`, `aria-label="카테고리"`, `aria-label="금액"` 부여 및 삭제 버튼에 `aria-label="항목 삭제"` 추가 |
| **`CardList`** | 빈 테이블 헤더 `<th>` 방치로 스크린리더 탐색 시 혼선 유발 | 각 헤더에 `scope="col"` 명시 및 마지막 열에 `<span className="sr-only">상세보기</span>` 레이블 제공 |
| **`CatalogCardTile`** | `span role="button"` 사용 및 버튼 내부 버튼 중첩 (`prefer-tag-over-role`) | 카드 타일을 컨테이너 `div`와 시맨틱 `<button>`들로 분리하여 유효한 HTML5 구조 확립 및 키보드 개별 포커스 지원 |
| **`CardDetailModal`** | `div role="dialog"` 및 비대화형 요소 클릭 이벤트 (`no-static-element-interactions`) | 시맨틱 `<dialog open>` 적용, 백드롭을 독립된 오버레이 버튼으로 분리, `aria-labelledby="card-modal-title"` 연동 |
| **`SpendingImporter`** | 이미지 드래그앤드롭 영역 `div role="button"` (`prefer-tag-over-role`) | 시맨틱 `<button type="button">`으로 변경, 키보드(Space/Enter) 조작 및 포커스 링 지원, 파일 입력 요소 분리 |

---

## 6. 테스트 및 검증 결과

1. **정적 접근성 린터 (`npm run lint:a11y`)**:
   - 검사 파일 44개 대상 151개 규칙 검사 완료
   - `jsx-a11y` 위반 오류 및 경고: **0건 (완전 무결)**
2. **컴포넌트 자동화 단위 테스트 (`npm test`)**:
   - `tests/a11y.test.tsx` 포함 14개 테스트 파일, 총 72개 테스트 **100% 통과 (Pass)**
   - axe-core WCAG 2.1 A/AA 위반 사항 **0건**
