import styled from 'styled-components';
import penIcon from '../../assets/pen.svg';
import type { ProcessMaterial } from '../../types/project';
import { formatDate } from '../../utils/formatDate';
import { colors } from '../../styles/theme';
import MaterialImage from './MaterialImage';

interface Props {
  index: number;
  material: ProcessMaterial;
  onEdit: (material: ProcessMaterial) => void;
  onView: (material: ProcessMaterial) => void;
}

// 창작 과정 타임라인 항목 (번호 뱃지 + 제작자료 카드)

export default function TimelineItem({ index, material, onEdit, onView }: Props) {
  const { title, description, createdAt, thumbnailUrl } = material;

  return (
    <Row>
      <NumberCol>
        <NumberBadge>{String(material.materialOrder ?? index + 1).padStart(2, '0')}</NumberBadge>
      </NumberCol>
      <Card>
        <Left>
          <Thumbnail>{material.files?.[0]
            ? <MaterialImage materialId={material.id} fileId={material.files[0].fileId} fileName={material.files[0].fileName} compact />
            : thumbnailUrl && <img src={thumbnailUrl} alt="" />}</Thumbnail>
          <Text>
            <TitleGroup>
              <Title>{title}</Title>
              <Desc>{description}</Desc>
            </TitleGroup>
            <DateText>제작 날짜 {material.productionDate === null ? '미입력' : formatDate(material.productionDate ?? createdAt)}</DateText>
            {!!material.files?.length && <Desc>첨부 {material.files.length}개 · {material.files.map((file) => file.fileName).join(', ')}</Desc>}
          </Text>
        </Left>
        <EditButton type="button" aria-label={`${title} 상세 보기`} onClick={() => onView(material)}>상세 보기</EditButton>
        <EditButton type="button" aria-label={`${title} 수정`} onClick={() => onEdit(material)}>
          <img src={penIcon} alt="" width={16} height={16} />
          수정
        </EditButton>
      </Card>
    </Row>
  );
}

const Row = styled.li`
  display: flex;
  align-items: flex-start;
  gap: 8px;
`;

const NumberCol = styled.div`
  padding: 4px 0;
  flex-shrink: 0;
`;

const NumberBadge = styled.span`
  display: block;
  padding: 6px 14px;
  color: ${colors.primary};
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
  text-align: center;
  background: ${colors.primarySoft};
  border-radius: 25px;
`;

const Card = styled.article`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 14px 10px;
  border: 1px solid ${colors.cardBorder};
  border-radius: 15px;
`;

const Left = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;
  flex: 1;
  min-width: 0;
`;

const Thumbnail = styled.div`
  width: 90px;
  height: 80px;
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

const Text = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1;
  min-width: 0;
  line-height: normal;
`;

/* 직접 입력한 긴 제목/설명은 한 줄로 자르고 … 표시 */
const ellipsis = `
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const TitleGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Title = styled.h3`
  margin: 0;
  color: ${colors.textStrong};
  font-size: 16px;
  font-weight: 600;
  ${ellipsis}
`;

const Desc = styled.p`
  margin: 0;
  color: ${colors.textSecondary};
  font-size: 14px;
  font-weight: 500;
  ${ellipsis}
`;

const DateText = styled.p`
  margin: 0;
  color: ${colors.textMuted};
  font-size: 14px;
  font-weight: 500;
`;

const EditButton = styled.button`
  display: inline-flex;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
  padding: 6px 16px;
  color: ${colors.textSecondary};
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
  background: transparent;
  border: 1px solid ${colors.border};
  border-radius: 15px;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: ${colors.bg};
  }

  img {
    display: block;
  }
`;
