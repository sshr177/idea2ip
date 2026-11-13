import { useRef, useState } from 'react';
import { uploadProjectThumbnail } from '../api/projects';
import { isSupportedImage, SUPPORTED_IMAGE_ACCEPT } from '../utils/image';
import { useProjectStore } from '../store/projectStore';
import type { Project } from '../types/project';

export default function ProjectThumbnailUpload({ project }: { project: Project }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  const picker = useRef<HTMLInputElement>(null);
  const save = async () => {
    if (!file || lock.current) return;
    lock.current = true; setBusy(true); setMessage('');
    const token = localStorage.getItem('accessToken');
    try {
      const result = await uploadProjectThumbnail(project.id, file);
      if (localStorage.getItem('accessToken') !== token) throw new Error('로그인 상태가 변경되었습니다.');
      useProjectStore.setState((state) => ({ projects: state.projects.some((item) => item.id === project.id)
        ? state.projects.map((item) => item.id === project.id ? { ...item, thumbnailUrl: result.thumbnailUrl } : item)
        : [...state.projects, { ...project, thumbnailUrl: result.thumbnailUrl }],
      }));
      setFile(null); if (picker.current) picker.current.value = '';
      setMessage('프로젝트 썸네일을 저장했습니다.');
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : '썸네일 저장에 실패했습니다.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <div aria-label="프로젝트 썸네일 등록 및 교체" aria-busy={busy}>
    <label htmlFor="project-thumbnail">프로젝트 썸네일 등록·교체 (JPG·PNG)</label>{' '}
    <input id="project-thumbnail" ref={picker} type="file" accept={SUPPORTED_IMAGE_ACCEPT} disabled={busy} onChange={(event) => {
      const selected = event.target.files?.[0];
      if (!selected) return;
      if (!selected.size || !isSupportedImage(selected)) { setMessage('비어 있지 않은 JPG 또는 PNG 파일을 선택해주세요.'); event.target.value = ''; setFile(null); return; }
      setFile(selected); setMessage('');
    }} />
    <button type="button" disabled={!file || busy} onClick={save}>{busy ? '저장 중…' : '썸네일 저장'}</button>
    {message && <p role="status">{message}</p>}
  </div>;
}
