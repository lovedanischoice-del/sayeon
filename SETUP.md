# 사연쇼츠 스튜디오 - 설치 및 환경 설정 가이드 (SETUP.md)

이 문서는 웹 서버 및 Windows Worker PC를 구성하는 전체 절차를 안내합니다.

---

## 1. 서버 환경 설정 (Google AI Studio / Cloud Run)

### 1.1 환경 변수
`.env.example` 파일을 복사하여 `.env`를 구성합니다:
```bash
# Gemini API Key (AI Studio Secrets에서 자동 주입)
GEMINI_API_KEY="AIzaSy..."

# 서버 배포 URL (클라우드 환경 시 Cloud Run URL)
APP_URL="https://ais-dev-vc2mpeanpks4vvvqfih7a3-32816725951.asia-northeast1.run.app"
PORT=3000
```

### 1.2 서버 시작
```bash
npm install
npm run dev
```

---

## 2. Windows Worker PC 환경 설정

### 2.1 요구 사항
- **OS:** Windows 10/11 64-bit
- **Python:** 3.10 이상
- **GPU:** NVIDIA GPU (VRAM 12GB 이상 권장 - H3 원활 구동)
- **ComfyUI:** 로컬 실행 중 (`http://127.0.0.1:8188`)
- **FFmpeg:** Windows PATH에 등록되어 있을 것

### 2.2 자동 설치 스크립트 실행
PowerShell 관리자 권한으로 실행:
```powershell
# 1. 스크립트 실행 권한 허용 및 환경 구축
powershell -ExecutionPolicy Bypass -File scripts\setup_worker.ps1
```
이 스크립트는:
- 가상환경 `.venv`를 생성합니다.
- `requests`, `faster-whisper`, `ffmpeg-python` 등 필수 의존성을 설치합니다.
- `ffmpeg` 명령어가 시스템에 설치되어 있는지 검증합니다.

### 2.3 환경 진단 (Doctor)
```powershell
powershell -ExecutionPolicy Bypass -File scripts\doctor.ps1 -ServerUrl "https://ais-dev-vc2mpeanpks4vvvqfih7a3-32816725951.asia-northeast1.run.app"
```
진단 항목:
1. `http://127.0.0.1:8188/system_stats` 연결 확인 (ComfyUI 활성 여부)
2. NVIDIA CUDA 가속 상태 확인
3. FFmpeg 정상 동작 확인
4. Faster-Whisper ASR 패키지 로드 테스트
5. 서버와의 HTTPS 통신 상태 확인

### 2.4 Worker 가동
```powershell
powershell -ExecutionPolicy Bypass -File scripts\start_worker.ps1 -ServerUrl "https://ais-dev-vc2mpeanpks4vvvqfih7a3-32816725951.asia-northeast1.run.app"
```

---

## 3. ComfyUI H3 노드 매핑 (`workflow_templates/workflow_binding.json`)

기존에 사용자가 정상적으로 구동하던 H3 워크플로 그래프의 노드 번호를 바인딩합니다:
```json
{
  "node_mappings": {
    "start_image_input": { "node_id": "12", "field_name": "image" },
    "positive_prompt": { "node_id": "6", "field_name": "text" },
    "dialogue_text_input": { "node_id": "24", "field_name": "dialogue_text" },
    "seed": { "node_id": "3", "field_name": "seed" },
    "output_video": { "node_id": "45" }
  }
}
```
*주의: 시스템은 새로운 워크플로를 생성하지 않으며 위 매핑 파일에 지정된 안전한 입력 필드만 치환하여 실행합니다.*
