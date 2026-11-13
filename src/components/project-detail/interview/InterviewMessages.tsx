import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { getInterviewMessages, INTERVIEW_FIELD_LABELS } from '../../../api/interview';
import type { ServerInterviewMessage } from '../../../api/interview';

export default function InterviewMessages({ projectId, refreshKey = 0 }: { projectId: string; refreshKey?: number }) {
  const [attempt, setAttempt] = useState(0);
  const key = `${projectId}/${refreshKey}/${attempt}`;
  const [result, setResult] = useState<{ key: string; messages?: ServerInterviewMessage[]; error?: string }>();
  useEffect(() => {
    const controller = new AbortController();
    const token = localStorage.getItem('accessToken');
    getInterviewMessages(projectId, controller.signal).then((messages) => {
      if (controller.signal.aborted) return;
      if (localStorage.getItem('accessToken') !== token) throw new Error('로그인 상태가 변경되었습니다. 다시 로그인해주세요.');
      setResult({ key, messages });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setResult({ key, error: error instanceof Error ? error.message : '대화 내역을 불러오지 못했습니다.' });
    });
    return () => controller.abort();
  }, [projectId, key]);
  const current = result?.key === key ? result : undefined;
  return <section aria-label="인터뷰 대화 내역">
    <h3>대화 내역</h3>
    {!current ? <p role="status">대화 내역을 불러오는 중입니다.</p> : current.error ? <p role="alert">{current.error}</p> : !current.messages?.length ? <p>아직 대화 내역이 없습니다.</p> : (
      <Messages>{current.messages.map((message) => <Message key={message.messageId} $user={message.role === 'USER'}>
        <strong>{message.role === 'USER' ? '내 답변' : 'AI 질문'}</strong>
        <small>{INTERVIEW_FIELD_LABELS[message.targetField]}</small>
        <p>{message.content}</p>
        <time dateTime={message.createdAt}>{message.createdAt.replace('T', ' ')}</time>
      </Message>)}</Messages>
    )}
    <button type="button" onClick={() => setAttempt((value) => value + 1)}>{current?.error ? '다시 시도' : '대화 내역 새로고침'}</button>
  </section>;
}

const Messages = styled.ol`
  display: flex;
  flex-direction: column;
  gap: 12px;
  list-style: none;
  padding: 0;
  max-height: 480px;
  overflow-y: auto;
`;
const Message = styled.li<{ $user: boolean }>`
  align-self: ${({ $user }) => $user ? 'flex-end' : 'flex-start'};
  max-width: 90%;
  padding: 14px;
  border-radius: 12px;
  background: ${({ $user }) => $user ? '#edf2ff' : '#f7f9fc'};
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  small { display: block; margin-top: 4px; }
  time { font-size: 12px; color: #68758d; }
`;
