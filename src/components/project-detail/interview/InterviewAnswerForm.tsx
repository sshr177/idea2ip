import { useRef, useState } from 'react';
import { InterviewAnswerError, submitInterviewAnswer } from '../../../api/interview';
import type { InterviewAnswerInput, ServerInterview } from '../../../api/interview';

export default function InterviewAnswerForm({ projectId, questionId, onAnswered, onBusyChange }: {
  projectId: string; questionId: number; onAnswered: (session: ServerInterview) => void; onBusyChange: (busy: boolean) => void;
}) {
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState(false);
  const lock = useRef(false);
  const pending = useRef<InterviewAnswerInput | undefined>(undefined);
  const submit = async () => {
    if (lock.current) return;
    if (!content.trim() || content.length > 8000) { setError('답변을 1~8,000자로 입력해주세요.'); return; }
    const input = pending.current ?? { questionId, content, requestId: crypto.randomUUID() };
    pending.current = input;
    lock.current = true;
    setBusy(true);
    onBusyChange(true);
    setError('');
    const token = localStorage.getItem('accessToken');
    try {
      const result = await submitInterviewAnswer(projectId, input);
      if (localStorage.getItem('accessToken') !== token) throw new InterviewAnswerError(401, '로그인 상태가 변경되었습니다. 다시 로그인해주세요.');
      pending.current = undefined;
      setRetrying(false);
      setContent('');
      onAnswered(result.interview);
    } catch (cause) {
      const keepRequest = cause instanceof InterviewAnswerError && [0, 500, 503].includes(cause.status);
      if (!keepRequest) pending.current = undefined;
      setRetrying(keepRequest);
      setError(cause instanceof Error ? cause.message : '답변을 제출하지 못했습니다.');
    } finally {
      lock.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  };
  return <form onSubmit={(event) => { event.preventDefault(); void submit(); }} aria-busy={busy}>
    <label htmlFor="interview-answer">내 답변</label>
    <textarea id="interview-answer" value={content} maxLength={8000} readOnly={busy || retrying} onChange={(event) => setContent(event.target.value)} style={{ display: 'block', width: '100%', minHeight: 100 }} />
    <p>{content.length} / 8,000자</p>
    {error && <p role="alert">{error}</p>}
    <button type="submit" disabled={busy || !content.trim()}>{busy ? '답변 저장 중…' : retrying ? '같은 답변으로 재시도' : '답변 제출'}</button>
  </form>;
}
