const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export interface CurrentUser {
  userId: number;
  loginId: string;
}

export class CurrentUserError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'CurrentUserError';
    this.status = status;
  }
}

export async function getCurrentUser(signal?: AbortSignal): Promise<CurrentUser> {
  const token = localStorage.getItem('accessToken')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new CurrentUserError(401, '로그인이 필요합니다.');

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/users/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new CurrentUserError(0, '서버에 연결할 수 없습니다. 다시 시도해주세요.');
  }
  if (response.status !== 200) {
    const messages: Record<number, string> = {
      401: '인증이 만료되었거나 유효하지 않습니다. 다시 로그인해주세요.',
      404: '사용자 정보를 찾을 수 없습니다.',
      500: '서버 오류로 사용자 정보를 불러오지 못했습니다.',
    };
    throw new CurrentUserError(response.status, messages[response.status] ?? '사용자 정보를 불러오지 못했습니다.');
  }
  const result = await response.json();
  const data = result?.data;
  if (!data || !Number.isSafeInteger(data.userId) || data.userId <= 0 ||
      typeof data.loginId !== 'string' || !data.loginId.trim()) {
    throw new Error('사용자 정보 응답 형식이 올바르지 않습니다.');
  }
  return data;
}
