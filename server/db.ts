/**
 * 사연쇼츠 스튜디오 - Durable Database & State Manager
 * Provides atomic persistence for Projects, Runs, Shots, Workers, Reviews, Assets, and Usage.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  Project,
  Run,
  EpisodeManifest,
  WorkerInfo,
  HumanReviewRecord,
  AssetRecord,
  UsageLedgerEntry,
  PipelineStage,
  RunStatus,
  ShotDefinition,
  QCResult,
} from '../shared/schemas/types.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'saryeon_db.json');
const EVENTS_DIR = path.join(DATA_DIR, 'events');

interface DatabaseSchema {
  projects: Record<string, Project>;
  runs: Record<string, Run>;
  workers: Record<string, WorkerInfo>;
  reviews: Record<string, HumanReviewRecord>;
  assets: Record<string, AssetRecord>;
  usage: Record<string, UsageLedgerEntry>;
  events: Record<string, Array<{ id: string; timestamp: string; type: string; payload: any }>>;
}

class Database {
  private data: DatabaseSchema = {
    projects: {},
    runs: {},
    workers: {},
    reviews: {},
    assets: {},
    usage: {},
    events: {},
  };
  private isLoaded = false;

  constructor() {
    this.ensureDirs();
    this.load();
  }

  private ensureDirs() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(EVENTS_DIR)) {
      fs.mkdirSync(EVENTS_DIR, { recursive: true });
    }
    const assetsDir = path.join(DATA_DIR, 'assets');
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }
  }

  private load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
      } else {
        this.save();
      }
      this.isLoaded = true;
    } catch (err) {
      console.error('[DB] Failed to load db file, initializing new:', err);
      this.save();
    }
  }

  private save() {
    this.ensureDirs();
    const tempFile = `${DB_FILE}.${Date.now()}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(this.data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  }

  // --- Projects ---
  public createProject(params: {
    title: string;
    raw_story: string;
    must_keep_sentences?: string[];
    ending_intent?: string;
    fact_type?: 'fiction' | 'tip' | 'verified_true_story';
    video_engine?: 'comfyui_h3' | 'google_ai';
    budget_limit_krw?: number;
    owner_id?: string;
  }): Project {
    const id = `proj_${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const project: Project = {
      id,
      title: params.title.trim() || '무제 사연쇼츠',
      raw_story: params.raw_story.trim(),
      must_keep_sentences: params.must_keep_sentences || [],
      ending_intent: params.ending_intent || '오해 해소와 따뜻한 감동적 결실',
      fact_type: params.fact_type || 'fiction',
      video_engine: params.video_engine || 'comfyui_h3',
      budget_limit_krw: params.budget_limit_krw || 50000,
      total_spent_krw: 0,
      created_at: now,
      updated_at: now,
      current_run_id: null,
      owner_id: params.owner_id || 'owner_default',
    };
    this.data.projects[id] = project;
    this.save();
    return project;
  }

  public getProject(id: string): Project | null {
    return this.data.projects[id] || null;
  }

  public listProjects(): Project[] {
    return Object.values(this.data.projects).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  public updateProject(id: string, updates: Partial<Project>): Project | null {
    const proj = this.data.projects[id];
    if (!proj) return null;
    const updated = { ...proj, ...updates, updated_at: new Date().toISOString() };
    this.data.projects[id] = updated;
    this.save();
    return updated;
  }

  // --- Runs ---
  public createRun(projectId: string, idempotencyKey?: string, videoEngine?: 'comfyui_h3' | 'google_ai'): Run | null {
    const project = this.data.projects[projectId];
    if (!project) return null;

    // Check if an identical active run was created recently (Idempotency check AT-11)
    if (project.current_run_id) {
      const activeRun = this.data.runs[project.current_run_id];
      if (activeRun && ['QUEUED', 'RUNNING'].includes(activeRun.status)) {
        return activeRun; // Return existing active run without re-initiating
      }
    }

    const runId = `run_${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const chosenEngine = videoEngine || project.video_engine || 'comfyui_h3';

    // Default shots template S01 ~ S10
    const defaultShots: ShotDefinition[] = Array.from({ length: 10 }, (_, i) => {
      const idx = String(i + 1).padStart(2, '0');
      const sceneId = `S${idx}`;
      return {
        scene_id: sceneId,
        story_beat_id: `B${idx}`,
        beat_role: i === 0 ? 'hook' : i === 8 ? 'climax' : i === 9 ? 'resolution' : 'conflict',
        new_information_or_change: `사연쇼츠 ${sceneId} 전개`,
        cast_ids: ['char_01'],
        speaker_id: i === 9 ? null : (i % 2 === 0 ? 'char_01' : null),
        dialogue_id: `D${idx}`,
        exact_dialogue_or_silent: i === 9 ? '' : (i % 2 === 0 ? `사연쇼츠 ${sceneId} 대사` : ''),
        estimated_speech_seconds: i === 9 ? 0 : 3.5,
        location_id: 'loc_main',
        story_time: 'present',
        appearance_ids: ['app_01_present'],
        prop_identity_hand: '기본 소품',
        start_frame_state: `${sceneId} 시작 직전의 정적 상태`,
        core_action: `${sceneId} 주요 감정 행동`,
        reaction_or_end_state: `${sceneId} 리액션`,
        gaze_axis: '시선 일관성 유지',
        composition: '9:16 세로 미디엄 샷',
        edit_use_window_plan: { in_sec: 0.5, out_sec: 4.5, target_duration: 4.0 },
        incoming_link: i === 0 ? '오프닝' : `S${String(i).padStart(2, '0')} 연결`,
        outgoing_link: i === 9 ? '엔딩' : `S${String(i + 2).padStart(2, '0')} 연결`,
        continuity_risks: [],
        reference_asset_ids: [],
        video_engine: chosenEngine,
        status: 'pending',
        qc_result_ids: [],
        attempt_count: 0,
      };
    });

    const initialManifest: EpisodeManifest = {
      manifest_version: '1.0.0',
      project_id: projectId,
      run_id: runId,
      title: project.title,
      fact_type: project.fact_type,
      video_engine: chosenEngine,
      story_text_hash: crypto.createHash('sha256').update(project.raw_story).digest('hex'),
      characters: [],
      props: [],
      shots: defaultShots,
      timeline: {
        version: 1,
        total_duration_sec: 48.0,
        clips: [],
        subtitles: [],
        boundaries: Array.from({ length: 9 }, (_, idx) => ({
          boundary_index: idx + 1,
          from_scene: `S${String(idx + 1).padStart(2, '0')}`,
          to_scene: `S${String(idx + 2).padStart(2, '0')}`,
          type: 'hard_cut',
          continuity_verified: false,
        })),
      },
      flags: {
        production_design_version: 'v3.8.1',
        schema_version: '1.0.0',
        review_policy: 'final_only',
        render_ready: false,
        editing_complete: false,
        manual_watch_qc: 'pending',
        transition_plan_version: 'v3.7',
        pacing_plan_version: 'v3.8',
        preproduction_qc: 'pending',
        reference_gate_status: 'pending',
        reference_gate_notes: '교복 및 캐릭터 기준 이미지 관문 검증 대기 (사전제작 통과 전 원격 생성 차단)',
        image_storyboard_qc: 'pending',
        h3_edit_coverage_qc: 'pending',
        transition_qc: 'pending',
        pacing_qc: 'pending',
        drive_export_status: 'NOT_STARTED',
      },
      output_assets: {},
      qc_results: [],
      created_at: now,
      updated_at: now,
    };

    const run: Run = {
      id: runId,
      project_id: projectId,
      version: 1,
      status: 'QUEUED',
      current_stage: 'PRECHECK',
      blocking_reason: null,
      flags: initialManifest.flags,
      video_engine: chosenEngine,
      manifest: initialManifest,
      created_at: now,
      updated_at: now,
    };

    this.data.runs[runId] = run;
    project.current_run_id = runId;
    this.updateProject(projectId, { current_run_id: runId });
    this.logEvent(runId, 'RUN_CREATED', { run_id: runId, project_id: projectId });
    this.save();
    return run;
  }

  public getRun(id: string): Run | null {
    return this.data.runs[id] || null;
  }

  public updateRun(id: string, updates: Partial<Run>): Run | null {
    const run = this.data.runs[id];
    if (!run) return null;
    const updated = {
      ...run,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.data.runs[id] = updated;
    this.save();
    return updated;
  }

  // --- Workers & Leasing ---
  public registerWorker(worker: WorkerInfo): WorkerInfo {
    this.data.workers[worker.id] = {
      ...worker,
      last_heartbeat: new Date().toISOString(),
    };
    this.save();
    return this.data.workers[worker.id];
  }

  public getWorker(id: string): WorkerInfo | null {
    return this.data.workers[id] || null;
  }

  public listWorkers(): WorkerInfo[] {
    return Object.values(this.data.workers);
  }

  public updateWorkerHeartbeat(workerId: string, capabilities?: WorkerInfo['capabilities']): WorkerInfo | null {
    const w = this.data.workers[workerId];
    if (!w) return null;
    w.last_heartbeat = new Date().toISOString();
    w.status = 'online';
    if (capabilities) {
      w.capabilities = capabilities;
    }
    this.save();
    return w;
  }

  public claimWork(workerId: string): {
    has_work: boolean;
    run?: Run;
    lease_token?: string;
  } {
    const worker = this.data.workers[workerId];
    if (!worker) return { has_work: false };

    const now = Date.now();
    // Look for runs in QUEUED or RUNNING where lease expired or unassigned
    for (const run of Object.values(this.data.runs)) {
      if (run.status === 'PAUSED' || run.status === 'AWAITING_REVIEW' || run.status === 'APPROVED' || run.status === 'FAILED') {
        continue;
      }
      if (run.status === 'QUEUED' || run.status === 'RUNNING') {
        const leaseExpired = !run.lease_expires_at || new Date(run.lease_expires_at).getTime() < now;
        if (!run.active_worker_id || leaseExpired || run.active_worker_id === workerId) {
          const leaseToken = `lease_${crypto.randomUUID().slice(0, 8)}`;
          const expiresAt = new Date(now + 90 * 1000).toISOString(); // 90 sec lease
          run.active_worker_id = workerId;
          run.lease_token = leaseToken;
          run.lease_expires_at = expiresAt;
          run.status = 'RUNNING';
          run.updated_at = new Date().toISOString();

          worker.status = 'busy';
          worker.current_run_id = run.id;
          worker.current_stage = run.current_stage;

          this.logEvent(run.id, 'WORKER_CLAIMED', { worker_id: workerId, lease_token: leaseToken });
          this.save();
          return { has_work: true, run, lease_token: leaseToken };
        }
      }
    }
    return { has_work: false };
  }

  // --- Human Reviews (Strict Gate - PRD 8.3 & 11.5) ---
  public submitHumanReview(params: {
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
  }): { success: boolean; run: Run | null; error?: string } {
    const run = this.data.runs[params.run_id];
    if (!run) return { success: false, run: null, error: 'Run not found' };

    // Deterministic check: Is render ready?
    if (!run.flags.render_ready) {
      return { success: false, run, error: 'Cannot submit review before render_ready is true' };
    }

    const reviewId = `rev_${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const reviewRecord: HumanReviewRecord = {
      id: reviewId,
      ...params,
      created_at: now,
    };
    this.data.reviews[reviewId] = reviewRecord;

    if (params.decision === 'APPROVED') {
      if (!params.fully_watched_and_listened) {
        return {
          success: false,
          run,
          error: 'Approval requires full watch and listen confirmation (fully_watched_and_listened: true)',
        };
      }
      run.flags.manual_watch_qc = 'passed';
      run.flags.editing_complete = true;
      run.status = 'APPROVED';
      this.logEvent(run.id, 'HUMAN_APPROVED', { reviewId, reviewer: params.reviewer_id });
    } else if (params.decision === 'REVISION_REQUESTED') {
      run.status = 'CHANGES_REQUESTED';
      run.flags.editing_complete = false;
      run.flags.manual_watch_qc = 'pending';
      // Handle partial invalidation
      this.applyRevisionScope(run, params.revision_scope);
      this.logEvent(run.id, 'REVISION_REQUESTED', { reviewId, scope: params.revision_scope });
    } else {
      run.status = 'REJECTED';
      run.flags.editing_complete = false;
      run.flags.manual_watch_qc = 'rejected';
      this.logEvent(run.id, 'HUMAN_REJECTED', { reviewId, notes: params.notes });
    }

    this.save();
    return { success: true, run };
  }

  private applyRevisionScope(
    run: Run,
    scope?: {
      shots_to_regenerate?: string[];
      subtitles_only?: boolean;
      audio_only?: boolean;
      notes: string;
    }
  ) {
    if (!scope) return;
    run.flags.render_ready = false;
    run.flags.editing_complete = false;

    if (scope.subtitles_only) {
      // Subtitle only edit: KEEP all 10 shots video & image intact (H3 calls = 0!)
      run.current_stage = 'EDIT';
      run.status = 'QUEUED';
      this.logEvent(run.id, 'SUBTITLES_ONLY_INVALIDATION', { notice: 'Images and H3 videos preserved' });
    } else if (scope.shots_to_regenerate && scope.shots_to_regenerate.length > 0) {
      // Targeted shot regeneration (e.g. S04 only)
      for (const shot of run.manifest.shots) {
        if (scope.shots_to_regenerate.includes(shot.scene_id)) {
          shot.status = 'pending';
          shot.attempt_count += 1;
          delete shot.video_asset_id;
          delete shot.video_url;
        }
      }
      run.current_stage = 'VIDEOS';
      run.status = 'QUEUED';
      this.logEvent(run.id, 'SHOT_TARGETED_INVALIDATION', { shots: scope.shots_to_regenerate });
    } else if (scope.audio_only) {
      run.current_stage = 'AUDIO_ALIGN';
      run.status = 'QUEUED';
    }
  }

  // --- Assets & Usage ---
  public registerAsset(asset: AssetRecord) {
    this.data.assets[asset.id] = asset;
    this.save();
  }

  public getAsset(id: string): AssetRecord | null {
    return this.data.assets[id] || null;
  }

  public recordUsage(entry: UsageLedgerEntry): { allowed: boolean; reason?: string } {
    const run = this.data.runs[entry.run_id];
    if (run) {
      const project = this.data.projects[run.project_id];
      if (project) {
        const wouldSpend = project.total_spent_krw + entry.estimated_cost_krw;
        if (wouldSpend > project.budget_limit_krw) {
          entry.status = 'failed';
          this.data.usage[entry.id] = entry;
          run.status = 'PAUSED';
          run.blocking_reason = 'BUDGET_LIMIT';
          run.blocking_message = `예산 초과: 설정 한도 ${project.budget_limit_krw}원 대비 예상 지출 ${wouldSpend}원`;
          this.save();
          return { allowed: false, reason: 'BUDGET_LIMIT' };
        }
        project.total_spent_krw += entry.estimated_cost_krw;
      }
    }
    this.data.usage[entry.id] = entry;
    this.save();
    return { allowed: true };
  }

  public getUsageForRun(runId: string): UsageLedgerEntry[] {
    return Object.values(this.data.usage).filter((u) => u.run_id === runId);
  }

  // --- Event Journal ---
  public logEvent(runId: string, type: string, payload: any) {
    if (!this.data.events[runId]) {
      this.data.events[runId] = [];
    }
    const event = {
      id: `evt_${crypto.randomUUID().slice(0, 8)}`,
      timestamp: new Date().toISOString(),
      type,
      payload,
    };
    this.data.events[runId].push(event);

    // Also append to jsonl file for persistence
    try {
      const logFile = path.join(EVENTS_DIR, `${runId}.jsonl`);
      fs.appendFileSync(logFile, JSON.stringify(event) + '\n', 'utf-8');
    } catch (e) {
      // ignore
    }
  }

  public getEvents(runId: string): Array<{ id: string; timestamp: string; type: string; payload: any }> {
    return this.data.events[runId] || [];
  }
}

export const db = new Database();
