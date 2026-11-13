import { useCallback, useEffect, useState } from 'react';
import { getReportVersion } from '../api/reports';
import type { ReportVersion } from '../api/reports';

export function useReportVersion(projectId: string, versionId?: number) {
  const [attempt, setAttempt] = useState(0);
  const refresh = useCallback(() => setAttempt((value) => value + 1), []);
  const [result, setResult] = useState<{ projectId: string; versionId: number; data?: ReportVersion; error?: string }>();
  useEffect(() => {
    if (versionId === undefined) return;
    const controller = new AbortController();
    const token = localStorage.getItem('accessToken');
    let timer: ReturnType<typeof setTimeout> | undefined;
    getReportVersion(projectId, versionId, controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      if (localStorage.getItem('accessToken') !== token) throw new Error('로그인 상태가 변경되었습니다.');
      setResult({ projectId, versionId, data });
      if (['QUEUED','RUNNING'].includes(data.status)) timer = setTimeout(refresh, 3000);
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setResult((old) => ({ projectId, versionId, data: old?.projectId === projectId && old.versionId === versionId ? old.data : undefined, error: error instanceof Error ? error.message : '버전 조회에 실패했습니다.' }));
    });
    return () => { controller.abort(); if (timer) clearTimeout(timer); };
  }, [projectId, versionId, attempt, refresh]);
  const current = versionId !== undefined && result?.projectId === projectId && result.versionId === versionId ? result : undefined;
  return { data: current?.data, error: current?.error, loading: versionId !== undefined && !current, refresh };
}
