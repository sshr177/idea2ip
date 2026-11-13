import { useRef, useState } from 'react';
import { ContributionGenerationError, generateContributions } from '../../../api/contributions';
import type { ContributionGeneration, GenerateContributionsInput } from '../../../api/contributions';

export default function ContributionGenerationPanel({ projectId, expectedRevision, latestGeneration, onRefresh }: {
  projectId: string; expectedRevision?: number; latestGeneration: ContributionGeneration | null; onRefresh: () => void;
}) {
  const [result, setResult] = useState<ContributionGeneration>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [hasRequest, setHasRequest] = useState(false);
  const request = useRef<GenerateContributionsInput | undefined>(undefined);
  const lock = useRef(false);
  const current = latestGeneration && (!result || latestGeneration.generationId >= result.generationId) ? latestGeneration : result;
  const submit = async () => {
    if (lock.current || expectedRevision === undefined) return;
    const input = current?.status === 'SUCCEEDED' ? { requestId: crypto.randomUUID(), expectedRevision } : request.current ?? { requestId: crypto.randomUUID(), expectedRevision };
    if (current?.status === 'FAILED') {
      if (!current.failure?.retryable || !request.current || current.requestId !== request.current.requestId) return;
      input.retry = true;
    }
    request.current = input;
    setHasRequest(true);
    lock.current = true;
    setBusy(true);
    setError('');
    const token = localStorage.getItem('accessToken');
    try {
      const generation = await generateContributions(projectId, input);
      if (localStorage.getItem('accessToken') !== token) throw new Error('로그인 상태가 변경되었습니다.');
      setResult(generation);
      onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '생성 요청에 실패했습니다.');
      if (cause instanceof ContributionGenerationError && cause.status === 409) {
        request.current = undefined;
        setHasRequest(false);
        onRefresh();
      }
    } finally { lock.current = false; setBusy(false); }
  };
  const labels = { QUEUED: '생성 대기', RUNNING: '생성 중', SUCCEEDED: '생성 완료', FAILED: '생성 실패' };
  return <section aria-label="기여 후보 생성" aria-busy={busy}>
    {expectedRevision === undefined && <p>기여 검토 목록 조회가 연결되면 후보 생성을 사용할 수 있습니다.</p>}
    {current && <p role="status">{labels[current.status]}</p>}
    {current?.failure && <p role="alert">{current.failure.message}</p>}
    {current?.status === 'FAILED' && !hasRequest && <p>이 작업의 원래 요청 리비전이 없어 여기서는 재시도할 수 없습니다.</p>}
    {error && <p role="alert">{error}</p>}
    <button type="button" onClick={submit} disabled={busy || expectedRevision === undefined || current?.status === 'QUEUED' || current?.status === 'RUNNING' || (current?.status === 'FAILED' && (!current.failure?.retryable || !hasRequest))}>
      {busy ? '요청 중…' : current?.status === 'FAILED' ? '실패한 작업 재시도' : current?.status === 'SUCCEEDED' ? '기여 후보 다시 생성' : hasRequest ? '동일 요청 상태 확인' : '기여 후보 생성'}
    </button>
  </section>;
}
