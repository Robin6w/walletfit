# walletfit 정리 스크립트
# 안 맞거나 더 이상 안 쓰이는 파일/폴더를 한 곳(_정리대상)으로 모아줍니다.
# 바로 지우지 않고 옮기기만 하니, _정리대상 폴더 안을 한 번 확인한 뒤 폴더째로 지우면 됩니다.
#
# 실행 방법: 이 파일이 있는 walletfit-app 폴더에서 PowerShell을 열고
#   powershell -ExecutionPolicy Bypass -File .\cleanup-move-stale-files.ps1
# 를 실행하거나, 이 파일을 마우스 오른쪽 버튼으로 눌러 "PowerShell로 실행"을 선택하세요.

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$dest = Join-Path $root "_정리대상"

if (-not (Test-Path $dest)) {
    New-Item -ItemType Directory -Path $dest | Out-Null
}

# 옮길 대상: (프로젝트 루트 기준 상대경로, 이유)
$targets = @(
    @{ Path = "src\components";  Reason = "feature 기반 구조 이전의 구버전 중복 폴더" },
    @{ Path = "src\contexts";    Reason = "feature 기반 구조 이전의 구버전 중복 폴더" },
    @{ Path = "src\hooks";       Reason = "feature 기반 구조 이전의 구버전 중복 폴더" },
    @{ Path = "src\lib";         Reason = "feature 기반 구조 이전의 구버전 중복 폴더" },
    @{ Path = "src\types";       Reason = "feature 기반 구조 이전의 구버전 중복 폴더" },
    @{ Path = "src\features\settings"; Reason = "Gemini API Key 설정 화면 - LLM 안 쓰기로 하면서 쓸모 없어짐, 앱 어디서도 안 열림" },
    @{ Path = "tests\ApiKeySettings.test.tsx";       Reason = "위 settings 화면 테스트, 같이 안 씀" },
    @{ Path = "tests\GeminiApiKeyContext.test.tsx";  Reason = "위 settings 화면 테스트, 같이 안 씀" },
    @{ Path = "docs\gemini-api-key-security-review.md"; Reason = "Gemini 키 보안 검토 문서 - 대상이 사라져서 의미 없음" },
    @{ Path = "_scipy_parts";    Reason = "public/pyodide-dist에 이미 있는 scipy wheel의 중복 조각 파일(약 47MB)" },
    @{ Path = "Claude outputs";  Reason = "예전 세션에서 만든 목업 파일 내보내기, 앱과 무관" },
    @{ Path = "data\catalog\cards-detail-raw.json"; Reason = "빌드 전용 원본 데이터(18.9MB). npm run fetch:tiers로 다시 받을 수 있음" }
)

foreach ($t in $targets) {
    $src = Join-Path $root $t.Path
    if (Test-Path $src) {
        $destPath = Join-Path $dest $t.Path
        $destParent = Split-Path $destPath -Parent
        if (-not (Test-Path $destParent)) {
            New-Item -ItemType Directory -Path $destParent -Force | Out-Null
        }
        Move-Item -Path $src -Destination $destPath -Force
        Write-Host "옮김: $($t.Path)  ($($t.Reason))"
    } else {
        Write-Host "건너뜀(이미 없음): $($t.Path)"
    }
}

Write-Host ""
Write-Host "완료했습니다. '$dest' 폴더 안을 확인한 뒤, 문제 없으면 그 폴더를 통째로 지우면 됩니다."
