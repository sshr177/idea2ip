import styled from 'styled-components';
import { useRef, useState } from 'react';
import { uploadArtworkImage } from '../../../api/artwork';
import { useArtwork } from '../../../hooks/useArtwork';
import FinalWorkForm from './FinalWorkForm';
import FinalWorkView from './FinalWorkView';
import SectionHeader from '../SectionHeader';
import { CardsRow, SoftButton, ToastSpot } from './finalWork.styles';
import { useArtworkImage } from '../../../hooks/useArtworkImage';
import { useAlertModal } from '../../../hooks/useAlertModal';
import { useFinalWork, useProjectStore } from '../../../store/projectStore';
import type { Project } from '../../../types/project';

// 프로젝트 상세 > "최종 작품" 탭
// - 저장한 최종 작품 없음: 1번 등록 화면 / 있음: 2번 저장 후 화면

interface Props {
  project: Project;
  /** "AI 인터뷰 준비 확인" → AI 인터뷰 탭으로 이동 */
  onGoToInterview: () => void;
}

export default function FinalWorkTab({ project, onGoToInterview }: Props) {
  const finalWork = useFinalWork(project.id);
  const { showAlert, alertNode } = useAlertModal(1800, 'subtle');
  // 목업 프로젝트와 로컬 등록 이미지는 기존 미리보기를 유지합니다.
  // 실제 서버 프로젝트는 메타데이터가 아직 없어도 이미지 조회가 가능합니다.
  const artwork = useArtwork(project.id);
  const loadServerImage = !artwork.loading && !artwork.error && !!(finalWork?.fileUrl || finalWork?.imageName);
  const image = useArtworkImage(project.id, loadServerImage);
  const [uploading, setUploading] = useState(false);
  const uploadLock = useRef(false);
  const handleUpload = async (file: File) => {
    if (uploadLock.current) throw new Error('이미지를 저장 중입니다.');
    uploadLock.current = true;
    setUploading(true);
    try {
      const result = await uploadArtworkImage(project.id, file);
      const current = useProjectStore.getState().finalWorkByProjectId[project.id];
      if (current) useProjectStore.getState().saveFinalWork(project.id, { ...current, imageName: result.fileName, fileUrl: '/api/projects/' + project.id + '/artwork/image' });
      image.retry();
      showAlert('이미지를 저장했습니다.');
      return result;
    } catch (error) {
      showAlert(error instanceof Error ? error.message : '이미지를 저장하지 못했습니다.');
      throw error;
    } finally {
      uploadLock.current = false;
      setUploading(false);
    }
  };
  return (
    <Section>
      <SectionHeader title="최종 작품" subtitle="자료별 제작 과정과 역할을 연결할 수 있어요." />
      {image.loading && <p role="status">저장된 이미지를 불러오는 중입니다.</p>}
      {image.error && <div role="alert"><p>{image.error}</p><SoftButton onClick={image.retry}>다시 시도</SoftButton></div>}
      <CardsRow>
        {artwork.loading ? <p role="status">최종 작품을 불러오는 중입니다.</p> : artwork.error ? (
          <div role="alert"><p>{artwork.error}</p><SoftButton onClick={artwork.retry}>다시 시도</SoftButton></div>
        ) : finalWork ? (
          <>
            <FinalWorkView project={project} finalWork={finalWork} showAlert={showAlert}
              onGoToInterview={onGoToInterview} onUpload={handleUpload} uploading={uploading} imageUrl={image.url} />
          </>
        ) : <FinalWorkForm project={project} showAlert={showAlert} onUpload={handleUpload} uploading={uploading} />}
        <ToastSpot>{alertNode}</ToastSpot>
      </CardsRow>
    </Section>
  );
}

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 32px;
`;
