import { useRef, useState } from 'react';
import { updateMaterialFiles, uploadMaterialFiles } from '../../api/materials';
import { isSupportedImage, SUPPORTED_IMAGE_ACCEPT } from '../../utils/image';
import type { ProcessMaterial } from '../../types/project';

export default function MaterialFilesUpload({ materialId, existingFiles, onUploaded, onBusyChange }: {
  materialId: string;
  existingFiles: NonNullable<ProcessMaterial['files']>;
  onUploaded: (files: NonNullable<ProcessMaterial['files']>) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [deleteIds, setDeleteIds] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  const picker = useRef<HTMLInputElement>(null);
  const handleUpload = async () => {
    if (lock.current || (!files.length && !deleteIds.length)) return;
    if (existingFiles.filter((file) => !deleteIds.includes(file.fileId)).length + files.length === 0) {
      setMessage('이미지가 최소 한 장 남아야 합니다. 새 이미지를 추가하거나 삭제 선택을 해제해주세요.');
      return;
    }
    lock.current = true;
    setBusy(true);
    onBusyChange(true);
    setMessage('');
    try {
      const uploaded = existingFiles.length
        ? await updateMaterialFiles(materialId, files, deleteIds)
        : await uploadMaterialFiles(materialId, files);
      onUploaded(uploaded);
      setFiles([]);
      setDeleteIds([]);
      if (picker.current) picker.current.value = '';
      setMessage('첨부 이미지를 저장했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '업로드하지 못했습니다.');
    } finally {
      lock.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  };
  return <section aria-label="첨부 이미지 업로드" aria-busy={busy}>
    {!!existingFiles.length && <fieldset disabled={busy}>
      <legend>삭제할 기존 이미지 선택</legend>
      {existingFiles.map((file) => <label key={file.fileId} style={{ display: 'block' }}>
        <input type="checkbox" checked={deleteIds.includes(file.fileId)} onChange={(event) => {
          setDeleteIds((ids) => event.target.checked ? [...ids, file.fileId] : ids.filter((id) => id !== file.fileId));
          setMessage('');
        }} /> {file.fileName}
      </label>)}
      <p>삭제 선택은 아래 변경 저장 버튼을 누르면 반영됩니다.</p>
    </fieldset>}
    <label htmlFor="material-files">JPG·PNG 이미지 추가 (여러 장 선택 가능)</label>
    <input id="material-files" ref={picker} type="file" accept={SUPPORTED_IMAGE_ACCEPT} multiple disabled={busy}
      onChange={(event) => {
        const selected = Array.from(event.target.files ?? []);
        if (selected.some((file) => !file.size || !isSupportedImage(file))) {
          setMessage('비어 있지 않은 JPG 또는 PNG 파일만 선택해주세요.');
          event.target.value = '';
          setFiles([]);
          return;
        }
        setFiles(selected);
        setMessage('');
      }} />
    {!!files.length && <ul>{files.map((file, index) => <li key={index}>{file.name}</li>)}</ul>}
    <button type="button" disabled={busy || (!files.length && !deleteIds.length)} onClick={handleUpload}>{busy ? '저장 중…' : existingFiles.length ? '첨부 이미지 변경 저장' : '이미지 업로드'}</button>
    {message && <p role="status">{message}</p>}
  </section>;
}
