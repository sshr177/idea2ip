import styled from 'styled-components';
import { NavLink, useNavigate } from 'react-router-dom';
import { useRef, useState } from 'react';
import { logout } from '../api/auth';
import { useProjectStore } from '../store/projectStore';
import CurrentUserInfo from './CurrentUserInfo';
import LogoImage from '../assets/LogoImage.png';
import dashboardIcon from '../assets/dashboard.svg';
import folderOpenIcon from '../assets/folder-open.svg';
import folderPlusIcon from '../assets/folder-plus.svg';
import bookOpenIcon from '../assets/book-open.svg';

const NAV_ITEMS = [
  { to: '/', label: '대시보드', icon: dashboardIcon, end: true },
  { to: '/projects', label: '내 프로젝트', icon: folderOpenIcon, end: false },
  { to: '/projects/new', label: '새 프로젝트', icon: folderPlusIcon, end: true },
  { to: '/guide', label: '사용 가이드', icon: bookOpenIcon, end: false },
];

/** 사이드바 너비. 메인 영역만 덮는 오버레이(새 프로젝트 모달 등)에서 사용 */
export const SIDEBAR_WIDTH = 276;

const Aside = styled.aside`
  width: ${SIDEBAR_WIDTH}px;
  flex-shrink: 0;
  min-height: 100vh;
  padding: 40px 14px;
  background: #ffffff;
  border-right: 1px solid #eef1f6;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 43px;
`;

const LogoImg = styled.img`
  width: 173px;
  height: 47px;
  object-fit: contain;
`;

const Nav = styled.nav`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const NavItem = styled(NavLink)`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  padding: 12px 10px 12px 68px;
  border-radius: 10px;
  text-decoration: none;
  color: #68758d;
  font-family: Pretendard, sans-serif;
  font-size: 15px;
  font-weight: 500;
  line-height: 21px;
  transition: background 0.15s;

  &:hover {
    background: #f3f6fd;
  }

  &.active {
    background: #edf2ff;
  }
`;

const Icon = styled.img`
  width: 16px;
  height: 16px;
`;

export default function Sidebar() {
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState('');
  const logoutLock = useRef(false);

  const handleLogout = async () => {
    if (logoutLock.current) return;
    logoutLock.current = true;
    setIsLoggingOut(true);
    setError('');
    try {
      await logout();
      localStorage.removeItem('accessToken');
      // 다른 계정에서 이전 사용자의 로컬 작업이 표시되지 않도록 정리합니다.
      useProjectStore.setState({
        projects: [],
        materialsByProjectId: {},
        finalWorkByProjectId: {},
        interviewByProjectId: {},
        briefByProjectId: {},
      });
      navigate('/login', { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '로그아웃하지 못했습니다.');
    } finally {
      logoutLock.current = false;
      setIsLoggingOut(false);
    }
  };

  return (
    <Aside>
      <LogoImg src={LogoImage} alt="Idea2IP" />
      <Nav>
        {NAV_ITEMS.map(({ to, label, icon, end }) => (
          <NavItem key={to} to={to} end={end}>
            <Icon src={icon} alt="" />
            <span>{label}</span>
          </NavItem>
        ))}
      </Nav>
      <LogoutArea>
        <CurrentUserInfo />
        {error && <p role="alert">{error}</p>}
        <LogoutButton type="button" onClick={handleLogout} disabled={isLoggingOut}>
          {isLoggingOut ? '로그아웃 중…' : '로그아웃'}
        </LogoutButton>
      </LogoutArea>
    </Aside>
  );
}

const LogoutArea = styled.div`
  width: 100%;
  margin-top: auto;

  p {
    padding: 0 16px;
    color: #b42318;
    font-size: 13px;
  }
`;

const LogoutButton = styled.button`
  width: 100%;
  padding: 12px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #68758d;
  font: inherit;
  cursor: pointer;

  &:hover { background: #f3f6fd; }
  &:disabled { opacity: 0.6; cursor: wait; }
`;
