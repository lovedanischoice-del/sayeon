import os
import zipfile

os.makedirs('public', exist_ok=True)
zip_path = 'public/saryeon_worker_bundle.zip'
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as z:
    for folder in ['worker', 'scripts', 'workflow_templates']:
        for root, dirs, files in os.walk(folder):
            for file in files:
                if not file.endswith('.pyc') and '__pycache__' not in root:
                    full = os.path.join(root, file)
                    z.write(full, full)
    readme_txt = (
        "[사연쇼츠 Windows Worker 실행 안내]\n\n"
        "1. 본 압축 파일을 C:\\Users\\shami\\saryeon-worker 또는 F:\\hermes\\saryeon-worker 에 풉니다.\n"
        "2. 해당 폴더에서 PowerShell을 열고 아래 명령어를 순서대로 실행합니다:\n\n"
        "   # 1단계: 환경 점검 (ComfyUI 연결 확인)\n"
        "   powershell -ExecutionPolicy Bypass -File scripts\\doctor.ps1 -ServerUrl \"https://ais-dev-vc2mpeanpks4vvvqfih7a3-32816725951.asia-northeast1.run.app\"\n\n"
        "   # 2단계: Worker 가동 (작업 수신 시작)\n"
        "   powershell -ExecutionPolicy Bypass -File scripts\\start_worker.ps1 -ServerUrl \"https://ais-dev-vc2mpeanpks4vvvqfih7a3-32816725951.asia-northeast1.run.app\"\n"
    )
    z.writestr('README_시작하기.txt', readme_txt)
print(f"Zip created successfully: {os.path.getsize(zip_path)} bytes")
