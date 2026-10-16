# 사연쇼츠 Windows Worker 원클릭 다운로드 및 설치 스크립트
# 사용법: powershell -ExecutionPolicy Bypass -Command "irm https://ais-dev-vc2mpeanpks4vvvqfih7a3-32816725951.asia-northeast1.run.app/quickstart.ps1 | iex"

$ServerUrl = "https://ais-dev-vc2mpeanpks4vvvqfih7a3-32816725951.asia-northeast1.run.app"
$ZipUrl = "$ServerUrl/saryeon_worker_bundle.zip"
$TargetDir = Join-Path (Get-Location) "saryeon-worker"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " 사연쇼츠 Windows Worker 원클릭 설치기" -ForegroundColor Cyan
Write-Host " 대상 폴더: $TargetDir" -ForegroundColor Gray
Write-Host "==========================================" -ForegroundColor Cyan

if (-Not (Test-Path $TargetDir)) {
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
}

$TempZip = Join-Path $env:TEMP "saryeon_worker_bundle.zip"
Write-Host "[1/3] 서버에서 최신 Worker 패키지 다운로드 중..." -ForegroundColor Yellow
Invoke-WebRequest -Uri $ZipUrl -OutFile $TempZip -UseBasicParsing

Write-Host "[2/3] 압축 해제 중: $TargetDir" -ForegroundColor Yellow
Expand-Archive -Path $TempZip -DestinationPath $TargetDir -Force
Remove-Item $TempZip -Force

Set-Location $TargetDir
Write-Host "[3/3] 설치 완료! 폴더 이동됨: $TargetDir" -ForegroundColor Green

Write-Host "`n>>> ComfyUI 환경 점검(Doctor) 실행 중..." -ForegroundColor Cyan
powershell -ExecutionPolicy Bypass -File "scripts\doctor.ps1" -ServerUrl $ServerUrl

Write-Host "`n==========================================" -ForegroundColor Green
Write-Host " Worker 가동 준비 완료!" -ForegroundColor Green
Write-Host " 지금 바로 Worker를 가동하려면 아래 명령을 실행하세요:" -ForegroundColor Yellow
Write-Host " powershell -ExecutionPolicy Bypass -File scripts\start_worker.ps1 -ServerUrl `"$ServerUrl`"" -ForegroundColor White
Write-Host "==========================================" -ForegroundColor Green
