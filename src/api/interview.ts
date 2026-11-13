const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export const INTERVIEW_FIELD_LABELS = {
  AI_TOOL: '사용한 AI 도구', AI_PURPOSE: 'AI 활용 목적', AI_OUTPUT_USAGE: 'AI 산출물 활용 방식',
  HUMAN_CREATED_ELEMENT: '직접 창작한 요소', HUMAN_EDITED_EXPRESSION: '직접 수정한 표현',
} as const;
export const INTERVIEW_STATUS_LABELS = {
  MISSING: '미입력', NEEDS_REVIEW: '보완 필요', COMPLETED: '완료', NOT_APPLICABLE: '해당 없음',
} as const;
export interface InterviewReadiness {
  canStart: boolean;
  fieldStates: { field: keyof typeof INTERVIEW_FIELD_LABELS; status: keyof typeof INTERVIEW_STATUS_LABELS; summary: string | null }[];
  materialChecks: { materialType: string; ready: boolean }[];
  blockingReasons: { materialType: string; message: string }[];
  warnings: { materialType: string; message: string }[];
}

export interface ServerInterview {
  interviewId: number | null;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  fieldStates: InterviewReadiness['fieldStates'];
  currentQuestion: {
    messageId: number; content: string; targetField: keyof typeof INTERVIEW_FIELD_LABELS;
    reason: string | null;
    materialRefs: { sourceId: string | number | null; materialId: number | null; fileId: number | null; title: string }[];
  } | null;
  nextQuestionPending: boolean;
}

export interface ServerInterviewMessage {
  messageId: number;
  role: 'ASSISTANT' | 'USER';
  content: string;
  sequenceNo: number;
  targetField: keyof typeof INTERVIEW_FIELD_LABELS;
  replyToQuestionId: number | null;
  createdAt: string;
}

export interface InterviewAnswerInput {
  questionId: number;
  content: string;
  requestId: string;
}

export class InterviewAnswerError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function submitInterviewAnswer(projectId: string, input: InterviewAnswerInput): Promise<{ answerMessageId: number; interview: ServerInterview }> {
  if (!/^[1-9]\d*$/.test(projectId) || BigInt(projectId) > 9223372036854775807n) throw new Error('프로젝트 ID 형식이 올바르지 않습니다.');
  if (!Number.isSafeInteger(input.questionId) || input.questionId <= 0 || !input.content.trim() || input.content.length > 8000 ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.requestId)) throw new Error('질문 ID, 답변 길이(최대 8,000자), 요청 ID를 확인해주세요.');
  const token = localStorage.getItem('accessToken')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new InterviewAnswerError(401, '로그인이 필요합니다.');
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/interview/answers`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(input),
    });
  } catch {
    throw new InterviewAnswerError(0, '연결 오류로 저장 여부를 확인하지 못했습니다. 같은 답변으로 재시도해주세요.');
  }
  if (response.status !== 200) {
    const messages: Record<number, string> = {
      400: '답변 입력값을 확인해주세요.', 401: '인증에 실패했습니다. 다시 로그인해주세요.',
      403: '프로젝트에 접근할 권한이 없습니다.', 404: '프로젝트 또는 해당 인터뷰의 질문을 찾을 수 없습니다.',
      409: '현재 질문이 아니거나 요청 ID가 충돌합니다. 인터뷰 상태를 새로고침해주세요.',
      500: '서버 오류가 발생했습니다. 같은 답변으로 재시도해주세요.',
      503: '답변은 저장됐지만 다음 질문 생성에 실패했습니다. 같은 답변으로 재시도해주세요.',
    };
    throw new InterviewAnswerError(response.status, messages[response.status] ?? '답변을 제출하지 못했습니다.');
  }
  try {
    const result = await response.json();
    if (!Number.isSafeInteger(result?.data?.answerMessageId) || result.data.answerMessageId <= 0) throw new Error();
    return { answerMessageId: result.data.answerMessageId, interview: validateServerInterview(result.data.interview) };
  } catch {
    throw new InterviewAnswerError(0, '저장 응답을 확인하지 못했습니다. 같은 답변으로 재시도하거나 상태를 새로고침해주세요.');
  }
}

export async function getInterviewMessages(projectId: string, signal?: AbortSignal): Promise<ServerInterviewMessage[]> {
  if (!/^[1-9]\d*$/.test(projectId) || BigInt(projectId) > 9223372036854775807n) throw new Error('프로젝트 ID 형식이 올바르지 않습니다.');
  const token = localStorage.getItem('accessToken')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('로그인이 필요합니다. 다시 로그인해주세요.');
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/interview/messages`, {
      method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, cache: 'no-store', signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('서버에 연결할 수 없어 대화 내역을 불러오지 못했습니다.');
  }
  if (response.status !== 200) {
    const messages: Record<number, string> = {
      401: '인증에 실패했습니다. 다시 로그인해주세요.', 403: '프로젝트에 접근할 권한이 없습니다.',
      404: '프로젝트를 찾을 수 없습니다.', 500: '서버 오류로 대화 내역을 불러오지 못했습니다.',
    };
    throw new Error(messages[response.status] ?? '대화 내역을 불러오지 못했습니다.');
  }
  const result = await response.json();
  const items = result?.data?.messages;
  const validId = (id: unknown) => typeof id === 'number' && Number.isSafeInteger(id) && id > 0;
  if (!Array.isArray(items) || items.some((item: any) => !item || !validId(item.messageId) ||
      !['ASSISTANT', 'USER'].includes(item.role) || typeof item.content !== 'string' ||
      !validId(item.sequenceNo) || !Object.hasOwn(INTERVIEW_FIELD_LABELS, item.targetField) ||
      (item.replyToQuestionId !== null && !validId(item.replyToQuestionId)) ||
      typeof item.createdAt !== 'string' || !Number.isFinite(Date.parse(item.createdAt))) ||
      new Set(items.map((item: ServerInterviewMessage) => item.messageId)).size !== items.length ||
      new Set(items.map((item: ServerInterviewMessage) => item.sequenceNo)).size !== items.length) {
    throw new Error('인터뷰 메시지 응답 형식이 올바르지 않습니다.');
  }
  return [...items].sort((a, b) => a.sequenceNo - b.sequenceNo);
}

export async function startInterview(projectId: string): Promise<ServerInterview> {
  return requestInterview(projectId, 'POST');
}

export async function getInterviewStatus(projectId: string, signal?: AbortSignal): Promise<ServerInterview> {
  return requestInterview(projectId, 'GET', signal);
}

async function requestInterview(projectId: string, method: 'GET' | 'POST', signal?: AbortSignal): Promise<ServerInterview> {
  if (!/^[1-9]\d*$/.test(projectId) || BigInt(projectId) > 9223372036854775807n) throw new Error('프로젝트 ID 형식이 올바르지 않습니다.');
  const token = localStorage.getItem('accessToken')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('로그인이 필요합니다. 다시 로그인해주세요.');
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/interview`, {
      method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, cache: 'no-store', signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('서버에 연결할 수 없어 인터뷰 정보를 불러오지 못했습니다.');
  }
  if (response.status !== 200 && !(method === 'POST' && response.status === 201)) {
    const messages: Record<number, string> = {
      401: '인증에 실패했습니다. 다시 로그인해주세요.', 403: '프로젝트에 접근할 권한이 없습니다.',
      404: '프로젝트를 찾을 수 없습니다.', 409: '최종 작품 이미지를 등록해야 인터뷰를 시작할 수 있습니다.',
      500: '서버 오류로 인터뷰를 시작하지 못했습니다.', 503: '질문 생성에 실패했습니다. 다시 시도해주세요.',
    };
    throw new Error(messages[response.status] ?? '인터뷰를 시작하지 못했습니다.');
  }
  const result = await response.json();
  const data = result?.data;
  return validateServerInterview(data);
}

function validateServerInterview(data: any): ServerInterview {
  const validId = (id: unknown) => typeof id === 'number' && Number.isSafeInteger(id) && id > 0;
  const q = data?.currentQuestion;
  if (!data || (data.interviewId !== null && !validId(data.interviewId)) ||
      !['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'].includes(data.status) ||
      (data.status !== 'NOT_STARTED' && !validId(data.interviewId)) || typeof data.nextQuestionPending !== 'boolean' ||
      !Array.isArray(data.fieldStates) || data.fieldStates.some((item: any) => !item || !Object.hasOwn(INTERVIEW_FIELD_LABELS, item.field) || !Object.hasOwn(INTERVIEW_STATUS_LABELS, item.status) || (item.summary !== null && typeof item.summary !== 'string')) ||
      (q !== null && (!q || !validId(q.messageId) || typeof q.content !== 'string' || !Object.hasOwn(INTERVIEW_FIELD_LABELS, q.targetField) ||
        (q.reason !== null && typeof q.reason !== 'string') || !Array.isArray(q.materialRefs) ||
        q.materialRefs.some((ref: any) => !ref || typeof ref.title !== 'string' ||
          (ref.sourceId !== null && !(typeof ref.sourceId === 'string' && ref.sourceId.trim()) && !validId(ref.sourceId)) ||
          ['materialId','fileId'].some((key) => ref[key] !== null && !validId(ref[key])))))) {
    throw new Error('인터뷰 시작 응답 형식이 올바르지 않습니다.');
  }
  return data;
}

export async function getInterviewReadiness(projectId: string, signal?: AbortSignal): Promise<InterviewReadiness> {
  if (!/^[1-9]\d*$/.test(projectId) || BigInt(projectId) > 9223372036854775807n) throw new Error('프로젝트 ID 형식이 올바르지 않습니다.');
  const token = localStorage.getItem('accessToken')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('로그인이 필요합니다. 다시 로그인해주세요.');
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/interview/readiness`, {
      method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, cache: 'no-store', signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('서버에 연결할 수 없어 인터뷰 준비 상태를 불러오지 못했습니다.');
  }
  if (response.status !== 200) {
    const messages: Record<number, string> = {
      401: '인증에 실패했습니다. 다시 로그인해주세요.', 403: '프로젝트에 접근할 권한이 없습니다.',
      404: '프로젝트를 찾을 수 없습니다.', 500: '서버 오류로 준비 상태를 불러오지 못했습니다.',
    };
    throw new Error(messages[response.status] ?? '인터뷰 준비 상태를 불러오지 못했습니다.');
  }
  const result = await response.json();
  const data = result?.data;
  // 배포 응답은 type, 명세 예시는 materialType을 사용합니다.
  const materialType = (item: any) => item?.materialType ?? item?.type;
  const validMessages = (items: any) => Array.isArray(items) && items.every((item: any) => item && typeof materialType(item) === 'string' && typeof item.message === 'string');
  if (!data || typeof data.canStart !== 'boolean' || !Array.isArray(data.fieldStates) ||
      data.fieldStates.some((item: any) => !item || !Object.hasOwn(INTERVIEW_FIELD_LABELS, item.field) || !Object.hasOwn(INTERVIEW_STATUS_LABELS, item.status) || (item.summary !== null && typeof item.summary !== 'string')) ||
      !Array.isArray(data.materialChecks) || data.materialChecks.some((item: any) => !item || typeof materialType(item) !== 'string' || typeof item.ready !== 'boolean') ||
      !validMessages(data.blockingReasons) || !validMessages(data.warnings)) throw new Error('인터뷰 준비 상태 응답 형식이 올바르지 않습니다.');
  return {
    ...data,
    materialChecks: data.materialChecks.map((item: any) => ({ ...item, materialType: materialType(item) })),
    blockingReasons: data.blockingReasons.map((item: any) => ({ ...item, materialType: materialType(item) })),
    warnings: data.warnings.map((item: any) => ({ ...item, materialType: materialType(item) })),
  };
}
