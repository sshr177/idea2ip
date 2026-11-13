const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export const REPORT_SECTION_LABELS = { WORK_OVERVIEW: '작품 개요', AI_USAGE: 'AI 활용', HUMAN_CONTRIBUTION: '창작 기여', EVIDENCE_SUMMARY: '근거 요약', GAPS_AND_GUIDANCE: '추가 확인 및 보완' } as const;
export type EditableReportSection = 'WORK_OVERVIEW' | 'AI_USAGE' | 'HUMAN_CONTRIBUTION';
export interface ReportVersionRequest {
  requestId: string;
  operation: 'GENERATE' | 'UPDATE' | 'EDIT';
  baseVersionId?: number | null;
  editedSections?: { sectionKey: EditableReportSection; paragraphs: string[] }[] | null;
  retry?: boolean | null;
}
export interface ReportVersion {
  versionId: number; versionNo: number; operation: ReportVersionRequest['operation'];
  status: 'QUEUED' | 'RUNNING' | 'READY' | 'FAILED';
  stage: 'COLLECTING_INPUT' | 'LINKING_SOURCES' | 'DRAFTING' | 'RENDERING_PDF' | null;
  createdAt: string; readyAt: string | null; updatedAt: string;
  pdfAvailable: boolean; baseVersionId: number | null; inputRevision: number;
  sections: { sectionKey: keyof typeof REPORT_SECTION_LABELS; title: string; paragraphs: string[]; sourceIds: string[]; userEdited: boolean }[];
  sources: { sourceId: string; kind: string; title: string; quote?: string | null; locator?: string | null; [key: string]: unknown }[];
  reviewFlags: { sectionKey: string; code: string; sourceIds: string[]; retainedUserParagraphs: string[] }[];
  failure: { code: string; message: string; retryable: boolean } | null;
  schemaVersion: string | null; templateVersion: string | null; mode: 'live' | 'mock' | null;
}
export class ReportRequestError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(status: number, message: string, code?: string) { super(message); this.status = status; this.code = code; }
}

export async function requestReportVersion(projectId: string, input: ReportVersionRequest): Promise<ReportVersion> {
  const positive = (id: unknown) => typeof id === 'number' && Number.isSafeInteger(id) && id > 0;
  const strings = (value: unknown) => Array.isArray(value) && value.every((item) => typeof item === 'string');
  if (!/^[1-9]\d*$/.test(projectId) || BigInt(projectId) > 9223372036854775807n ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.requestId) ||
      !['GENERATE','UPDATE','EDIT'].includes(input.operation) ||
      (input.operation !== 'GENERATE' && !positive(input.baseVersionId)) ||
      (input.operation === 'GENERATE' && input.baseVersionId != null) ||
      (input.operation === 'EDIT' && (!Array.isArray(input.editedSections) || !input.editedSections.length || input.editedSections.length > 3 ||
        new Set(input.editedSections.map((section) => section.sectionKey)).size !== input.editedSections.length ||
        input.editedSections.some((section) => !['WORK_OVERVIEW','AI_USAGE','HUMAN_CONTRIBUTION'].includes(section.sectionKey) || !strings(section.paragraphs) || section.paragraphs.length < 1 || section.paragraphs.length > 100 || section.paragraphs.some((p) => p.length > 8000)))) ||
      (input.retry != null && typeof input.retry !== 'boolean')) throw new Error('리포트 요청 UUID, 기준 버전 또는 편집 단락을 확인해주세요.');
  const token = localStorage.getItem('accessToken')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new ReportRequestError(401, '로그인이 필요합니다.');
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/report/versions`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(input),
    });
  } catch { throw new ReportRequestError(0, '접수 여부를 확인하지 못했습니다. 동일 요청으로 다시 확인해주세요.'); }
  if (![200,202].includes(response.status)) {
    const body = await response.json().catch(() => null);
    const code = typeof body?.code === 'string' ? body.code : undefined;
    const messages: Record<string, string> = {
      REPORT_NOT_READY: '리포트 생성 준비 조건을 확인해주세요.', NO_REPORT_INPUT_CHANGES: '새로 반영할 입력 변경이 없습니다.',
      REPORT_ALREADY_EXISTS: '이미 리포트가 있습니다. 최신 버전을 조회한 뒤 업데이트해주세요.', STALE_BASE_VERSION: '기준 버전이 최신 버전이 아닙니다. 최신 버전을 다시 조회해주세요.',
      REPORT_JOB_IN_PROGRESS: '리포트 작업이 이미 진행 중입니다.', REQUEST_ID_CONFLICT: '동일 요청 ID에 다른 내용이 사용됐습니다.', RETRY_REQUEST_NOT_FOUND: '재시도할 기존 요청을 찾을 수 없습니다.', INVALID_REPORT_REQUEST: '리포트 요청 내용을 확인해주세요.',
    };
    const statuses: Record<number, string> = { 400: '리포트 입력값을 확인해주세요.', 401: '다시 로그인해주세요.', 403: '프로젝트 접근 권한이 없습니다.', 404: '프로젝트를 찾을 수 없습니다.', 409: '현재 리포트 상태와 충돌합니다.', 500: '서버 오류가 발생했습니다.' };
    throw new ReportRequestError(response.status, messages[code ?? ''] ?? statuses[response.status] ?? '리포트 요청에 실패했습니다.', code);
  }
  const body = await response.json();
  const data = body?.data;
  return parseReportVersion(data, { operation: input.operation });
}

function parseReportVersion(data: any, expected: { operation?: string; versionId?: number }): ReportVersion {
  const positive = (id: unknown) => typeof id === 'number' && Number.isSafeInteger(id) && id > 0;
  const strings = (value: unknown) => Array.isArray(value) && value.every((item) => typeof item === 'string');
  const date = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value));
  if (!data || !positive(data.versionId) || !positive(data.versionNo) || !['GENERATE','UPDATE','EDIT'].includes(data.operation) || (expected.operation !== undefined && data.operation !== expected.operation) || (expected.versionId !== undefined && data.versionId !== expected.versionId) ||
      !['QUEUED','RUNNING','READY','FAILED'].includes(data.status) ||
      (data.stage !== null && !['COLLECTING_INPUT','LINKING_SOURCES','DRAFTING','RENDERING_PDF'].includes(data.stage)) ||
      !date(data.createdAt) || !date(data.updatedAt) || (data.readyAt !== null && !date(data.readyAt)) || typeof data.pdfAvailable !== 'boolean' ||
      (data.baseVersionId !== null && !positive(data.baseVersionId)) || !Number.isSafeInteger(data.inputRevision) || data.inputRevision < 0 ||
      !Array.isArray(data.sections) || data.sections.some((s: any) => !s || !Object.hasOwn(REPORT_SECTION_LABELS,s.sectionKey) || typeof s.title !== 'string' || !strings(s.paragraphs) || !strings(s.sourceIds) || typeof s.userEdited !== 'boolean') ||
      !Array.isArray(data.sources) || data.sources.some((s: any) => !s || typeof s.sourceId !== 'string' || typeof s.title !== 'string' || typeof s.kind !== 'string') ||
      !Array.isArray(data.reviewFlags) || data.reviewFlags.some((f: any) => !f || typeof f.sectionKey !== 'string' || typeof f.code !== 'string' || !strings(f.sourceIds) || !strings(f.retainedUserParagraphs)) ||
      (data.failure !== null && (!data.failure || typeof data.failure.code !== 'string' || typeof data.failure.message !== 'string' || typeof data.failure.retryable !== 'boolean')) ||
      (data.status === 'FAILED' && !data.failure) || ['schemaVersion','templateVersion'].some((key) => data[key] !== null && typeof data[key] !== 'string') ||
      (data.mode !== null && !['live','mock'].includes(data.mode))) throw new ReportRequestError(0, '리포트 응답을 확인하지 못했습니다. 동일 요청으로 다시 확인해주세요.');
  return data;
}

export interface ReportCheck {
  code: string;
  status: 'READY' | 'BLOCKED' | 'WARNING';
  message: string;
}

export async function getReportPdf(projectId: string, versionId: number, signal?: AbortSignal): Promise<{ blob: Blob; fileName: string }> {
  if (!/^[1-9]\d*$/.test(projectId) || BigInt(projectId) > 9223372036854775807n || !Number.isSafeInteger(versionId) || versionId <= 0) throw new Error('프로젝트 또는 버전 ID 형식이 올바르지 않습니다.');
  const token = localStorage.getItem('accessToken')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('로그인이 필요합니다.');
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/report/versions/${versionId}/pdf`, {
      method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/pdf' }, cache: 'no-store', signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('서버에 연결할 수 없어 PDF를 다운로드하지 못했습니다.');
  }
  if (response.status !== 200) {
    const messages: Record<number, string> = { 401: '인증에 실패했습니다. 다시 로그인해주세요.', 403: '프로젝트 접근 권한이 없습니다.', 404: '프로젝트 또는 리포트 버전을 찾을 수 없습니다.', 409: 'PDF가 아직 준비되지 않았습니다. 버전 상태를 확인해주세요.', 500: '서버에서 PDF를 읽지 못했습니다.' };
    throw new Error(messages[response.status] ?? 'PDF 다운로드에 실패했습니다.');
  }
  if (response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/pdf') throw new Error('서버가 PDF 형식의 파일을 반환하지 않았습니다.');
  const blob = await response.blob();
  if (!blob.size) throw new Error('PDF 파일이 비어 있습니다.');
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const encoded = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(disposition)?.[1];
  const name = /filename\s*=\s*(?:"([^"]*)"|([^;]+))/i.exec(disposition);
  let fileName = name?.[1] ?? name?.[2] ?? `copyright-brief-version-${versionId}.pdf`;
  if (encoded) { try { fileName = decodeURIComponent(encoded.trim()); } catch { /* Keep the plain filename or fallback. */ } }
  fileName = Array.from(fileName.trim()).map((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 || '\\/<>:"|?*'.includes(char) ? '_' : char).join('').slice(0, 180);
  if (!fileName || /^\.+$/.test(fileName)) fileName = `copyright-brief-version-${versionId}.pdf`;
  if (!fileName.toLowerCase().endsWith('.pdf')) fileName += '.pdf';
  return { blob, fileName };
}

export async function getReportVersion(projectId: string, versionId: number, signal?: AbortSignal): Promise<ReportVersion> {
  if (!/^[1-9]\d*$/.test(projectId) || BigInt(projectId) > 9223372036854775807n || !Number.isSafeInteger(versionId) || versionId <= 0) throw new Error('프로젝트 또는 버전 ID 형식이 올바르지 않습니다.');
  const token = localStorage.getItem('accessToken')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('로그인이 필요합니다.');
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/report/versions/${versionId}`, {
      method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, cache: 'no-store', signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('서버에 연결할 수 없어 리포트 버전을 불러오지 못했습니다.');
  }
  if (response.status !== 200) {
    const messages: Record<number, string> = { 401: '인증에 실패했습니다. 다시 로그인해주세요.', 403: '프로젝트 접근 권한이 없습니다.', 404: '프로젝트 또는 해당 버전을 찾을 수 없습니다.', 500: '서버 오류로 버전을 불러오지 못했습니다.' };
    throw new Error(messages[response.status] ?? '리포트 버전 조회에 실패했습니다.');
  }
  const body = await response.json();
  return parseReportVersion(body?.data, { versionId });
}
export interface ReportReadiness {
  canGenerate: boolean;
  checks: ReportCheck[];
  blockingReasons: ReportCheck[];
  warnings: ReportCheck[];
  inputRevision: number;
}

export type ReportVersionSummary = Pick<ReportVersion, 'versionId' | 'versionNo' | 'operation' | 'status' | 'stage' | 'createdAt' | 'readyAt' | 'pdfAvailable'>;
export interface ReportVersionPage {
  versions: ReportVersionSummary[];
  nextBeforeVersionNo: number | null;
}

export async function getReportVersions(projectId: string, options: { beforeVersionNo?: number | null; limit?: number } = {}, signal?: AbortSignal): Promise<ReportVersionPage> {
  const limit = options.limit ?? 20;
  const before = options.beforeVersionNo;
  if (!/^[1-9]\d*$/.test(projectId) || BigInt(projectId) > 9223372036854775807n ||
      !Number.isInteger(limit) || limit < 1 || limit > 100 ||
      (before != null && (!Number.isSafeInteger(before) || before <= 0))) throw new Error('프로젝트 ID와 페이지 조회 범위를 확인해주세요.');
  const token = localStorage.getItem('accessToken')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('로그인이 필요합니다.');
  const query = new URLSearchParams({ limit: String(limit) });
  if (before != null) query.set('beforeVersionNo', String(before));
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/report/versions?${query}`, {
      method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, cache: 'no-store', signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('서버에 연결할 수 없어 버전 목록을 불러오지 못했습니다.');
  }
  if (response.status !== 200) {
    const messages: Record<number, string> = { 400: '페이지 조회 범위를 확인해주세요.', 401: '인증에 실패했습니다. 다시 로그인해주세요.', 403: '프로젝트 접근 권한이 없습니다.', 404: '프로젝트를 찾을 수 없습니다.', 500: '서버 오류로 버전 목록을 불러오지 못했습니다.' };
    throw new Error(messages[response.status] ?? '버전 목록을 불러오지 못했습니다.');
  }
  const body = await response.json();
  const data = body?.data;
  const positive = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n > 0;
  const date = (s: unknown) => typeof s === 'string' && Number.isFinite(Date.parse(s));
  if (!data || !Array.isArray(data.versions) || data.versions.length > limit ||
      data.versions.some((v: any) => !v || !positive(v.versionId) || !positive(v.versionNo) || (before != null && v.versionNo >= before) ||
        !['GENERATE','UPDATE','EDIT'].includes(v.operation) || !['QUEUED','RUNNING','READY','FAILED'].includes(v.status) ||
        (v.stage !== null && !['COLLECTING_INPUT','LINKING_SOURCES','DRAFTING','RENDERING_PDF'].includes(v.stage)) ||
        !date(v.createdAt) || (v.readyAt !== null && !date(v.readyAt)) || typeof v.pdfAvailable !== 'boolean') ||
      new Set(data.versions.map((v: any) => v.versionId)).size !== data.versions.length || new Set(data.versions.map((v: any) => v.versionNo)).size !== data.versions.length ||
      (data.nextBeforeVersionNo !== null && (!positive(data.nextBeforeVersionNo) || !data.versions.length || (before != null && data.nextBeforeVersionNo >= before)))) throw new Error('리포트 버전 목록 응답 형식이 올바르지 않습니다.');
  return { versions: [...data.versions].sort((a, b) => b.versionNo - a.versionNo), nextBeforeVersionNo: data.nextBeforeVersionNo };
}
export interface ReportOverview {
  reportStatus: 'NOT_STARTED' | 'GENERATING' | 'READY' | 'FAILED';
  latestReadyVersion: ReportVersionSummary | null;
  activeVersion: ReportVersionSummary | null;
  lastFailedVersion: ReportVersionSummary | null;
  canUpdate: boolean;
  changeSummary: { fromRevision: number; toRevision: number; changes: { type: string; added: number; updated: number; deleted: number }[] } | null;
}

export async function getReportOverview(projectId: string, signal?: AbortSignal): Promise<ReportOverview> {
  if (!/^[1-9]\d*$/.test(projectId) || BigInt(projectId) > 9223372036854775807n) throw new Error('프로젝트 ID 형식이 올바르지 않습니다.');
  const token = localStorage.getItem('accessToken')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('로그인이 필요합니다.');
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/report`, {
      method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, cache: 'no-store', signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('서버에 연결할 수 없어 리포트 현황을 불러오지 못했습니다.');
  }
  if (response.status !== 200) {
    const messages: Record<number, string> = { 401: '인증에 실패했습니다. 다시 로그인해주세요.', 403: '프로젝트에 접근할 권한이 없습니다.', 404: '프로젝트를 찾을 수 없습니다.', 500: '서버 오류로 리포트 현황을 불러오지 못했습니다.' };
    throw new Error(messages[response.status] ?? '리포트 현황을 불러오지 못했습니다.');
  }
  const body = await response.json();
  const data = body?.data;
  const natural = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
  const date = (s: unknown) => typeof s === 'string' && Number.isFinite(Date.parse(s));
  const summary = (v: any) => v === null || (v && natural(v.versionId) && v.versionId > 0 && natural(v.versionNo) && v.versionNo > 0 &&
    ['GENERATE','UPDATE','EDIT'].includes(v.operation) && ['QUEUED','RUNNING','READY','FAILED'].includes(v.status) &&
    (v.stage === null || ['COLLECTING_INPUT','LINKING_SOURCES','DRAFTING','RENDERING_PDF'].includes(v.stage)) && date(v.createdAt) && (v.readyAt === null || date(v.readyAt)) && typeof v.pdfAvailable === 'boolean');
  const changes = data?.changeSummary;
  if (!data || !['NOT_STARTED','GENERATING','READY','FAILED'].includes(data.reportStatus) || typeof data.canUpdate !== 'boolean' ||
      !summary(data.latestReadyVersion) || !summary(data.activeVersion) || !summary(data.lastFailedVersion) ||
      (data.latestReadyVersion && data.latestReadyVersion.status !== 'READY') ||
      (data.activeVersion && !['QUEUED','RUNNING'].includes(data.activeVersion.status)) ||
      (data.lastFailedVersion && data.lastFailedVersion.status !== 'FAILED') ||
      (changes !== null && (!changes || !natural(changes.fromRevision) || !natural(changes.toRevision) || !Array.isArray(changes.changes) ||
        changes.changes.some((item: any) => !item || typeof item.type !== 'string' || !natural(item.added) || !natural(item.updated) || !natural(item.deleted))))) throw new Error('리포트 현황 응답 형식이 올바르지 않습니다.');
  return data;
}

export async function getReportReadiness(projectId: string, signal?: AbortSignal): Promise<ReportReadiness> {
  if (!/^[1-9]\d*$/.test(projectId) || BigInt(projectId) > 9223372036854775807n) throw new Error('프로젝트 ID 형식이 올바르지 않습니다.');
  const token = localStorage.getItem('accessToken')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('로그인이 필요합니다.');
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/report/readiness`, {
      method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, cache: 'no-store', signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('서버에 연결할 수 없어 리포트 준비 상태를 불러오지 못했습니다.');
  }
  if (response.status !== 200) {
    const messages: Record<number, string> = { 401: '인증에 실패했습니다. 다시 로그인해주세요.', 403: '프로젝트에 접근할 권한이 없습니다.', 404: '프로젝트를 찾을 수 없습니다.', 500: '서버 오류로 리포트 준비 상태를 불러오지 못했습니다.' };
    throw new Error(messages[response.status] ?? '리포트 준비 상태를 불러오지 못했습니다.');
  }
  const result = await response.json();
  const data = result?.data;
  const validChecks = (items: any) => Array.isArray(items) && items.every((item: any) => item && typeof item.code === 'string' && ['READY','BLOCKED','WARNING'].includes(item.status) && typeof item.message === 'string');
  if (!data || typeof data.canGenerate !== 'boolean' || !Number.isSafeInteger(data.inputRevision) || data.inputRevision < 0 ||
      !validChecks(data.checks) || !validChecks(data.blockingReasons) || !validChecks(data.warnings)) throw new Error('리포트 준비 상태 응답 형식이 올바르지 않습니다.');
  return data;
}
