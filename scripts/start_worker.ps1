# 사연쇼츠 스튜디오 - Windows Worker Startup Script
param (
    [string]$ServerUrl = "https://ais-dev-vc2mpeanpks4vvvqfih7a3-32816725951.asia-northeast1.run.app",
    [string]$WorkerId = "",
    [string]$Mode = "auto",
    [string]$Cookie = ""
)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " 사연쇼츠 Windows Worker 실행 (Start)" -ForegroundColor Cyan
Write-Host " Server: $ServerUrl" -ForegroundColor Gray
Write-Host " Mode: $Mode" -ForegroundColor Gray
if ($Cookie -ne "") {
    Write-Host " Cookie: [Provided]" -ForegroundColor Gray
}
Write-Host "==========================================" -ForegroundColor Cyan

if (Test-Path ".venv\Scripts\python.exe") {
    $PythonExe = ".\.venv\Scripts\python.exe"
} else {
    $PythonExe = "python"
}

$ArgsList = @("worker\worker.py", "--server-url", $ServerUrl, "--mode", $Mode)
if ($WorkerId -ne "") {
    $ArgsList += @("--worker-id", $WorkerId)
}
if ($Cookie -ne "") {
    $ArgsList += @("--cookie", $Cookie)
}

& $PythonExe @ArgsList
