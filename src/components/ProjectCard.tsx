import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { colors } from '../styles/theme';
import { getWorkTypeLabel } from '../constants/workTypes';
import StatusBadge from './StatusBadge';
import type { Project } from '../types/project';
import { formatDate } from '../utils/formatDate';
import ProjectThumbnail from './ProjectThumbnail';

// 대시보드 "최근 프로젝트" 카드 ("자세히" → 내 프로젝트에서 해당 프로젝트 선택)

export default function ProjectCard({ project }: { project: Project }) {
  const { id, title, workType, status, updatedAt, thumbnailUrl } = project;
  const category = getWorkTypeLabel(workType);

  return (
    <Card>
      <Body>
        <Thumbnail><ProjectThumbnail src={thumbnailUrl} /></Thumbnail>
        <Info>
          <TextGroup>
            <Title>{title}</Title>
            <Category>{category}</Category>
          </TextGroup>
          <FullWidthBadge status={status} />
        </Info>
      </Body>
      <Footer>
        <UpdatedAt>최근 수정: {formatDate(updatedAt)}</UpdatedAt>
        <DetailLink to={`/projects/${id}`}>자세히</DetailLink>
      </Footer>
    </Card>
  );
}

const Card = styled.article`
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 13px;
  flex-shrink: 0;
  padding: 16px 16px 4px 10px;
  background: ${colors.card};
  border: 1px solid ${colors.cardBorder};
  border-radius: 20px;
`;

const Body = styled.div`
  display: flex;
  align-items: center;
  gap: 22px;
  padding: 0 12px;
`;

const Thumbnail = styled.div`
  width: 110px;
  height: 116px;
  flex-shrink: 0;
  overflow: hidden;
  background: #d9d9d9;
  border-radius: 10px;

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
  align-items: flex-end;
  gap: 14px;
  min-width: 103px;
`;

const TextGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  padding: 0 6px;
  line-height: 1.4;
`;

const Title = styled.h3`
  margin: 0;
  color: ${colors.text};
  font-size: 18px;
  font-weight: 700;
  white-space: nowrap;
`;

const Category = styled.p`
  margin: 0;
  color: ${colors.textTertiary};
  font-size: 14px;
`;

const FullWidthBadge = styled(StatusBadge)`
  width: 100%;
`;

const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px; /* 넓을 땐 space-between으로 벌어짐 (Figma 122px) */
  padding: 14px 16px 12px;
  font-size: 14px;
  line-height: 1.4;
  white-space: nowrap;
  border-top: 1px solid ${colors.cardBorder};
`;

const UpdatedAt = styled.span`
  color: rgba(135, 149, 170, 0.8);
`;

const DetailLink = styled(Link)`
  color: ${colors.primary};
  text-decoration: underline;
`;
