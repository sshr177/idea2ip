const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
import type { ProcessMaterial } from '../types/project';
import { isSupportedImage } from '../utils/image';

export async function deleteMaterial(materialId: string): Promise<void> {
  if (!/^[1-9]\d*$/.test(materialId) || BigInt(materialId) > 9223372036854775807n) throw new Error('창작 자료 ID 형식이 올바르지 않습니다.');
  const token = localStorage.getItem('accessToken')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('로그인이 필요합니다. 다시 로그인해주세요.');
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/materials/${materialId}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new Error('서버에 연결할 수 없어 자료를 삭제하지 못했습니다.');
  }
  if (response.status === 204) return;
  const messages: Record<number, string> = {
    401: '인증에 실패했습니다. 다시 로그인해주세요.',
    403: '창작 자료를 삭제할 권한이 없습니다.',
    404: '창작 자료를 찾을 수 없습니다. 목록을 다시 확인해주세요.',
    500: '서버 오류로 자료를 삭제하지 못했습니다.',
  };
  throw new Error(messages[response.status] ?? '창작 자료를 삭제하지 못했습니다.');
}

export async function getMaterialImage(materialId: string, fileId: string, signal?: AbortSignal): Promise<Blob> {
  if ([materialId, fileId].some((id) => !/^[1-9]\d*$/.test(id) || BigInt(id) > 9223372036854775807n)) {
    throw new Error('창작 자료 또는 첨부 파일 ID 형식이 올바르지 않습니다.');
  }
  const token = localStorage.getItem('accessToken')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('로그인이 필요합니다. 다시 로그인해주세요.');
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/materials/${materialId}/files/${fileId}`, {
      method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'image/png, image/jpeg' }, signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('서버에 연결할 수 없어 이미지를 불러오지 못했습니다.');
  }
  if (response.status !== 200) {
    const messages: Record<number, string> = {
      400: '창작 자료 또는 첨부 파일 ID 형식이 올바르지 않습니다.',
      401: '인증에 실패했습니다. 다시 로그인해주세요.',
      403: '해당 프로젝트에 접근할 권한이 없습니다.',
      404: '자료 또는 이미지를 찾을 수 없거나 해당 자료의 파일이 아닙니다.',
      500: '서버에서 이미지를 읽지 못했습니다.',
    };
    throw new Error(messages[response.status] ?? '첨부 이미지를 불러오지 못했습니다.');
  }
  const type = response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
  if (type !== 'image/png' && type !== 'image/jpeg') throw new Error('지원하지 않는 이미지 응답 형식입니다.');
  const blob = await response.blob();
  if (!blob.size) throw new Error('이미지 응답이 비어 있습니다.');
  return blob;
}

export async function uploadMaterialFiles(materialId: string, files: File[]): Promise<NonNullable<ProcessMaterial['files']>> {
  return sendMaterialFiles(materialId, files, [], 'POST');
}

export async function updateMaterialFiles(materialId: string, newFiles: File[], deleteFileIds: number[]): Promise<NonNullable<ProcessMaterial['files']>> {
  if (deleteFileIds.some((id) => !Number.isSafeInteger(id) || id <= 0) || new Set(deleteFileIds).size !== deleteFileIds.length) throw new Error('삭제 대상 파일 ID가 올바르지 않습니다.');
  return sendMaterialFiles(materialId, newFiles, deleteFileIds, 'PATCH');
}

async function sendMaterialFiles(materialId: string, files: File[], deleteFileIds: number[], method: 'POST' | 'PATCH'): Promise<NonNullable<ProcessMaterial['files']>> {
  if (!/^[1-9]\d*$/.test(materialId) || BigInt(materialId) > 9223372036854775807n) throw new Error('창작 자료 ID 형식이 올바르지 않습니다.');
  const token = localStorage.getItem('accessToken')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('로그인이 필요합니다. 다시 로그인해주세요.');
  if ((!files.length && !deleteFileIds.length) || files.some((file) => !file.size || !isSupportedImage(file))) throw new Error('변경할 파일을 선택해주세요. 새 이미지는 비어 있지 않은 JPG 또는 PNG여야 합니다.');
  const body = new FormData();
  files.forEach((file) => body.append(method === 'POST' ? 'files' : 'newFiles', file));
  deleteFileIds.forEach((id) => body.append('deleteFileIds', String(id)));
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/materials/${materialId}/files`, {
      method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, body,
    });
  } catch {
    throw new Error('서버에 연결할 수 없어 업로드하지 못했습니다.');
  }
  if (response.status !== (method === 'POST' ? 201 : 200)) {
    const messages: Record<number, string> = {
      400: '파일 형식, 삭제 대상 또는 변경 후 남는 이미지가 있는지 확인해주세요.',
      401: '인증에 실패했습니다. 다시 로그인해주세요.',
      403: '프로젝트에 접근할 권한이 없습니다.',
      404: '창작 자료를 찾을 수 없습니다.',
      500: '서버 오류로 이미지를 업로드하지 못했습니다.',
    };
    throw new Error(messages[response.status] ?? '이미지를 업로드하지 못했습니다.');
  }
  const result = await response.json();
  const data = result?.data;
  if (!data || !Number.isSafeInteger(data.materialId) || String(data.materialId) !== materialId ||
      !Array.isArray(data.files) || !data.files.length || data.files.some((file: any) => !file || !Number.isSafeInteger(file.fileId) || file.fileId <= 0 || typeof file.fileName !== 'string' || typeof file.imageUrl !== 'string') ||
      new Set(data.files.map((file: { fileId: number }) => file.fileId)).size !== data.files.length) {
    throw new Error('업로드 응답을 확인하지 못했습니다. 첨부 목록을 다시 조회해주세요.');
  }
  return data.files;
}

export type MaterialDetail = Pick<ProcessMaterial, 'id' | 'type' | 'title' | 'description' | 'aiTool' | 'productionDate' | 'files'>;

export async function getMaterial(materialId: string, signal?: AbortSignal): Promise<MaterialDetail> {
  return requestMaterial(materialId, 'GET', undefined, signal);
}

export async function updateMaterial(materialId: string, input: Partial<CreateMaterialInput>): Promise<MaterialDetail> {
  if (input.title !== undefined && !input.title.trim()) throw new Error('자료 제목을 입력해주세요.');
  return requestMaterial(materialId, 'PATCH', input);
}

async function requestMaterial(materialId: string, method: 'GET' | 'PATCH', input?: Partial<CreateMaterialInput>, signal?: AbortSignal): Promise<MaterialDetail> {
  if (!/^[1-9]\d*$/.test(materialId) || BigInt(materialId) > 9223372036854775807n) throw new Error('창작 자료 ID 형식이 올바르지 않습니다.');
  const token = localStorage.getItem('accessToken')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('로그인이 필요합니다. 다시 로그인해주세요.');
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/materials/${materialId}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(method === 'PATCH' ? { 'Content-Type': 'application/json' } : {}) },
      ...(method === 'PATCH' ? { body: JSON.stringify(input) } : {}), signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('서버에 연결할 수 없습니다. 다시 시도해주세요.');
  }
  if (response.status !== 200) {
    const messages: Record<number, string> = {
      400: '창작 자료 ID 형식이 올바르지 않습니다.', 401: '인증에 실패했습니다. 다시 로그인해주세요.',
      403: '프로젝트에 접근할 권한이 없습니다.', 404: '창작 자료를 찾을 수 없습니다.',
      500: '서버 오류로 자료 정보를 불러오지 못했습니다.',
    };
    throw new Error(messages[response.status] ?? '자료 정보를 불러오지 못했습니다.');
  }
  const result = await response.json();
  const item = result?.data;
  const types = { INITIAL_SKETCH: 'sketch', AI_ASSISTED: 'ai', MANUAL_EDIT: 'manual' } as const;
  if (!item || !Number.isSafeInteger(item.materialId) || String(item.materialId) !== materialId ||
      typeof item.materialType !== 'string' || !Object.hasOwn(types, item.materialType) ||
      typeof item.title !== 'string' || !item.title.trim() ||
      (item.description != null && typeof item.description !== 'string') ||
      (item.usedAi != null && typeof item.usedAi !== 'string') ||
      (item.productionDate != null && (typeof item.productionDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.productionDate) || !Number.isFinite(Date.parse(item.productionDate)))) ||
      !Array.isArray(item.files) || item.files.some((file: any) => !file || !Number.isSafeInteger(file.fileId) || file.fileId <= 0 || typeof file.fileName !== 'string' || typeof file.imageUrl !== 'string')) {
    throw new Error('창작 자료 상세 응답 형식이 올바르지 않습니다.');
  }
  return {
    id: String(item.materialId), type: types[item.materialType as keyof typeof types],
    title: item.title, description: item.description ?? '', aiTool: item.usedAi ?? undefined,
    productionDate: item.productionDate ?? null, files: item.files,
  };
}

export async function getMaterials(projectId: string, signal?: AbortSignal): Promise<ProcessMaterial[]> {
  if (!/^[1-9]\d*$/.test(projectId) || BigInt(projectId) > 9223372036854775807n) throw new Error('프로젝트 ID 형식이 올바르지 않습니다.');
  const token = localStorage.getItem('accessToken')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('로그인이 필요합니다. 다시 로그인해주세요.');
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/materials`, {
      method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('서버에 연결할 수 없습니다. 다시 시도해주세요.');
  }
  if (response.status !== 200) {
    const messages: Record<number, string> = {
      400: '프로젝트 ID 형식이 올바르지 않습니다.',
      401: '인증에 실패했습니다. 다시 로그인해주세요.',
      403: '프로젝트에 접근할 권한이 없습니다.',
      404: '프로젝트를 찾을 수 없습니다.',
      500: '서버 오류로 자료 목록을 불러오지 못했습니다.',
    };
    throw new Error(messages[response.status] ?? '자료 목록을 불러오지 못했습니다.');
  }
  const result = await response.json();
  if (!Array.isArray(result?.data?.materials)) throw new Error('자료 목록 응답 형식이 올바르지 않습니다.');
  const materials: ProcessMaterial[] = result.data.materials.map((item: any) => {
    if (!item || !Number.isSafeInteger(item.materialId) || item.materialId <= 0 ||
        !Number.isSafeInteger(item.materialOrder) || item.materialOrder <= 0 ||
        typeof item.title !== 'string' || typeof item.createdAt !== 'string' || !Number.isFinite(Date.parse(item.createdAt)) ||
        (item.description != null && typeof item.description !== 'string') ||
        (item.productionDate != null && (typeof item.productionDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.productionDate) || !Number.isFinite(Date.parse(item.productionDate)))) ||
        !Array.isArray(item.files) || item.files.some((file: any) => !file || !Number.isSafeInteger(file.fileId) || file.fileId <= 0 || typeof file.fileName !== 'string' || typeof file.imageUrl !== 'string')) {
      throw new Error('자료 목록 항목 형식이 올바르지 않습니다.');
    }
    return {
      id: String(item.materialId), type: null, title: item.title,
      description: item.description ?? '', materialOrder: item.materialOrder,
      productionDate: item.productionDate ?? null,
      createdAt: item.createdAt, registeredAt: item.createdAt,
      files: item.files,
      imageName: item.files[0]?.fileName,
    };
  });
  if (new Set(materials.map((item) => item.id)).size !== materials.length) throw new Error('자료 ID가 중복된 응답입니다.');
  return materials.sort((a, b) => a.materialOrder! - b.materialOrder!);
}

export interface CreateMaterialInput {
  materialType: 'INITIAL_SKETCH' | 'AI_ASSISTED' | 'MANUAL_EDIT';
  title: string;
  description?: string | null;
  usedAi?: string | null;
  productionDate?: string | null;
}

export interface CreatedMaterial {
  materialId: number;
  projectId: number;
  title: string;
  files: unknown[];
}

export async function createMaterial(projectId: string, input: CreateMaterialInput): Promise<CreatedMaterial> {
  if (!/^[1-9]\d*$/.test(projectId) || BigInt(projectId) > 9223372036854775807n) {
    throw new Error('프로젝트 ID 형식이 올바르지 않습니다.');
  }
  const token = localStorage.getItem('accessToken')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('로그인이 필요합니다. 다시 로그인해주세요.');
  if (!input.title.trim() || !input.materialType.trim()) throw new Error('자료 제목과 자료 유형을 입력해주세요.');

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/materials`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...input, title: input.title.trim() }),
    });
  } catch {
    throw new Error('서버에 연결할 수 없습니다. 다시 시도해주세요.');
  }
  if (response.status !== 201) {
    const messages: Record<number, string> = {
      400: '창작 자료 입력값을 확인해주세요.',
      401: '인증이 만료되었거나 유효하지 않습니다. 다시 로그인해주세요.',
      403: '이 프로젝트에 접근할 권한이 없습니다.',
      404: '프로젝트를 찾을 수 없습니다.',
      500: '서버 오류로 창작 자료를 등록하지 못했습니다.',
    };
    throw new Error(messages[response.status] ?? '창작 자료를 등록하지 못했습니다.');
  }
  const result = await response.json();
  const data = result?.data;
  if (!data || !Number.isSafeInteger(data.materialId) || data.materialId <= 0 ||
      !Number.isSafeInteger(data.projectId) || String(data.projectId) !== projectId ||
      typeof data.title !== 'string' || !data.title.trim() || !Array.isArray(data.files)) {
    throw new Error('창작 자료 등록 응답을 확인하지 못했습니다. 등록 여부를 확인해주세요.');
  }
  return data;
}
