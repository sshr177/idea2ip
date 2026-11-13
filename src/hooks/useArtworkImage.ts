import { useEffect, useState } from 'react';
import { ArtworkImageError, getArtworkImage } from '../api/artwork';

type ImageState = {
  projectId: string;
  attempt: number;
  url?: string;
  error?: string;
  status?: number;
  signal?: AbortSignal;
};

export function useArtworkImage(projectId: string, enabled: boolean) {
  const [state, setState] = useState<ImageState>({ projectId, attempt: 0 });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const token = localStorage.getItem('accessToken');
    let objectUrl: string | undefined;

    getArtworkImage(projectId, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        if (localStorage.getItem('accessToken') !== token) {
          setState({ projectId, attempt, signal: controller.signal, error: '로그인 상태가 변경되었습니다. 다시 로그인해주세요.' });
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setState({ projectId, attempt, signal: controller.signal, url: objectUrl });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          projectId,
          attempt,
          signal: controller.signal,
          error: error instanceof Error ? error.message : '이미지를 불러오지 못했습니다.',
          status: error instanceof ArtworkImageError ? error.status : undefined,
        });
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [projectId, enabled, attempt]);

  const current = enabled && !state.signal?.aborted && state.projectId === projectId && state.attempt === attempt ? state : undefined;
  return {
    url: current?.url,
    error: current?.error,
    status: current?.status,
    loading: enabled && !current?.url && !current?.error,
    retry: () => setAttempt((value) => value + 1),
  };
}
