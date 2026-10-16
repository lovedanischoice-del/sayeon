# 사연쇼츠 스튜디오 - Windows Worker Diagnostic Tool (Doctor)
# Diagnoses ComfyUI (port 8188), GPU CUDA, FFmpeg, Whisper, and Server connectivity.

param (
    [string]$ServerUrl = "http://localhost:3000",
    [string]$Cookie = ""
)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " 사연쇼츠 스튜디오 시스템 환경 진단 (Doctor)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$AllGood = $true

# 1. ComfyUI Port 8188 Check
Write-Host -NoNewline "[1/5] ComfyUI (http://127.0.0.1:8188) 확인: "
try {
    $res = Invoke-RestMethod -Uri "http://127.0.0.1:8188/system_stats" -Method Get -TimeoutSec 3 -ErrorAction Stop
    Write-Host "정상 연결됨 (Online)" -ForegroundColor Green
} catch {
    Write-Host "미연결 (ComfyUI가 실행 중이지 않거나 포트 8188이 닫혀 있습니다)" -ForegroundColor Yellow
    $AllGood = $false
}

# 2. NVIDIA GPU & CUDA Check
Write-Host -NoNewline "[2/5] NVIDIA GPU / CUDA 확인: "
try {
    $nvidiaSmi = nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>&1
    Write-Host "$nvidiaSmi" -ForegroundColor Green
} catch {
    Write-Host "NVIDIA GPU를 감지하지 못했습니다 (CPU 또는 가상환경 모드로 작동)" -ForegroundColor Yellow
}

# 3. FFmpeg Check
Write-Host -NoNewline "[3/5] FFmpeg 비디오 렌더러 확인: "
try {
    $ffmpegVer = ffmpeg -version 2>&1 | Select-Object -First 1
    Write-Host "$ffmpegVer" -ForegroundColor Green
} catch {
    Write-Host "FFmpeg를 찾을 수 없습니다. (winget install Gyan.FFmpeg 필요)" -ForegroundColor Red
    $AllGood = $false
}

# 4. Whisper / ASR Check
Write-Host -NoNewline "[4/5] Faster-Whisper ASR 확인: "
if (Test-Path ".venv\Scripts\python.exe") {
    $whisperCheck = & .\.venv\Scripts\python.exe -c "import faster_whisper; print('OK')" 2>&1
    if ($whisperCheck -eq "OK") {
        Write-Host "설치됨 (faster-whisper 준비 완료)" -ForegroundColor Green
    } else {
        Write-Host "미설치 (scripts\setup_worker.ps1 실행 필요)" -ForegroundColor Yellow
    }
} else {
    Write-Host "가상환경 미설치 (.venv 없음)" -ForegroundColor Yellow
}

# 5. Web Server Connectivity Check
Write-Host -NoNewline "[5/5] 웹 서버 ($ServerUrl) 연결 확인: "
try {
    $headers = @{}
    if ($Cookie -ne "") {
        $headers["Cookie"] = $Cookie
    }
    $sysStatus = Invoke-RestMethod -Uri "$ServerUrl/api/system/status" -Headers $headers -Method Get -TimeoutSec 5 -ErrorAction Stop
    if ($sysStatus -is [string] -and $sysStatus -like "*<html*") {
        Write-Host "HTML 감지됨 (Google Cloud Run 쿠키 보호 페이지)" -ForegroundColor Yellow
        Write-Host "  -> 브라우저의 Cookie 값을 -Cookie 옵션으로 전달하거나, PC에서 로컬 서버(http://localhost:3000)를 실행하세요." -ForegroundColor Gray
        $AllGood = $false
    } else {
        Write-Host "정상 연결됨 (Server Online)" -ForegroundColor Green
    }
} catch {
    Write-Host "연결 실패 ($ServerUrl 에 접근할 수 없습니다)" -ForegroundColor Red
    $AllGood = $false
}

Write-Host "==========================================" -ForegroundColor Cyan
if ($AllGood) {
    Write-Host "모든 필수 환경이 준비되었습니다! 제작을 시작할 수 있습니다." -ForegroundColor Green
} else {
    Write-Host "일부 항목이 미연결 또는 미설치 상태입니다. SETUP.md를 참조하세요." -ForegroundColor Yellow
}
Write-Host "==========================================" -ForegroundColor Cyan
