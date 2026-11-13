import { useEffect, useState } from 'react';
import BriefReady from './BriefReady';
import ReportVersionPanel from './ReportVersionPanel';
import ReportVersionList from './ReportVersionList';
import { getReportReadiness } from '../../../api/reports';
import type { ReportReadiness } from '../../../api/reports';
import type { Project } from '../../../types/project';
import { useReportOverview } from '../../../hooks/useReportOverview';

export default function ReportTab({ project }: { project: Project }) {
  const overview = useReportOverview(project.id);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ projectId: string; attempt: number; data?: ReportReadiness; error?: string }>();
  useEffect(() => {
    const controller = new AbortController();
    const token = localStorage.getItem('accessToken');
    getReportReadiness(project.id, controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      if (localStorage.getItem('accessToken') !== token) throw new Error('로그인 상태가 변경되었습니다. 다시 로그인해주세요.');
      setResult({ projectId: project.id, attempt, data });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setResult({ projectId: project.id, attempt, error: error instanceof Error ? error.message : '리포트 준비 상태를 불러오지 못했습니다.' });
    });
    return () => controller.abort();
  }, [project.id, attempt]);
  const current = result?.projectId === project.id && result.attempt === attempt ? result : undefined;
  return <section>
    <h3>리포트 현황</h3>
    <button type="button" disabled={overview.refreshing} onClick={overview.refresh}>현황 새로고침</button>
    {overview.loading && <p role="status">리포트 현황을 불러오는 중입니다.</p>}
    {overview.error && <p role="alert">{overview.error}</p>}
    {overview.data && <>
      <p>{({ NOT_STARTED: '생성 전', GENERATING: '생성 중', READY: '준비 완료', FAILED: '생성 실패' })[overview.data.reportStatus]}</p>
      {overview.data.latestReadyVersion && <p>최신 준비 버전: {overview.data.latestReadyVersion.versionNo} · {overview.data.latestReadyVersion.pdfAvailable ? 'PDF 준비됨' : 'PDF 준비 전'}</p>}
      {overview.data.activeVersion && <p role="status">진행 중 버전 {overview.data.activeVersion.versionNo} · {overview.data.activeVersion.stage ?? '작업 대기'}</p>}
      {overview.data.lastFailedVersion && <p>최근 실패 버전: {overview.data.lastFailedVersion.versionNo}</p>}
      <p>{overview.data.canUpdate ? '새 입력을 반영할 수 있습니다.' : '현재 새 입력 반영이 불가능합니다.'}</p>
      {overview.data.changeSummary && <section><h4>입력 변경 요약</h4><p>리비전 {overview.data.changeSummary.fromRevision} → {overview.data.changeSummary.toRevision}</p><ul>{overview.data.changeSummary.changes.map((item, index) => <li key={index}>{({ FINAL_ARTWORK: '최종 작품', MATERIAL: '창작 자료', INTERVIEW_ANSWER: '인터뷰 답변', CONTRIBUTION: '창작 기여' } as Record<string,string>)[item.type] ?? item.type} · 추가 {item.added} · 수정 {item.updated} · 삭제 {item.deleted}</li>)}</ul></section>}
    </>}
    <button type="button" onClick={() => setAttempt((value) => value + 1)}>{current?.error ? '다시 시도' : '준비 상태 새로고침'}</button>
    {!current ? <p role="status">리포트 준비 상태를 불러오는 중입니다.</p> : current.error ? <p role="alert">{current.error}</p> : current.data && <BriefReady readiness={current.data} />}
    <ReportVersionPanel key={project.id} projectId={project.id} canGenerate={!!current?.data?.canGenerate} overview={overview.data} overviewReady={!overview.loading && !overview.refreshing && !overview.error} onRequested={overview.refresh} />
    <ReportVersionList key={`versions/${project.id}`} projectId={project.id} />
  </section>;
}
