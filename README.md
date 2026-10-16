# 사연쇼츠 스튜디오 (Story Shorts Studio) v1.0

> **한국 감동 휴먼드라마 숏폼(사연쇼츠) 자동 완주 제작 웹앱**  
> 기준 제작 계약: 사연쇼츠 자동완주 스킬 v3.8.1 (2026-10-12 갱신본)

---

## 1. 제품 개요

사용자가 웹 브라우저에서 사연을 입력하고 **'자동 제작 시작'**을 누르면, 시스템이 다음 과정을 사람의 중간 개입 없이 자동으로 진행합니다:
```
사연 접수 
  → 1. Gemini 구조화 기획·대본 (v3.8.1)
  → 2. 캐릭터·장소·소품 기준 확정
  → 3. 10개 샷(S01~S10) 9:16 시작 이미지 생성 및 검증
  → 4. 고난도 컷(PILOT) 선행 테스트
  → 5. Windows Worker의 기존 ComfyUI H3 5초 영상·음성 원본 생성
  → 6. Faster-Whisper 음성 분석 및 단어 단위 타임스탬프
  → 7. FFmpeg 9개 경계 및 J/L-cut 자동 타임라인 합성
  → 8. 자동 기술 QC 검사
  → 9. 최종 렌더 완성 (render_ready = true)
  → 10. 감독(사람)의 전체 시청·청취 후 승인 (editing_complete = true)
  → 11. Google Drive 개별 파일 납품 및 재조회 검증
```

---

## 2. 핵심 아키텍처 원칙

1. **자동 완주 (Final-Only Review):**
   - 대본이나 이미지 단계에서 사람의 확인 클릭을 요구하지 않습니다.
   - 단 한 번의 사연 등록으로 최종 검수용 MP4까지 도달합니다.
2. **PC를 공개 인터넷에 노출하지 않는 Worker 구조:**
   - 웹 서버의 `localhost`를 사용자 PC라고 가정하지 않습니다.
   - Windows Python Worker가 아웃바운드 HTTPS로 서버 작업을 안전하게 가져옵니다 (`POST /api/workers/claim`).
3. **기존 H3 워크플로 및 노드 매핑 재사용:**
   - 임의의 새로운 ComfyUI 그래프를 LLM으로 매번 생성하지 않습니다.
   - `workflow_binding.json`에 정의된 검증된 시작 이미지, 프롬프트, 대사 노드만 안전하게 치환합니다.
4. **진실한 상태 분리:**
   - `render_ready`: 실제 MP4 파일 생성 및 자동 기술 QC 통과.
   - `editing_complete`: 사람이 전체 영상을 보고 듣고 승인해야만 기록 (AI나 클라이언트 임의 설정 불가).
   - `drive_export_status`: Google Drive 업로드 및 재조회 검증 완료 상태.
5. **최소 단위 부분 수정 및 의존성 복구:**
   - **자막 오탈자만 수정:** H3 영상/이미지 생성 호출 0회 (기존 영상 100% 재사용).
   - **특정 샷(예: S04)만 수정:** S01~S03, S05~S10의 고유 해시와 원본을 보존하고 S04만 선택적으로 재생성.
   - **브라우저 종료 및 Worker 재시작:** 로컬 저널 및 서버 체크포인트를 통해 중단 지점부터 즉시 재개.

---

## 3. 빠른 시작 가이드

### 3.1 웹 서버 실행 (Node.js)
```bash
npm install
npm run dev
# http://localhost:3000 접속
```

### 3.2 Windows Worker 실행 (Windows PC)
Worker PC의 PowerShell에서:
```powershell
# 1단계: 환경 설정 및 가상환경 설치
powershell -ExecutionPolicy Bypass -File scripts\setup_worker.ps1

# 2단계: 환경 진단 (ComfyUI 8188 포트, FFmpeg, GPU 확인)
powershell -ExecutionPolicy Bypass -File scripts\doctor.ps1

# 3단계: Worker 가동
powershell -ExecutionPolicy Bypass -File scripts\start_worker.ps1
```

### 3.3 인수 시험 (AT-01 ~ AT-26) 실행
```bash
npm test
```
총 26개 계약 검증 항목(10샷 규격, 0회 사람 개입, 부분 무효화, 자막 전용 수정 시 0회 H3 호출, 예산 상한, 진실성 게이트)이 자동 검증됩니다.

---

## 4. 디렉터리 구조

```text
├── server.ts                   # Express 풀스택 엔트리포인트 (Port 3000, Vite 미들웨어)
├── server/
│   ├── db.ts                   # 원자적 영속 상태 장부 (Projects, Runs, Workers, Reviews, Usage)
│   ├── geminiGateway.ts        # Gemini API 게이트웨이 (gemini-3.8-flash, gemini-3.1-flash-lite-image)
│   └── routes.ts               # PRD 15조 명세 API 전체 구현
├── worker/
│   ├── worker.py               # Windows Worker 메인 루프 (아웃바운드 HTTPS 폴링 및 체크포인트)
│   ├── comfyui_adapter.py      # ComfyUI 공식 API 어댑터 (안전 인터럽트, 노드 바인딩)
│   ├── audio_aligner.py        # Faster-Whisper 음성 분석 및 타임스탬프 정렬
│   ├── timeline_renderer.py    # FFmpeg 9:16 세로 1080x1920 자동 합성 렌더러
│   └── qc_checker.py           # 확정적 기술 QC 검사기
├── shared/schemas/types.ts     # TypeScript 공용 데이터 스키마
├── production_rules/saryeon-v3.8.1/ # v3.8.1 기계 판독 제작 규칙 및 프롬프트
├── workflow_templates/         # ComfyUI H3 API 그래프 및 workflow_binding.json
├── scripts/                    # setup_worker.ps1, start_worker.ps1, doctor.ps1
└── tests/                      # 3개 시험 사연 fixtures 및 AT-01~AT-26 테스트 러너
```
