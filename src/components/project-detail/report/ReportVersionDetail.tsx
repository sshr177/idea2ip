import ModalShell from '../../modal/ModalShell';
import { useReportVersion } from '../../../hooks/useReportVersion';
import ReportPdfDownload from './ReportPdfDownload';

export default function ReportVersionDetail({ projectId, versionId, onClose }: { projectId: string; versionId: number; onClose: () => void }) {
  const { data, error, loading, refresh } = useReportVersion(projectId, versionId);
  const metadata = { edition: '판본', publisher: '발행처', publishedOn: '발행일', effectiveFrom: '시행 시작일', effectiveTo: '시행 종료일', retrievedOn: '조회일' };
  return <ModalShell titleId="report-version-detail-title" title="리포트 버전 상세" width={760} onClose={onClose}>
    <button type="button" onClick={refresh}>버전 새로고침</button>
    {loading && <p role="status">버전을 불러오는 중입니다.</p>}
    {error && <p role="alert">{error}</p>}
    {data && <article style={{ paddingBottom: 24, overflowWrap: 'anywhere' }}>
      <h3>버전 {data.versionNo} · {({ QUEUED: '대기', RUNNING: '생성 중', READY: '준비 완료', FAILED: '실패' })[data.status]}</h3>
      {data.stage && <p>처리 단계: {data.stage}</p>}
      <p>생성: {data.createdAt} · 갱신: {data.updatedAt}</p>
      {data.failure && <p role="alert">{data.failure.code} · {data.failure.message}</p>}
      {data.sections.map((section) => <section key={section.sectionKey}>
        <h4>{section.title}{section.userEdited ? ' (사용자 편집)' : ''}</h4>
        {section.paragraphs.map((p, index) => <p key={index} style={{ whiteSpace: 'pre-wrap' }}>{p}</p>)}
        {!!section.sourceIds.length && <p>연결 출처: {section.sourceIds.join(', ')}</p>}
      </section>)}
      {!!data.reviewFlags.length && <section><h4>편집 검토 안내</h4>{data.reviewFlags.map((flag, i) => <div key={i}><p>{flag.sectionKey} · {flag.code}</p><p>출처: {flag.sourceIds.join(', ')}</p>{flag.retainedUserParagraphs.map((p, j) => <p key={j}>{p}</p>)}</div>)}</section>}
      <h4>출처</h4>{!data.sources.length && <p>출처 없음</p>}
      {data.sources.map((source, i) => <section key={`${source.sourceId}/${i}`}>
        <h5>{source.title}</h5><p>{source.kind}</p>{source.quote && <blockquote>{source.quote}</blockquote>}{source.locator && <p>{source.locator}</p>}
        {typeof source.officialUrl === 'string' && /^https?:\/\//i.test(source.officialUrl) && <a href={source.officialUrl} target="_blank" rel="noreferrer">공식 자료 보기</a>}
        <dl>{Object.entries(metadata).map(([key,label]) => typeof source[key] === 'string' && <div key={key}><dt>{label}</dt><dd>{String(source[key])}</dd></div>)}</dl>
      </section>)}
      <p>입력 리비전 {data.inputRevision} · 스키마 {data.schemaVersion ?? '미제공'} · 템플릿 {data.templateVersion ?? '미제공'} · 모드 {data.mode ?? '미제공'}</p>
      <ReportPdfDownload projectId={projectId} versionId={data.versionId} available={data.status === 'READY' && data.pdfAvailable} />
    </article>}
  </ModalShell>;
}
