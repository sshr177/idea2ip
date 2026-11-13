import styled from 'styled-components';
import { Link, Outlet, useMatch } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import { getProjects, ProjectListError } from '../api/projects';
import { useProjectStore } from '../store/projectStore';

const Wrapper = styled.div`
  display: flex;
  min-height: 100vh;
  background: #f7f9fc;
`;

const Main = styled.main`
  flex: 1;
  position: relative;
  min-width: 0;
`;

export default function DashboardLayout() {
  const isDetailPage = Boolean(useMatch('/projects/:projectId'));
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ attempt: number; error?: string; unauthorized?: boolean }>();

  useEffect(() => {
    if (isDetailPage) return;
    const controller = new AbortController();
    const token = localStorage.getItem('accessToken');
    const isStale = () => {
      if (controller.signal.aborted) return true;
      if (localStorage.getItem('accessToken') !== token) {
        setResult({ attempt, unauthorized: true, error: '로그인 상태가 변경되었습니다. 다시 로그인해주세요.' });
        return true;
      }
      return false;
    };
    getProjects(controller.signal)
      .then((projects) => {
        if (isStale()) return;
        useProjectStore.setState({ projects });
        setResult({ attempt });
      })
      .catch((error: unknown) => {
        if (isStale()) return;
        const unauthorized = error instanceof ProjectListError && error.status === 401;
        if (unauthorized) {
          localStorage.removeItem('accessToken');
          useProjectStore.setState({ projects: [], materialsByProjectId: {}, finalWorkByProjectId: {}, interviewByProjectId: {}, briefByProjectId: {} });
        }
        setResult({ attempt, unauthorized, error: error instanceof Error ? error.message : '프로젝트 목록을 불러오지 못했습니다.' });
      });
    return () => controller.abort();
  }, [attempt, isDetailPage]);

  const current = result?.attempt === attempt ? result : undefined;
  return (
    <Wrapper>
      <Sidebar />
      <Main>
        {isDetailPage ? <Outlet /> : !current ? (
          <Feedback role="status">프로젝트 목록을 불러오는 중입니다.</Feedback>
        ) : current.error ? (
          <Feedback role="alert">
            <p>{current.error}</p>
            {current.unauthorized ? <Link to="/login">로그인하기</Link> : (
              <button type="button" onClick={() => setAttempt((value) => value + 1)}>다시 시도</button>
            )}
          </Feedback>
        ) : <Outlet />}
      </Main>
    </Wrapper>
  );
}

const Feedback = styled.div`
  padding: 80px 50px;
  color: #68758d;
`;
