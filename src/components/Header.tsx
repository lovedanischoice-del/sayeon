import React from 'react';
import { Film, Cpu, HardDrive, ShieldCheck, Activity, RefreshCw, AlertTriangle } from 'lucide-react';

interface HeaderProps {
  activeTab: 'projects' | 'pipeline' | 'review' | 'diagnostics';
  setActiveTab: (tab: 'projects' | 'pipeline' | 'review' | 'diagnostics') => void;
  systemStatus: any;
  onRefresh: () => void;
  onQuickTest?: () => void;
  activeEngine?: 'comfyui_h3' | 'google_ai';
  hasError?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  systemStatus,
  activeEngine,
  hasError,
  onRefresh,
  onQuickTest,
}) => {
  const isWorkerOnline = systemStatus?.worker_connection?.status === 'CONNECTED';
  const isComfyOnline = systemStatus?.comfyui_h3?.status === 'CONNECTED';
  const isGeminiOnline = systemStatus?.gemini_gateway?.status === 'CONNECTED';

  return (
    <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-40 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
      {/* Brand & Contract Version */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-rose-600 flex items-center justify-center text-white shadow-lg shadow-rose-950/50">
          <Film className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-lg text-slate-100 tracking-tight">사연쇼츠 스튜디오</h1>
            <span className="text-xs px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 font-mono border border-rose-800/40">
              v3.8.1 기준
            </span>
          </div>
          <p className="text-xs text-slate-400">한국 감동 휴먼드라마 10샷(S01~S10) 9:16 자동 제작</p>
        </div>
      </div>

      {/* Nav Tabs */}
      <nav className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
        <button
          onClick={() => setActiveTab('projects')}
          className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition ${
            activeTab === 'projects'
              ? 'bg-slate-800 text-rose-400 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
          }`}
        >
          사연 등록 & 목록
        </button>
        <button
          onClick={() => setActiveTab('pipeline')}
          className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition ${
            activeTab === 'pipeline'
              ? 'bg-slate-800 text-rose-400 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          10샷 제작 파이프라인
        </button>
        <button
          onClick={() => setActiveTab('review')}
          className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition ${
            activeTab === 'review'
              ? 'bg-slate-800 text-rose-400 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          최종 검수실 (사람 승인)
        </button>
        <button
          onClick={() => setActiveTab('diagnostics')}
          className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition ${
            activeTab === 'diagnostics'
              ? 'bg-slate-800 text-rose-400 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          환경 점검 & 설정
        </button>
      </nav>

      {/* Real-time System Indicators */}
      <div className="flex items-center gap-3">
        {hasError && (
          <button
            onClick={() => setActiveTab('pipeline')}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-rose-950 text-rose-200 border border-rose-600 font-bold text-xs animate-bounce cursor-pointer shadow-lg shadow-rose-950/60 hover:bg-rose-900"
            title="파이프라인 오류가 감지되었습니다. 클릭하여 세부 내용 확인"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>🚨 오류 발생 (확인 필요)</span>
          </button>
        )}

        <div className="flex items-center gap-2 text-xs">
          {/* Worker status */}
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border transition cursor-pointer hover:brightness-110 ${
              isWorkerOnline
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40'
                : 'bg-amber-950/40 text-amber-300 border-amber-800/40 animate-pulse'
            }`}
            title="클릭하여 환경 점검 & Worker 연결 가이드 열기"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Worker: {isWorkerOnline ? '온라인' : '오프라인'}</span>
          </button>

          {/* ComfyUI H3 status */}
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border transition cursor-pointer hover:brightness-110 ${
              isComfyOnline
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40'
                : 'bg-slate-850 text-slate-400 border-slate-750'
            }`}
            title="클릭하여 ComfyUI H3 연동 설정 확인"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>ComfyUI: {isComfyOnline ? '연결됨' : '대기중'}</span>
          </button>

          {/* Gemini gateway */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border ${
              isGeminiOnline
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40'
                : 'bg-rose-950/40 text-rose-300 border-rose-800/40'
            }`}
            title="서버 측 Gemini API Gateway (gemini-3.8-flash)"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Gemini: {isGeminiOnline ? '연결됨' : '키 필요'}</span>
          </div>

          {/* Active Video Engine badge */}
          {activeEngine && (
            <div
              className={`flex items-center gap-1 px-2.5 py-1 rounded border font-mono font-semibold transition ${
                activeEngine === 'google_ai'
                  ? 'bg-indigo-950/60 text-indigo-300 border-indigo-700/60'
                  : 'bg-rose-950/60 text-rose-300 border-rose-700/60'
              }`}
              title={`현재 활성화된 영상 합성 엔진: ${activeEngine === 'google_ai' ? 'Google AI Cloud' : 'ComfyUI MiniMax H3 (내부 GPU)'}`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>{activeEngine === 'google_ai' ? '엔진: Google AI' : '엔진: ComfyUI H3'}</span>
            </div>
          )}
        </div>

        {onQuickTest && (
          <button
            onClick={onQuickTest}
            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs shadow-md shadow-rose-950/50 flex items-center gap-1.5 transition cursor-pointer"
            title="1-클릭 감동실화 10샷 파일럿 테스트 제작 즉시 실행"
          >
            <span>⚡ 테스트 제작 시작</span>
          </button>
        )}

        <button
          onClick={onRefresh}
          className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          title="상태 새로고침"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
