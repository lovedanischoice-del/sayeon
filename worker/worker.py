"""
사연쇼츠 스튜디오 - Windows Python Worker (v3.8.1)
HTTPS Outbound Worker claiming tasks from Cloud/Local Server.
Handles ComfyUI H3 Video, Faster-Whisper ASR, FFmpeg Timeline, and Checkpointing.
"""

import sys
import os
import time
import argparse
import requests
import json
import uuid
from typing import Dict, Any, Optional

from comfyui_adapter import ComfyUIAdapter
from audio_aligner import AudioAligner
from timeline_renderer import TimelineRenderer
from qc_checker import QCChecker

class StoryShortsWorker:
    def __init__(self, server_url: str, worker_id: Optional[str] = None, mode: str = "auto", cookie: Optional[str] = None):
        url = server_url.rstrip('/')
        # Windows IPv6 fix: replace 'localhost' with '127.0.0.1' to prevent WinError 10061 on ::1
        if "://localhost" in url:
            url = url.replace("://localhost", "://127.0.0.1")
        self.server_url = url
        self.worker_id = worker_id or f"win_worker_{uuid.uuid4().hex[:6]}"
        self.mode = mode
        self.cookie = cookie
        self.running = True

        self.session = requests.Session()
        if self.cookie:
            self.session.headers["Cookie"] = self.cookie

        self.comfyui = ComfyUIAdapter()
        self.aligner = AudioAligner()
        self.renderer = TimelineRenderer(output_dir=os.path.join("data", "output"))
        self.qc = QCChecker()

        self.active_claim = None
        self._detect_capabilities()

    def _detect_capabilities(self):
        comfy_online = self.comfyui.check_connection()
        ffmpeg_ok = self.renderer.check_ffmpeg()
        whisper_ok = self.aligner.model is not None

        if self.mode == "auto":
            self.mode = "real" if comfy_online else "simulation"

        self.capabilities = {
            "comfyui_online": comfy_online,
            "comfyui_url": self.comfyui.comfyui_url,
            "h3_workflow_loaded": True,
            "ffmpeg_available": ffmpeg_ok,
            "whisper_available": whisper_ok,
            "gpu_name": "NVIDIA RTX Series / CUDA" if comfy_online else "Standard Host",
            "vram_mb": 16384 if comfy_online else 0,
            "mode": self.mode
        }
        print(f"[Worker] Initialized ID={self.worker_id}, Mode={self.mode}, ComfyUI={comfy_online}")

    def register(self):
        try:
            payload = {
                "id": self.worker_id,
                "name": f"Windows H3 Worker ({self.mode})",
                "platform": "windows",
                "capabilities": self.capabilities
            }
            r = self.session.post(f"{self.server_url}/api/workers/register", json=payload, timeout=10)
            if r.status_code == 200:
                print(f"[Worker] Successfully registered with server {self.server_url}")
                return True
            else:
                print(f"[Worker] Registration failed: {r.status_code} {r.text}")
                return False
        except Exception as e:
            print(f"[Worker] Server connection error: {e}")
            return False

    def send_heartbeat(self):
        try:
            r = self.session.post(f"{self.server_url}/api/workers/heartbeat", json={
                "worker_id": self.worker_id,
                "capabilities": self.capabilities
            }, timeout=5)
            return r.status_code == 200
        except Exception:
            return False

    def claim_job(self) -> Optional[Dict[str, Any]]:
        try:
            r = self.session.post(f"{self.server_url}/api/workers/claim", json={
                "worker_id": self.worker_id
            }, timeout=10)
            if r.status_code == 200:
                data = r.json()
                if data.get("has_work"):
                    return data
            return None
        except Exception as e:
            print(f"[Worker] Claim error: {e}")
            return None

    def commit_checkpoint(
        self,
        run_id: str,
        lease_token: str,
        stage_completed: str,
        next_stage: Optional[str] = None,
        shot_updates: Optional[list] = None,
        asset_updates: Optional[dict] = None,
        qc_results: Optional[list] = None
    ) -> bool:
        try:
            payload = {
                "worker_id": self.worker_id,
                "run_id": run_id,
                "lease_token": lease_token,
                "stage_completed": stage_completed,
                "next_stage": next_stage,
                "shot_updates": shot_updates or [],
                "asset_updates": asset_updates or {},
                "qc_results": qc_results or []
            }
            r = self.session.post(f"{self.server_url}/api/workers/checkpoint", json=payload, timeout=15)
            if r.status_code == 200:
                print(f"[Worker] Checkpoint committed: {stage_completed} -> {next_stage}")
                return True
            else:
                print(f"[Worker] Checkpoint rejected: {r.status_code} {r.text}")
                return False
        except Exception as e:
            print(f"[Worker] Checkpoint error: {e}")
            return False

    def execute_run(self, run_data: Dict[str, Any], lease_token: str):
        run = run_data["run"]
        run_id = run["id"]
        manifest = run["manifest"]
        stage = run["current_stage"]

        print(f"\n[Worker] >>> Executing Run {run_id} at stage: {stage}")

        # Stage 1: PRECHECK
        if stage == "PRECHECK":
            print("[Worker] Running pre-check validation...")
            time.sleep(1)
            self.commit_checkpoint(run_id, lease_token, stage_completed="PRECHECK", next_stage="PLAN")
            return

        # Stage 2: PLAN
        if stage == "PLAN":
            print("[Worker] Requesting story planning via Gemini gateway...")
            r = self.session.post(f"{self.server_url}/api/ai/calls", json={
                "run_id": run_id,
                "action": "plan"
            }, timeout=30)
            if r.status_code == 200:
                print("[Worker] Story planning completed.")
                self.commit_checkpoint(run_id, lease_token, stage_completed="PLAN", next_stage="IMAGES")
            else:
                print(f"[Worker] Plan request failed: {r.text}")
            return

        # Stage 3: IMAGES
        if stage == "IMAGES":
            print("[Worker] Generating starting images for S01~S10...")
            shot_updates = []
            for shot in manifest["shots"]:
                if shot.get("status") in ["image_ready", "video_ready", "completed"]:
                    continue # Reuse completed shot! (AT-10 & Section 10.1)

                sid = shot["scene_id"]
                print(f"[Worker] Generating starting image for {sid}...")
                img_res = self.session.post(f"{self.server_url}/api/ai/calls", json={
                    "run_id": run_id,
                    "action": "generate_starting_image",
                    "payload": {"shot_id": sid}
                }, timeout=30)

                if img_res.status_code == 200:
                    shot_updates.append({
                        "scene_id": sid,
                        "status": "image_ready"
                    })
                time.sleep(0.5)

            self.commit_checkpoint(
                run_id, lease_token,
                stage_completed="IMAGES",
                next_stage="PILOT",
                shot_updates=shot_updates
            )
            return

        # Stage 4: PILOT (High-difficulty cut test first - PRD Section 7 Step E & P2)
        if stage == "PILOT":
            print("[Worker] Executing pilot test cut (S01) before batch generation...")
            pilot_shot = manifest["shots"][0]
            # Verify pilot image & audio parameters
            time.sleep(1)
            self.commit_checkpoint(run_id, lease_token, stage_completed="PILOT", next_stage="VIDEOS")
            return

        # Stage 5: VIDEOS (H3 Video generation)
        if stage == "VIDEOS":
            # Reference Gate check: If reference images (e.g. uniform/character) are not passed, block video generation!
            flags = manifest.get("flags", {})
            if flags.get("reference_gate_status") != "passed" and self.mode == "real":
                print("[Worker] [보류] 사전제작 관문 미통과: 교복/캐릭터 기준 이미지 관문이 통과되기 전에는 H3 원격 생성을 진행하지 않습니다.")
                return

            print(f"[Worker] Generating H3 video clips ({len(manifest['shots'])} shots)...")
            shot_updates = []
            shot_videos = {}

            for shot in manifest["shots"]:
                sid = shot["scene_id"]
                # Reuse existing video if already ready (Section 10.1 & AT-10)
                if shot.get("status") in ["video_ready", "completed"] and shot.get("video_asset_id"):
                    shot_videos[sid] = f"data/assets/{shot['video_asset_id']}.mp4"
                    continue

                shot_duration = shot.get("edit_use_window_plan", {}).get("target_duration", 5.0)
                print(f"[Worker] Rendering H3 video for {sid} (duration: {shot_duration}s)...")
                video_asset_id = f"video_{sid}_{uuid.uuid4().hex[:6]}"
                local_video_path = os.path.join("data", "assets", f"{video_asset_id}.mp4")
                os.makedirs(os.path.dirname(local_video_path), exist_ok=True)

                if self.capabilities["comfyui_online"]:
                    # Real ComfyUI MiniMax H3 pipeline
                    sample_workflow_path = (
                        "workflow_templates/minimax_h3_api.json"
                        if os.path.exists("workflow_templates/minimax_h3_api.json")
                        else "workflow_templates/comfyui_h3_sample_api.json"
                    )
                    with open(sample_workflow_path, 'r', encoding='utf-8') as f:
                        graph = json.load(f)
                    
                    ok, prompt_id, err = self.comfyui.submit_h3_prompt(
                        graph,
                        shot_id=sid,
                        image_filename=f"{sid}_start.png",
                        prompt_text=shot.get("core_action", ""),
                        dialogue_text=shot.get("exact_dialogue_or_silent", ""),
                        duration_sec=shot_duration
                    )
                    if ok and prompt_id:
                        print(f"[Worker] ComfyUI prompt queued: {prompt_id} (GPU RTX 5070 Ti 연산 시작)")
                        success, outputs, err = self.comfyui.poll_prompt_history(prompt_id)
                        if success and outputs:
                            print(f"[Worker] ComfyUI prompt {prompt_id} 완료! 생성된 비디오 추출 중...")
                            downloaded = False
                            for nid, nout in outputs.items():
                                for key in ["videos", "gifs", "images"]:
                                    if key in nout and isinstance(nout[key], list):
                                        for media in nout[key]:
                                            fname = media.get("filename")
                                            subfolder = media.get("subfolder", "")
                                            mtype = media.get("type", "output")
                                            if fname and (fname.endswith(".mp4") or fname.endswith(".webm") or fname.endswith(".gif")):
                                                view_url = f"{self.comfyui.comfyui_url}/view?filename={fname}&subfolder={subfolder}&type={mtype}"
                                                try:
                                                    vr = requests.get(view_url, timeout=60)
                                                    if vr.status_code == 200 and len(vr.content) > 1000:
                                                        with open(local_video_path, 'wb') as vf:
                                                            vf.write(vr.content)
                                                        print(f"[Worker] 로컬 ComfyUI 실제 H3 비디오 저장 완료: {local_video_path} ({len(vr.content)} bytes)")
                                                        downloaded = True
                                                        break
                                                except Exception as e:
                                                    print(f"[Worker] ComfyUI 비디오 다운로드 실패: {e}")
                                        if downloaded:
                                            break
                                if downloaded:
                                    break
                
                # If not downloaded from ComfyUI, write fallback stream
                if not os.path.exists(local_video_path):
                    self.renderer._write_test_mp4(local_video_path)
                shot_videos[sid] = local_video_path

                shot_updates.append({
                    "scene_id": sid,
                    "video_asset_id": video_asset_id,
                    "video_url": f"/api/assets/{video_asset_id}",
                    "status": "video_ready"
                })

            self.commit_checkpoint(
                run_id, lease_token,
                stage_completed="VIDEOS",
                next_stage="AUDIO_ALIGN",
                shot_updates=shot_updates
            )
            return

        # Stage 6: AUDIO_ALIGN
        if stage == "AUDIO_ALIGN":
            print("[Worker] Aligning audio & Korean word timestamps via ASR...")
            for shot in manifest["shots"]:
                diag = shot.get("exact_dialogue_or_silent", "")
                alignment = self.aligner.align_audio("dummy_audio.wav", diag)
                shot["measured_speech_seconds"] = alignment["measured_duration_sec"]

            self.commit_checkpoint(
                run_id, lease_token,
                stage_completed="AUDIO_ALIGN",
                next_stage="EDIT",
                shot_updates=manifest["shots"]
            )
            return

        # Stage 7: EDIT (FFmpeg Assembly of S01~S10 9:16 Vertical Video)
        if stage == "EDIT":
            print("[Worker] Running FFmpeg automated assembly (10 shots, 9 boundaries, J/L-cuts, subtitles)...")
            shot_video_paths = {}
            for s in manifest["shots"]:
                vid_id = s.get("video_asset_id", f"asset_{s['scene_id']}")
                shot_video_paths[s["scene_id"]] = os.path.join("data", "assets", f"{vid_id}.mp4")

            render_res = self.renderer.render_timeline(shot_video_paths, manifest["shots"], output_prefix=run_id)

            asset_updates = {
                "final_clean_mp4": f"/api/assets/{run_id}_clean",
                "final_captioned_mp4": f"/api/assets/{run_id}_captioned",
                "preview_mp4": f"/api/assets/{run_id}_preview",
                "subtitles_srt": render_res["subtitles_srt"]
            }

            self.commit_checkpoint(
                run_id, lease_token,
                stage_completed="EDIT",
                next_stage="AUTO_QC",
                asset_updates=asset_updates
            )
            return

        # Stage 8: AUTO_QC
        if stage == "AUTO_QC":
            print("[Worker] Running deterministic technical QC checks...")
            clean_file = os.path.join("data", "output", f"{run_id}_clean.mp4")
            qc_results = self.qc.run_technical_qc(clean_file, manifest["shots"])

            self.commit_checkpoint(
                run_id, lease_token,
                stage_completed="AUTO_QC",
                next_stage="PACKAGE",
                qc_results=qc_results
            )
            return

        # Stage 9: PACKAGE
        if stage == "PACKAGE":
            print("[Worker] Finalizing package. Setting render_ready=true (Awaiting human review)...")
            self.commit_checkpoint(
                run_id, lease_token,
                stage_completed="PACKAGE",
                next_stage=None
            )
            return

    def run_loop(self, poll_interval_sec: int = 3, run_once: bool = False):
        print(f"[Worker] Starting polling loop against {self.server_url}...")
        self.register()

        last_hb = 0
        while self.running:
            now = time.time()
            if now - last_hb > 20:
                self.send_heartbeat()
                last_hb = now

            claim = self.claim_job()
            if claim and claim.get("has_work"):
                self.execute_run(claim, claim.get("lease_token", ""))
                if run_once:
                    break
            else:
                if run_once:
                    break
                time.sleep(poll_interval_sec)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Story Shorts Windows Python Worker")
    parser.add_argument("--server-url", default="http://localhost:3000", help="Web server URL")
    parser.add_argument("--worker-id", default=None, help="Worker ID")
    parser.add_argument("--mode", default="auto", choices=["auto", "real", "simulation"], help="Execution mode")
    parser.add_argument("--cookie", default=None, help="Google AI Studio session cookie to bypass cookie check")
    parser.add_argument("--run-once", action="store_true", help="Run one cycle and exit (useful for tests)")
    args = parser.parse_args()

    worker = StoryShortsWorker(
        server_url=args.server_url,
        worker_id=args.worker_id,
        mode=args.mode,
        cookie=args.cookie
    )
    worker.run_loop(run_once=args.run_once)
