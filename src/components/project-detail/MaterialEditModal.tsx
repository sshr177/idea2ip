import { useEffect, useState } from 'react';
import { getMaterial } from '../../api/materials';
import type { ProcessMaterial } from '../../types/project';
import ModalShell from '../modal/ModalShell';
import MaterialModal from './MaterialModal';

export default function MaterialEditModal({ projectId, material, onClose, onSaved }: {
  projectId: string; material: ProcessMaterial; onClose: () => void; onSaved: () => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ attempt: number; material?: ProcessMaterial; error?: string }>();
  useEffect(() => {
    const controller = new AbortController();
    const token = localStorage.getItem('accessToken');
    getMaterial(material.id, controller.signal).then((detail) => {
      if (controller.signal.aborted) return;
      if (localStorage.getItem('accessToken') !== token) {
        setResult({ attempt, error: '로그인 상태가 변경되었습니다. 다시 로그인해주세요.' });
        return;
      }
      setResult({ attempt, material: { ...material, ...detail } });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setResult({ attempt, error: error instanceof Error ? error.message : '자료 조회에 실패했습니다.' });
    });
    return () => controller.abort();
  }, [material, attempt]);
  const current = result?.attempt === attempt ? result : undefined;
  if (current?.material) return <MaterialModal projectId={projectId} material={current.material} onClose={onClose} onCreated={onSaved} />;
  return <ModalShell titleId="material-edit-title" title="창작 자료 수정" onClose={onClose}>
    {current?.error ? <div role="alert"><p>{current.error}</p><button type="button" onClick={() => setAttempt((value) => value + 1)}>다시 시도</button></div> : <p role="status">자료 정보를 불러오는 중입니다.</p>}
  </ModalShell>;
}
