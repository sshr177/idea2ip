import { useEffect, useState } from 'react';
import { ArtworkImageError, getArtwork } from '../api/artwork';
import { useProjectStore } from '../store/projectStore';

export function useArtwork(projectId: string) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ projectId: string; attempt: number; error?: string }>();
  useEffect(() => {
    const controller = new AbortController();
    const token = localStorage.getItem('accessToken');
    getArtwork(projectId, controller.signal).then((artwork) => {
      if (controller.signal.aborted) return;
      if (localStorage.getItem('accessToken') !== token) {
        setResult({ projectId, attempt, error: '로그인 상태가 변경되었습니다. 다시 로그인해주세요.' });
        return;
      }
      useProjectStore.setState((state) => ({ finalWorkByProjectId: {
        ...state.finalWorkByProjectId,
        [projectId]: {
          ...state.finalWorkByProjectId[projectId],
          artworkId: artwork.artworkId, title: artwork.title,
          description: artwork.description ?? '', imageName: artwork.fileName ?? '',
          fileUrl: artwork.fileUrl, imageUrl: '',
          updatedAt: state.finalWorkByProjectId[projectId]?.updatedAt ?? '',
        },
      } }));
      setResult({ projectId, attempt });
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      if (localStorage.getItem('accessToken') !== token) {
        setResult({ projectId, attempt, error: '로그인 상태가 변경되었습니다. 다시 로그인해주세요.' });
        return;
      }
      if (error instanceof ArtworkImageError && error.status === 404) {
        useProjectStore.setState((state) => {
          const next = { ...state.finalWorkByProjectId };
          delete next[projectId];
          return { finalWorkByProjectId: next };
        });
        setResult({ projectId, attempt });
      } else setResult({ projectId, attempt, error: error instanceof Error ? error.message : '최종 작품을 불러오지 못했습니다.' });
    });
    return () => controller.abort();
  }, [projectId, attempt]);
  const current = result?.projectId === projectId && result.attempt === attempt ? result : undefined;
  return { loading: !current, error: current?.error, retry: () => setAttempt((value) => value + 1) };
}
