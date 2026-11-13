import { useEffect, useRef, useState } from 'react';
import ModalShell from '../modal/ModalShell';
import { deleteMaterial, getMaterial } from '../../api/materials';
import type { MaterialDetail } from '../../api/materials';
import { MATERIAL_TYPES } from '../../constants/materialTypes';
import { useProjectStore } from '../../store/projectStore';
import MaterialImage from './MaterialImage';

export default function MaterialDetailModal({ projectId, materialId, onClose, onDeleted }: {
  projectId: string; materialId: string; onClose: () => void; onDeleted: () => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const deleteLock = useRef(false);
  const handleDelete = async () => {
    if (deleteLock.current) return;
    if (!window.confirm('이 창작 자료를 삭제할까요? 첨부 이미지도 함께 삭제됩니다.')) return;
    deleteLock.current = true;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteMaterial(materialId);
      useProjectStore.setState((state) => ({ materialsByProjectId: {
        ...state.materialsByProjectId,
        [projectId]: (state.materialsByProjectId[projectId] ?? []).filter((item) => item.id !== materialId),
      } }));
      onDeleted();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : '자료를 삭제하지 못했습니다.');
    } finally {
      deleteLock.current = false;
      setDeleting(false);
    }
  };
  const [result, setResult] = useState<{ attempt: number; detail?: MaterialDetail; error?: string }>();
  useEffect(() => {
    const controller = new AbortController();
    const token = localStorage.getItem('accessToken');
    getMaterial(materialId, controller.signal).then((detail) => {
      if (controller.signal.aborted) return;
      if (localStorage.getItem('accessToken') !== token) {
        setResult({ attempt, error: '로그인 상태가 변경되었습니다. 다시 로그인해주세요.' });
        return;
      }
      useProjectStore.setState((state) => ({ materialsByProjectId: {
        ...state.materialsByProjectId,
        [projectId]: (state.materialsByProjectId[projectId] ?? []).map((item) => item.id === materialId ? { ...item, ...detail } : item),
      } }));
      setResult({ attempt, detail });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setResult({ attempt, error: error instanceof Error ? error.message : '자료 정보를 불러오지 못했습니다.' });
    });
    return () => controller.abort();
  }, [projectId, materialId, attempt]);
  const current = result?.attempt === attempt ? result : undefined;
  const detail = current?.detail;
  return (
    <ModalShell titleId="material-detail-title" title="창작 자료 상세" onClose={() => { if (!deleteLock.current) onClose(); }} width={598}>
      {!current ? <p role="status">자료 정보를 불러오는 중입니다.</p> : current.error ? (
        <div role="alert"><p>{current.error}</p><button type="button" onClick={() => setAttempt((value) => value + 1)}>다시 시도</button></div>
      ) : detail && (
        <>
        <dl style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.8 }}>
          <dt>자료 제목</dt><dd>{detail.title}</dd>
          <dt>자료 유형</dt><dd>{MATERIAL_TYPES.find((item) => item.value === detail.type)?.label}</dd>
          <dt>설명</dt><dd>{detail.description || '미입력'}</dd>
          <dt>사용한 AI 도구</dt><dd>{detail.aiTool || '미입력'}</dd>
          <dt>실제 제작 날짜</dt><dd>{detail.productionDate || '미입력'}</dd>
          <dt>첨부 이미지</dt><dd style={{ marginLeft: 0 }}>{detail.files?.length ? <ul style={{ listStyle: 'none', padding: 0 }}>{detail.files.map((file) => <li key={file.fileId} style={{ marginBottom: 16 }}>
            <MaterialImage materialId={materialId} fileId={file.fileId} fileName={file.fileName} />
            <p style={{ marginTop: 4 }}>{file.fileName}</p>
          </li>)}</ul> : '없음'}</dd>
        </dl>
        {deleteError && <p role="alert">{deleteError}</p>}
        <button type="button" disabled={deleting} onClick={handleDelete} style={{ color: '#b42318', marginTop: 20 }}>
          {deleting ? '삭제 중…' : '창작 자료 삭제'}
        </button>
        </>
      )}
    </ModalShell>
  );
}
