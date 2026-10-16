import React, { useState } from 'react';
import { X, RefreshCw, AlertCircle, Info } from 'lucide-react';

interface RevisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialShotId?: string;
  onRerenderVideoOnly?: (targetShots: string[], engine: 'comfyui_h3' | 'google_ai') => Promise<void>;
  onSubmitRevision: (data: {
    natural_language_request: string;
    target_shots: string[];
    subtitles_only: boolean;
    audio_only: boolean;
    video_engine?: 'comfyui_h3' | 'google_ai';
  }) => Promise<void>;
}

export const RevisionModal: React.FC<RevisionModalProps> = ({
  isOpen,
  onClose,
  initialShotId,
  onRerenderVideoOnly,
  onSubmitRevision,
}) => {
  const [requestText, setRequestText] = useState('');
  const [targetShots, setTargetShots] = useState<string[]>(initialShotId ? [initialShotId] : ['S02']);
  const [subtitlesOnly, setSubtitlesOnly] = useState(false);
  const [videoEngine, setVideoEngine] = useState<'comfyui_h3' | 'google_ai'>('google_ai');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const toggleShot = (sid: string) => {
    if (targetShots.includes(sid)) {
      setTargetShots(targetShots.filter((s) => s !== sid));
    } else {
      setTargetShots([...targetShots, sid]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const promptText =
        requestText.trim() ||
        `${targetShots.join(', ')} 컷 ${
          videoEngine === 'google_ai' ? 'Google AI' : 'ComfyUI H3'
        } 영상 재생성`;
      await onSubmitRevision({
        natural_language_request: promptText,
        target_shots: subtitlesOnly ? [] : targetShots,
        subtitles_only: subtitlesOnly,
        audio_only: false,
        video_engine: videoEngine,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-rose-500" />
              선택 컷/자막 부분 수정 요청
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              전체 재제작 대신 필요한 최소 단위의 의존 결과만 재생성합니다.
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1-Click Video Only Instant Render */}
        <div className="mt-4 p-3.5 bg-gradient-to-r from-indigo-950/70 via-slate-900 to-indigo-950/50 rounded-xl border border-indigo-700/60 flex items-center justify-between gap-3 shadow-lg">
          <div>
            <div className="font-bold text-slate-100 flex items-center gap-1.5 text-xs">
              <span>🌐 {targetShots.join(', ') || '선택 컷'} 영상만 Google AI로 즉시 생성</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
              대본이나 프롬프트 수정 없이, 시작 이미지를 사용해 Google AI 비디오를 즉시 렌더링합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              if (onRerenderVideoOnly) {
                await onRerenderVideoOnly(
                  targetShots.length > 0 ? targetShots : (initialShotId ? [initialShotId] : ['S02']),
                  'google_ai'
                );
              } else {
                await handleSubmit({ preventDefault: () => {} } as any);
              }
              onClose();
            }}
            className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs whitespace-nowrap shadow cursor-pointer transition flex items-center gap-1"
          >
            <span>영상 즉시 생성</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 my-4 text-xs">
          {/* Subtitles only toggle */}
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
            <label className="flex items-center gap-2.5 cursor-pointer font-semibold text-slate-200">
              <input
                type="checkbox"
                checked={subtitlesOnly}
                onChange={(e) => setSubtitlesOnly(e.target.checked)}
                className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 bg-slate-900 border-slate-700"
              />
              <span>자막 오탈자 / 타이밍만 수정 (영상·H3 재생성 안 함)</span>
            </label>
            {subtitlesOnly && (
              <p className="text-[11px] text-emerald-400 mt-1 pl-6">
                * H3 영상 호출 0회! 기존 생성된 모든 10샷 비디오와 이미지를 100% 그대로 재사용합니다.
              </p>
            )}
          </div>

          {/* Shot selectors */}
          {!subtitlesOnly && (
            <div>
              <label className="block font-medium text-slate-300 mb-2">
                재생성할 샷 선택 (선택된 샷 외의 자산은 고유 해시로 보존됩니다):
              </label>
              <div className="grid grid-cols-5 gap-1.5 font-mono">
                {Array.from({ length: 10 }, (_, i) => {
                  const sid = `S${String(i + 1).padStart(2, '0')}`;
                  const isChecked = targetShots.includes(sid);
                  return (
                    <button
                      type="button"
                      key={sid}
                      onClick={() => toggleShot(sid)}
                      className={`p-2 rounded border text-center transition font-semibold ${
                        isChecked
                          ? 'bg-rose-950 text-rose-300 border-rose-600'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {sid}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Video Engine Selection */}
          {!subtitlesOnly && (
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
              <label className="block font-medium text-slate-300">영상 생성 엔진 선택:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setVideoEngine('comfyui_h3')}
                  className={`p-2 rounded border text-left transition cursor-pointer ${
                    videoEngine === 'comfyui_h3'
                      ? 'bg-rose-950/60 border-rose-500 text-rose-200 ring-1 ring-rose-500/50'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    <span>🖥️ ComfyUI H3</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-800/40">내부 GPU</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">로컬 Worker PC 가속</div>
                </button>

                <button
                  type="button"
                  onClick={() => setVideoEngine('google_ai')}
                  className={`p-2 rounded border text-left transition cursor-pointer ${
                    videoEngine === 'google_ai'
                      ? 'bg-indigo-950/60 border-indigo-500 text-indigo-200 ring-1 ring-indigo-500/50'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    <span>🌐 Google AI</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/40">클라우드</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Veo / Gemini 클라우드</div>
                </button>
              </div>
            </div>
          )}

          {/* Natural language instructions */}
          <div>
            <label className="block font-medium text-slate-300 mb-1">
              수정 요청 내용 (자연어)
            </label>
            <textarea
              rows={4}
              value={requestText}
              onChange={(e) => setRequestText(e.target.value)}
              placeholder="예: S04에서 어머니의 표정을 조금 더 애절하게 바꾸고, 대사 '미안하다'를 조금 더 부드럽게 조정해 주세요."
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500"
              required
            />
          </div>

          <div className="p-2.5 rounded bg-amber-950/40 border border-amber-900/40 text-[11px] text-amber-300 flex items-start gap-2">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              새로운 렌더가 생성되면 이전 승인 기록은 자동 취소되며, 완성 후 다시 전체 시청 검수를 진행해야 합니다.
            </span>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-800 text-slate-400 hover:bg-slate-800"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold transition shadow"
            >
              {isSubmitting ? '수정 범위 등록 중...' : '부분 수정 시작'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
