"""
사연쇼츠 v3.8.1 - ComfyUI H3 Workflow Adapter
재사용: 검증된 API 워크플로 그래프 및 노드 바인딩.
금지: 매번 새로운 임의 그래프를 LLM으로 생성하거나, 타인의 작업을 interrupt 취소하지 않음.
"""

import json
import os
import time
import requests
import hashlib
from typing import Dict, Any, Optional, Tuple

class ComfyUIAdapter:
    def __init__(self, comfyui_url: str = "http://127.0.0.1:8188", binding_path: str = "workflow_templates/workflow_binding.json"):
        self.comfyui_url = comfyui_url.rstrip('/')
        self.binding_path = binding_path
        self.binding = self._load_binding()
        self.active_prompts = set()

    def _load_binding(self) -> Dict[str, Any]:
        if os.path.exists(self.binding_path):
            with open(self.binding_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {
            "node_mappings": {
                "start_image_input": {"node_id": "12", "field_name": "image"},
                "positive_prompt": {"node_id": "6", "field_name": "text"},
                "dialogue_text_input": {"node_id": "24", "field_name": "dialogue_text"},
                "seed": {"node_id": "3", "field_name": "seed"},
                "output_video": {"node_id": "45"}
            }
        }

    def check_connection(self) -> bool:
        try:
            r = requests.get(f"{self.comfyui_url}/system_stats", timeout=3)
            return r.status_code == 200
        except Exception:
            return False

    def upload_image(self, image_path: str, filename: str) -> bool:
        if not os.path.exists(image_path):
            return False
        try:
            with open(image_path, 'rb') as f:
                files = {'image': (filename, f, 'image/png')}
                r = requests.post(f"{self.comfyui_url}/upload/image", files=files, timeout=10)
                return r.status_code == 200
        except Exception as e:
            print(f"[ComfyUI] Upload image error: {e}")
            return False

    def submit_h3_prompt(self, workflow_graph: Dict[str, Any], shot_id: str, image_filename: str, prompt_text: str, dialogue_text: str, seed: Optional[int] = None, duration_sec: Optional[float] = None) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Substitutes ONLY permitted fields according to workflow_binding.json.
        Returns: (success, prompt_id, error_message)
        """
        graph = json.loads(json.dumps(workflow_graph)) # deepcopy
        mappings = self.binding.get("node_mappings", {})

        # 1. Substitute Start Image
        img_map = mappings.get("start_image_input")
        if img_map and img_map["node_id"] in graph:
            graph[img_map["node_id"]]["inputs"][img_map["field_name"]] = image_filename

        # 2. Substitute Positive Prompt
        prompt_map = mappings.get("positive_prompt")
        if prompt_map and prompt_map["node_id"] in graph:
            graph[prompt_map["node_id"]]["inputs"][prompt_map["field_name"]] = prompt_text

        # 3. Substitute Dialogue Text or combine into Prompt if dialogue node is not separate
        diag_map = mappings.get("dialogue_text_input")
        if diag_map and diag_map.get("node_id") in graph:
            graph[diag_map["node_id"]]["inputs"][diag_map["field_name"]] = dialogue_text
        elif dialogue_text and prompt_map and prompt_map.get("node_id") in graph:
            # For integrated multimodal nodes (MiniMaxH3ImageToVideo), append dialogue to prompt
            curr_prompt = graph[prompt_map["node_id"]]["inputs"].get(prompt_map["field_name"], "")
            if f"대사:" not in curr_prompt and dialogue_text:
                graph[prompt_map["node_id"]]["inputs"][prompt_map["field_name"]] = f"{prompt_text}\n\nSpoken Korean dialogue: \"{dialogue_text}\""

        # 4. Substitute Duration (Dynamic per shot plan, e.g. 5.0s ~ 8.0s)
        dur_map = mappings.get("duration_seconds")
        if dur_map and dur_map.get("node_id") in graph:
            dur = duration_sec if duration_sec is not None else float(dur_map.get("target_value", 5.0))
            graph[dur_map["node_id"]]["inputs"][dur_map["field_name"]] = float(dur)

        # 5. Substitute Seed if provided
        seed_map = mappings.get("seed")
        if seed_map and seed_map.get("node_id") in graph and seed is not None:
            graph[seed_map["node_id"]]["inputs"][seed_map["field_name"]] = seed

        # 6. Substitute Output Video Prefix
        out_map = mappings.get("output_video")
        if out_map and out_map.get("node_id") in graph:
            prefix_field = out_map.get("field_name", "filename_prefix")
            graph[out_map["node_id"]]["inputs"][prefix_field] = f"video/MiniMax_H3_{shot_id}"

        # Submit to ComfyUI
        try:
            payload = {"prompt": graph, "client_id": f"saryeon_worker_{shot_id}"}
            r = requests.post(f"{self.comfyui_url}/prompt", json=payload, timeout=15)
            if r.status_code == 200:
                data = r.json()
                prompt_id = data.get("prompt_id")
                if prompt_id:
                    self.active_prompts.add(prompt_id)
                    return True, prompt_id, None
                return False, None, "No prompt_id in response"
            else:
                return False, None, f"ComfyUI HTTP {r.status_code}: {r.text}"
        except Exception as e:
            return False, None, str(e)

    def poll_prompt_history(self, prompt_id: str, timeout_sec: int = 300) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
        start_time = time.time()
        while time.time() - start_time < timeout_sec:
            try:
                r = requests.get(f"{self.comfyui_url}/history/{prompt_id}", timeout=5)
                if r.status_code == 200:
                    history = r.json()
                    if prompt_id in history:
                        item = history[prompt_id]
                        status = item.get("status", {})
                        if status.get("completed", False):
                            self.active_prompts.discard(prompt_id)
                            return True, item.get("outputs", {}), None
                        if status.get("status_str") == "error":
                            self.active_prompts.discard(prompt_id)
                            return False, None, f"ComfyUI execution error: {status.get('messages')}"
            except Exception as e:
                print(f"[ComfyUI] Poll error: {e}")
            time.sleep(2)
        return False, None, "Timeout waiting for H3 video generation"

    def safe_interrupt(self, prompt_id: str) -> bool:
        """
        Interrupts ONLY if the current prompt in ComfyUI queue is owned by this worker.
        Does NOT cancel manual or other projects' jobs (PRD 9.4 & AT-18).
        """
        if prompt_id not in self.active_prompts:
            print(f"[ComfyUI] Refusing to interrupt prompt {prompt_id}: not owned by this worker.")
            return False

        try:
            q_res = requests.get(f"{self.comfyui_url}/queue", timeout=3)
            if q_res.status_code == 200:
                q_data = q_res.json()
                current_executing = q_data.get("queue_running", [])
                if current_executing and len(current_executing) > 0:
                    current_prompt_id = current_executing[0][1]
                    if current_prompt_id == prompt_id:
                        requests.post(f"{self.comfyui_url}/interrupt", timeout=3)
                        self.active_prompts.discard(prompt_id)
                        print(f"[ComfyUI] Safely interrupted owned prompt {prompt_id}")
                        return True
            return False
        except Exception as e:
            print(f"[ComfyUI] Safe interrupt error: {e}")
            return False
