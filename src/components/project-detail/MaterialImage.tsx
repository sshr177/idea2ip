import { useEffect, useState } from 'react';
import { getMaterialImage } from '../../api/materials';

export default function MaterialImage({ materialId, fileId, fileName, compact = false }: {
  materialId: string; fileId: number; fileName: string; compact?: boolean;
}) {
  const [attempt, setAttempt] = useState(0);
  const key = `${materialId}/${fileId}/${attempt}`;
  const [result, setResult] = useState<{ key: string; url?: string; error?: string }>();
  useEffect(() => {
    const controller = new AbortController();
    const token = localStorage.getItem('accessToken');
    let objectUrl: string | undefined;
    getMaterialImage(materialId, String(fileId), controller.signal).then((blob) => {
      if (controller.signal.aborted) return;
      if (localStorage.getItem('accessToken') !== token) {
        setResult({ key, error: '로그인 상태가 변경되었습니다.' });
        return;
      }
      objectUrl = URL.createObjectURL(blob);
      setResult({ key, url: objectUrl });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setResult({ key, error: error instanceof Error ? error.message : '이미지 조회에 실패했습니다.' });
    });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [materialId, fileId, key]);
  const current = result?.key === key ? result : undefined;
  if (current?.error) return <div role="alert" title={current.error} style={{ fontSize: compact ? 11 : 14 }}>
    <span>{compact ? '이미지 오류' : current.error}</span>{' '}
    <button type="button" onClick={() => setAttempt((value) => value + 1)}>재시도</button>
  </div>;
  if (!current?.url) return <span role="status" style={{ fontSize: compact ? 11 : 14 }}>이미지 로딩 중…</span>;
  return <img src={current.url} alt={fileName} style={{ maxWidth: '100%', maxHeight: compact ? 80 : 360, objectFit: compact ? 'cover' : 'contain' }}
    onError={() => setResult({ key, error: '이미지를 표시할 수 없습니다.' })} />;
}
