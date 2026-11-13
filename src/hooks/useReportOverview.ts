import { useCallback, useEffect, useState } from 'react';
import { getReportOverview } from '../api/reports';
import type { ReportOverview } from '../api/reports';

export function useReportOverview(projectId: string) {
  const [attempt, setAttempt] = useState(0);
  const refresh = useCallback(() => setAttempt((value) => value + 1), []);
  const [result, setResult] = useState<{ projectId: string; attempt: number; data?: ReportOverview; error?: string }>();
  useEffect(() => {
    const controller = new AbortController();
    const token = localStorage.getItem('accessToken');
    let timer: ReturnType<typeof setTimeout> | undefined;
    getReportOverview(projectId, controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      if (localStorage.getItem('accessToken') !== token) throw new Error('로그인 상태가 변경되었습니다. 다시 로그인해주세요.');
      setResult({ projectId, attempt, data });
      if (data.activeVersion || data.reportStatus === 'GENERATING') timer = setTimeout(refresh, 3000);
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setResult((old) => ({ projectId, attempt, data: old?.projectId === projectId ? old.data : undefined, error: error instanceof Error ? error.message : '현황 조회에 실패했습니다.' }));
    });
    return () => { controller.abort(); if (timer) clearTimeout(timer); };
  }, [projectId, attempt, refresh]);
  const current = result?.projectId === projectId ? result : undefined;
  return { data: current?.data, error: current?.error, loading: !current, refreshing: current?.attempt !== attempt, refresh };
}
