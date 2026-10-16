/**
 * 사연쇼츠 스튜디오 (Story Shorts Studio) - Shared Schemas & Types
 * 기준: 사연쇼츠 자동완주 스킬 v3.8.1 (2026-10-12) & PRD v1.0
 */

export type FactType = 'fiction' | 'tip' | 'verified_true_story';

export type VideoEngineType = 'comfyui_h3' | 'google_ai';

export type RunStatus =
  | 'DRAFT'
  | 'QUEUED'
  | 'RUNNING'
  | 'PAUSED'
  | 'AWAITING_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'FAILED'
  | 'CANCELLED';

export type PipelineStage =
  | 'PRECHECK'
  | 'PLAN'
  | 'REFERENCES'
  | 'IMAGES'
  | 'PILOT'
  | 'VIDEOS'
  | 'AUDIO_ALIGN'
  | 'EDIT'
  | 'AUTO_QC'
  | 'PACKAGE';

export type BlockingReason =
  | 'WORKER_OFFLINE'
  | 'CONFIG_REQUIRED'
  | 'BUDGET_LIMIT'
  | 'PROVIDER_RESULT_UNKNOWN'
  | 'FACT_CHECK_REQUIRED'
  | 'POLICY_BLOCKED'
  | 'QUALITY_BLOCKED'
  | 'REFERENCE_GATE_UNPASSED'
  | null;

export type DriveExportStatus = 'NOT_STARTED' | 'UPLOADING' | 'VERIFIED' | 'FAILED';

export interface ProductionFlags {
  production_design_version: string; // e.g. "v3.8.1"
  schema_version: string; // "1.0.0"
  review_policy: 'final_only';
  render_ready: boolean;
  editing_complete: boolean;
  manual_watch_qc: 'pending' | 'passed' | 'rejected';
  transition_plan_version: string;
  pacing_plan_version: string;
  preproduction_qc: 'pending' | 'passed' | 'failed';
  reference_gate_status: 'pending' | 'passed' | 'failed'; // e.g. 교복/캐릭터 참조 이미지 관문
  reference_gate_notes?: string;
  image_storyboard_qc: 'pending' | 'passed' | 'failed';
  h3_edit_coverage_qc: 'pending' | 'passed' | 'failed';
  transition_qc: 'pending' | 'passed' | 'failed';
  pacing_qc: 'pending' | 'passed' | 'failed';
  drive_export_status: DriveExportStatus;
}

export type SocialPlatform = 'youtube' | 'instagram' | 'tiktok';

export interface PlatformPublishMetadata {
  youtube: {
    title: string;
    description: string;
    tags: string[];
    pinned_comment: string;
    privacy: 'public' | 'unlisted' | 'private';
  };
  instagram: {
    caption: string;
    hashtags: string[];
    share_to_feed: boolean;
  };
  tiktok: {
    caption: string;
    hashtags: string[];
    privacy: 'public' | 'friends' | 'private';
  };
}

export interface PublishResultRecord {
  id: string;
  run_id: string;
  platform: SocialPlatform;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  post_id?: string;
  post_url?: string;
  error?: string;
  published_at: string;
}

export interface CharacterAppearance {
  appearance_id: string;
  time_period: 'past' | 'present' | 'future';
  age_description: string;
  hair: string;
  clothing: string;
  reference_asset_id?: string;
  reference_image_url?: string;
}

export interface Character {
  id: string;
  name: string;
  role: string;
  relationship_to_protagonist: string;
  appearances: CharacterAppearance[];
}

export interface PropItem {
  id: string;
  name: string;
  description: string;
  continuity_notes: string;
  reference_asset_id?: string;
}

export interface ShotDefinition {
  scene_id: string; // "S01" ~ "S10"
  story_beat_id: string; // "B01" ~ "B16"
  beat_role: 'hook' | 'setup' | 'conflict' | 'escalation' | 'twist' | 'climax' | 'resolution' | 'ending';
  new_information_or_change: string;
  cast_ids: string[];
  speaker_id: string | null; // null if silent/reaction
  dialogue_id: string;
  exact_dialogue_or_silent: string;
  estimated_speech_seconds: number;
  measured_speech_seconds?: number;
  location_id: string;
  story_time: 'past' | 'present';
  appearance_ids: string[];
  prop_identity_hand: string;
  start_frame_state: string; // Action right at beginning (NOT finished outcome)
  core_action: string;
  reaction_or_end_state: string;
  gaze_axis: string;
  composition: string; // Korean drama medium / medium-wide 9:16
  edit_use_window_plan: {
    in_sec: number;
    out_sec: number;
    target_duration: number; // typically 3.5 - 5.0 sec
  };
  incoming_link: string; // boundary transition description
  outgoing_link: string;
  continuity_risks: string[];
  reference_asset_ids: string[];
  start_image_asset_id?: string;
  start_image_hash?: string;
  start_image_url?: string;
  video_asset_id?: string;
  video_url?: string;
  video_engine?: VideoEngineType; // 'comfyui_h3' (내부 GPU) | 'google_ai' (외부 Google AI)
  source_audio_asset_id?: string;
  workflow_hash?: string;
  prompt_version?: number;
  status: 'pending' | 'image_ready' | 'generating_video' | 'video_ready' | 'qc_failed' | 'completed';
  qc_result_ids: string[];
  attempt_count: number;
  error_message?: string;
}

export interface SubtitleCue {
  id: string;
  shot_id: string;
  start_sec: number;
  end_sec: number;
  text: string;
  speaker_id: string | null;
}

export interface TimelineClip {
  clip_id: string;
  scene_id: string;
  video_asset_id: string;
  source_in: number;
  source_out: number;
  timeline_in: number;
  timeline_out: number;
  j_cut_audio_offset: number; // seconds speech starts before video
  l_cut_audio_offset: number; // seconds speech extends after video
  volume_gain: number;
}

export interface ProductionTimeline {
  version: number;
  total_duration_sec: number;
  clips: TimelineClip[];
  subtitles: SubtitleCue[];
  bgm_track?: {
    asset_id: string;
    title: string;
    volume_level: number; // e.g. 0.18 to not overpower dialogue
  };
  boundaries: {
    boundary_index: number;
    from_scene: string;
    to_scene: string;
    type: 'hard_cut' | 'j_cut' | 'l_cut';
    continuity_verified: boolean;
  }[];
}

export interface QCResult {
  id: string;
  category: 'technical' | 'story' | 'continuity' | 'audio' | 'boundary';
  reviewer: 'deterministic' | 'model_assisted' | 'human';
  scope: string; // e.g. "S04", "timeline", "full_render"
  timestamp_sec?: number;
  status: 'passed' | 'failed' | 'uncertain' | 'not_run';
  severity: 'blocking' | 'warning';
  title: string;
  details: string;
  evidence_asset_hash?: string;
  created_at: string;
}

export interface HumanReviewRecord {
  id: string;
  run_id: string;
  render_id: string;
  reviewer_id: string;
  fully_watched_and_listened: boolean;
  decision: 'APPROVED' | 'REJECTED' | 'REVISION_REQUESTED';
  revision_scope?: {
    shots_to_regenerate?: string[];
    subtitles_only?: boolean;
    audio_only?: boolean;
    notes: string;
  };
  notes: string;
  created_at: string;
}

export interface EpisodeManifest {
  manifest_version: string;
  project_id: string;
  run_id: string;
  title: string;
  fact_type: FactType;
  story_text_hash: string;
  characters: Character[];
  props: PropItem[];
  shots: ShotDefinition[];
  timeline: ProductionTimeline;
  flags: ProductionFlags;
  video_engine?: VideoEngineType;
  output_assets: {
    final_clean_mp4?: string;
    final_captioned_mp4?: string;
    preview_mp4?: string;
    subtitles_srt?: string;
    subtitles_ass?: string;
    poster_frame_png?: string;
  };
  qc_results: QCResult[];
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  title: string;
  raw_story: string;
  must_keep_sentences: string[];
  ending_intent: string;
  fact_type: FactType;
  video_engine?: VideoEngineType;
  budget_limit_krw: number;
  total_spent_krw: number;
  created_at: string;
  updated_at: string;
  current_run_id: string | null;
  owner_id: string;
}

export interface Run {
  id: string;
  project_id: string;
  version: number;
  status: RunStatus;
  current_stage: PipelineStage;
  blocking_reason: BlockingReason;
  blocking_message?: string;
  flags: ProductionFlags;
  video_engine?: VideoEngineType;
  manifest: EpisodeManifest;
  active_worker_id?: string;
  lease_token?: string;
  lease_expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkerInfo {
  id: string;
  name: string;
  platform: 'windows' | 'linux' | 'darwin';
  ip_address?: string;
  status: 'online' | 'busy' | 'offline';
  last_heartbeat: string;
  current_run_id?: string;
  current_stage?: PipelineStage;
  capabilities: {
    comfyui_online: boolean;
    comfyui_url?: string;
    h3_workflow_loaded: boolean;
    ffmpeg_available: boolean;
    whisper_available: boolean;
    gpu_name?: string;
    vram_mb?: number;
    mode: 'real' | 'simulation';
  };
}

export interface WorkerClaimRequest {
  worker_id: string;
  capabilities: WorkerInfo['capabilities'];
}

export interface WorkerClaimResponse {
  has_work: boolean;
  run_id?: string;
  step?: PipelineStage;
  lease_token?: string;
  lease_duration_sec?: number;
  payload?: any;
}

export interface WorkerCheckpointRequest {
  worker_id: string;
  run_id: string;
  lease_token: string;
  stage_completed: PipelineStage;
  next_stage?: PipelineStage;
  shot_updates?: Partial<ShotDefinition>[];
  asset_updates?: { [key: string]: string };
  qc_results?: QCResult[];
  error?: string;
}

export interface AssetRecord {
  id: string;
  project_id: string;
  run_id: string;
  file_type: 'image' | 'video' | 'audio' | 'subtitle' | 'json';
  file_name: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  storage_path: string;
  public_url: string;
  metadata: {
    width?: number;
    height?: number;
    fps?: number;
    duration_sec?: number;
    shot_id?: string;
    is_upscaled?: boolean;
  };
  created_at: string;
}

export interface UsageLedgerEntry {
  id: string;
  run_id: string;
  provider: 'gemini' | 'comfyui_local' | 'drive';
  endpoint: string;
  units: number;
  unit_type: 'tokens' | 'images' | 'seconds' | 'calls';
  estimated_cost_krw: number;
  status: 'reserved' | 'confirmed' | 'failed' | 'result_unknown';
  idempotency_key: string;
  timestamp: string;
}

export interface RevisionRequest {
  user_notes: string;
  shots_to_regenerate: string[]; // e.g. ["S04"]
  subtitles_only?: boolean;
  audio_only?: boolean;
}
