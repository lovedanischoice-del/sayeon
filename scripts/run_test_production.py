"""
사연쇼츠 스튜디오 - 1편 전체 자동 제작 테스트 스크립트
1. 사연 등록 (30년 만에 찾은 고향 국밥집)
2. Run 생성
3. Worker 실행을 통해 기획 -> 10샷 명세 -> 시작 이미지 -> 영상 -> ASR 음성 분석 -> FFmpeg 합성 -> QC -> 검수 대기(render_ready)까지 자동 완주
"""

import requests
import json
import time
import os
import sys

# Ensure worker modules are in sys.path
sys.path.append(os.path.abspath("worker"))
from worker import StoryShortsWorker

SERVER_URL = "http://localhost:3000"

def main():
    print("======================================================")
    print(" 사연쇼츠 스튜디오 - 테스트 제작 (전 파이프라인 자동 완주)")
    print("======================================================\n")

    # 1. 사연 등록
    project_payload = {
        "title": "30년 만에 찾은 고향 국밥집",
        "raw_story": (
            "어린 시절 가난해서 밥을 굶던 날, 욕쟁이 할머니는 돈도 받지 않고 고기 가득 든 국밥 한 그릇을 말아주셨습니다. "
            "'성공해서 꼭 갚으라'던 그 호통을 가슴에 품고 대기업 임원이 되어 30년 만에 그 골목을 다시 찾았습니다. "
            "휠체어를 탄 90대 백발의 할머니는 제 얼굴을 보자마자 단번에 '그때 그 코흘리개 녀석이구나'라며 주름진 손을 잡아주셨습니다."
        ),
        "must_keep_sentences": ["그때 그 코흘리개 녀석이구나"],
        "ending_intent": "오랜 세월을 뛰어넘은 온정과 은혜에 대한 눈물의 보답",
        "fact_type": "verified_true_story",
        "budget_limit_krw": 50000
    }

    print("[1/3] 새 프로젝트 등록 중...")
    r = requests.post(f"{SERVER_URL}/api/projects", json=project_payload, timeout=10)
    if r.status_code not in [200, 201]:
        print(f"프로젝트 등록 실패: {r.text}")
        sys.exit(1)
    project = r.json()
    project_id = project["id"]
    print(f" -> 프로젝트 생성 완료! ID: {project_id}, 제목: {project['title']}")

    # 2. Run 등록
    print("\n[2/3] 자동 제작 Run 등록 중...")
    r_run = requests.post(f"{SERVER_URL}/api/projects/{project_id}/runs", timeout=10)
    if r_run.status_code not in [200, 201]:
        print(f"Run 등록 실패: {r_run.text}")
        sys.exit(1)
    run = r_run.json()
    run_id = run["id"]
    print(f" -> Run 등록 완료! ID: {run_id}, 상태: {run['status']}")

    # 3. Worker 실행을 통해 전 파이프라인 순차 완주
    print("\n[3/3] Worker 파이프라인 가동 (기획 -> 10샷 이미지 -> 영상 -> ASR -> 편집 -> QC)...")
    worker = StoryShortsWorker(server_url=SERVER_URL, worker_id="test_runner_worker", mode="simulation")
    worker.register()

    # Loop until render_ready is True
    max_steps = 15
    steps = 0
    while steps < max_steps:
        steps += 1
        claim = worker.claim_job()
        if not claim or not claim.get("has_work"):
            # Check run status directly
            chk = requests.get(f"{SERVER_URL}/api/runs/{run_id}").json()
            if chk.get("flags", {}).get("render_ready"):
                print("\n>>> 최종 렌더 완료 (render_ready = True) 확인!")
                break
            time.sleep(1)
            continue

        stage = claim["run"]["current_stage"]
        print(f"\n[Worker 단계 진행 {steps}/{max_steps}] Stage: {stage}")
        worker.execute_run(claim, claim["lease_token"])

        # Check if completed
        chk = requests.get(f"{SERVER_URL}/api/runs/{run_id}").json()
        if chk.get("flags", {}).get("render_ready"):
            print("\n>>> 최종 렌더 완료 (render_ready = True) 확인!")
            break

    # 4. 최종 결과 검증 및 리포트
    final_run = requests.get(f"{SERVER_URL}/api/runs/{run_id}").json()
    flags = final_run.get("flags", {})
    manifest = final_run.get("manifest", {})
    shots = manifest.get("shots", [])

    print("\n======================================================")
    print(" 테스트 제작 결과 요약")
    print("======================================================")
    print(f"- Project ID: {project_id}")
    print(f"- Run ID: {run_id}")
    print(f"- 상태: {final_run.get('status')} (검수 대기: AWAITING_REVIEW)")
    print(f"- render_ready: {flags.get('render_ready')}")
    print(f"- editing_complete: {flags.get('editing_complete')} (사람 승인 전: False 유지)")
    print(f"- 총 샷 수: {len(shots)}샷 (S01~S10)")
    
    for s in shots:
        print(f"  [{s['scene_id']}] {s['beat_role'].upper():<10} | 화자: {s['speaker_id'] or '무대사':<10} | 대사: {s['exact_dialogue_or_silent'][:18]}")

    print(f"- 자막 파일: {manifest.get('output_assets', {}).get('subtitles_srt')}")
    print(f"- 클린 렌더: {manifest.get('output_assets', {}).get('final_clean_mp4')}")
    print(f"- 자막 렌더: {manifest.get('output_assets', {}).get('final_captioned_mp4')}")

    # SNS 메타데이터 조회 확인
    meta = requests.get(f"{SERVER_URL}/api/runs/{run_id}/publish-metadata").json()
    print("\n[SNS 자동 생성 메타데이터]")
    print(f"- YouTube 쇼츠 제목: {meta['youtube']['title']}")
    print(f"- YouTube 고정 댓글: {meta['youtube']['pinned_comment']}")
    print(f"- Instagram 릴스 태그: {' '.join(meta['instagram']['hashtags'][:5])}")
    print("======================================================\n")

if __name__ == "__main__":
    main()
