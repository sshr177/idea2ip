import { useEffect, useState } from 'react';
import { getReportVersions } from '../../../api/reports';
import type { ReportVersionSummary } from '../../../api/reports';
import ReportVersionDetail from './ReportVersionDetail';
import ReportPdfDownload from './ReportPdfDownload';

export default function ReportVersionList({ projectId }: { projectId: string }) {
  const [query, setQuery] = useState<{ attempt: number; before?: number }>({ attempt: 0 });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [result, setResult] = useState<{ attempt: number; versions: ReportVersionSummary[]; next: number | null; error?: string }>();
  useEffect(() => {
    const controller = new AbortController();
    const token = localStorage.getItem('accessToken');
    getReportVersions(projectId, { beforeVersionNo: query.before, limit: 20 }, controller.signal).then((page) => {
      if (controller.signal.aborted) return;
      if (localStorage.getItem('accessToken') !== token) throw new Error('로그인 상태가 변경되었습니다.');
      setResult((old) => {
        const items = query.before === undefined ? page.versions : [...(old?.versions ?? []), ...page.versions];
        const unique = [...new Map(items.map((item) => [item.versionId, item])).values()].sort((a, b) => b.versionNo - a.versionNo);
        return { attempt: query.attempt, versions: unique, next: page.nextBeforeVersionNo };
      });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setResult((old) => ({ attempt: query.attempt, versions: old?.versions ?? [], next: old?.next ?? null, error: error instanceof Error ? error.message : '버전 목록 조회에 실패했습니다.' }));
    });
    return () => controller.abort();
  }, [projectId, query]);
  const loading = result?.attempt !== query.attempt;
  const statuses = { QUEUED: '대기', RUNNING: '생성 중', READY: '준비 완료', FAILED: '실패' };
  const operations = { GENERATE: '최초 생성', UPDATE: '입력 업데이트', EDIT: '직접 편집' };
  return <section aria-label="리포트 버전 목록" aria-busy={loading}>
    <h3>리포트 버전 목록</h3>
    <button type="button" disabled={loading} onClick={() => setQuery((old) => ({ attempt: old.attempt + 1 }))}>최신 목록 새로고침</button>
    {loading && <p role="status">버전 목록을 불러오는 중입니다.</p>}
    {result?.error && <div role="alert"><p>{result.error}</p><button type="button" disabled={loading} onClick={() => setQuery((old) => ({ ...old, attempt: old.attempt + 1 }))}>다시 시도</button></div>}
    {!loading && !result?.error && !result?.versions.length && <p>아직 생성된 리포트 버전이 없습니다.</p>}
    <ol>{result?.versions.map((version) => <li key={version.versionId} style={{ padding: 12, marginBottom: 8, background: '#fff', borderRadius: 10 }}>
      <strong>버전 {version.versionNo}</strong> · {operations[version.operation]} · {statuses[version.status]}
      <p>생성: {version.createdAt.replace('T', ' ')}</p>
      {version.readyAt && <p>준비 완료: {version.readyAt.replace('T', ' ')}</p>}
      {version.stage && <p>처리 단계: {({ COLLECTING_INPUT: '입력 수집', LINKING_SOURCES: '출처 연결', DRAFTING: '본문 작성', RENDERING_PDF: 'PDF 생성' })[version.stage]}</p>}
      <p>{version.pdfAvailable ? 'PDF 준비됨' : 'PDF 준비 전'}</p>
      <button type="button" onClick={() => setSelectedId(version.versionId)}>버전 상세 보기</button>
      <ReportPdfDownload projectId={projectId} versionId={version.versionId} available={version.status === 'READY' && version.pdfAvailable} />
    </li>)}</ol>
    {result?.next != null && !result.error && <button type="button" disabled={loading} onClick={() => setQuery((old) => ({ attempt: old.attempt + 1, before: result.next! }))}>이전 버전 더 보기</button>}
    {selectedId !== null && <ReportVersionDetail key={selectedId} projectId={projectId} versionId={selectedId} onClose={() => setSelectedId(null)} />}
  </section>;
}
