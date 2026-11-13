import { useRef, useState } from 'react';
import { useReportVersion } from '../../../hooks/useReportVersion';
import ReportPdfDownload from './ReportPdfDownload';
import { ReportRequestError, requestReportVersion, REPORT_SECTION_LABELS } from '../../../api/reports';
import type { EditableReportSection, ReportOverview, ReportVersion, ReportVersionRequest } from '../../../api/reports';

export default function ReportVersionPanel({ projectId, canGenerate, overview, overviewReady, onRequested }: {
  projectId: string; canGenerate: boolean; overview?: ReportOverview; overviewReady: boolean; onRequested: () => void;
}) {
  const [localVersion, setVersion] = useState<ReportVersion>();
  const [localReady, setReady] = useState<ReportVersion>();
  const [operation, setOperation] = useState<ReportVersionRequest['operation']>('GENERATE');
  const [section, setSection] = useState<EditableReportSection>('WORK_OVERVIEW');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const request = useRef<ReportVersionRequest | undefined>(undefined);
  const base = overview?.latestReadyVersion ?? localReady;
  const latestDetail = useReportVersion(projectId, base?.versionId);
  const jobDetail = useReportVersion(projectId, localVersion?.versionId ?? overview?.activeVersion?.versionId);
  const ready = latestDetail.data?.status === 'READY' ? latestDetail.data : localReady?.versionId === base?.versionId ? localReady : undefined;
  const version = jobDetail.data ?? localVersion;
  const active = !!overview?.activeVersion || overview?.reportStatus === 'GENERATING';
  const run = async () => {
    if (lock.current) return;
    let input = request.current;
    if (!input) {
      if (!overviewReady || active) return;
      if (operation !== 'EDIT' && !canGenerate) return;
      if (operation === 'UPDATE' && !overview?.canUpdate) return;
      if (operation !== 'GENERATE' && !base) { setError('최신 READY 버전이 필요합니다.'); return; }
      input = { requestId: crypto.randomUUID(), operation, ...(operation !== 'GENERATE' ? { baseVersionId: base!.versionId } : {}) };
      if (operation === 'EDIT') input.editedSections = [{ sectionKey: section, paragraphs: text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean) }];
    }
    if (version?.status === 'FAILED' && version.failure?.retryable) input = { ...input, retry: true };
    request.current = input;
    lock.current = true; setBusy(true); setFrozen(true); setError('');
    const token = localStorage.getItem('accessToken');
    try {
      const result = await requestReportVersion(projectId, input);
      if (localStorage.getItem('accessToken') !== token) throw new Error('로그인 상태가 변경되었습니다.');
      setVersion(result);
      onRequested();
      if (result.status === 'READY') {
        setReady(result); request.current = undefined; setFrozen(false); setOperation('UPDATE');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '리포트 요청에 실패했습니다.');
      if (cause instanceof ReportRequestError && [400,401,403,404,409].includes(cause.status)) { request.current = undefined; setFrozen(false); }
      if (cause instanceof ReportRequestError && cause.status === 409) onRequested();
    } finally { lock.current = false; setBusy(false); }
  };
  const labels = { QUEUED: '생성 대기', RUNNING: '생성 중', READY: '준비 완료', FAILED: '생성 실패' };
  const stages = { COLLECTING_INPUT: '입력 수집', LINKING_SOURCES: '출처 연결', DRAFTING: '본문 작성', RENDERING_PDF: 'PDF 생성' };
  return <section aria-label="리포트 버전 작업" aria-busy={busy}>
    <h3>리포트 버전 생성·업데이트·편집</h3>
    {latestDetail.loading && <p role="status">최신 버전 본문을 불러오는 중입니다.</p>}
    {latestDetail.error && <div role="alert"><p>{latestDetail.error}</p><button type="button" onClick={latestDetail.refresh}>최신 버전 다시 조회</button></div>}
    {jobDetail.error && <div role="alert"><p>{jobDetail.error}</p><button type="button" onClick={jobDetail.refresh}>진행 상태 다시 조회</button></div>}
    <fieldset disabled={busy || frozen}>
      <label>작업 유형 <select value={operation} onChange={(event) => {
        setOperation(event.target.value as typeof operation);
        if (event.target.value === 'EDIT') setText(ready?.sections.find((item) => item.sectionKey === section)?.paragraphs.join('\n\n') ?? '');
      }}>
        <option value="GENERATE" disabled={!!base}>최초 생성</option><option value="UPDATE" disabled={!base || !overview?.canUpdate}>새 입력 반영</option><option value="EDIT" disabled={!ready || ready.versionId !== base?.versionId}>직접 편집</option>
      </select></label>
      {operation === 'EDIT' && <>
        <label>편집 섹션 <select value={section} onChange={(event) => {
          const key = event.target.value as EditableReportSection;
          setSection(key); setText(ready?.sections.find((item) => item.sectionKey === key)?.paragraphs.join('\n\n') ?? '');
        }}>{(['WORK_OVERVIEW','AI_USAGE','HUMAN_CONTRIBUTION'] as const).map((key) => <option key={key} value={key}>{REPORT_SECTION_LABELS[key]}</option>)}</select></label>
        <p>단락은 빈 줄로 구분합니다. 선택한 섹션의 전체 단락이 교체됩니다.</p>
        <textarea value={text} onChange={(event) => setText(event.target.value)} style={{ display: 'block', width: '100%', minHeight: 160 }} />
        <button type="button" onClick={() => setText(ready?.sections.find((item) => item.sectionKey === section)?.paragraphs.join('\n\n') ?? '')}>기존 섹션 내용 불러오기</button>
      </>}
    </fieldset>
    {error && <p role="alert">{error}</p>}
    <button type="button" onClick={() => {
      if (version && ['QUEUED','RUNNING'].includes(version.status)) jobDetail.refresh();
      else if (frozen && version?.status === 'READY') { request.current = undefined; setFrozen(false); setOperation('UPDATE'); }
      else void run();
    }} disabled={busy || (!frozen && (!overviewReady || active || (operation !== 'EDIT' && !canGenerate) || (operation === 'GENERATE' && !!base) || (operation === 'UPDATE' && (!base || !overview?.canUpdate)))) || (version?.status === 'FAILED' && !version.failure?.retryable)}>
      {busy ? '요청 중…' : frozen ? version?.status === 'FAILED' ? '실패한 동일 요청 재시도' : '동일 요청 상태 확인' : '리포트 버전 요청'}
    </button>
    {base && !active && <button type="button" disabled={busy || !overviewReady} onClick={() => { request.current = undefined; setFrozen(false); setVersion(undefined); setOperation('UPDATE'); setError(''); }}>최신 READY 버전 기준으로 새 작업 준비</button>}
    {!base && <p>최초 리포트를 생성하면 업데이트·편집할 수 있습니다.</p>}
    {version && <>
      <h4>버전 {version.versionNo} · {labels[version.status]}</h4>
      {version.stage && <p>{stages[version.stage]}</p>}
      {version.failure && <p role="alert">{version.failure.message}</p>}
      <p>입력 리비전 {version.inputRevision} · {version.pdfAvailable ? 'PDF 준비됨' : 'PDF 준비 전'}</p>
      <ReportPdfDownload projectId={projectId} versionId={version.versionId} available={version.status === 'READY' && version.pdfAvailable} />
      {version.sections.map((item) => <section key={item.sectionKey}><h4>{item.title}</h4>{item.paragraphs.map((paragraph, index) => <p key={index} style={{ whiteSpace: 'pre-wrap' }}>{paragraph}</p>)}</section>)}
      {!!version.reviewFlags.length && <section><h4>편집 검토 안내</h4>{version.reviewFlags.map((flag, index) => <div key={index}><p>{flag.sectionKey} · {flag.code}</p>{flag.retainedUserParagraphs.map((p, i) => <p key={i}>{p}</p>)}</div>)}</section>}
      {!!version.sources.length && <section><h4>출처</h4>{version.sources.map((source) => <div key={source.sourceId}><strong>{source.title}</strong>{source.quote && <blockquote>{source.quote}</blockquote>}{source.locator && <p>{source.locator}</p>}</div>)}</section>}
    </>}
  </section>;
}
