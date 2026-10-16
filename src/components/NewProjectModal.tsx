import React, { useState } from 'react';
import { X, Sparkles, BookOpen, AlertCircle } from 'lucide-react';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    raw_story: string;
    must_keep_sentences: string[];
    ending_intent: string;
    fact_type: 'fiction' | 'tip' | 'verified_true_story';
    video_engine: 'comfyui_h3' | 'google_ai';
    budget_limit_krw: number;
  }) => Promise<void>;
}

const SAMPLE_STORIES = [
  {
    title: '어머니의 낡은 통장',
    raw_story:
      '어머니는 30년 동안 시장 골목에서 붕어빵을 구우며 단 한 번도 새 옷을 사 입지 않으셨습니다. 매달 10만 원씩 꼬박꼬박 모은 낡은 통장을 시집가는 제 손에 쥐여주시며, "엄마가 못나서 이것밖에 못 해줘 미안하다"며 눈물을 흘리셨습니다. 그 통장 첫 장에는 30년 전 세상을 떠난 아버지 이름으로 시작된 글씨가 적혀 있었습니다.',
    must_keep: '엄마가 못나서 이것밖에 못 해줘 미안하다',
    ending_intent: '어머니의 오랜 희생에 대한 감동적 참회와 포옹',
    fact_type: 'fiction' as const,
  },
  {
    title: '아버지가 남긴 유품 시계',
    raw_story:
      '사업에 실패하고 돌아가신 아버지의 유품을 정리하던 날이었습니다. 서랍 깊은 곳에서 태엽이 멈춘 낡은 손목시계 하나와 작은 쪽지를 발견했습니다. "아들아, 시간이 멈춰도 아비의 사랑은 멈추지 않는다." 시계를 흔들자 거짓말처럼 째깍거리며 초침이 다시 움직이기 시작했습니다.',
    must_keep: '시간이 멈춰도 아비의 사랑은 멈추지 않는다',
    ending_intent: '멈추지 않는 아버지의 부성애에 대한 깨달음',
    fact_type: 'tip' as const,
  },
  {
    title: '30년 만에 찾은 고향 국밥집',
    raw_story:
      '어린 시절 가난해서 밥을 굶던 날, 욕쟁이 할머니는 돈도 받지 않고 고기 가득 든 국밥 한 그릇을 말아주셨습니다. "성공해서 꼭 갚으라"던 그 호통을 가슴에 품고 대기업 임원이 되어 30년 만에 그 골목을 다시 찾았습니다. 휠체어를 탄 90대 백발의 할머니는 제 얼굴을 보자마자 단번에 "그때 그 코흘리개 녀석이구나"라며 주름진 손을 잡아주셨습니다.',
    must_keep: '그때 그 코흘리개 녀석이구나',
    ending_intent: '오랜 세월을 뛰어넘은 온정과 은혜에 대한 보답',
    fact_type: 'verified_true_story' as const,
  },
];

export const NewProjectModal: React.FC<NewProjectModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [title, setTitle] = useState('');
  const [rawStory, setRawStory] = useState('');
  const [mustKeep, setMustKeep] = useState('');
  const [endingIntent, setEndingIntent] = useState('오해 해소와 따뜻한 감동적 결실');
  const [factType, setFactType] = useState<'fiction' | 'tip' | 'verified_true_story'>('fiction');
  const [videoEngine, setVideoEngine] = useState<'comfyui_h3' | 'google_ai'>('comfyui_h3');
  const [budgetLimit, setBudgetLimit] = useState(50000);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLoadSample = (sample: typeof SAMPLE_STORIES[0]) => {
    setTitle(sample.title);
    setRawStory(sample.raw_story);
    setMustKeep(sample.must_keep);
    setEndingIntent(sample.ending_intent);
    setFactType(sample.fact_type);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawStory.trim()) {
      setError('사연 본문을 입력해 주세요.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit({
        title: title.trim() || rawStory.slice(0, 20) + '...',
        raw_story: rawStory.trim(),
        must_keep_sentences: mustKeep ? [mustKeep.trim()] : [],
        ending_intent: endingIntent.trim(),
        fact_type: factType,
        video_engine: videoEngine,
        budget_limit_krw: budgetLimit,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || '프로젝트 등록에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-rose-500" />새 사연 등록 (v3.8.1 자동 완주)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              사연을 입력하면 기획 → 10샷 명세 → 시작 이미지 → H3 영상 → FFmpeg 합성까지 자동 진행됩니다.
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Sample Selector */}
        <div className="my-4 p-3 bg-slate-950/60 rounded-lg border border-slate-800/60">
          <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-rose-400" />
            <span>시험용 한국 휴먼드라마 사연 불러오기:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_STORIES.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleLoadSample(s)}
                className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              >
                예제 {idx + 1}: {s.title}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-950/60 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">제목 (선택)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 어머니의 낡은 통장 (미입력 시 사연 첫 문장으로 자동 설정)"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Raw Story */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              사연 본문 <span className="text-rose-400 font-bold">*필수</span>
            </label>
            <textarea
              rows={6}
              value={rawStory}
              onChange={(e) => setRawStory(e.target.value)}
              placeholder="감동적인 실제 사연이나 가족 이야기를 입력하세요 (60대 이상 여성 타깃 한국 드라마 감동물)..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500 leading-relaxed font-sans"
              required
            />
          </div>

          {/* Must keep & Ending intent */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                반드시 유지할 문장/대사 (선택)
              </label>
              <input
                type="text"
                value={mustKeep}
                onChange={(e) => setMustKeep(e.target.value)}
                placeholder="예: 엄마가 못나서 미안하다..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">결말 연출 의도</label>
              <input
                type="text"
                value={endingIntent}
                onChange={(e) => setEndingIntent(e.target.value)}
                placeholder="예: 오해 해소와 뜨거운 눈물의 포옹"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          {/* Fact type & Budget limit */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">사실 구분</label>
              <select
                value={factType}
                onChange={(e) => setFactType(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-rose-500"
              >
                <option value="fiction">허구 창작 드라마 (기본값)</option>
                <option value="tip">제보 기반 각색</option>
                <option value="verified_true_story">검증된 실화</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                프로젝트 예산 상한 (KRW)
              </label>
              <input
                type="number"
                step="5000"
                value={budgetLimit}
                onChange={(e) => setBudgetLimit(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          {/* Video Engine Selection (ComfyUI MiniMax H3 vs Google AI) */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-200">
                영상 제작 엔진 선택 (5초 샷 생성 모델)
              </label>
              <span className="text-[11px] text-slate-400">제작 도중 파이프라인에서 언제든 변경 가능</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Option 1: ComfyUI MiniMax H3 (Internal GPU) */}
              <div
                onClick={() => setVideoEngine('comfyui_h3')}
                className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                  videoEngine === 'comfyui_h3'
                    ? 'bg-rose-950/40 border-rose-500 shadow-md shadow-rose-950/40 ring-1 ring-rose-500/50'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-750 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🖥️</span>
                    <div>
                      <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                        ComfyUI MiniMax H3
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-800/50 font-normal">
                          내부 GPU
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        로컬 PC의 GPU 워커 에이전트와 연동하여 MiniMax H3 5초 클립 직접 렌더링
                      </p>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="video_engine"
                    checked={videoEngine === 'comfyui_h3'}
                    onChange={() => setVideoEngine('comfyui_h3')}
                    className="accent-rose-500 mt-1"
                  />
                </div>
                <div className="mt-2 pt-2 border-t border-slate-800/50 text-[10px] text-slate-400 flex items-center gap-2">
                  <span className="text-emerald-400">✓ 고화질 인물 모션</span>
                  <span>• 로컬 GPU Worker 필요</span>
                </div>
              </div>

              {/* Option 2: Google AI (External Cloud) */}
              <div
                onClick={() => setVideoEngine('google_ai')}
                className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                  videoEngine === 'google_ai'
                    ? 'bg-indigo-950/40 border-indigo-500 shadow-md shadow-indigo-950/40 ring-1 ring-indigo-500/50'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-750 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🌐</span>
                    <div>
                      <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                        Google AI Cloud
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/50 font-normal">
                          외부 클라우드
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Google AI 비디오 엔진(Veo / Gemini)을 사용해 클라우드에서 즉시 영상 합성
                      </p>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="video_engine"
                    checked={videoEngine === 'google_ai'}
                    onChange={() => setVideoEngine('google_ai')}
                    className="accent-indigo-500 mt-1"
                  />
                </div>
                <div className="mt-2 pt-2 border-t border-slate-800/50 text-[10px] text-slate-400 flex items-center gap-2">
                  <span className="text-indigo-400">✓ GPU 설치 불필요</span>
                  <span>• 영화적 카메라 워크 & 톤</span>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-800 text-slate-300 hover:bg-slate-800 transition"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold transition shadow-lg shadow-rose-950/60 disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? '작업 등록 중...' : '자동 제작 시작 (10샷)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
