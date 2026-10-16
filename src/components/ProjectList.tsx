import React from 'react';
import { Plus, Play, CheckCircle2, Clock, AlertTriangle, Eye, HardDrive, RefreshCw } from 'lucide-react';
import type { Project, Run } from '../../shared/schemas/types.js';

interface ProjectListProps {
  projects: Project[];
  activeProject: Project | null;
  activeRun: Run | null;
  onSelectProject: (proj: Project) => void;
  onOpenNewModal: () => void;
  onRefresh: () => void;
  onGoToReview: () => void;
  onGoToPipeline: () => void;
  onQuickTest?: () => void;
}

export const ProjectList: React.FC<ProjectListProps> = ({
  projects,
  activeProject,
  activeRun,
  onSelectProject,
  onOpenNewModal,
  onRefresh,
  onGoToReview,
  onGoToPipeline,
  onQuickTest,
}) => {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top action bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-xl bg-slate-900 border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">제작 프로젝트 목록</h2>
          <p className="text-xs text-slate-400 mt-1">
            한국 휴먼드라마 숏폼(사연쇼츠) v3.8.1 기준 자동 제작 프로젝트 장부
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm border border-slate-700 flex items-center gap-1.5 transition"
          >
            <RefreshCw className="w-4 h-4" /> 새로고침
          </button>
          {onQuickTest && (
            <button
              onClick={onQuickTest}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-semibold text-sm shadow-lg shadow-rose-950/60 flex items-center gap-2 transition cursor-pointer"
            >
              <span>⚡ 테스트 제작 시작</span>
            </button>
          )}
          <button
            onClick={onOpenNewModal}
            className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm shadow-lg shadow-rose-950/60 flex items-center gap-2 transition"
          >
            <Plus className="w-4 h-4" /> 새 사연 등록
          </button>
        </div>
      </div>

      {/* Projects Table / Cards */}
      {projects.length === 0 ? (
        <div className="p-12 text-center rounded-xl bg-slate-900/50 border border-dashed border-slate-800 space-y-3">
          <p className="text-slate-300 font-semibold text-base">등록된 사연쇼츠 프로젝트가 없습니다.</p>
          <p className="text-slate-400 text-xs max-w-md mx-auto">
            1-클릭 '테스트 제작 시작'을 누르면 샘플 감동실화(어머니의 낡은 통장)로 기획부터 10샷 생성, 자막, FFmpeg 합성까지 즉시 가동됩니다.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            {onQuickTest && (
              <button
                onClick={onQuickTest}
                className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-xs font-bold inline-flex items-center gap-2 shadow-lg shadow-rose-950/50 cursor-pointer"
              >
                <span>⚡ 1-클릭 테스트 제작 시작</span>
              </button>
            )}
            <button
              onClick={onOpenNewModal}
              className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 border border-slate-700"
            >
              <Plus className="w-3.5 h-3.5" /> 직접 사연 입력
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((proj) => {
            const isSelected = activeProject?.id === proj.id;
            const run = isSelected ? activeRun : null;
            const status = run?.status || '제작 대기';
            const readyForReview = run?.flags?.render_ready;
            const isApproved = run?.flags?.editing_complete;

            return (
              <div
                key={proj.id}
                onClick={() => onSelectProject(proj)}
                className={`p-5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-slate-850 border-rose-600/80 shadow-lg shadow-rose-950/30 ring-1 ring-rose-500/50'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span className="font-mono text-slate-500">{proj.id}</span>
                    <span>{new Date(proj.created_at).toLocaleDateString('ko-KR')}</span>
                  </div>

                  <h3 className="text-base font-bold text-slate-100 line-clamp-1 mb-2">
                    {proj.title}
                  </h3>

                  <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed mb-4">
                    {proj.raw_story}
                  </p>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between py-1 border-t border-slate-800/60">
                      <span className="text-slate-500">진행 상태</span>
                      <span
                        className={`font-semibold ${
                          isApproved
                            ? 'text-emerald-400'
                            : readyForReview
                            ? 'text-amber-400'
                            : 'text-slate-300'
                        }`}
                      >
                        {isApproved
                          ? '사람 승인 완료'
                          : readyForReview
                          ? '최종 검수 대기 (렌더 완료)'
                          : status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-t border-slate-800/60">
                      <span className="text-slate-500">샷 구성</span>
                      <span className="text-slate-300 font-mono">
                        {run ? `${run.manifest.shots.filter((s) => s.status === 'video_ready' || s.status === 'completed').length}/10 샷` : '10샷 예정'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-t border-slate-800/60">
                      <span className="text-slate-500">Drive 저장</span>
                      <span className="text-slate-400 font-mono text-[11px]">
                        {run?.flags?.drive_export_status || 'NOT_STARTED'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectProject(proj);
                      onGoToPipeline();
                    }}
                    className="flex-1 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition text-center"
                  >
                    파이프라인 보기
                  </button>
                  {readyForReview && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectProject(proj);
                        onGoToReview();
                      }}
                      className="flex-1 py-1.5 rounded bg-rose-600/90 hover:bg-rose-600 text-xs font-semibold text-white transition text-center shadow"
                    >
                      최종 검수하기
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
