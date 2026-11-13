import { useEffect, useState } from 'react';
import { getProject, ProjectListError } from '../api/projects';
import type { Project } from '../types/project';

export function useProjectDetail(projectId: string) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    projectId: string;
    attempt: number;
    project?: Project;
    error?: string;
    status?: number;
  }>();

  useEffect(() => {
    const controller = new AbortController();
    const token = localStorage.getItem('accessToken');
    getProject(projectId, controller.signal)
      .then((project) => {
        if (controller.signal.aborted) return;
        if (localStorage.getItem('accessToken') !== token) {
          setResult({ projectId, attempt, status: 401, error: '로그인 상태가 변경되었습니다. 다시 로그인해주세요.' });
          return;
        }
        setResult({ projectId, attempt, project });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const status = error instanceof ProjectListError ? error.status : undefined;
        if (status === 401 && localStorage.getItem('accessToken') === token) localStorage.removeItem('accessToken');
        setResult({ projectId, attempt, status, error: error instanceof Error ? error.message : '프로젝트 정보를 불러오지 못했습니다.' });
      });
    return () => controller.abort();
  }, [projectId, attempt]);

  const current = result?.projectId === projectId && result.attempt === attempt ? result : undefined;
  return { ...current, loading: !current, retry: () => setAttempt((value) => value + 1) };
}
