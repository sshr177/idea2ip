import { useEffect, useRef, useState } from 'react';
import InterviewReady from './InterviewReady';
import InterviewComplete from './InterviewComplete';
import InterviewMessages from './InterviewMessages';
import InterviewAnswerForm from './InterviewAnswerForm';
import { getInterviewStatus, startInterview, INTERVIEW_FIELD_LABELS, INTERVIEW_STATUS_LABELS } from '../../../api/interview';
import type { ServerInterview } from '../../../api/interview';
import type { ProjectTabKey } from '../../../constants/projectTabs';
import { Panel, PanelTitle } from './interview.styles';

export default function InterviewTab({ projectId, onChangeTab }: { projectId: string; onChangeTab: (tab: ProjectTabKey) => void }) {
  const [session, setSession] = useState<ServerInterview>();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const [answerBusy, setAnswerBusy] = useState(false);
  const [messageRevision, setMessageRevision] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{ projectId: string; attempt: number }>();
  useEffect(() => {
    const controller = new AbortController();
    const token = localStorage.getItem('accessToken');
    getInterviewStatus(projectId, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (localStorage.getItem('accessToken') !== token) throw new Error('로그인 상태가 변경되었습니다. 다시 로그인해주세요.');
      setSession(result);
      setError('');
      setLoaded({ projectId, attempt });
    }).catch((cause: unknown) => {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : '인터뷰 상태를 불러오지 못했습니다.');
      setLoaded({ projectId, attempt });
    });
    return () => controller.abort();
  }, [projectId, attempt]);
  const handleStart = async () => {
    if (lock.current || answerBusy) return;
    lock.current = true;
    setStarting(true);
    setError('');
    const token = localStorage.getItem('accessToken');
    try {
      const result = await startInterview(projectId);
      if (localStorage.getItem('accessToken') !== token) throw new Error('로그인 상태가 변경되었습니다. 다시 로그인해주세요.');
      setSession(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '인터뷰를 시작하지 못했습니다.');
    } finally {
      lock.current = false;
      setStarting(false);
    }
  };
  if (loaded?.projectId !== projectId || loaded.attempt !== attempt) return <p role="status">인터뷰 상태를 불러오는 중입니다.</p>;
  if (!session) return <div role="alert"><p>{error}</p><button type="button" onClick={() => setAttempt((value) => value + 1)}>다시 시도</button></div>;
  if (session.status === 'COMPLETED') return <><InterviewComplete onNext={() => onChangeTab('contribution')} /><InterviewMessages projectId={projectId} refreshKey={attempt + messageRevision} /></>;
  if (session?.status === 'IN_PROGRESS') return (
    <Panel $ratio={1} aria-busy={starting}>
      <PanelTitle>AI 인터뷰</PanelTitle>
      <InterviewMessages projectId={projectId} refreshKey={attempt + messageRevision} />
      {error && <p role="alert">{error}</p>}
      {session.currentQuestion ? <>
        <h3>{INTERVIEW_FIELD_LABELS[session.currentQuestion.targetField]}</h3>
        <p style={{ whiteSpace: 'pre-wrap' }}>{session.currentQuestion.content}</p>
        {session.currentQuestion.reason && <p>{session.currentQuestion.reason}</p>}
        {!!session.currentQuestion.materialRefs.length && <ul>{session.currentQuestion.materialRefs.map((ref, index) => <li key={index}>{ref.title}</li>)}</ul>}
        <InterviewAnswerForm key={session.currentQuestion.messageId} projectId={projectId} questionId={session.currentQuestion.messageId}
          onBusyChange={setAnswerBusy} onAnswered={(next) => { setSession(next); setMessageRevision((value) => value + 1); }} />
      </> : <p role="status">{session.nextQuestionPending ? '다음 질문 생성 대기 중입니다.' : '현재 질문이 없습니다.'}</p>}
      <button type="button" disabled={starting || answerBusy} onClick={() => setAttempt((value) => value + 1)}>현재 상태 새로고침</button>
      {session.nextQuestionPending && <button type="button" disabled={starting || answerBusy} onClick={handleStart}>{starting ? '질문 생성 중…' : '질문 생성 재시도'}</button>}
      <ul>{session.fieldStates.map((field) => <li key={field.field}>{INTERVIEW_FIELD_LABELS[field.field]} / {INTERVIEW_STATUS_LABELS[field.status]} {field.summary}</li>)}</ul>
    </Panel>
  );
  return <>
    {error && <p role="alert">{error}</p>}
    <InterviewReady projectId={projectId} onStart={handleStart} starting={starting} onGoToProcess={() => onChangeTab('process')} />
  </>;
}
