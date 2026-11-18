import { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';
import BriefReady from './BriefReady';
import BriefGenerating from './BriefGenerating';
import BriefReportView from './BriefReportView';
import BriefEditModal from './BriefEditModal';
import BriefPdfPanel from './BriefPdfPanel';
import ReportVersionList from './ReportVersionList';
import ReportPdfDownload from './ReportPdfDownload';
import { BlueButton, OutlineBlueButton } from './report.styles';
import StatusMessage from '../../StatusMessage';
import { getReportReadiness } from '../../../api/reports';
import type { EditableReportSection, ReportOverview, ReportReadiness, ReportVersion } from '../../../api/reports';
import type { Project } from '../../../types/project';
import type { BriefReport, BriefSectionKey } from '../../../types/brief';
import type { EvidenceKind } from '../../../types/contribution';
import { BRIEF_SECTION_META } from '../../../mocks/brief';
import { useReportOverview } from '../../../hooks/useReportOverview';
import { useReportVersionRequest } from '../../../hooks/useReportVersionRequest';

// 프로젝트 상세 > "리포트" 탭 (Copyright Brief)
// 생성 전(1) → 생성 중(2) → 생성 완료(3) / 새 입력이 있으면 업데이트 배너(6) → 다시 생성 중 → 새 버전
// 화면은 Figma 리포트 프레임 그대로, 내용·상태는 서버 리포트 API 응답으로 채움

/** 서버 섹션 ↔ 화면 섹션 */
const SECTION_KEYS: Record<ReportVersion['sections'][number]['sectionKey'], BriefSectionKey> = {
  WORK_OVERVIEW: 'overview',
  AI_USAGE: 'ai-output',
  HUMAN_CONTRIBUTION: 'human-expression',
  EVIDENCE_SUMMARY: 'references',
  GAPS_AND_GUIDANCE: 'supplement',
};
/** 서버에서 직접 편집할 수 있는 섹션 */
const EDITABLE: Partial<Record<BriefSectionKey, EditableReportSection>> = {
  overview: 'WORK_OVERVIEW',
  'ai-output': 'AI_USAGE',
  'human-expression': 'HUMAN_CONTRIBUTION',
};
const CHANGE_LABELS: Record<string, string> = { FINAL_ARTWORK: '최종 작품', MATERIAL: '창작 자료', INTERVIEW_ANSWER: '인터뷰 답변', CONTRIBUTION: '창작 기여' };

/** 서버 리포트 버전 → 리포트 화면 데이터 */
function toBriefReport(version: ReportVersion): BriefReport {
  const sourceKinds = new Map(version.sources.map((source) => [source.sourceId, source.kind]));
  return {
    version: version.versionNo,
    generatedAt: version.readyAt ?? version.createdAt,
    sections: version.sections.map((section) => {
      const key = SECTION_KEYS[section.sectionKey];
      const kinds = new Set<EvidenceKind>(section.sourceIds.map((id) =>
        sourceKinds.get(id) === 'USER_STATEMENT' ? 'user-statement' : 'attachment'));
      return {
        key,
        title: section.title || BRIEF_SECTION_META[key].title,
        summary: BRIEF_SECTION_META[key].summary,
        content: section.paragraphs.join('\n\n'),
        sources: kinds.size ? [...kinds] : ['unverified'],
        userEditedAt: section.userEdited ? version.updatedAt : undefined,
      };
    }),
  };
}

/** 업데이트 배너 두 번째 줄 (새로 반영할 입력 변경) */
function describeChanges(overview?: ReportOverview) {
  if (!overview?.canUpdate || !overview.changeSummary) return '';
  return overview.changeSummary.changes
    .map((item) => {
      const counts = [item.added && `추가 ${item.added}`, item.updated && `수정 ${item.updated}`, item.deleted && `삭제 ${item.deleted}`].filter(Boolean).join(' ');
      return counts ? `${CHANGE_LABELS[item.type] ?? item.type} ${counts}` : '';
    })
    .filter(Boolean)
    .join(' · ') || `입력 리비전 ${overview.changeSummary.fromRevision} → ${overview.changeSummary.toRevision}`;
}

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

  const job = useReportVersionRequest({
    projectId: project.id,
    canGenerate: !!current?.data?.canGenerate,
    overview: overview.data,
    overviewReady: !overview.loading && !overview.refreshing && !overview.error,
    onRequested: overview.refresh,
  });

  const [editKey, setEditKey] = useState<BriefSectionKey | null>(null);
  const [isPdfOpen, setIsPdfOpen] = useState(false);
  const closeEdit = useCallback(() => setEditKey(null), []);
  const closePdf = useCallback(() => setIsPdfOpen(false), []);

  const refreshAll = () => { overview.refresh(); setAttempt((value) => value + 1); };
  const jobRunning = !!job.version && ['QUEUED', 'RUNNING'].includes(job.version.status);
  const generating = job.active || jobRunning;

  // 편집 요청이 접수되면 모달 닫기 (실패하면 모달 안에 오류 표시)
  const [editRequested, setEditRequested] = useState(false);
  if (editRequested && !job.busy) {
    setEditRequested(false);
    if (!job.error) setEditKey(null);
  }

  // 같은 요청이 완료(READY)되면 기존 "동일 요청 상태 확인" 버튼을 누른 것처럼 요청 정리
  const { frozen, busy, continueRequest } = job;
  const finished = job.version?.status === 'READY';
  useEffect(() => {
    if (frozen && finished && !busy) continueRequest();
  }, [frozen, finished, busy, continueRequest]);

  /** 오류·안내 (디자인에 없는 상태라 공통 안내 박스로 위쪽에 표시) */
  const notices = (
    <>
      {overview.error && <StatusMessage role="alert" message={overview.error} action={<OutlineBlueButton type="button" onClick={overview.refresh}>현황 새로고침</OutlineBlueButton>} />}
      {job.error && !editKey && <StatusMessage role="alert" message={job.error} action={job.frozen ? <OutlineBlueButton type="button" disabled={job.busy} onClick={job.continueRequest}>동일 요청 다시 확인</OutlineBlueButton> : undefined} />}
      {job.latestDetail.error && <StatusMessage role="alert" message={job.latestDetail.error} action={<OutlineBlueButton type="button" onClick={job.latestDetail.refresh}>최신 버전 다시 조회</OutlineBlueButton>} />}
      {job.jobDetail.error && <StatusMessage role="alert" message={job.jobDetail.error} action={<OutlineBlueButton type="button" onClick={job.jobDetail.refresh}>진행 상태 다시 조회</OutlineBlueButton>} />}
      {job.version?.status === 'FAILED' && (
        <StatusMessage role="alert" message={job.version.failure?.message ?? '리포트 생성에 실패했습니다.'}
          action={job.version.failure?.retryable && job.frozen
            ? <OutlineBlueButton type="button" disabled={job.busy} onClick={job.continueRequest}>실패한 동일 요청 재시도</OutlineBlueButton>
            : <OutlineBlueButton type="button" disabled={job.busy} onClick={job.reset}>새 작업 준비</OutlineBlueButton>} />
      )}
      {!job.version && overview.data?.lastFailedVersion && (
        <StatusMessage role="alert" message={`최근 실패한 버전: v${overview.data.lastFailedVersion.versionNo}`} />
      )}
    </>
  );

  let body;
  if (overview.loading || !current) {
    body = <StatusMessage message="리포트 현황을 불러오는 중입니다." />;
  } else if (generating) {
    const stage = job.version?.stage ?? overview.data?.activeVersion?.stage;
    body = (
      <BriefGenerating
        stage={stage}
        action={job.frozen && !job.busy ? (
          <BlueButton type="button" onClick={job.continueRequest}>동일 요청 상태 확인</BlueButton>
        ) : undefined}
      />
    );
  } else if (job.ready) {
    const report = toBriefReport(job.ready);
    body = (
      <>
        <BriefReportView
          report={report}
          newInfoText={job.canRequest('UPDATE') ? describeChanges(overview.data) : ''}
          onUpdate={() => void job.run('UPDATE')}
          onEdit={setEditKey}
          onOpenPdf={() => setIsPdfOpen(true)}
        />
        {editKey && (
          <BriefEditModal
            report={report}
            initialKey={editKey}
            editableKeys={Object.keys(EDITABLE) as BriefSectionKey[]}
            saving={job.busy}
            error={job.error}
            onSave={(changes) => {
              const editedSections = (Object.entries(changes) as [BriefSectionKey, string][]).map(([key, content]) => ({
                sectionKey: EDITABLE[key]!,
                paragraphs: content.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
              }));
              if (!job.canRequest('EDIT')) return;
              setEditRequested(true);
              void job.run('EDIT', editedSections);
            }}
            onClose={closeEdit}
          />
        )}
        {isPdfOpen && (
          <BriefPdfPanel
            projectTitle={project.title}
            report={report}
            downloadButton={<ReportPdfDownload projectId={project.id} versionId={job.ready.versionId} available={job.ready.pdfAvailable} />}
            onClose={closePdf}
          />
        )}
      </>
    );
  } else if (job.base && job.latestDetail.loading) {
    body = <StatusMessage message="최신 리포트를 불러오는 중입니다." />;
  } else if (current.error) {
    body = <StatusMessage role="alert" message={current.error} action={<OutlineBlueButton type="button" onClick={() => setAttempt((value) => value + 1)}>다시 시도</OutlineBlueButton>} />;
  } else if (current.data) {
    body = (
      <BriefReady
        readiness={current.data}
        generating={job.busy}
        onGenerate={job.canRequest('GENERATE') || !current.data.canGenerate ? () => void job.run('GENERATE') : undefined}
      />
    );
  }

  return (
    <Section>
      {notices}
      {body}
      <Refresh>
        <OutlineBlueButton type="button" disabled={overview.refreshing} onClick={refreshAll}>현황 새로고침</OutlineBlueButton>
      </Refresh>
      <ReportVersionList key={`versions/${project.id}`} projectId={project.id} latestReady={job.ready} />
    </Section>
  );
}

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

/* 디자인에 없는 새로고침: 리포트 카드 아래 오른쪽 */
const Refresh = styled.div`
  display: flex;
  justify-content: flex-end;
`;
