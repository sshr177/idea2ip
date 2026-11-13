import { useCallback, useEffect, useState } from 'react';
import { getContributions } from '../api/contributions';
import type { ContributionReview } from '../api/contributions';

export function useContributions(projectId: string) {
  const [attempt, setAttempt] = useState(0);
  const refresh = useCallback(() => setAttempt((value) => value + 1), []);
  const [result, setResult] = useState<{ projectId: string; attempt: number; data?: ContributionReview; error?: string }>();
  useEffect(() => {
    const controller = new AbortController();
    const token = localStorage.getItem('accessToken');
    let timer: ReturnType<typeof setTimeout> | undefined;
    getContributions(projectId, controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      if (localStorage.getItem('accessToken') !== token) throw new Error('로그인 상태가 변경되었습니다. 다시 로그인해주세요.');
      setResult({ projectId, attempt, data });
      if (data.latestGeneration && ['QUEUED','RUNNING'].includes(data.latestGeneration.status)) timer = setTimeout(refresh, 3000);
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setResult((old) => ({ projectId, attempt, data: old?.projectId === projectId ? old.data : undefined, error: error instanceof Error ? error.message : '기여 목록 조회에 실패했습니다.' }));
    });
    return () => { controller.abort(); if (timer) clearTimeout(timer); };
  }, [projectId, attempt, refresh]);
  const current = result?.projectId === projectId ? result : undefined;
  const applyReview = (data: ContributionReview) => { setResult({ projectId, attempt, data }); refresh(); };
  return { data: current?.data, error: current?.error, loading: !current, refreshing: current?.attempt !== attempt, refresh, applyReview };
}
