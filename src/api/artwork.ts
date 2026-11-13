const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
import { isSupportedImage } from '../utils/image';

const ERROR_MESSAGES: Record<number, string> = {
  400: '프로젝트 ID 형식이 올바르지 않습니다.',
  401: '로그인이 필요하거나 인증이 만료되었습니다.',
  403: '이 프로젝트에 접근할 권한이 없습니다.',
  404: '프로젝트, 최종 작품 또는 이미지를 찾을 수 없습니다.',
  500: '서버에서 이미지를 읽지 못했습니다.',
};

export class ArtworkImageError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ArtworkImageError';
  }
}

/** 인증된 이미지 응답은 JSON이 아닌 Blob으로 읽습니다. */
function getAuthorization(projectId: string) {
  if (!/^[1-9]\d*$/.test(projectId) || BigInt(projectId) > 9223372036854775807n) {
    throw new ArtworkImageError(400, ERROR_MESSAGES[400]);
  }

  // 로그인 API 연동 시 이 키에 JWT access token을 저장합니다.
  const token = localStorage.getItem('accessToken')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new ArtworkImageError(401, ERROR_MESSAGES[401]);
  return `Bearer ${token}`;
}

export interface ArtworkImageResult {
  artworkId: number;
  projectId: number;
  fileName: string;
}

export interface CreatedArtwork {
  artworkId: number;
  projectId: number;
  title: string;
}

export interface Artwork extends CreatedArtwork {
  description: string | null;
  fileName: string | null;
  fileUrl: string | null;
}

export interface UpdateArtworkInput {
  title?: string;
  description?: string | null;
}

export async function deleteArtwork(projectId: string): Promise<void> {
  const authorization = getAuthorization(projectId);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/artwork`, {
      method: 'DELETE', headers: { Authorization: authorization },
    });
  } catch {
    throw new Error('서버에 연결할 수 없어 최종 작품을 삭제하지 못했습니다.');
  }
  if (response.status === 204) return;
  const messages: Record<number, string> = {
    401: '인증에 실패했습니다. 다시 로그인해주세요.',
    403: '프로젝트에 접근할 권한이 없습니다.',
    404: '최종 작품을 찾을 수 없습니다. 다시 조회해주세요.',
    500: '서버 오류로 최종 작품을 삭제하지 못했습니다.',
  };
  throw new ArtworkImageError(response.status, messages[response.status] ?? '최종 작품을 삭제하지 못했습니다.');
}

export async function updateArtwork(projectId: string, input: UpdateArtworkInput): Promise<Omit<Artwork, 'projectId' | 'fileUrl'>> {
  const authorization = getAuthorization(projectId);
  if (input.title !== undefined && !input.title.trim()) throw new Error('최종 작품 제목을 입력해주세요.');
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/artwork`, {
      method: 'PATCH',
      headers: { Authorization: authorization, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    throw new Error('서버에 연결할 수 없어 작품을 수정하지 못했습니다.');
  }
  if (response.status !== 200) throw new ArtworkImageError(response.status,
    response.status === 400 ? '수정할 작품 정보를 확인해주세요.' : response.status === 500 ? '서버 오류로 작품을 수정하지 못했습니다.' : ERROR_MESSAGES[response.status] ?? '작품을 수정하지 못했습니다.');
  const result = await response.json();
  const data = result?.data;
  if (!data || !Number.isSafeInteger(data.artworkId) || data.artworkId <= 0 || typeof data.title !== 'string' || !data.title.trim() ||
      (data.description != null && typeof data.description !== 'string') ||
      (data.fileName !== null && typeof data.fileName !== 'string')) throw new Error('작품 수정 응답 형식이 올바르지 않습니다.');
  return { artworkId: data.artworkId, title: data.title, description: data.description ?? null, fileName: data.fileName };
}

export async function getArtwork(projectId: string, signal?: AbortSignal): Promise<Artwork> {
  const authorization = getAuthorization(projectId);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/artwork`, {
      headers: { Authorization: authorization, Accept: 'application/json' }, signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('서버에 연결할 수 없어 최종 작품을 불러오지 못했습니다.');
  }
  if (response.status !== 200) throw new ArtworkImageError(response.status,
    response.status === 500 ? '서버 오류로 최종 작품을 불러오지 못했습니다.' : ERROR_MESSAGES[response.status] ?? '최종 작품을 불러오지 못했습니다.');
  const result = await response.json();
  const data = result?.data;
  if (!data || !Number.isSafeInteger(data.artworkId) || data.artworkId <= 0 ||
      !Number.isSafeInteger(data.projectId) || String(data.projectId) !== projectId ||
      typeof data.title !== 'string' || !data.title.trim() ||
      (data.description != null && typeof data.description !== 'string') ||
      (data.fileName !== null && typeof data.fileName !== 'string') ||
      (data.fileUrl !== null && typeof data.fileUrl !== 'string')) throw new Error('최종 작품 조회 응답 형식이 올바르지 않습니다.');
  return { ...data, description: data.description ?? null };
}

export async function createArtwork(projectId: string, input: { title: string; description?: string | null }): Promise<CreatedArtwork> {
  const authorization = getAuthorization(projectId);
  if (!input.title.trim()) throw new Error('최종 작품 제목을 입력해주세요.');
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/artwork`, {
      method: 'POST',
      headers: { Authorization: authorization, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ ...input, title: input.title.trim() }),
    });
  } catch {
    throw new Error('서버에 연결할 수 없어 작품을 등록하지 못했습니다.');
  }
  if (response.status !== 201) {
    const messages: Record<number, string> = {
      400: '최종 작품 입력값을 확인해주세요.',
      409: '이미 최종 작품이 등록된 프로젝트입니다.',
      500: '서버 오류로 최종 작품을 등록하지 못했습니다.',
    };
    throw new ArtworkImageError(response.status, messages[response.status] ?? ERROR_MESSAGES[response.status] ?? '최종 작품을 등록하지 못했습니다.');
  }
  const result = await response.json();
  const data = result?.data;
  if (!data || !Number.isSafeInteger(data.artworkId) || data.artworkId <= 0 ||
      !Number.isSafeInteger(data.projectId) || String(data.projectId) !== projectId ||
      typeof data.title !== 'string' || !data.title.trim()) throw new Error('최종 작품 등록 응답을 확인하지 못했습니다. 등록 여부를 확인해주세요.');
  return data;
}

export async function uploadArtworkImage(projectId: string, file: File): Promise<ArtworkImageResult> {
  const authorization = getAuthorization(projectId);
  if (!file.size || !isSupportedImage(file)) {
    throw new ArtworkImageError(400, '비어 있지 않은 JPG 또는 PNG 파일을 선택해주세요.');
  }
  const body = new FormData();
  body.append('file', file);
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/artwork/image`, {
    method: 'PATCH',
    headers: { Authorization: authorization, Accept: 'application/json' },
    // Content-Type은 브라우저가 multipart boundary와 함께 설정합니다.
    body,
  });
  if (response.status !== 200) {
    const message = response.status === 400
      ? '파일 누락, 미지원 이미지 형식 또는 요청 데이터 오류입니다.'
      : response.status === 404
        ? '프로젝트 또는 최종 작품을 찾을 수 없습니다.'
        : response.status === 500
          ? '서버에서 이미지를 저장하지 못했습니다.'
          : ERROR_MESSAGES[response.status] ?? '이미지를 저장하지 못했습니다.';
    throw new ArtworkImageError(response.status, message);
  }
  const result = await response.json();
  const data = result?.data;
  if (!data || !Number.isSafeInteger(data.artworkId) || data.artworkId <= 0 ||
      !Number.isSafeInteger(data.projectId) || String(data.projectId) !== projectId ||
      typeof data.fileName !== 'string' || !data.fileName) {
    throw new Error('이미지 저장 응답 형식이 올바르지 않습니다.');
  }
  return data;
}

export async function getArtworkImage(projectId: string, signal?: AbortSignal): Promise<Blob> {
  const authorization = getAuthorization(projectId);

  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/artwork/image`, {
    cache: 'no-store',
    headers: {
      Authorization: authorization,
      Accept: 'image/png, image/jpeg',
    },
    signal,
  });

  if (response.status !== 200) {
    // 오류 본문은 JSON일 수 있으므로 이미지로 변환하지 않습니다.
    throw new ArtworkImageError(
      response.status,
      ERROR_MESSAGES[response.status] ?? '최종 작품 이미지를 불러오지 못했습니다.',
    );
  }

  const contentType = response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
  if (contentType !== 'image/png' && contentType !== 'image/jpeg') {
    throw new Error('서버에서 지원하지 않는 이미지 형식을 반환했습니다.');
  }
  const image = await response.blob();
  if (!image.size) throw new Error('서버에서 빈 이미지를 반환했습니다.');
  return image;
}
