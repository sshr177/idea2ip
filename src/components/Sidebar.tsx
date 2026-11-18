import styled from 'styled-components';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { logout } from '../api/auth';
import { useProjectStore } from '../store/projectStore';
import CurrentUserInfo from './CurrentUserInfo';
import LogoImage from '../assets/LogoImage.png';
import dashboardIcon from '../assets/dashboard.svg';
import folderOpenIcon from '../assets/folder-open.svg';
import bookOpenIcon from '../assets/book-open.svg';
import logoutIcon from '../assets/logout.svg';
import { breakpoints, colors, media, MOBILE_TOP_BAR_HEIGHT, sidebarWidths } from '../styles/theme';

const NAV_ITEMS = [
  { to: '/', label: '대시보드', icon: dashboardIcon, end: true },
  { to: '/projects', label: '내 프로젝트', icon: folderOpenIcon, end: false },
  { to: '/guide', label: '사용 가이드', icon: bookOpenIcon, end: false },
];

/** 데스크톱 사이드바 너비 (오버레이 위치는 GlobalStyle의 --sidebar-width 사용) */
export const SIDEBAR_WIDTH = sidebarWidths.desktop;

const MOBILE_QUERY = `(max-width: ${breakpoints.tablet - 1}px)`;
const subscribe = (onChange: () => void) => {
  const list = window.matchMedia(MOBILE_QUERY);
  list.addEventListener('change', onChange);
  return () => list.removeEventListener('change', onChange);
};
/** 모바일 너비 여부 (모바일에서만 닫힌 메뉴를 화면 읽기·탭 이동에서 제외) */
const useIsMobile = () => useSyncExternalStore(subscribe, () => window.matchMedia(MOBILE_QUERY).matches, () => false);

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState('');
  const logoutLock = useRef(false);
  // 모바일 메뉴: 연 화면(location.key)에서만 열린 상태 → 메뉴에서 이동하면 자동으로 닫힘
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const isMenuOpen = isMobile && openedAt === location.key;
  const closeMenu = () => setOpenedAt(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  // 메뉴가 열려 있으면 Esc로 닫고, 뒤 화면 스크롤 막기
  useEffect(() => {
    if (!isMenuOpen) return;
    firstLinkRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenedAt(null);
        menuButtonRef.current?.focus();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isMenuOpen]);

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
    <>
      {/* 모바일 상단 바: 로고 + 메뉴 버튼 */}
      <TopBar>
        <TopLogo src={LogoImage} alt="Idea2IP" />
        <MenuButton
          ref={menuButtonRef}
          type="button"
          aria-label={isMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
          aria-expanded={isMenuOpen}
          aria-controls="app-sidebar"
          onClick={() => setOpenedAt(isMenuOpen ? null : location.key)}
        >
          <MenuIcon aria-hidden="true" $open={isMenuOpen}>
            <span />
            <span />
            <span />
          </MenuIcon>
        </MenuButton>
      </TopBar>
      <Backdrop $open={isMenuOpen} onClick={closeMenu} aria-hidden="true" />

      <Aside
        id="app-sidebar"
        $open={isMenuOpen}
        aria-label="메인 메뉴"
        aria-hidden={isMobile && !isMenuOpen ? true : undefined}
        inert={isMobile && !isMenuOpen ? true : undefined}
      >
        <LogoImg src={LogoImage} alt="Idea2IP" />
        <Nav>
          {NAV_ITEMS.map(({ to, label, icon, end }, index) => (
            <NavItem key={to} to={to} end={end} title={label} ref={index === 0 ? firstLinkRef : undefined} onClick={closeMenu}>
              <Icon src={icon} alt="" />
              <Label>{label}</Label>
            </NavItem>
          ))}
        </Nav>
        <LogoutArea>
          <UserInfo>
            <CurrentUserInfo />
          </UserInfo>
          {error && <LogoutError role="alert">{error}</LogoutError>}
          <LogoutButton type="button" onClick={handleLogout} disabled={isLoggingOut} title="로그아웃">
            <img src={logoutIcon} alt="" width={24} height={24} />
            <Label>{isLoggingOut ? '로그아웃 중…' : '로그아웃'}</Label>
          </LogoutButton>
        </LogoutArea>
      </Aside>
    </>
  );
}

/* 태블릿 아이콘 메뉴에서 글자는 숨기고 화면 읽기용으로만 남김 */
const visuallyHidden = `
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
`;

const Aside = styled.aside<{ $open: boolean }>`
  width: ${sidebarWidths.desktop}px;
  flex-shrink: 0;
  /* 페이지가 길어도 로그아웃 버튼이 화면 아래에 보이도록 화면 높이에 고정 */
  position: sticky;
  top: 0;
  align-self: flex-start;
  height: 100vh;
  overflow-y: auto;
  padding: 40px 14px;
  background: #ffffff;
  border-right: 1px solid #eef1f6;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 43px;

  ${media.tabletOnly} {
    width: ${sidebarWidths.tablet}px;
    padding: 32px 12px;
    gap: 32px;
  }

  /* 모바일: 왼쪽에서 밀려 나오는 메뉴 */
  ${media.mobile} {
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    z-index: 210;
    width: min(300px, 85vw);
    height: 100%;
    padding: 24px 14px;
    gap: 32px;
    transform: translateX(${({ $open }) => ($open ? '0' : '-100%')});
    visibility: ${({ $open }) => ($open ? 'visible' : 'hidden')};
    transition:
      transform 0.2s ease,
      visibility 0.2s;
    box-shadow: ${({ $open }) => ($open ? '8px 0 24px rgba(0, 0, 0, 0.08)' : 'none')};
  }
`;

const LogoImg = styled.img`
  width: 173px;
  height: 47px;
  object-fit: contain;
  flex-shrink: 0;

  /* 태블릿: 로고 그림 부분만 보이게 */
  ${media.tabletOnly} {
    width: 44px;
    object-fit: cover;
    object-position: left center;
  }
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
  min-height: 45px;
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

  ${media.tabletOnly} {
    justify-content: center;
    padding: 12px;
  }

  ${media.mobile} {
    padding: 12px 16px;
  }
`;

const Icon = styled.img`
  width: 16px;
  height: 16px;
  flex-shrink: 0;
`;

const Label = styled.span`
  ${media.tabletOnly} {
    ${visuallyHidden}
  }
`;

/* 사이드바 맨 아래: 사용자 정보(디자인에 없음, 작게) + 로그아웃 (Figma 118:266) */
const LogoutArea = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  margin-top: auto;
`;

const UserInfo = styled.div`
  ${media.tabletOnly} {
    ${visuallyHidden}
  }
`;

const LogoutError = styled.p`
  margin: 0;
  padding: 0 10px;
  color: ${colors.required};
  font-size: 13px;
  line-height: 1.4;

  ${media.tabletOnly} {
    padding: 0;
    font-size: 11px;
    text-align: center;
  }
`;

/* Figma: 연파랑 배경 + 24px 아이콘 + 메뉴와 같은 15px 글자 */
const LogoutButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 46px;
  padding: 12px 10px 10px;
  color: ${colors.textSecondary};
  font-family: Pretendard, sans-serif;
  font-size: 15px;
  font-weight: 500;
  line-height: 1.4;
  background: ${colors.primarySoft};
  border: 0;
  border-radius: 10px;
  cursor: pointer;

  img {
    display: block;
    flex-shrink: 0;
  }

  &:hover:not(:disabled) {
    background: ${colors.chipPositiveBg};
  }

  &:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  ${media.tabletOnly} {
    padding: 11px;
  }
`;

/* 모바일 상단 바 (데스크톱·태블릿에서는 숨김) */
const TopBar = styled.header`
  display: none;

  ${media.mobile} {
    position: sticky;
    top: 0;
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: ${MOBILE_TOP_BAR_HEIGHT}px;
    padding: 0 8px 0 16px;
    background: #ffffff;
    border-bottom: 1px solid #eef1f6;
  }
`;

const TopLogo = styled.img`
  width: 118px;
  height: 32px;
  object-fit: contain;
  object-position: left center;
`;

const MenuButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 10px;
  cursor: pointer;

  &:hover {
    background: #f3f6fd;
  }
`;

/* 메뉴 아이콘: 사이드바 글자색 선 3개 (열리면 X) */
const MenuIcon = styled.span<{ $open: boolean }>`
  position: relative;
  display: block;
  width: 20px;
  height: 14px;

  span {
    position: absolute;
    left: 0;
    width: 100%;
    height: 2px;
    background: ${colors.textSecondary};
    border-radius: 1px;
    transition:
      transform 0.2s,
      opacity 0.2s,
      top 0.2s;
  }

  span:nth-child(1) {
    top: ${({ $open }) => ($open ? '6px' : '0')};
    transform: rotate(${({ $open }) => ($open ? '45deg' : '0')});
  }

  span:nth-child(2) {
    top: 6px;
    opacity: ${({ $open }) => ($open ? 0 : 1)};
  }

  span:nth-child(3) {
    top: ${({ $open }) => ($open ? '6px' : '12px')};
    transform: rotate(${({ $open }) => ($open ? '-45deg' : '0')});
  }
`;

const Backdrop = styled.div<{ $open: boolean }>`
  display: none;

  ${media.mobile} {
    position: fixed;
    inset: 0;
    z-index: 205;
    display: block;
    background: ${colors.overlay};
    opacity: ${({ $open }) => ($open ? 1 : 0)};
    pointer-events: ${({ $open }) => ($open ? 'auto' : 'none')};
    transition: opacity 0.2s;
  }
`;
