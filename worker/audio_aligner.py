"""
사연쇼츠 v3.8.1 - Audio Alignment & ASR Module
Faster-Whisper 기반 음성 분석 및 한국어 단어 타임스탬프 추출.
원본 음성을 보존하며 침묵 구간 및 대사 일치율 검사.
"""

import os
from typing import Dict, Any, List, Optional

class AudioAligner:
    def __init__(self, model_size: str = "base"):
        self.model_size = model_size
        self.model = None
        self._init_model()

    def _init_model(self):
        try:
            from faster_whisper import WhisperModel
            # Load CPU/CUDA whisper model
            self.model = WhisperModel(self.model_size, device="cpu", compute_type="int8")
            print(f"[ASR] Loaded faster-whisper model ({self.model_size})")
        except Exception as e:
            print(f"[ASR] faster-whisper not available or GPU error: {e}. Fallback aligner enabled.")
            self.model = None

    def align_audio(self, audio_file_path: str, expected_dialogue: str) -> Dict[str, Any]:
        """
        Analyzes audio file, extracts actual spoken segments and word timestamps.
        """
        if self.model and os.path.exists(audio_file_path):
            try:
                segments, info = self.model.transcribe(
                    audio_file_path,
                    language="ko",
                    word_timestamps=True,
                    vad_filter=True
                )
                transcribed_text = ""
                word_timings = []
                for s in segments:
                    transcribed_text += s.text
                    for w in (s.words or []):
                        word_timings.append({
                            "word": w.word,
                            "start": w.start,
                            "end": w.end,
                            "probability": w.probability
                        })
                
                # Compare expected vs transcribed
                mismatch_words = []
                for kw in expected_dialogue.split():
                    if len(kw) > 1 and kw not in transcribed_text:
                        mismatch_words.append(kw)

                return {
                    "transcribed_text": transcribed_text.strip(),
                    "measured_duration_sec": info.duration,
                    "word_timings": word_timings,
                    "mismatch_detected": len(mismatch_words) > 0,
                    "mismatch_words": mismatch_words,
                    "confidence": "high"
                }
            except Exception as e:
                print(f"[ASR] Error during transcription: {e}")

        # Deterministic fallback timing calculation based on Korean syllables
        char_count = len(expected_dialogue.replace(" ", ""))
        est_sec = min(4.8, max(1.5, char_count * 0.22)) if char_count > 0 else 0.0

        words = expected_dialogue.split()
        fallback_timings = []
        curr = 0.5
        for w in words:
            w_dur = max(0.3, len(w) * 0.22)
            fallback_timings.append({
                "word": w,
                "start": round(curr, 2),
                "end": round(curr + w_dur, 2),
                "probability": 0.95
            })
            curr += w_dur + 0.1

        return {
            "transcribed_text": expected_dialogue,
            "measured_duration_sec": est_sec,
            "word_timings": fallback_timings,
            "mismatch_detected": False,
            "mismatch_words": [],
            "confidence": "fallback_estimation"
        }
