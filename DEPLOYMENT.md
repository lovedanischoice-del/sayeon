# 사연쇼츠 스튜디오 - 배포 가이드 (DEPLOYMENT.md)

이 문서는 Google AI Studio / Google Cloud Run 배포 및 컨테이너 런타임 수명 주기를 설명합니다.

---

## 1. Cloud Run 컨테이너 런타임 특성

- **비영속적 파일 시스템:** Cloud Run 인스턴스가 재시작되거나 축소될 때 로컬 디스크 내용은 초기화됩니다.
- **영속 상태 전략:** 
  - 영속적 작업 상태는 `server/db.ts`의 원자적 저장소 또는 Firestore로 보존됩니다.
  - Windows Worker는 로컬 체크포인트와 작업 저널을 유지하므로, 서버 컨테이너가 교체되거나 네트워크가 일시 단절되어도 이전에 완료된 샷(S01~S10)을 재사용합니다.
  - 생성된 비디오 및 이미지 자산은 장기 보존을 위해 오브젝트 저장소 또는 Google Drive로 동기화됩니다.

---

## 2. 빌드 및 배포

### 2.1 프로덕션 빌드
```bash
npm run build
```
Vite가 `src/` 프런트엔드 애플리케이션을 최적화된 번들로 `dist/`에 출력합니다.

### 2.2 서비스 시작
`package.json`의 `"start"` 스크립트는 `server.ts`를 실행합니다:
```bash
npm start
```
`server.ts`는 프로덕션 모드(`NODE_ENV=production`)에서 `dist/`의 정적 번들을 서빙하고 모든 `/api/*` 요청을 처리합니다.

---

## 3. 포트 및 권한 규칙

- **포트:** 3000 (`PORT=3000`)
- **API Secret:** `GEMINI_API_KEY`는 서버 환경변수로만 취급되며 브라우저에 절대 노출되지 않습니다.
- **Worker 통신 보안:** Worker는 오직 아웃바운드 HTTPS로 서버와 통신하며, 인가된 `worker_id`와 만료 시간(lease) 기반의 토큰으로 작업을 제어합니다.
