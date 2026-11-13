import SectionHeader from '../SectionHeader';
import { useState } from 'react';
import ContributionStepModal from './ContributionStepModal';
import ContributionReviewModal from './ContributionReviewModal';
import ContributionGenerationPanel from './ContributionGenerationPanel';
import { useContributions } from '../../../hooks/useContributions';
import type { ProjectTabKey } from '../../../constants/projectTabs';

export default function ContributionTab({ projectId }: { projectId: string; onChangeTab: (tab: ProjectTabKey) => void }) {
  const { data, error, loading, refreshing, refresh, applyReview } = useContributions(projectId);
  const [review, setReview] = useState<{ stepId: number | null; revision: number } | null>(null);
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  if (loading) return <p role="status">기여 목록을 불러오는 중입니다.</p>;
  const reviews = { NOT_STARTED: '검토 전', IN_REVIEW: '검토 중', CONFIRMED: '확정' };
  const kinds = { MATERIAL: '창작 자료', FINAL_ARTWORK: '최종 작품', INTERVIEW_STATEMENT: '인터뷰 진술' };
  const steps = { UNREVIEWED: '미검토', EDITED: '수정됨', CONFIRMED: '확정', EXCLUDED: '제외됨' };
  return <section>
    <SectionHeader title="창작 기여 정리" subtitle="서버에서 생성한 기여 단계와 검토 상태를 확인해요." />
    {error && <p role="alert">{error}</p>}
    <button type="button" disabled={refreshing} onClick={refresh}>목록 새로고침</button>
    {data && <>
      <p>{reviews[data.reviewStatus]} · 검토 리비전 {data.revision}</p>
      <button type="button" disabled={refreshing || !!error} onClick={() => setReview({ stepId: null, revision: data.revision })}>전체 검토 확정</button>
      <ContributionGenerationPanel projectId={projectId} expectedRevision={!error && !refreshing ? data.revision : undefined} latestGeneration={data.latestGeneration} onRefresh={refresh} />
      {!!data.unresolvedFields.length && <div><h3>확인이 필요한 항목</h3><ul>{data.unresolvedFields.map((field) => <li key={field}>{field}</li>)}</ul></div>}
      {!data.timeline.length ? <p>아직 기여 단계가 없습니다.</p> : <ol>{data.timeline.map((step) => <li key={step.stepId} style={{ padding: 16, marginBottom: 12, background: '#fff', borderRadius: 12 }}>
        <strong>{step.order}. {step.title}</strong><p>{kinds[step.kind]} / {steps[step.reviewStatus]}</p>
        <button type="button" onClick={() => setSelectedStep(step.stepId)}>단계 상세 보기</button>
        <button type="button" disabled={refreshing || !!error} onClick={() => setReview({ stepId: step.stepId, revision: data.revision })}>수정·제외·확정</button>
      </li>)}</ol>}
    </>}
    {selectedStep !== null && <ContributionStepModal key={`${projectId}/${selectedStep}/${data?.revision}`} projectId={projectId} stepId={selectedStep} onClose={() => setSelectedStep(null)} />}
    {review && <ContributionReviewModal projectId={projectId} revision={review.revision} stepId={review.stepId} onClose={() => setReview(null)} onSaved={(next) => { applyReview(next); setReview(null); }} />}
  </section>;
}
