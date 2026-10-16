# 사연쇼츠 스튜디오 - Windows Worker Setup Script
# Creates Python virtual environment and installs worker dependencies.

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " 사연쇼츠 Windows Worker 환경 설정 (Setup)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Check Python version
try {
    $pyVersion = python --version 2>&1
    Write-Host "[OK] Python 확인됨: $pyVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Python 3.10+ 이 설치되어 있지 않거나 PATH에 없습니다." -ForegroundColor Red
    Exit 1
}

# 2. Create isolated virtual environment (.venv)
if (-Not (Test-Path ".venv")) {
    Write-Host "[INFO] 가상환경(.venv) 생성 중..." -ForegroundColor Yellow
    python -m venv .venv
}

# 3. Activate venv & install dependencies
Write-Host "[INFO] 종속성 패키지 설치 중 (requests, faster-whisper, ffmpeg-python)..." -ForegroundColor Yellow
& .\.venv\Scripts\pip install --upgrade pip
& .\.venv\Scripts\pip install -r worker\requirements.txt

# 4. Check FFmpeg
try {
    $ffmpegVer = ffmpeg -version 2>&1 | Select-Object -First 1
    Write-Host "[OK] FFmpeg 확인됨: $ffmpegVer" -ForegroundColor Green
} catch {
    Write-Host "[WARN] FFmpeg가 PATH에 없습니다. Winget으로 설치 권장: winget install Gyan.FFmpeg" -ForegroundColor Yellow
}

Write-Host "==========================================" -ForegroundColor Green
Write-Host " Worker 설치 완료! scripts\start_worker.ps1 로 실행하세요." -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
