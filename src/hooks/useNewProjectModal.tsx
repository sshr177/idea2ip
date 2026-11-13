import { useCallback, useState } from 'react';
import NewProjectModal from '../components/NewProjectModal';
import type { NewProjectInput } from '../components/NewProjectModal';
import { useProjectStore } from '../store/projectStore';
import { createProject, uploadProjectThumbnail } from '../api/projects';
import type { CreatedProject } from '../api/projects';

/**
 * 새 프로젝트 생성 모달 (대시보드, 내 프로젝트에서 공통 사용)
 * const { openModal, modalNode } = useNewProjectModal();
 * <button onClick={openModal}>...</button> {modalNode}
 */
export function useNewProjectModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [createdProject, setCreatedProject] = useState<CreatedProject>();
  const addProject = useProjectStore((state) => state.addProject);

  const openModal = useCallback(() => { setCreatedProject(undefined); setIsOpen(true); }, []);
  const closeModal = useCallback(() => setIsOpen(false), []);

  const handleCreate = async ({ name, image, workType }: NewProjectInput) => {
    const created = createdProject ?? await createProject({ title: name, workType });
    if (!createdProject) {
      setCreatedProject(created);
      addProject({
      id: String(created.projectId),
      title: created.title,
      workType,
      status: 'unknown',
      updatedAt: new Date().toISOString(),
    });
    }
    if (image) {
      try {
        const result = await uploadProjectThumbnail(String(created.projectId), image);
        useProjectStore.setState((state) => ({ projects: state.projects.map((project) => project.id === String(created.projectId) ? { ...project, thumbnailUrl: result.thumbnailUrl } : project) }));
      } catch (cause) {
        throw new Error(`프로젝트는 생성됐지만 썸네일 저장에 실패했습니다. 다시 저장하면 이미지만 재시도합니다. ${cause instanceof Error ? cause.message : ''}`);
      }
    }
    setIsOpen(false);
  };

  const modalNode = isOpen ? (
    <NewProjectModal onClose={closeModal} onSubmit={handleCreate} projectCreated={!!createdProject} />
  ) : null;

  return { openModal, modalNode };
}
