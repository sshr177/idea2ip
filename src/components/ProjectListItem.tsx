import styled from 'styled-components';
import newProjectThumbnail from '../assets/new-project-thumbnail.svg';
import StatusBadge from './StatusBadge';
import { getWorkTypeLabel } from '../constants/workTypes';
import type { Project } from '../types/project';
import { formatDate } from '../utils/formatDate';
import { colors } from '../styles/theme';
import ProjectThumbnail from './ProjectThumbnail';

// "내 프로젝트" 목록의 가로형 프로젝트 카드 + "새 프로젝트 만들기" 카드

interface ProjectListItemProps {
  project: Project;
  /** 카드 또는 "열기" 클릭 → 프로젝트 상세(/projects/:id)로 이동 */
  onOpen: (id: string) => void;
}

export default function ProjectListItem({ project, onOpen }: ProjectListItemProps) {
  const { id, title, workType, status, updatedAt, thumbnailUrl } = project;

  return (
    // 카드 어디를 눌러도 "열기"와 동일하게 동작 (키보드는 "열기" 버튼으로 접근)
    <Item $clickable onClick={() => onOpen(id)}>
      <Left>
        <Thumbnail><ProjectThumbnail src={thumbnailUrl} /></Thumbnail>
        <Info>
          <TopRow>
            <TextGroup>
              <Title>{title}</Title>
              <Desc>{getWorkTypeLabel(workType)}</Desc>
            </TextGroup>
            <ListStatusBadge status={status} />
          </TopRow>
          <UpdatedAt>최근 수정 {formatDate(updatedAt, '. ')}</UpdatedAt>
        </Info>
      </Left>
      <OutlineButton
        type="button"
        onClick={(e) => {
          e.stopPropagation(); // 카드 onClick과 중복 실행 방지
          onOpen(id);
        }}
      >
        열기
      </OutlineButton>
    </Item>
  );
}

export function CreateProjectItem({ onCreate }: { onCreate: () => void }) {
  return (
    <Item>
      <Left $gap={31}>
        <img src={newProjectThumbnail} alt="" width={90} height={90} />
        <TextGroup>
          <Title>새 프로젝트 만들기</Title>
          <Desc>새로운 창작 기록을 시작해 보세요</Desc>
        </TextGroup>
      </Left>
      <OutlineButton type="button" onClick={onCreate}>
        만들기
      </OutlineButton>
    </Item>
  );
}

const Item = styled.article<{ $clickable?: boolean }>`
  cursor: ${({ $clickable }) => ($clickable ? 'pointer' : 'default')};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  width: 100%;
  padding: 14px 10px;
  background: ${colors.card};
  border: 1px solid ${colors.cardBorder};
  border-radius: 15px;
  transition: border-color 0.15s;

  &:hover {
    border-color: ${colors.cardActiveBorder};
  }
`;

const Left = styled.div<{ $gap?: number }>`
  display: flex;
  align-items: center;
  gap: ${({ $gap = 20 }) => $gap}px;
  min-width: 0;

  & > img {
    display: block;
    flex-shrink: 0;
  }
`;

const Thumbnail = styled.div`
  width: 100px;
  height: 90px;
  flex-shrink: 0;
  overflow: hidden;
  background: #d9d9d9;
  border-radius: 15px;

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const Info = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 239px;
`;

const TopRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 32px;
`;

const TextGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 118px;
  line-height: normal;
`;

const Title = styled.h3`
  margin: 0;
  color: ${colors.text};
  font-size: 18px;
  font-weight: 600;
  white-space: nowrap;
`;

const Desc = styled.p`
  margin: 0;
  color: ${colors.textTertiary};
  font-size: 16px;
  white-space: nowrap;
`;

const ListStatusBadge = styled(StatusBadge)`
  padding: 5px 22px;
`;

const UpdatedAt = styled.p`
  margin: 0;
  color: rgba(135, 149, 170, 0.8);
  font-size: 14px;
  line-height: normal;
`;

const OutlineButton = styled.button`
  width: 149px;
  flex-shrink: 0;
  padding: 8px 20px;
  color: rgba(19, 28, 51, 0.8);
  font-size: 18px;
  font-weight: 700;
  line-height: 1.4;
  background: ${colors.card};
  border: 1px solid ${colors.border};
  border-radius: 15px;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: ${colors.bg};
  }
`;
