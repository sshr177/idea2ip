import { useEffect, useRef, useState } from 'react';
import ModalShell from '../../modal/ModalShell';
import { getContributionStep, updateContributions } from '../../../api/contributions';
import type { ContributionReview, ContributionStepDetail, ReviewContributionsInput } from '../../../api/contributions';

export default function ContributionReviewModal({ projectId, revision, stepId, onClose, onSaved }: {
  projectId: string; revision: number; stepId: number | null; onClose: () => void; onSaved: (review: ContributionReview) => void;
}) {
  const [baseRevision] = useState(revision);
  const [decision, setDecision] = useState<'EDIT' | 'EXCLUDE' | 'CONFIRM'>('CONFIRM');
  const [detail, setDetail] = useState<ContributionStepDetail>();
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [tools, setTools] = useState('');
  const [purpose, setPurpose] = useState('');
  const [usage, setUsage] = useState('');
  const [created, setCreated] = useState('');
  const [edited, setEdited] = useState('');
  const [clearAi, setClearAi] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  useEffect(() => {
    if (stepId === null) return;
    const controller = new AbortController();
    getContributionStep(projectId, stepId, controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      setDetail(data); setLoadError('');
      setTools(data.aiUsage?.tools.join('\n') ?? ''); setPurpose(data.aiUsage?.purpose ?? ''); setUsage(data.aiUsage?.outputUsage ?? '');
      setCreated(data.humanCreatedElements.join('\n')); setEdited(data.humanEdits.join('\n')); setClearAi(data.aiUsage === null);
    }).catch((cause: unknown) => { if (!controller.signal.aborted) setLoadError(cause instanceof Error ? cause.message : '상세 조회에 실패했습니다.'); });
    return () => controller.abort();
  }, [projectId, stepId, attempt]);
  const lines = (value: string) => value.split('\n').map((line) => line.trim()).filter(Boolean);
  const save = async () => {
    if (lock.current || (decision === 'EDIT' && stepId !== null && !detail)) return;
    const input: ReviewContributionsInput = { expectedRevision: baseRevision, changes: [] };
    if (stepId === null) {
      input.finalize = true;
      if (reason.trim()) input.noContributionReason = reason.trim();
    } else input.changes = [{ stepId, decision, ...(decision === 'EDIT' ? { edits: {
      aiUsage: clearAi ? null : { tools: lines(tools), purpose: purpose.trim() || null, outputUsage: usage.trim() || null },
      humanCreatedElements: lines(created), humanEdits: lines(edited),
    } } : {}) }];
    lock.current = true; setBusy(true); setError('');
    const token = localStorage.getItem('accessToken');
    try {
      const review = await updateContributions(projectId, input);
      if (localStorage.getItem('accessToken') !== token) throw new Error('로그인 상태가 변경되었습니다.');
      onSaved(review);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '저장에 실패했습니다.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <ModalShell titleId="contribution-review-title" title={stepId === null ? '기여 검토 전체 확정' : '기여 단계 검토'} width={680} onClose={() => { if (!lock.current) onClose(); }}>
    <form onSubmit={(event) => { event.preventDefault(); void save(); }} aria-busy={busy}>
      <fieldset disabled={busy} style={{ border: 0, padding: '16px 0' }}>
        {stepId === null ? <>
          <p>각 단계의 검토 결정을 저장한 뒤 전체 검토를 확정합니다.</p>
          <label htmlFor="no-contribution-reason">확정할 기여가 없는 경우 사유</label>
          <textarea id="no-contribution-reason" maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} style={{ display: 'block', width: '100%' }} />
        </> : <>
          <h3>{detail?.title ?? `단계 ${stepId}`}</h3>
          <label htmlFor="contribution-decision">검토 결정</label>{' '}
          <select id="contribution-decision" value={decision} onChange={(event) => setDecision(event.target.value as typeof decision)}>
            <option value="CONFIRM">확정</option><option value="EDIT">수정</option><option value="EXCLUDE">제외</option>
          </select>
          {decision === 'EXCLUDE' && <p>이 단계를 기여 검토에서 제외합니다. 원본 자료는 삭제하지 않습니다.</p>}
          {decision === 'EDIT' && (!detail ? <div><p role={loadError ? 'alert' : 'status'}>{loadError || '기존 내용을 불러오는 중입니다.'}</p>{loadError && <button type="button" onClick={() => setAttempt((value) => value + 1)}>다시 조회</button>}</div> : <>
            <p>목록 항목은 줄마다 하나씩 입력합니다. 내용을 모두 지우고 저장하면 해당 목록이 비워집니다.</p>
            <label><input type="checkbox" checked={clearAi} onChange={(event) => setClearAi(event.target.checked)} />AI 활용 정보 비우기</label>
            {!clearAi && <>
              <label style={{ display: 'block' }}>AI 도구<textarea value={tools} onChange={(event) => setTools(event.target.value)} /></label>
              <label style={{ display: 'block' }}>활용 목적<textarea value={purpose} onChange={(event) => setPurpose(event.target.value)} /></label>
              <label style={{ display: 'block' }}>산출물 활용<textarea value={usage} onChange={(event) => setUsage(event.target.value)} /></label>
            </>}
            <label style={{ display: 'block' }}>직접 창작한 요소<textarea value={created} onChange={(event) => setCreated(event.target.value)} /></label>
            <label style={{ display: 'block' }}>직접 수정한 요소<textarea value={edited} onChange={(event) => setEdited(event.target.value)} /></label>
          </>)}
        </>}
        {error && <p role="alert">{error}</p>}
        <button type="button" onClick={onClose}>취소</button>{' '}
        <button type="submit" disabled={decision === 'EDIT' && stepId !== null && !detail}>{busy ? '저장 중…' : stepId === null ? '전체 검토 확정' : '검토 결정 저장'}</button>
      </fieldset>
    </form>
  </ModalShell>;
}
