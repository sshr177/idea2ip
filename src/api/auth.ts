const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export interface LoginRequest {
  loginId: string;
  password: string;
}

export interface LoginResult {
  accessToken: string;
}

/** 204에는 본문이 없으므로 JSON으로 읽지 않습니다. */
export async function logout(): Promise<void> {
  const token = localStorage.getItem('accessToken')?.replace(/^Bearer\s+/i, '').trim();
  // 토큰이 이미 없으면 브라우저의 로그인 상태만 정리합니다.
  if (!token) return;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new Error('서버에 연결할 수 없어 로그아웃하지 못했습니다. 다시 시도해주세요.');
  }
  // 만료되거나 유효하지 않은 토큰도 로컬에서 제거하도록 합니다.
  if (response.status === 204 || response.status === 401) return;
  throw new Error(response.status === 500
    ? '서버 오류로 로그아웃하지 못했습니다. 잠시 후 다시 시도해주세요.'
    : '로그아웃하지 못했습니다. 다시 시도해주세요.');
}

export async function login(input: LoginRequest): Promise<LoginResult> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    throw new Error('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
  }

  if (response.status !== 200) {
    const messages: Record<number, string> = {
      400: '아이디와 비밀번호를 모두 입력해주세요.',
      401: '아이디 또는 비밀번호가 일치하지 않습니다.',
      500: '서버 오류로 로그인하지 못했습니다. 잠시 후 다시 시도해주세요.',
    };
    throw new Error(messages[response.status] ?? '로그인하지 못했습니다. 다시 시도해주세요.');
  }

  const result = await response.json();
  const token = result?.data?.accessToken;
  if (typeof token !== 'string' || !token.trim()) {
    throw new Error('로그인 응답에 유효한 인증 토큰이 없습니다.');
  }
  return { accessToken: token.trim() };
}

export interface SignupRequest {
  loginId: string;
  password: string;
}

export interface SignupResult {
  userId: number;
  loginId: string;
}

export class SignupError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'SignupError';
    this.status = status;
  }
}

export async function signup(input: SignupRequest): Promise<SignupResult> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    throw new SignupError(0, '서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
  }

  if (response.status !== 201) {
    const messages: Record<number, string> = {
      400: '아이디 또는 비밀번호의 입력값을 확인해주세요.',
      409: '이미 사용 중인 아이디입니다. 다른 아이디를 입력해주세요.',
      500: '서버 오류로 회원가입하지 못했습니다. 잠시 후 다시 시도해주세요.',
    };
    throw new SignupError(response.status, messages[response.status] ?? '회원가입하지 못했습니다. 다시 시도해주세요.');
  }

  const result = await response.json();
  const data = result?.data;
  if (!data || !Number.isSafeInteger(data.userId) || data.userId <= 0 ||
      typeof data.loginId !== 'string' || !data.loginId) {
    throw new Error('회원가입 응답을 확인하지 못했습니다. 로그인 화면에서 가입 여부를 확인해주세요.');
  }
  return data;
}
