import type { WorkType } from '../constants/workTypes';
import type { Project } from '../types/project';
import { isSupportedImage } from '../utils/image';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

// CHARACTER_DESIGN은 제공된 명세 기준입니다. 나머지 값은 서버 Enum 확인이 필요합니다.
const ARTWORK_TYPES: Record<WorkType, string> = {
  'digital-illustration': 'DIGITAL_ILLUSTRATION',
  'character-design': 'CHARACTER_DESIGN',
  'graphic-design': 'GRAPHIC_DESIGN',
};

export async function uploadProjectThumbnail(projectId: string, thumbnail: File): Promise<{ projectId: number; thumbnailUrl: string }> {
  if (!/^[1-9]\d*$/.test(projectId) || BigInt(projectId) > 9223372036854775807n) throw new Error('프로젝트 ID 형식이 올바르지 않습니다.');
  if (!thumbnail.size || !isSupportedImage(thumbnail)) throw new Error('비어 있지 않은 JPG 또는 PNG 이미지를 선택해주세요.');
  const token = localStorage.getItem('accessToken')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('로그인이 필요합니다.');
  const body = new FormData(); body.append('thumbnail', thumbnail);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/thumbnail`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, body,
    });
  } catch { throw new Error('서버에 연결할 수 없어 썸네일을 저장하지 못했습니다.'); }
  if (response.status !== 200) {
    const messages: Record<number, string> = { 400: '썸네일 파일과 요청 정보를 확인해주세요.', 401: '다시 로그인해주세요.', 403: '프로젝트 접근 권한이 없습니다.', 404: '프로젝트를 찾을 수 없습니다.', 500: '서버 오류로 썸네일을 저장하지 못했습니다.' };
    throw new Error(messages[response.status] ?? '썸네일 저장에 실패했습니다.');
  }
  const result = await response.json();
  const data = result?.data;
  if (!data || !Number.isSafeInteger(data.projectId) || String(data.projectId) !== projectId || typeof data.thumbnailUrl !== 'string' || !data.thumbnailUrl.trim()) throw new Error('썸네일 저장 응답을 확인하지 못했습니다.');
  const thumbnailUrl = /^https?:\/\//i.test(data.thumbnailUrl) ? data.thumbnailUrl : `${API_BASE_URL}/${data.thumbnailUrl.replace(/^\/+/, '')}`;
  return { projectId: data.projectId, thumbnailUrl };
}

export class ProjectListError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function getProject(projectId: string, signal?: AbortSignal): Promise<Project> {
  if (!/^[1-9]\d*$/.test(projectId) || BigInt(projectId) > 9223372036854775807n) {
    throw new ProjectListError(400, '프로젝트 ID 형식이 올바르지 않습니다.');
  }
  const token = localStorage.getItem('accessToken')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new ProjectListError(401, '로그인이 필요합니다.');
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ProjectListError(0, '서버에 연결할 수 없습니다. 다시 시도해주세요.');
  }
  if (response.status !== 200) {
    const messages: Record<number, string> = {
      401: '인증이 만료되었거나 유효하지 않습니다. 다시 로그인해주세요.',
      403: '이 프로젝트에 접근할 권한이 없습니다.',
      404: '프로젝트를 찾을 수 없습니다.',
      500: '서버 오류로 프로젝트 정보를 불러오지 못했습니다.',
    };
    throw new ProjectListError(response.status, messages[response.status] ?? '프로젝트 정보를 불러오지 못했습니다.');
  }
  const result = await response.json();
  const data = result?.data;
  if (!data || !Number.isSafeInteger(data.projectId) || String(data.projectId) !== projectId ||
      typeof data.title !== 'string' || !data.title.trim() ||
      typeof data.createdAt !== 'string' || !Number.isFinite(Date.parse(data.createdAt)) ||
      (data.description != null && typeof data.description !== 'string') ||
      (data.artworkType !== null && typeof data.artworkType !== 'string')) {
    throw new Error('프로젝트 상세 응답 형식이 올바르지 않습니다.');
  }
  return {
    id: String(data.projectId),
    title: data.title,
    description: data.description ?? null,
    createdAt: data.createdAt,
    updatedAt: data.createdAt,
    workType: (Object.keys(ARTWORK_TYPES) as WorkType[]).find((key) => ARTWORK_TYPES[key] === data.artworkType) ?? null,
    status: 'unknown',
  };
}

export async function getProjects(signal?: AbortSignal): Promise<Project[]> {
  const token = localStorage.getItem('accessToken')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new ProjectListError(401, '로그인이 필요합니다.');
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/projects`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ProjectListError(0, '서버에 연결할 수 없습니다. 다시 시도해주세요.');
  }
  if (response.status !== 200) {
    throw new ProjectListError(response.status, response.status === 401
      ? '인증이 만료되었거나 유효하지 않습니다. 다시 로그인해주세요.'
      : '프로젝트 목록을 불러오지 못했습니다. 다시 시도해주세요.');
  }
  const result = await response.json();
  if (!Array.isArray(result?.data?.projects)) throw new Error('프로젝트 목록 응답 형식이 올바르지 않습니다.');
  const projects: Project[] = result.data.projects.map((item: Record<string, unknown>) => {
    if (!item || !Number.isSafeInteger(item.projectId) || Number(item.projectId) <= 0 ||
        typeof item.title !== 'string' || typeof item.createdAt !== 'string' ||
        !Number.isFinite(Date.parse(item.createdAt)) ||
        (item.updatedAt !== null && (typeof item.updatedAt !== 'string' || !Number.isFinite(Date.parse(item.updatedAt)))) ||
        (item.artworkType !== null && typeof item.artworkType !== 'string') ||
        (item.thumbnailUrl !== null && typeof item.thumbnailUrl !== 'string')) {
      throw new Error('프로젝트 목록 항목 형식이 올바르지 않습니다.');
    }
    const workType = (Object.keys(ARTWORK_TYPES) as WorkType[]).find((key) => ARTWORK_TYPES[key] === item.artworkType) ?? null;
    const thumbnail = item.thumbnailUrl as string | null;
    // 서버 상대 경로도 /idea2ip 같은 API 기본 주소의 경로 뒤에 이어 붙입니다.
    const thumbnailUrl = thumbnail
      ? /^https?:\/\//i.test(thumbnail)
        ? thumbnail
        : `${API_BASE_URL}/${thumbnail.replace(/^\/+/, '')}`
      : undefined;
    return {
      id: String(item.projectId),
      title: item.title,
      createdAt: item.createdAt,
      updatedAt: (item.updatedAt as string | null) ?? item.createdAt,
      workType,
      thumbnailUrl,
      status: 'unknown', // 목록 명세에 진행 상태가 없으므로 임의로 완료 여부를 정하지 않습니다.
    };
  });
  if (new Set(projects.map((project) => project.id)).size !== projects.length) throw new Error('프로젝트 ID가 중복된 응답입니다.');
  return projects.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export interface CreateProjectInput {
  title: string;
  workType: WorkType;
  description?: string | null;
}

export interface CreatedProject {
  projectId: number;
  title: string;
}

export async function createProject(input: CreateProjectInput): Promise<CreatedProject> {
  const token = localStorage.getItem('accessToken')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('로그인이 필요합니다. 로그인 후 다시 시도해주세요.');
  if (!input.title.trim()) throw new Error('프로젝트 제목을 입력해주세요.');

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/projects`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        title: input.title.trim(),
        artworkType: ARTWORK_TYPES[input.workType],
        ...(input.description !== undefined ? { description: input.description } : {}),
      }),
    });
  } catch {
    throw new Error('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
  }
  if (response.status !== 201) {
    const messages: Record<number, string> = {
      400: '프로젝트 제목과 작품 유형 등 입력값을 확인해주세요.',
      401: '인증이 만료되었거나 유효하지 않습니다. 다시 로그인해주세요.',
      500: '서버 오류로 프로젝트를 생성하지 못했습니다.',
    };
    throw new Error(messages[response.status] ?? '프로젝트를 생성하지 못했습니다.');
  }
  const result = await response.json();
  const data = result?.data;
  if (!data || !Number.isSafeInteger(data.projectId) || data.projectId <= 0 ||
      typeof data.title !== 'string' || !data.title.trim()) {
    throw new Error('프로젝트 생성 응답을 확인하지 못했습니다. 생성 여부를 확인해주세요.');
  }
  return data;
}
