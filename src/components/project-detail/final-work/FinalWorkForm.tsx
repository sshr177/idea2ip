import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import ImageDropZone from './ImageDropZone';
import { Panel, PanelTitle } from './finalWork.styles';
import {
  CancelButton,
  FieldLabel,
  ModalActions,
  SubmitButton,
  TextArea,
  TextInput,
} from '../../modal/modalForm.styles';
import { getWorkTypeSummary } from '../../../constants/workTypes';
import { useProjectStore } from '../../../store/projectStore';
import type { Project } from '../../../types/project';
import { createRegisteredAt } from '../../../utils/registeredAt';
import { colors } from '../../../styles/theme';
import type { ArtworkImageResult } from '../../../api/artwork';
import { createArtwork } from '../../../api/artwork';

interface Props {
  project: Project;
  showAlert: (message: string) => void;
  onUpload: (file: File) => Promise<ArtworkImageResult>;
  uploading: boolean;
}

// 최종 작품 탭 1번 상태: 최종 작품 등록 (이미지 + 작품 정보/설명)

export default function FinalWorkForm({ project, showAlert, onUpload, uploading }: Props) {
  const saveFinalWork = useProjectStore((state) => state.saveFinalWork);
  const [image, setImage] = useState<{ file: File; url: string } | null>(null);
  const [description, setDescription] = useState('');
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const createLock = useRef(false);
  const titleRef = useRef<HTMLInputElement>(null);

  // 저장하지 않고 화면을 벗어나면 미리보기 URL 해제 (저장한 URL은 2번 상태에서 계속 사용)
  const unsavedUrl = useRef<string | null>(null);
  useEffect(() => () => {
    if (unsavedUrl.current) URL.revokeObjectURL(unsavedUrl.current);
  }, []);

  const replaceImage = (next: { file: File; url: string } | null) => {
    if (image) URL.revokeObjectURL(image.url);
    unsavedUrl.current = next?.url ?? null;
    setImage(next);
  };

  const handleSelect = (file: File) => replaceImage({ file, url: URL.createObjectURL(file) });

  const handleCancel = () => {
    replaceImage(null);
    setDescription('');
    setTitle('');
  };

  const handleSave = async () => {
    if (uploading || createLock.current) return;
    // 위에서부터 순서대로 첫 번째 문제 하나만 안내
    if (!title.trim()) {
      showAlert('최종 작품 제목을 입력해주세요.');
      titleRef.current?.focus();
      return;
    }
    createLock.current = true;
    setCreating(true);
    try {
      const artwork = await createArtwork(project.id, { title: title.trim(), description: description.trim() || null });
      const saved = {
      artworkId: artwork.artworkId,
      title: artwork.title,
      imageUrl: '', // 서버 GET 응답으로 이미지를 표시합니다.
      imageName: '',
      description: description.trim(),
      updatedAt: new Date().toISOString(),
      // 작품 교체·설명 수정 때는 FinalWorkView가 기존 값을 그대로 유지
      registeredAt: createRegisteredAt(),
      };
      // 생성 성공을 먼저 기록해 이미지 업로드 실패 시 작품을 중복 생성하지 않습니다.
      saveFinalWork(project.id, saved);
      if (image) {
        try {
          const uploaded = await onUpload(image.file);
          saveFinalWork(project.id, { ...saved, ...useProjectStore.getState().finalWorkByProjectId[project.id], imageName: uploaded.fileName });
        } catch {
          showAlert('작품은 등록됐지만 이미지 업로드에 실패했습니다. 작품 교체로 다시 시도해주세요.');
        }
      } else showAlert('최종 작품을 등록했습니다. 작품 교체에서 이미지를 추가할 수 있습니다.');
    } catch (error) {
      showAlert(error instanceof Error ? error.message : '최종 작품을 등록하지 못했습니다.');
    } finally {
      createLock.current = false;
      setCreating(false);
    }
  };

  return (
    <fieldset disabled={uploading || creating} style={{ display: 'contents' }} aria-busy={uploading || creating}>
      <ImagePanel $ratio={492}>
        <PanelHead>
          <PanelTitle>최종 작품 이미지</PanelTitle>
          <Hint>JPG · PNG 이미지 파일을 등록해주세요.</Hint>
        </PanelHead>
        <ImageDropZone
          previewUrl={image?.url}
          onSelect={handleSelect}
          onInvalid={() => showAlert('지원하지 않는 이미지 형식입니다.')}
        />
      </ImagePanel>

      <InfoPanel $ratio={536}>
        <InfoBody>
          <InfoBlock>
            <InfoTitle>작품 정보</InfoTitle>
            <InfoRow>
              <InfoItem>
                <InfoLabel>프로젝트</InfoLabel>
                <InfoValue>{project.title}</InfoValue>
              </InfoItem>
              <InfoItem>
                <InfoLabel>저작물 유형</InfoLabel>
                <InfoValue>{getWorkTypeSummary(project.workType)}</InfoValue>
              </InfoItem>
            </InfoRow>
          </InfoBlock>

          <div>
            <DescriptionLabel htmlFor="final-work-title">최종 작품 제목</DescriptionLabel>
            <TextInput ref={titleRef} id="final-work-title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div>
            <DescriptionLabel htmlFor="final-work-description">최종 작품 설명</DescriptionLabel>
            <DescriptionInput
              id="final-work-description"
              placeholder="최종 결과물의 주제, 시각적 특징 등을 간단히 설명해주세요."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </InfoBody>

        <Actions>
          <CancelButton type="button" onClick={handleCancel}>
            취소
          </CancelButton>
          <SaveButton type="button" onClick={handleSave}>
            {uploading || creating ? '저장 중…' : '최종 작품 저장'}
          </SaveButton>
        </Actions>
      </InfoPanel>
    </fieldset>
  );
}

const ImagePanel = styled(Panel)`
  gap: 20px;
  padding-bottom: 40px;
`;

const PanelHead = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Hint = styled.p`
  margin: 0;
  color: ${colors.textHint};
  font-size: 10px;
  line-height: 15px;
`;

const InfoPanel = styled(Panel)`
  gap: 36px;
  padding-bottom: 14px;
`;

const InfoBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 49px;
`;

const InfoBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 30px;
`;

const InfoTitle = styled(PanelTitle)`
  color: #000;
`;

const InfoRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  column-gap: 130px;
  row-gap: 16px;
  line-height: 1.4;
`;

const InfoItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const InfoLabel = styled.span`
  color: ${colors.textSecondary};
  font-size: 14px;
`;

const InfoValue = styled.span`
  color: ${colors.textStrong};
  font-size: 16px;
  font-weight: 500;
`;

const DescriptionLabel = styled(FieldLabel)`
  color: ${colors.textSecondary};
`;

const DescriptionInput = styled(TextArea)`
  height: 121px;
  background: #f6f8fc;

  &:focus {
    background: ${colors.card};
  }
`;

/* 정보 카드가 더 커져도 버튼은 카드 아래쪽에 */
const Actions = styled(ModalActions)`
  margin-top: auto;
`;

const SaveButton = styled(SubmitButton)`
  width: 148px;
`;
