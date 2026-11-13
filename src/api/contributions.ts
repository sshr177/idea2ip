const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export interface GenerateContributionsInput {
  requestId: string;
  expectedRevision: number;
  retry?: boolean | null;
}

export interface ContributionEdits {
  aiUsage?: { tools?: string[]; purpose?: string | null; outputUsage?: string | null } | null;
  humanCreatedElements?: string[] | null;
  humanEdits?: string[] | null;
}
export interface ReviewContributionsInput {
  expectedRevision: number;
  changes: { stepId: number; decision: 'EDIT' | 'EXCLUDE' | 'CONFIRM'; edits?: ContributionEdits | null }[];
  finalize?: boolean | null;
  noContributionReason?: string | null;
}

export async function updateContributions(projectId: string, input: ReviewContributionsInput): Promise<ContributionReview> {
  if (!/^[1-9]\d*$/.test(projectId) || BigInt(projectId) > 9223372036854775807n) throw new Error('프로젝트 ID 형식이 올바르지 않습니다.');
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 || !Array.isArray(input.changes) || input.changes.length > 500 ||
      new Set(input.changes.map((change) => change.stepId)).size !== input.changes.length ||
      input.changes.some((change) => !Number.isSafeInteger(change.stepId) || !['EDIT','EXCLUDE','CONFIRM'].includes(change.decision) ||
        (change.decision === 'EDIT' && !change.edits) || (change.decision === 'EXCLUDE' && change.edits != null)) ||
      (input.noContributionReason != null && input.noContributionReason.length > 2000)) throw new Error('검토 리비전, 단계 결정 또는 확정 사유를 확인해주세요.');
  const token = localStorage.getItem('accessToken')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new ContributionGenerationError(401, '로그인이 필요합니다.');
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/contributions`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(input),
    });
  } catch { throw new Error('연결 오류로 저장 여부를 확인하지 못했습니다. 목록을 다시 확인해주세요.'); }
  if (response.status !== 200) {
    const body = await response.json().catch(() => null);
    const code = typeof body?.code === 'string' ? body.code : undefined;
    const messages: Record<string, string> = {
      INVALID_CONTRIBUTION_CHANGE: '수정 내용 또는 단계 결정을 확인해주세요.',
      CONTRIBUTION_DECISION_REQUIRED: '모든 단계의 검토 결정을 완료해주세요.',
      NO_CONTRIBUTION_REASON_REQUIRED: '확정할 기여가 없는 사유를 입력해주세요.',
      CONTRIBUTION_STEP_NOT_FOUND: '해당 단계를 찾을 수 없습니다.',
      INTERVIEW_NOT_COMPLETED: '인터뷰를 먼저 완료해주세요.',
      STALE_REVIEW_REVISION: '검토 정보가 변경됐습니다. 창을 닫고 최신 목록을 확인한 뒤 다시 편집해주세요.',
    };
    const statuses: Record<number, string> = { 400: '검토 입력값을 확인해주세요.', 401: '다시 로그인해주세요.', 403: '수정 권한이 없습니다.', 404: '프로젝트 또는 단계가 없습니다.', 409: '검토 상태가 충돌합니다. 최신 목록을 확인해주세요.', 500: '서버 오류로 저장하지 못했습니다.' };
    throw new ContributionGenerationError(response.status, messages[code ?? ''] ?? statuses[response.status] ?? '검토 저장에 실패했습니다.', code);
  }
  const result = await response.json();
  return parseContributionReview(result?.data);
}
export interface ContributionGeneration {
  generationId: number;
  requestId: string;
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  failure: { code: string; message: string; retryable: boolean } | null;
}

export interface ContributionReview {
  reviewStatus: 'NOT_STARTED' | 'IN_REVIEW' | 'CONFIRMED';
  revision: number;
  timeline: { stepId: number; order: number; kind: 'MATERIAL' | 'FINAL_ARTWORK' | 'INTERVIEW_STATEMENT'; title: string; reviewStatus: 'UNREVIEWED' | 'EDITED' | 'CONFIRMED' | 'EXCLUDED' }[];
  unresolvedFields: string[];
  latestGeneration: ContributionGeneration | null;
}

export type ContributionStepDetail = ContributionReview['timeline'][number] & {
  materialRefs: { materialId: number; title: string; files: { fileId: number; originalFileName: string; fileUrl: string }[] }[];
  finalArtworkRef: { artworkId: number; title: string; fileUrl: string | null } | null;
  aiUsage: { tools: string[]; purpose: string | null; outputUsage: string | null } | null;
  humanCreatedElements: string[];
  humanEdits: string[];
  sources: { sourceId: string; kind: string; title: string; quote: string | null; locator: string | null; officialUrl: string | null; edition: string | null; effectiveFrom: string | null; effectiveTo: string | null; publisher: string | null; publishedOn: string | null; retrievedOn: string | null }[];
}

export async function getContributionStep(projectId: string, stepId: number, signal?: AbortSignal): Promise<ContributionStepDetail> {
  if (!/^[1-9]\d*$/.test(projectId) || BigInt(projectId) > 9223372036854775807n || !Number.isSafeInteger(stepId)) throw new Error('프로젝트 또는 단계 ID 형식이 올바르지 않습니다.');
  const token = localStorage.getItem('accessToken')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('로그인이 필요합니다.');
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/contributions/steps/${stepId}`, {
      method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, cache: 'no-store', signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('서버에 연결할 수 없어 단계 정보를 불러오지 못했습니다.');
  }
  if (response.status !== 200) {
    const messages: Record<number, string> = { 401: '인증에 실패했습니다. 다시 로그인해주세요.', 403: '프로젝트에 접근할 권한이 없습니다.', 404: '프로젝트 또는 해당 기여 단계를 찾을 수 없습니다.', 500: '서버 오류로 단계 정보를 불러오지 못했습니다.' };
    throw new Error(messages[response.status] ?? '기여 단계 조회에 실패했습니다.');
  }
  const body = await response.json();
  const data = body?.data;
  const id = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
  const nullableText = (value: unknown) => value === null || typeof value === 'string';
  const texts = (value: unknown) => Array.isArray(value) && value.every((text) => typeof text === 'string');
  if (!data || data.stepId !== stepId || !id(data.order) || typeof data.title !== 'string' ||
      !['MATERIAL','FINAL_ARTWORK','INTERVIEW_STATEMENT'].includes(data.kind) || !['UNREVIEWED','EDITED','CONFIRMED','EXCLUDED'].includes(data.reviewStatus) ||
      !Array.isArray(data.materialRefs) || data.materialRefs.some((ref: any) => !ref || !id(ref.materialId) || typeof ref.title !== 'string' || !Array.isArray(ref.files) || ref.files.some((file: any) => !file || !id(file.fileId) || typeof file.originalFileName !== 'string' || typeof file.fileUrl !== 'string')) ||
      (data.finalArtworkRef !== null && (!data.finalArtworkRef || !id(data.finalArtworkRef.artworkId) || typeof data.finalArtworkRef.title !== 'string' || !nullableText(data.finalArtworkRef.fileUrl))) ||
      (data.aiUsage !== null && (!data.aiUsage || !texts(data.aiUsage.tools) || !nullableText(data.aiUsage.purpose) || !nullableText(data.aiUsage.outputUsage))) ||
      !texts(data.humanCreatedElements) || !texts(data.humanEdits) || !Array.isArray(data.sources) ||
      data.sources.some((source: any) => !source || typeof source.sourceId !== 'string' || typeof source.kind !== 'string' || typeof source.title !== 'string' || ['quote','locator','officialUrl','edition','effectiveFrom','effectiveTo','publisher','publishedOn','retrievedOn'].some((key) => !nullableText(source[key])))) {
    throw new Error('기여 단계 상세 응답 형식이 올바르지 않습니다.');
  }
  return data;
}

export async function getContributions(projectId: string, signal?: AbortSignal): Promise<ContributionReview> {
  if (!/^[1-9]\d*$/.test(projectId) || BigInt(projectId) > 9223372036854775807n) throw new Error('프로젝트 ID 형식이 올바르지 않습니다.');
  const token = localStorage.getItem('accessToken')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('로그인이 필요합니다.');
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/contributions`, {
      method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, cache: 'no-store', signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('서버에 연결할 수 없어 기여 목록을 불러오지 못했습니다.');
  }
  if (response.status !== 200) {
    const messages: Record<number, string> = { 401: '인증에 실패했습니다. 다시 로그인해주세요.', 403: '프로젝트에 접근할 권한이 없습니다.', 404: '프로젝트를 찾을 수 없습니다.', 500: '서버 오류로 기여 목록을 불러오지 못했습니다.' };
    throw new Error(messages[response.status] ?? '기여 목록을 불러오지 못했습니다.');
  }
  const result = await response.json();
  const data = result?.data;
  return parseContributionReview(data);
}

function parseContributionReview(data: any): ContributionReview {
  const job = data?.latestGeneration;
  if (!data || !['NOT_STARTED','IN_REVIEW','CONFIRMED'].includes(data.reviewStatus) || !Number.isSafeInteger(data.revision) || data.revision < 0 ||
      !Array.isArray(data.timeline) || data.timeline.some((step: any) => !step || !Number.isSafeInteger(step.stepId) || !Number.isSafeInteger(step.order) || step.order <= 0 ||
        !['MATERIAL','FINAL_ARTWORK','INTERVIEW_STATEMENT'].includes(step.kind) || typeof step.title !== 'string' || !['UNREVIEWED','EDITED','CONFIRMED','EXCLUDED'].includes(step.reviewStatus)) ||
      new Set(data.timeline.map((step: any) => step.stepId)).size !== data.timeline.length ||
      !Array.isArray(data.unresolvedFields) || data.unresolvedFields.some((field: unknown) => typeof field !== 'string') ||
      (job !== null && (!job || !Number.isSafeInteger(job.generationId) || job.generationId <= 0 || typeof job.requestId !== 'string' ||
        !['QUEUED','RUNNING','SUCCEEDED','FAILED'].includes(job.status) ||
        (job.failure !== null && (!job.failure || typeof job.failure.code !== 'string' || typeof job.failure.message !== 'string' || typeof job.failure.retryable !== 'boolean')) ||
        (job.status === 'FAILED' && !job.failure)))) throw new Error('기여 목록 응답 형식이 올바르지 않습니다.');
  return { ...data, timeline: [...data.timeline].sort((a, b) => a.order - b.order) };
}
export class ContributionGenerationError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function generateContributions(projectId: string, input: GenerateContributionsInput): Promise<ContributionGeneration> {
  if (!/^[1-9]\d*$/.test(projectId) || BigInt(projectId) > 9223372036854775807n) throw new Error('프로젝트 ID 형식이 올바르지 않습니다.');
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.requestId) ||
      (input.retry != null && typeof input.retry !== 'boolean')) throw new Error('요청 UUID와 검토 리비전을 확인해주세요.');
  const token = localStorage.getItem('accessToken')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new ContributionGenerationError(401, '로그인이 필요합니다.');
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/contributions/generations`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(input),
    });
  } catch {
    throw new ContributionGenerationError(0, '연결 오류로 작업 접수 여부를 확인하지 못했습니다. 동일 요청으로 확인해주세요.');
  }
  if (response.status !== 200 && response.status !== 202) {
    const body = await response.json().catch(() => null);
    const code = typeof body?.code === 'string' ? body.code : undefined;
    const messages: Record<string, string> = {
      INTERVIEW_NOT_COMPLETED: '인터뷰를 완료한 뒤 기여 후보를 생성해주세요.',
      STALE_REVIEW_REVISION: '검토 정보가 변경되었습니다. 목록을 다시 조회해주세요.',
      CONTRIBUTION_JOB_IN_PROGRESS: '기여 후보 생성 작업이 이미 진행 중입니다.',
      REQUEST_ID_CONFLICT: '요청 ID가 다른 요청과 충돌합니다. 최신 상태를 확인해주세요.',
      RETRY_REQUEST_NOT_FOUND: '재시도할 기존 요청을 찾을 수 없습니다.',
    };
    const statuses: Record<number, string> = {
      400: '생성 요청 정보를 확인해주세요.', 401: '인증에 실패했습니다. 다시 로그인해주세요.',
      403: '프로젝트에 접근할 권한이 없습니다.', 404: '프로젝트를 찾을 수 없습니다.',
      409: '요청이 현재 검토 상태와 충돌합니다. 목록을 다시 조회해주세요.', 500: '서버 오류로 생성 요청을 처리하지 못했습니다.',
    };
    throw new ContributionGenerationError(response.status, messages[code ?? ''] ?? statuses[response.status] ?? '기여 후보 생성에 실패했습니다.', code);
  }
  const body = await response.json();
  const data = body?.data;
  if (!data || !Number.isSafeInteger(data.generationId) || data.generationId <= 0 || data.requestId !== input.requestId ||
      !['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED'].includes(data.status) ||
      (data.failure !== null && (!data.failure || typeof data.failure.code !== 'string' || typeof data.failure.message !== 'string' || typeof data.failure.retryable !== 'boolean')) ||
      (data.status === 'FAILED' && !data.failure)) throw new ContributionGenerationError(0, '작업 응답을 확인하지 못했습니다. 동일 요청으로 다시 확인해주세요.');
  return data;
}
