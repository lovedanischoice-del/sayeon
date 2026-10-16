/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header.js';
import { ProjectList } from './components/ProjectList.js';
import { PipelineView } from './components/PipelineView.js';
import { ReviewRoom } from './components/ReviewRoom.js';
import { DiagnosticsView } from './components/DiagnosticsView.js';
import { NewProjectModal } from './components/NewProjectModal.js';
import { RevisionModal } from './components/RevisionModal.js';
import type { Project, Run } from '../shared/schemas/types.js';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Unhandled UI error in component tree:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-2xl mx-auto my-12 p-6 rounded-xl bg-slate-900 border border-rose-800/60 text-slate-100 space-y-4">
          <div className="flex items-center gap-2 text-rose-400 font-bold text-lg">
            <span>⚠️ 화면 표시 중 오류가 발생했습니다</span>
          </div>
          <p className="text-sm text-slate-300">
            {this.state.error?.message || '알 수 없는 클라이언트 렌더 오류'}
          </p>
          <div className="pt-2">
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition"
            >
              화면 새로고침
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'projects' | 'pipeline' | 'review' | 'diagnostics'>('projects');
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activeRun, setActiveRun] = useState<Run | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [uiNotice, setUiNotice] = useState<{ message: string; type: 'info' | 'error' | 'success' } | null>(null);

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [revisionShotId, setRevisionShotId] = useState<string | undefined>(undefined);

  // 1. Fetch system status
  const fetchSystemStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/system/status');
      if (res.ok) {
        const data = await res.json();
        setSystemStatus(data);
      }
    } catch (e) {
      console.warn('Failed to fetch system status:', e);
    }
  }, []);

  // 2. Fetch projects list
  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const list: Project[] = await res.json();
        setProjects(list);
        if (list.length > 0 && !activeProject) {
          setActiveProject(list[0]);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch projects:', e);
    }
  }, [activeProject]);

  // 3. Fetch active run details & events
  const fetchActiveRun = useCallback(async () => {
    if (!activeProject || !activeProject.current_run_id) return;
    try {
      const [runRes, eventsRes] = await Promise.all([
        fetch(`/api/runs/${activeProject.current_run_id}`),
        fetch(`/api/runs/${activeProject.current_run_id}/events`),
      ]);
      if (runRes.ok) {
        const runData = await runRes.json();
        setActiveRun(runData);
      }
      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setEvents(eventsData);
      }
    } catch (e) {
      console.warn('Failed to fetch run data:', e);
    }
  }, [activeProject]);

  useEffect(() => {
    fetchSystemStatus();
    fetchProjects();
  }, [fetchSystemStatus, fetchProjects]);

  useEffect(() => {
    fetchActiveRun();
    const interval = setInterval(() => {
      fetchActiveRun();
      fetchSystemStatus();
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchActiveRun, fetchSystemStatus]);

  // Project creation handler
  const handleCreateProject = async (data: any) => {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('프로젝트 생성 실패');
    const newProj: Project = await res.json();

    // Start Run with chosen engine
    const runRes = await fetch(`/api/projects/${newProj.id}/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_engine: data.video_engine }),
    });
    if (!runRes.ok) throw new Error('작업 실행 등록 실패');
    const newRun: Run = await runRes.json();

    newProj.current_run_id = newRun.id;
    setActiveProject(newProj);
    setActiveRun(newRun);
    setActiveTab('pipeline');
    fetchProjects();
  };

  // 1-Click Quick Test Production
  const handleQuickTest = async (engine: 'comfyui_h3' | 'google_ai' = 'comfyui_h3') => {
    try {
      const engineName = engine === 'google_ai' ? 'Google AI Cloud' : 'ComfyUI MiniMax H3';
      setUiNotice({ message: `10샷 테스트 제작 (${engineName}) 시작 중...`, type: 'info' });
      const res = await fetch('/api/projects/quick-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_engine: engine }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || '테스트 제작 요청 실패');
      }
      const data = await res.json();
      setActiveProject(data.project);
      setActiveRun(data.run);
      setActiveTab('pipeline');
      fetchProjects();
      setUiNotice({
        message: `10샷 감동실화 사연쇼츠 [${engineName}] 파이프라인이 가동되었습니다.`,
        type: 'success',
      });
      setTimeout(() => setUiNotice(null), 4000);
    } catch (e: any) {
      setUiNotice({ message: `테스트 제작 오류: ${e.message}`, type: 'error' });
      setTimeout(() => setUiNotice(null), 6000);
    }
  };

  // Run Test Pipeline on existing run
  const handleRunTestPipeline = async (engine?: 'comfyui_h3' | 'google_ai') => {
    if (!activeRun) return;
    try {
      const targetEngine = engine || activeRun.video_engine || 'comfyui_h3';
      const engineName = targetEngine === 'google_ai' ? 'Google AI Cloud' : 'ComfyUI MiniMax H3';
      setUiNotice({ message: `[${engineName}] 테스트 파이프라인 가동 중...`, type: 'info' });
      const res = await fetch(`/api/runs/${activeRun.id}/test-run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_engine: targetEngine }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || '테스트 파이프라인 가동 실패');
      }
      fetchActiveRun();
      setUiNotice({ message: `[${engineName}] 파이프라인이 시작되었습니다.`, type: 'success' });
      setTimeout(() => setUiNotice(null), 4000);
    } catch (e: any) {
      setUiNotice({ message: `테스트 파이프라인 오류: ${e.message}`, type: 'error' });
      setTimeout(() => setUiNotice(null), 6000);
    }
  };

  // Switch Video Engine for active run
  const handleSwitchEngine = async (engine: 'comfyui_h3' | 'google_ai') => {
    if (!activeRun) return;
    try {
      const res = await fetch(`/api/runs/${activeRun.id}/engine`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_engine: engine }),
      });
      if (res.ok) {
        const updatedRun = await res.json();
        setActiveRun(updatedRun);
        setUiNotice({
          message: `영상 제작 엔진이 [${engine === 'google_ai' ? 'Google AI Cloud (외부)' : 'ComfyUI MiniMax H3 (내부 GPU)'}]로 설정되었습니다.`,
          type: 'success',
        });
        setTimeout(() => setUiNotice(null), 4000);
      }
    } catch (e: any) {
      setUiNotice({ message: `엔진 전환 오류: ${e.message}`, type: 'error' });
      setTimeout(() => setUiNotice(null), 5000);
    }
  };

  // Run control handlers
  const handlePauseRun = async () => {
    if (!activeRun) return;
    await fetch(`/api/runs/${activeRun.id}/pause`, { method: 'POST' });
    fetchActiveRun();
  };

  const handleResumeRun = async () => {
    if (!activeRun) return;
    await fetch(`/api/runs/${activeRun.id}/resume`, { method: 'POST' });
    fetchActiveRun();
  };

  const handleCancelRun = async () => {
    if (!activeRun) return;
    await fetch(`/api/runs/${activeRun.id}/cancel`, { method: 'POST' });
    fetchActiveRun();
  };

  // Review submission
  const handleSubmitReview = async (reviewData: any) => {
    if (!activeRun) return;
    const res = await fetch(`/api/renders/${activeRun.id}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        run_id: activeRun.id,
        ...reviewData,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      alert(`검수 처리 오류: ${err.error || '승인 실패'}`);
      return;
    }
    fetchActiveRun();
  };

  // Drive Export
  const handleTriggerDriveExport = async () => {
    if (!activeRun) return;
    await fetch(`/api/runs/${activeRun.id}/exports/drive`, { method: 'POST' });
    fetchActiveRun();
  };

  // Revision submission
  const handleSubmitRevision = async (revData: any) => {
    if (!activeRun) return;
    const res = await fetch(`/api/runs/${activeRun.id}/revisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(revData),
    });
    if (!res.ok) {
      alert('수정 요청 등록 실패');
      return;
    }
    fetchActiveRun();
    setActiveTab('pipeline');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-rose-500 selection:text-white">
      {/* Top Global Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        systemStatus={systemStatus}
        activeEngine={activeRun?.video_engine || activeProject?.video_engine || 'comfyui_h3'}
        onQuickTest={handleQuickTest}
        onRefresh={() => {
          fetchProjects();
          fetchActiveRun();
          fetchSystemStatus();
        }}
      />

      {/* Global Notification Banner */}
      {uiNotice && (
        <div
          className={`px-6 py-2.5 text-xs font-semibold flex items-center justify-between transition ${
            uiNotice.type === 'error'
              ? 'bg-rose-950/90 text-rose-200 border-b border-rose-800'
              : uiNotice.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-b border-emerald-800'
              : 'bg-indigo-950/90 text-indigo-200 border-b border-indigo-800'
          }`}
        >
          <span>{uiNotice.message}</span>
          <button
            onClick={() => setUiNotice(null)}
            className="text-xs text-slate-400 hover:text-white ml-4 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <ErrorBoundary>
        <main className="flex-1 p-6">
        {activeTab === 'projects' && (
          <ProjectList
            projects={projects}
            activeProject={activeProject}
            activeRun={activeRun}
            onSelectProject={(p) => {
              setActiveProject(p);
              fetchActiveRun();
            }}
            onOpenNewModal={() => setIsNewModalOpen(true)}
            onQuickTest={handleQuickTest}
            onRefresh={fetchProjects}
            onGoToPipeline={() => setActiveTab('pipeline')}
            onGoToReview={() => setActiveTab('review')}
          />
        )}

        {activeTab === 'pipeline' && (
          <PipelineView
            project={activeProject}
            run={activeRun}
            events={events}
            onPause={handlePauseRun}
            onResume={handleResumeRun}
            onCancel={handleCancelRun}
            onRefresh={fetchActiveRun}
            onRunTestPipeline={handleRunTestPipeline}
            onOpenRevisionForShot={(shotId) => {
              setRevisionShotId(shotId);
              setIsRevisionModalOpen(true);
            }}
            onGoToReview={() => setActiveTab('review')}
            onSwitchEngine={handleSwitchEngine}
          />
        )}

        {activeTab === 'review' && (
          <ReviewRoom
            project={activeProject}
            run={activeRun}
            onSubmitReview={handleSubmitReview}
            onTriggerDriveExport={handleTriggerDriveExport}
            onOpenRevisionModal={() => {
              setRevisionShotId(undefined);
              setIsRevisionModalOpen(true);
            }}
          />
        )}

        {activeTab === 'diagnostics' && (
          <DiagnosticsView
            systemStatus={systemStatus}
            onRefresh={fetchSystemStatus}
            activeProject={activeProject}
            activeRun={activeRun}
          />
        )}
      </main>
      </ErrorBoundary>

      {/* Modals */}
      <NewProjectModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSubmit={handleCreateProject}
      />

      <RevisionModal
        isOpen={isRevisionModalOpen}
        onClose={() => {
          setIsRevisionModalOpen(false);
          setRevisionShotId(undefined);
        }}
        initialShotId={revisionShotId}
        onRerenderVideoOnly={async (shots, engine) => {
          if (!activeRun) return;
          setUiNotice({
            message: `${shots.join(', ')} 컷을 [${engine === 'google_ai' ? 'Google AI Cloud' : 'ComfyUI H3'}]로 렌더링하는 중...`,
            type: 'info',
          });
          const res = await fetch(`/api/runs/${activeRun.id}/rerender-video`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              target_shots: shots,
              video_engine: engine,
            }),
          });
          if (res.ok) {
            fetchActiveRun();
            setUiNotice({
              message: `${shots.join(', ')} 컷 영상이 정상적으로 재생성되었습니다.`,
              type: 'success',
            });
            setTimeout(() => setUiNotice(null), 4000);
          }
        }}
        onSubmitRevision={handleSubmitRevision}
      />
    </div>
  );
}
