import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { CurrentUserError, getCurrentUser } from '../api/users';
import type { CurrentUser } from '../api/users';

export default function CurrentUserInfo() {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    attempt: number;
    user?: CurrentUser;
    error?: string;
    unauthorized?: boolean;
  }>();
  const token = localStorage.getItem('accessToken');

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    getCurrentUser(controller.signal)
      .then((user) => {
        if (controller.signal.aborted || localStorage.getItem('accessToken') !== token) return;
        setResult({ attempt, user });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || localStorage.getItem('accessToken') !== token) return;
        const unauthorized = error instanceof CurrentUserError && error.status === 401;
        if (unauthorized) localStorage.removeItem('accessToken');
        setResult({
          attempt,
          unauthorized,
          error: error instanceof Error ? error.message : '사용자 정보를 불러오지 못했습니다.',
        });
      });
    return () => controller.abort();
  }, [token, attempt]);

  const current = result?.attempt === attempt ? result : undefined;
  return (
    <Profile aria-label="내 정보">
      {current?.unauthorized ? (
        <><p role="alert">{current.error}</p><Link to="/login">다시 로그인</Link></>
      ) : !token ? (
        <Link to="/login">로그인이 필요합니다</Link>
      ) : current?.user ? (
        <><strong>{current.user.loginId}</strong><span>로그인한 사용자</span></>
      ) : current?.error ? (
        <><p role="alert">{current.error}</p><button type="button" onClick={() => setAttempt((value) => value + 1)}>다시 시도</button></>
      ) : (
        <span role="status">내 정보를 불러오는 중…</span>
      )}
    </Profile>
  );
}

const Profile = styled.div`
  padding: 12px 16px;
  color: #68758d;
  font-size: 13px;
  overflow-wrap: anywhere;
  strong, span { display: block; }
  strong { color: #1c2940; font-size: 15px; margin-bottom: 4px; }
  p { margin: 0 0 8px; }
  a, button { color: #3466ef; }
  button { background: transparent; border: 0; padding: 0; font: inherit; cursor: pointer; }
`;
