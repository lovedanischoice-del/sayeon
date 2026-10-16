import React, { useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  Camera,
  Film,
  FileText,
  Volume2,
  Scissors,
  CheckSquare,
  PackageCheck,
  ChevronRight,
  User,
  Eye,
  RefreshCw,
} from 'lucide-react';
import type { Project, Run, ShotDefinition, PipelineStage } from '../../shared/schemas/types.js';

interface PipelineViewProps {
  project: Project | null;
  run: Run | null;
  events: any[];
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onRefresh: () => void;
  onOpenRevisionForShot: (shotId: string) => void;
  onGoToReview: () => void;
  onRunTestPipeline?: (engine?: 'comfyui_h3' | 'google_ai') => void;
  onSwitchEngine?: (engine: 'comfyui_h3' | 'google_ai') => Promise<void>;
}

const STAGES: { id: PipelineStage; label: string; icon: any }[] = [
  { id: 'PRECHECK', label: '1. 사전 점검', icon: CheckSquare },
  { id: 'PLAN', label: '2. 기획·대본', icon: FileText },
  { id: 'IMAGES', label: '3. 시작 이미지 (10샷)', icon: Camera },
  { id: 'PILOT', label: '4. 고난도 컷 선행', icon: Sparkles },
  { id: 'VIDEOS', label: '5. 비디오 클립 합성', icon: Film },
  { id: 'AUDIO_ALIGN', label: '6. 음성 ASR 분석', icon: Volume2 },
  { id: 'EDIT', label: '7. FFmpeg 자동 편집', icon: Scissors },
  { id: 'AUTO_QC', label: '8. 자동 기술 검사', icon: AlertCircle },
  { id: 'PACKAGE', label: '9. 패키징 (검수대기)', icon: PackageCheck },
];

export const PipelineView: React.FC<PipelineViewProps> = ({
  project,
  run,
  events,
  onPause,
  onResume,
  onCancel,
  onRefresh,
  onOpenRevisionForShot,
  onGoToReview,
  onRunTestPipeline,
  onSwitchEngine,
}) => {
  const [selectedShotId, setSelectedShotId] = useState<string>('S01');
  const [showLogs, setShowLogs] = useState(false);
  const [isRerendering, setIsRerendering] = useState(false);
  const [showRerenderMenu, setShowRerenderMenu] = useState(false);

  const currentEngine: 'comfyui_h3' | 'google_ai' =
    run?.video_engine || run?.manifest?.video_engine || 'comfyui_h3';

  const handleRerenderVideo = async (
    targetShots?: string[],
    engineOverride?: 'comfyui_h3' | 'google_ai'
  ) => {
    if (!run) return;
    setIsRerendering(true);
    setShowRerenderMenu(false);
    try {
      await fetch(`/api/runs/${run.id}/rerender-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_shots: targetShots,
          video_engine: engineOverride || currentEngine,
        }),
      });
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setIsRerendering(false);
    }
  };

  if (!project || !run) {
    return (
      <div className="p-12 text-center rounded-xl bg-slate-900 border border-slate-800 text-slate-400">
        프로젝트를 먼저 선택해 주세요.
      </div>
    );
  }

  const shots = run.manifest?.shots || [];
  const selectedShot = shots.find((s) => s.scene_id === selectedShotId) || shots[0];
  const currentStageIndex = STAGES.findIndex((s) => s.id === run.current_stage);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Run Top Banner & Controls */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400">
              {run.id}
            </span>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                run.status === 'RUNNING'
                  ? 'bg-rose-950 text-rose-300 border border-rose-800/50 animate-pulse'
                  : run.status === 'PAUSED'
                  ? 'bg-amber-950 text-amber-300 border border-amber-800/50'
                  : run.status === 'AWAITING_REVIEW'
                  ? 'bg-blue-950 text-blue-300 border border-blue-800/50'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {run.status === 'AWAITING_REVIEW'
                ? '최종 검수 대기 (렌더 완료)'
                : run.status === 'RUNNING'
                ? '자동 제작 진행 중'
                : run.status}
            </span>
            {run.blocking_reason && (
              <span className="text-xs px-2 py-0.5 rounded bg-amber-950 text-amber-200 border border-amber-800">
                차단 원인: {run.blocking_reason}
              </span>
            )}
          </div>
          <h2 className="text-xl font-bold text-slate-100">{project.title}</h2>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {run.flags?.render_ready ? (
            <button
              onClick={onGoToReview}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm shadow-lg shadow-rose-950/60 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Eye className="w-4 h-4" /> 최종 검수실 이동
            </button>
          ) : (
            onRunTestPipeline && (
              <button
                onClick={() => onRunTestPipeline(currentEngine)}
                disabled={run.status === 'RUNNING'}
                className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-semibold text-sm shadow-lg shadow-rose-950/50 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                title={`웹 내장 테스트 엔진으로 10샷 기획·이미지·영상(${currentEngine === 'google_ai' ? 'Google AI' : 'ComfyUI H3'})·자막·합성 즉시 실행`}
              >
                <span>⚡ 전체 테스트 파이프라인 가동</span>
              </button>
            )
          )}

          {shots.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowRerenderMenu(!showRerenderMenu)}
                disabled={isRerendering}
                className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-md flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                title="기획과 시작 이미지는 그대로 두고, 10샷 비디오 클립만 다시 렌더링합니다"
              >
                <Film className={`w-4 h-4 ${isRerendering ? 'animate-spin' : ''}`} />
                <span>{isRerendering ? '영상 렌더링 중...' : '영상만 다시 제작 ▼'}</span>
              </button>

              {showRerenderMenu && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-30 space-y-1">
                  <div className="px-2 py-1 text-[11px] text-slate-400 font-semibold border-b border-slate-800">
                    비디오 생성 엔진 선택
                  </div>
                  <button
                    onClick={() => handleRerenderVideo(undefined, 'comfyui_h3')}
                    className="w-full text-left p-2 rounded-lg hover:bg-rose-950/50 text-xs text-slate-200 transition flex items-center gap-2 cursor-pointer"
                  >
                    <span className="text-base">🖥️</span>
                    <div>
                      <div className="font-bold text-rose-300">ComfyUI MiniMax H3</div>
                      <div className="text-[10px] text-slate-400">내부 GPU / 로컬 Worker 사용</div>
                    </div>
                  </button>
                  <button
                    onClick={() => handleRerenderVideo(undefined, 'google_ai')}
                    className="w-full text-left p-2 rounded-lg hover:bg-indigo-950/50 text-xs text-slate-200 transition flex items-center gap-2 cursor-pointer"
                  >
                    <span className="text-base">🌐</span>
                    <div>
                      <div className="font-bold text-indigo-300">Google AI Cloud</div>
                      <div className="text-[10px] text-slate-400">외부 클라우드 (Veo / Gemini)</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}

          {run.status === 'RUNNING' ? (
            <button
              onClick={onPause}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-sm border border-slate-700 flex items-center gap-1.5 transition"
            >
              <Pause className="w-4 h-4" /> 일시정지
            </button>
          ) : run.status === 'PAUSED' ? (
            <button
              onClick={onResume}
              className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-sm flex items-center gap-1.5 transition"
            >
              <Play className="w-4 h-4" /> 재개하기
            </button>
          ) : null}

          <button
            onClick={onRefresh}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm border border-slate-700 transition"
          >
            새로고침
          </button>
        </div>
      </div>

      {/* Video Engine Selection Bar (ComfyUI MiniMax H3 vs Google AI Cloud) */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
              <span>🎬 영상 제작 엔진 선택</span>
            </span>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-medium border ${
                currentEngine === 'google_ai'
                  ? 'bg-indigo-950/80 text-indigo-300 border-indigo-700/60'
                  : 'bg-rose-950/80 text-rose-300 border-rose-700/60'
              }`}
            >
              현재: {currentEngine === 'google_ai' ? '🌐 Google AI Cloud (외부)' : '🖥️ ComfyUI MiniMax H3 (내부 GPU)'}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            원하는 엔진 카드를 클릭하면 즉시 활성화되며, [영상만 다시 제작] 시 해당 엔진으로 합성됩니다.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Card 1: ComfyUI MiniMax H3 */}
          <div
            onClick={() => onSwitchEngine && onSwitchEngine('comfyui_h3')}
            className={`p-3.5 rounded-xl border text-left transition flex items-start justify-between cursor-pointer ${
              currentEngine === 'comfyui_h3'
                ? 'bg-rose-950/40 border-rose-500 shadow-md ring-1 ring-rose-500/60'
                : 'bg-slate-950 border-slate-800 hover:border-slate-700 hover:bg-slate-900/50'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-lg">🖥️</span>
                <span className="text-xs font-bold text-slate-100">ComfyUI MiniMax H3</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800/60 font-semibold">
                  내부 GPU
                </span>
                {currentEngine === 'comfyui_h3' && (
                  <span className="text-[10px] text-emerald-400 font-bold ml-1">● 활성 중</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                로컬 PC의 GPU Worker를 통해 MiniMax H3 워크플로를 구동하여 5초 인물 드라마 샷 렌더링
              </p>
              <div className="pt-1 text-[10px] text-slate-500">
                인물 피부 질감 및 리얼 드라마 포트레이트 모션 최적화
              </div>
            </div>
          </div>

          {/* Card 2: Google AI Cloud */}
          <div
            onClick={() => onSwitchEngine && onSwitchEngine('google_ai')}
            className={`p-3.5 rounded-xl border text-left transition flex items-start justify-between cursor-pointer ${
              currentEngine === 'google_ai'
                ? 'bg-indigo-950/40 border-indigo-500 shadow-md ring-1 ring-indigo-500/60'
                : 'bg-slate-950 border-slate-800 hover:border-slate-700 hover:bg-slate-900/50'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-lg">🌐</span>
                <span className="text-xs font-bold text-slate-100">Google AI Cloud Video</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60 font-semibold">
                  외부 클라우드
                </span>
                {currentEngine === 'google_ai' && (
                  <span className="text-[10px] text-emerald-400 font-bold ml-1">● 활성 중</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                로컬 GPU 없이 Google AI(Veo / Gemini)의 클라우드 비디오 생성 및 영화적 카메라 모션 합성
              </p>
              <div className="pt-1 text-[10px] text-slate-500">
                GPU 설치 불필요 · 시네마틱 카메라 줌/팬 · 영화적 톤 매핑
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3-Column Studio Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Stages Checklist */}
        <div className="lg:col-span-3 rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-2">
            제작 계약 v3.8.1 파이프라인
          </h3>
          <div className="space-y-1">
            {STAGES.map((s, idx) => {
              const Icon = s.icon;
              const isPast = currentStageIndex > idx || Boolean(run.flags?.render_ready);
              const isCurrent = run.current_stage === s.id && !run.flags?.render_ready;

              return (
                <div
                  key={s.id}
                  className={`flex items-center justify-between p-2.5 rounded-lg text-xs transition ${
                    isCurrent
                      ? 'bg-rose-950/50 text-rose-300 border border-rose-800/40 font-semibold'
                      : isPast
                      ? 'bg-slate-950 text-slate-300 border border-slate-850'
                      : 'text-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span>{s.label}</span>
                  </div>
                  {isPast ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : isCurrent ? (
                    <Clock className="w-3.5 h-3.5 text-rose-400 animate-spin" />
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-500 px-2 leading-relaxed">
            * 정상 경로에서는 대본·이미지 단계의 사람 중간 승인을 요구하지 않으며 시스템이 자동으로 완주합니다.
          </div>
        </div>

        {/* Center Column: S01~S10 10-Shot Cards Grid */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-slate-200">
              10개 샷 스토리보드 (각 5초 H3 소스 원본)
            </h3>
            <span className="text-xs text-slate-400">클릭하여 세부 정보 점검</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {shots.map((shot) => {
              const isSelected = shot.scene_id === selectedShotId;
              const hasVideo = shot.status === 'video_ready' || shot.status === 'completed';
              const hasImg = shot.status === 'image_ready' || hasVideo;

              return (
                <div
                  key={shot.scene_id}
                  onClick={() => setSelectedShotId(shot.scene_id)}
                  className={`p-2.5 rounded-lg border transition cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-slate-800 border-rose-500 shadow-md ring-1 ring-rose-500/60'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    {/* Scene Badge & Role */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-xs font-bold text-rose-400">
                        {shot.scene_id}
                      </span>
                      <span className="text-[10px] uppercase font-semibold text-slate-400">
                        {shot.beat_role}
                      </span>
                    </div>

                    {/* 9:16 Aspect Thumbnail Container */}
                    <div className="w-full aspect-[9/16] bg-slate-950 rounded border border-slate-800 overflow-hidden relative mb-2 flex items-center justify-center group/thumb">
                      <img
                        src={shot.start_image_url || `/sample_drama/${shot.scene_id}.jpg`}
                        alt={shot.scene_id}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover/thumb:scale-105"
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (!target.dataset.fallbackTried) {
                            target.dataset.fallbackTried = 'true';
                            target.src = `/sample_drama/${shot.scene_id}.jpg`;
                          }
                        }}
                      />

                      {/* Engine Tag Overlay */}
                      {hasVideo && (
                        <span
                          className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[8px] font-bold ${
                            shot.video_engine === 'google_ai'
                              ? 'bg-indigo-950/90 text-indigo-200 border border-indigo-700/80 shadow'
                              : 'bg-rose-950/90 text-rose-200 border border-rose-700/80 shadow'
                          }`}
                        >
                          {shot.video_engine === 'google_ai' ? '🌐 Google AI' : '🖥️ H3 GPU'}
                        </span>
                      )}

                      {/* Status Overlay */}
                      <span
                        className={`absolute bottom-1 right-1 px-1 py-0.5 rounded text-[9px] font-mono ${
                          hasVideo
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                            : hasImg
                            ? 'bg-blue-950/80 text-blue-300 border border-blue-800/60'
                            : 'bg-slate-900/80 text-slate-400'
                        }`}
                      >
                        {hasVideo ? '영상 완료' : hasImg ? '이미지 준비' : '대기'}
                      </span>
                    </div>

                    {/* Dialogue preview */}
                    <p className="text-[11px] text-slate-300 line-clamp-2 leading-tight">
                      {shot.exact_dialogue_or_silent || '(무대사 반응 샷)'}
                    </p>
                  </div>

                  <div className="mt-2 pt-1 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500">
                    <span>{shot.speaker_id ? '화자 발화' : '입 다뭄'}</span>
                    <span>5.0s</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Shot Inspector Pane */}
        {selectedShot && (
          <div className="lg:col-span-3 rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="text-xs font-mono text-rose-400 font-bold">
                  {selectedShot.scene_id} 인스펙터
                </span>
                <h4 className="text-sm font-bold text-slate-100">{selectedShot.story_beat_id} 비트</h4>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleRerenderVideo([selectedShot.scene_id], 'google_ai')}
                  disabled={isRerendering}
                  className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow"
                  title="이 컷만 Google AI로 영상 즉시 생성"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Google AI 렌더</span>
                </button>
                <button
                  onClick={() => onOpenRevisionForShot(selectedShot.scene_id)}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-rose-300 text-xs font-medium border border-rose-900/40 cursor-pointer"
                >
                  이 컷만 수정
                </button>
              </div>
            </div>

            {/* Shot Photo Preview in Inspector */}
            <div className="w-full aspect-[9/16] max-h-72 bg-slate-950 rounded-lg overflow-hidden border border-slate-800 relative group">
              <img
                src={selectedShot.start_image_url || `/sample_drama/${selectedShot.scene_id}.jpg`}
                alt={selectedShot.scene_id}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.dataset.fallbackTried) {
                    target.dataset.fallbackTried = 'true';
                    target.src = `/sample_drama/${selectedShot.scene_id}.jpg`;
                  }
                }}
              />
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-sm border border-slate-700/50 text-[10px] font-mono text-rose-300">
                실사 9:16 휴먼드라마 키프레임
              </div>
            </div>

            {/* Quick 1-Click Video Action for This Cut */}
            <div className="p-3 bg-gradient-to-r from-indigo-950/70 to-slate-900 rounded-xl border border-indigo-700/60 space-y-2 shadow-lg">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-100 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  {selectedShot.scene_id} 영상만 Google AI 생성
                </span>
                <span className="text-[10px] text-indigo-300 bg-indigo-950 px-1.5 py-0.5 rounded border border-indigo-800/60 font-mono">
                  클라우드 즉시 렌더
                </span>
              </div>
              <button
                onClick={() => handleRerenderVideo([selectedShot.scene_id], 'google_ai')}
                disabled={isRerendering}
                className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-950/60 transition cursor-pointer disabled:opacity-50"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isRerendering ? 'animate-spin' : ''}`} />
                <span>{isRerendering ? 'Google AI 영상 생성 중...' : `🌐 ${selectedShot.scene_id} 영상 Google AI로 즉시 생성`}</span>
              </button>
            </div>

            {/* Inspector Details */}
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-500 block mb-0.5">정확한 한국어 대사:</span>
                <p className="p-2 bg-slate-950 rounded border border-slate-800 text-slate-200 font-sans leading-relaxed">
                  {selectedShot.exact_dialogue_or_silent || '(침묵 / 무대사 리액션 - 비화자 입 닫힘)'}
                </p>
              </div>

              <div>
                <span className="text-slate-500 block mb-0.5">시작 프레임 상태 (행동 직전):</span>
                <p className="text-slate-300">{selectedShot.start_frame_state}</p>
              </div>

              <div>
                <span className="text-slate-500 block mb-0.5">주요 행동 및 시선 축:</span>
                <p className="text-slate-300">{selectedShot.core_action}</p>
                <p className="text-slate-500 text-[11px] mt-0.5">시선: {selectedShot.gaze_axis}</p>
              </div>

              <div>
                <span className="text-slate-500 block mb-0.5">손 소품 일관성:</span>
                <p className="text-slate-300">{selectedShot.prop_identity_hand}</p>
              </div>

              <div>
                <span className="text-slate-500 block mb-0.5">9:16 구도 & 편집 윈도우:</span>
                <p className="text-slate-300">{selectedShot.composition}</p>
                <p className="text-slate-400 font-mono text-[11px] mt-0.5">
                  사용구간: {selectedShot.edit_use_window_plan?.in_sec ?? 0.5}s ~ {selectedShot.edit_use_window_plan?.out_sec ?? 4.5}s (목표: {selectedShot.edit_use_window_plan?.target_duration ?? 4.0}s)
                </p>
              </div>

              {selectedShot.start_image_hash && (
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-slate-500 block mb-0.5 font-mono text-[10px]">
                    시작 이미지 SHA-256:
                  </span>
                  <span className="font-mono text-[10px] text-slate-400 break-all">
                    {selectedShot.start_image_hash}
                  </span>
                </div>
              )}

              {/* Individual Shot Video Actions with Engine Selection */}
              <div className="pt-3 border-t border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between text-[11px] p-2 bg-slate-950 rounded border border-slate-850">
                  <span className="text-slate-400">현재 컷 엔진:</span>
                  <span
                    className={`font-semibold px-2 py-0.5 rounded text-[10px] ${
                      selectedShot.video_engine === 'google_ai'
                        ? 'bg-indigo-950 text-indigo-300 border border-indigo-800/60'
                        : 'bg-rose-950 text-rose-300 border border-rose-800/60'
                    }`}
                  >
                    {selectedShot.video_engine === 'google_ai'
                      ? '🌐 Google AI Cloud'
                      : '🖥️ ComfyUI H3 (내부 GPU)'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleRerenderVideo([selectedShot.scene_id], 'comfyui_h3')}
                    disabled={isRerendering}
                    className="px-2 py-2 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-200 text-[11px] font-semibold flex items-center justify-center gap-1 border border-rose-800/70 transition cursor-pointer disabled:opacity-50"
                    title={`이 샷만 ComfyUI H3(내부 GPU)로 렌더링`}
                  >
                    <span>🖥️ H3로 재생성</span>
                  </button>

                  <button
                    onClick={() => handleRerenderVideo([selectedShot.scene_id], 'google_ai')}
                    disabled={isRerendering}
                    className="px-2 py-2 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 text-[11px] font-semibold flex items-center justify-center gap-1 border border-indigo-800/70 transition cursor-pointer disabled:opacity-50"
                    title={`이 샷만 Google AI(외부 클라우드)로 렌더링`}
                  >
                    <span>🌐 Google AI 재생성</span>
                  </button>
                </div>

                <button
                  onClick={() => onOpenRevisionForShot(selectedShot.scene_id)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition cursor-pointer"
                  title="대사 또는 연출 지시문 수정 후 재생성"
                >
                  대본/지시문 수정 후 재생성
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Collapsible Execution Events Journal */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="w-full px-5 py-3 flex items-center justify-between text-xs font-semibold text-slate-300 hover:bg-slate-850 transition"
        >
          <span>실시간 실행 저널 및 체크포인트 이벤트 ({events.length}건)</span>
          <span>{showLogs ? '접기 ▲' : '펼치기 ▼'}</span>
        </button>

        {showLogs && (
          <div className="p-4 bg-slate-950 font-mono text-xs max-h-60 overflow-y-auto space-y-1.5 border-t border-slate-850">
            {events.length === 0 ? (
              <p className="text-slate-600">이벤트 기록이 없습니다.</p>
            ) : (
              events.map((evt, i) => (
                <div key={i} className="flex items-start gap-2 text-slate-400">
                  <span className="text-slate-600">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                  <span className="text-rose-400 font-semibold">{evt.type}</span>
                  <span className="text-slate-300 truncate">
                    {JSON.stringify(evt.payload)}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
