import React, { useState } from 'react';
import {
  Play,
  Pause,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  HardDrive,
  FileText,
  Volume2,
  Clock,
  ShieldCheck,
  Film,
  Sparkles,
} from 'lucide-react';
import type { Project, Run } from '../../shared/schemas/types.js';

interface ReviewRoomProps {
  project: Project | null;
  run: Run | null;
  onSubmitReview: (data: {
    decision: 'APPROVED' | 'REJECTED' | 'REVISION_REQUESTED';
    fully_watched_and_listened: boolean;
    notes: string;
  }) => Promise<void>;
  onTriggerDriveExport: () => Promise<void>;
  onOpenRevisionModal: () => void;
}

export const ReviewRoom: React.FC<ReviewRoomProps> = ({
  project,
  run,
  onSubmitReview,
  onTriggerDriveExport,
  onOpenRevisionModal,
}) => {
  const [videoMode, setVideoMode] = useState<'captioned' | 'clean'>('captioned');
  const [watchedConfirmed, setWatchedConfirmed] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeShotPreview, setActiveShotPreview] = useState('S01');

  if (!project || !run) {
    return (
      <div className="p-12 text-center rounded-xl bg-slate-900 border border-slate-800 text-slate-400">
        검수할 프로젝트를 먼저 선택해 주세요.
      </div>
    );
  }

  const isApproved = run.flags.editing_complete;
  const driveStatus = run.flags.drive_export_status;
  const qcResults = run.manifest.qc_results || [];
  const blockingQc = qcResults.filter((q) => q.severity === 'blocking' && q.status === 'failed');

  const handleApprove = async () => {
    if (!watchedConfirmed) {
      alert('승인을 위해 동영상을 처음부터 끝까지 전체 시청·청취하였음을 확인해 주세요.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmitReview({
        decision: 'APPROVED',
        fully_watched_and_listened: true,
        notes: notes || '감독 최종 전체 시청 승인 완료',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!confirm('정말로 이 버전을 반려 처리하시겠습니까?')) return;
    setIsSubmitting(true);
    try {
      await onSubmitReview({
        decision: 'REJECTED',
        fully_watched_and_listened: watchedConfirmed,
        notes: notes || '품질 기준 미달로 반려',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRerenderVideoAll = async () => {
    if (!confirm('기획 내용과 시작 이미지는 100% 보존하고, 전체 비디오 클립과 자막 합성만 다시 렌더링하시겠습니까?')) return;
    setIsSubmitting(true);
    try {
      await fetch(`/api/runs/${run.id}/rerender-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      alert('영상만 다시 제작 파이프라인이 백그라운드에서 시작되었습니다.');
    } catch (e: any) {
      alert(`재제작 오류: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const videoAssetUrl =
    videoMode === 'captioned'
      ? `/api/assets/${run.id}_captioned`
      : `/api/assets/${run.id}_clean`;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header status */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400">
              {run.id}
            </span>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                isApproved
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : 'bg-amber-950 text-amber-300 border border-amber-800'
              }`}
            >
              {isApproved ? '사람 검수 승인 완료 (editing_complete=true)' : '최종 검수 대기 (사람 검수 필요)'}
            </span>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-medium border ${
                run.video_engine === 'google_ai'
                  ? 'bg-indigo-950/80 text-indigo-300 border-indigo-700/60'
                  : 'bg-rose-950/80 text-rose-300 border-rose-700/60'
              }`}
            >
              {run.video_engine === 'google_ai' ? '🌐 Google AI Cloud' : '🖥️ ComfyUI MiniMax H3 (내부 GPU)'}
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-100">{project.title}</h2>
        </div>

        {/* Video Mode Toggle */}
        <div className="flex items-center gap-2 p-1 bg-slate-950 rounded-lg border border-slate-800">
          <button
            onClick={() => setVideoMode('captioned')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
              videoMode === 'captioned'
                ? 'bg-rose-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            자막 포함 렌더 (Captioned)
          </button>
          <button
            onClick={() => setVideoMode('clean')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
              videoMode === 'clean'
                ? 'bg-slate-800 text-slate-200 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            클린 렌더 (Clean)
          </button>
        </div>
      </div>

      {/* Main Review Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: 9:16 Vertical Video Player */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="w-full max-w-[340px] aspect-[9/16] bg-black rounded-2xl border-2 border-slate-800 overflow-hidden shadow-2xl relative flex items-center justify-center">
            <video
              key={videoAssetUrl}
              src={videoAssetUrl}
              controls
              playsInline
              className="w-full h-full object-cover"
              poster={`/api/assets/${run.id}_poster`}
            />
          </div>

          <p className="text-xs text-slate-500 mt-2 text-center">
            9:16 세로 1080×1920 MP4 (H.264 / AAC 24fps)
          </p>
        </div>

        {/* Right: Timeline, QC, and Human Approval Gate */}
        <div className="lg:col-span-7 space-y-5">
          {/* 10-Shot Cut Timeline */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Film className="w-4 h-4 text-rose-500" />
              10샷 타임라인 & 9개 연결 경계
            </h3>

            <div className="grid grid-cols-5 sm:grid-cols-10 gap-1 text-center font-mono text-xs">
              {run.manifest.shots.map((shot, idx) => (
                <button
                  key={shot.scene_id}
                  onClick={() => setActiveShotPreview(shot.scene_id)}
                  className={`p-1.5 rounded border transition ${
                    activeShotPreview === shot.scene_id
                      ? 'bg-rose-950 text-rose-300 border-rose-600'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold text-[11px]">{shot.scene_id}</div>
                  <div className="text-[9px] text-slate-500 truncate">{shot.beat_role}</div>
                </button>
              ))}
            </div>

            {/* Active shot quick preview */}
            {(() => {
              const active = run.manifest.shots.find((s) => s.scene_id === activeShotPreview);
              if (!active) return null;
              return (
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-850 text-xs space-y-1">
                  <div className="flex items-center justify-between font-semibold text-slate-300">
                    <span>{active.scene_id} ({active.beat_role.toUpperCase()})</span>
                    <span>화자: {active.speaker_id ? '어머니/등장인물' : '무대사 (입 닫힘)'}</span>
                  </div>
                  <p className="text-slate-400">{active.exact_dialogue_or_silent || '(대사 없음)'}</p>
                </div>
              );
            })()}
          </div>

          {/* Automated Technical QC Diagnostics */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              자동 기술 검사 보고서 ({qcResults.length}건)
            </h3>

            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {qcResults.length === 0 ? (
                <p className="text-xs text-slate-500">실행된 검사 기록이 없습니다.</p>
              ) : (
                qcResults.map((qc, i) => (
                  <div
                    key={i}
                    className="p-2 rounded bg-slate-950 border border-slate-850 flex items-start justify-between text-xs gap-2"
                  >
                    <div>
                      <span className="font-semibold text-slate-200 block">{qc.title}</span>
                      <span className="text-slate-400 text-[11px]">{qc.details}</span>
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
                        qc.status === 'passed'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : qc.status === 'failed'
                          ? 'bg-rose-950 text-rose-400 border border-rose-800'
                          : 'bg-amber-950 text-amber-400'
                      }`}
                    >
                      {qc.status.toUpperCase()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Human Watch Confirmation & Approval Gate (PRD 8.3 & 11.5) */}
          <div className="p-5 rounded-xl bg-slate-900 border-2 border-slate-700/80 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-rose-400" />
              <h3 className="text-sm font-bold text-slate-100">감독의 최종 전체 검수 게이트</h3>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              사연쇼츠 v3.8.1 규칙에 따라 AI나 시스템은 스스로 최종 완료(editing_complete=true)를 확정할 수 없습니다.
              사람이 직접 전체 동영상을 보고 듣고 승인해야 합니다.
            </p>

            {/* Strict Watch Checkbox */}
            <label className="flex items-start gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={watchedConfirmed}
                onChange={(e) => setWatchedConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-rose-600 focus:ring-rose-500 bg-slate-900 border-slate-700"
              />
              <span className="text-xs text-slate-200 font-medium">
                본 영상을 처음부터 끝까지 전체 시청 및 청취하였으며, 인물·음색·자막 싱크 및 감정선 완결을 확인하였습니다.
              </span>
            </label>

            <div>
              <label className="block text-xs text-slate-400 mb-1">검수 의견 (선택)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="예: 결말 감정선 양호, S04 자막 타이밍 적절함"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-rose-500"
              />
            </div>

            {/* Approval Decision Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={handleApprove}
                disabled={!watchedConfirmed || isSubmitting || isApproved}
                className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs shadow-lg shadow-emerald-950/60 flex items-center gap-2 transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isApproved ? '이미 승인됨' : '최종 승인 확정 (editing_complete=true)'}
              </button>

              <button
                onClick={onOpenRevisionModal}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 font-medium text-xs border border-slate-700 transition"
              >
                선택 컷/자막 부분 수정 요청
              </button>

              <button
                onClick={handleRerenderVideoAll}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-md transition"
                title="기획과 시작 이미지는 그대로 두고 영상 및 자막 합성만 다시 렌더링"
              >
                🎬 영상만 다시 렌더링
              </button>


              <button
                onClick={handleReject}
                disabled={isSubmitting || isApproved}
                className="px-3.5 py-2.5 rounded-lg bg-rose-950/40 hover:bg-rose-950 text-rose-300 font-medium text-xs border border-rose-900/40 transition"
              >
                반려
              </button>
            </div>
          </div>

          {/* Google Drive Delivery Section */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                <HardDrive className="w-4 h-4 text-blue-400" />
                Google Drive 개별 파일 납품·보관
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                상태: <span className="font-mono text-slate-300 font-bold">{driveStatus}</span> (폴더: 사연쇼츠/261015/EP001/)
              </p>
            </div>

            <button
              onClick={onTriggerDriveExport}
              className="px-3.5 py-2 rounded-lg bg-blue-600/90 hover:bg-blue-600 text-white font-semibold text-xs shadow transition"
            >
              {driveStatus === 'VERIFIED' ? 'Drive 재조회 검증' : 'Drive 저장 시작/재시도'}
            </button>
          </div>

          {/* Social Media Publishing Center (YouTube / Instagram / TikTok) */}
          <SocialPublishingSection run={run} isApproved={isApproved} />
        </div>
      </div>
    </div>
  );
};

// Sub-component for Social Media Publishing Center
function SocialPublishingSection({ run, isApproved }: { run: Run; isApproved: boolean }) {
  const [selectedPlatform, setSelectedPlatform] = useState<'youtube' | 'instagram' | 'tiktok'>('youtube');
  const [metadata, setMetadata] = useState<any>(null);
  const [privacy, setPrivacy] = useState<'private' | 'unlisted' | 'public'>('private');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<any>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Fetch tailored metadata
  React.useEffect(() => {
    fetch(`/api/runs/${run.id}/publish-metadata`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setMetadata(data);
      })
      .catch((e) => console.warn('Failed to load publish metadata:', e));
  }, [run.id]);

  const copyText = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handlePublish = async () => {
    if (!isApproved) {
      alert('감독의 최종 시청 승인(editing_complete=true) 전에는 SNS 업로드가 차단됩니다.');
      return;
    }
    setIsPublishing(true);
    setPublishResult(null);
    try {
      const activeMeta = metadata ? metadata[selectedPlatform] : {};
      const res = await fetch(`/api/runs/${run.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: selectedPlatform,
          title: activeMeta.title || run.manifest.title,
          caption: activeMeta.caption || '',
          privacy,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || '업로드 요청 실패');
      } else {
        setPublishResult(data);
      }
    } catch (e: any) {
      alert(`업로드 통신 오류: ${e.message}`);
    } finally {
      setIsPublishing(false);
    }
  };

  const cur = metadata ? metadata[selectedPlatform] : null;

  return (
    <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-rose-500" />
            유튜브 / 인스타 / 틱톡 즉시 업로드 & 배포 센터
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            플랫폼 규격에 최적화된 제목·해시태그·고정댓글 생성 및 원클릭 바로 업로드
          </p>
        </div>

        {/* Platform Selector Buttons */}
        <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setSelectedPlatform('youtube')}
            className={`px-3 py-1.5 rounded font-semibold transition ${
              selectedPlatform === 'youtube'
                ? 'bg-red-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            유튜브 쇼츠
          </button>
          <button
            onClick={() => setSelectedPlatform('instagram')}
            className={`px-3 py-1.5 rounded font-semibold transition ${
              selectedPlatform === 'instagram'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            인스타 릴스
          </button>
          <button
            onClick={() => setSelectedPlatform('tiktok')}
            className={`px-3 py-1.5 rounded font-semibold transition ${
              selectedPlatform === 'tiktok'
                ? 'bg-slate-800 text-cyan-300 shadow border border-cyan-800/60'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            틱톡
          </button>
        </div>
      </div>

      {/* Platform Content Preview & Quick Copy */}
      {cur ? (
        <div className="space-y-3 text-xs">
          {selectedPlatform === 'youtube' && (
            <>
              <div>
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="font-semibold text-slate-300">유튜브 쇼츠 최적화 제목:</span>
                  <button
                    onClick={() => copyText(cur.title, 'yt_title')}
                    className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold"
                  >
                    {copiedField === 'yt_title' ? '✓ 복사됨' : '제목 복사'}
                  </button>
                </div>
                <div className="p-2.5 bg-slate-950 rounded border border-slate-800 text-slate-100 font-medium">
                  {cur.title}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="font-semibold text-slate-300">설명문 및 해시태그:</span>
                  <button
                    onClick={() => copyText(cur.description, 'yt_desc')}
                    className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold"
                  >
                    {copiedField === 'yt_desc' ? '✓ 복사됨' : '설명문 복사'}
                  </button>
                </div>
                <div className="p-2.5 bg-slate-950 rounded border border-slate-800 text-slate-300 whitespace-pre-wrap leading-relaxed max-h-24 overflow-y-auto">
                  {cur.description}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="font-semibold text-slate-300">알고리즘 고정 댓글 (시청자 반응 유도):</span>
                  <button
                    onClick={() => copyText(cur.pinned_comment, 'yt_pin')}
                    className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold"
                  >
                    {copiedField === 'yt_pin' ? '✓ 복사됨' : '댓글 복사'}
                  </button>
                </div>
                <div className="p-2 bg-slate-950 rounded border border-slate-800 text-slate-400 italic">
                  "{cur.pinned_comment}"
                </div>
              </div>
            </>
          )}

          {selectedPlatform === 'instagram' && (
            <div>
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="font-semibold text-slate-300">인스타그램 릴스 캡션 및 20개 인기 해시태그:</span>
                <button
                  onClick={() => copyText(cur.caption, 'ig_cap')}
                  className="text-[11px] text-pink-400 hover:text-pink-300 font-semibold"
                >
                  {copiedField === 'ig_cap' ? '✓ 복사됨' : '전체 캡션 복사'}
                </button>
              </div>
              <div className="p-2.5 bg-slate-950 rounded border border-slate-800 text-slate-200 whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
                {cur.caption}
              </div>
            </div>
          )}

          {selectedPlatform === 'tiktok' && (
            <div>
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="font-semibold text-slate-300">틱톡 캡션 및 추천 사운드 해시태그:</span>
                <button
                  onClick={() => copyText(cur.caption, 'tt_cap')}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold"
                >
                  {copiedField === 'tt_cap' ? '✓ 복사됨' : '캡션 복사'}
                </button>
              </div>
              <div className="p-2.5 bg-slate-950 rounded border border-slate-800 text-slate-200 whitespace-pre-wrap leading-relaxed">
                {cur.caption}
              </div>
            </div>
          )}

          {/* Action Row */}
          <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">공개 설정:</span>
              <select
                value={privacy}
                onChange={(e) => setPrivacy(e.target.value as any)}
                className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-200 text-xs focus:outline-none"
              >
                <option value="private">비공개 (안전 검토용 권장)</option>
                <option value="unlisted">일부공개 (링크가 있는 사용자만)</option>
                <option value="public">즉시 공개 발행</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePublish}
                disabled={!isApproved || isPublishing}
                className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 transition shadow-lg ${
                  isApproved
                    ? selectedPlatform === 'youtube'
                      ? 'bg-red-600 hover:bg-red-500 text-white'
                      : selectedPlatform === 'instagram'
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 text-white'
                      : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                }`}
              >
                {isPublishing
                  ? '업로드 전송 중...'
                  : `${
                      selectedPlatform === 'youtube'
                        ? 'YouTube Shorts'
                        : selectedPlatform === 'instagram'
                        ? 'Instagram Reels'
                        : 'TikTok'
                    } 바로 업로드`}
              </button>
            </div>
          </div>

          {!isApproved && (
            <p className="text-[11px] text-amber-400/90 leading-tight">
              * 안전 원칙: 감독의 최종 시청 승인(editing_complete=true) 완료 시에만 업로드 버튼이 활성화됩니다.
            </p>
          )}

          {/* Publish Success Banner */}
          {publishResult && (
            <div className="p-3 bg-emerald-950/60 rounded-lg border border-emerald-800 text-emerald-300 text-xs flex items-center justify-between gap-2">
              <div>
                <span className="font-bold block">✓ {publishResult.message}</span>
                <span className="text-[11px] text-emerald-400 font-mono">{publishResult.post_url}</span>
              </div>
              <a
                href={publishResult.post_url}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 rounded bg-emerald-800 hover:bg-emerald-700 text-white font-semibold text-[11px]"
              >
                확인하기
              </a>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-4 text-xs text-slate-500">메타데이터 생성 중...</div>
      )}
    </div>
  );
}
