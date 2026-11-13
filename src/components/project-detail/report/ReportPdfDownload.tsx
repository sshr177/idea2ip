import { useEffect, useRef, useState } from 'react';
import { getReportPdf } from '../../../api/reports';

export default function ReportPdfDownload({ projectId, versionId, available }: { projectId: string; versionId: number; available: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => controller.current?.abort(), [projectId, versionId]);
  const download = async () => {
    if (!available || controller.current) return;
    const request = new AbortController();
    controller.current = request;
    setBusy(true); setError('');
    const token = localStorage.getItem('accessToken');
    try {
      const { blob, fileName } = await getReportPdf(projectId, versionId, request.signal);
      if (request.signal.aborted) return;
      if (localStorage.getItem('accessToken') !== token) throw new Error('로그인 상태가 변경되었습니다. 다시 로그인해주세요.');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = fileName;
      document.body.appendChild(link);
      try { link.click(); } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch (cause) {
      if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : 'PDF 다운로드에 실패했습니다.');
    } finally { controller.current = undefined; setBusy(false); }
  };
  return <div>
    <button type="button" disabled={!available || busy} onClick={download}>{busy ? 'PDF 다운로드 중…' : 'PDF 다운로드'}</button>
    {error && <p role="alert">{error}</p>}
  </div>;
}
