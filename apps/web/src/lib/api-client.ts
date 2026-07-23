function resolveApiBaseUrl() {
  const configured =
    typeof window === 'undefined'
      ? process.env.API_BASE_URL ??
        process.env.NEXT_PUBLIC_API_BASE_URL ??
        process.env.NEXT_PUBLIC_API_URL ??
        'http://127.0.0.1:3000/api'
      : process.env.NEXT_PUBLIC_API_BASE_URL ??
        process.env.NEXT_PUBLIC_API_URL ??
        '/api';

  return configured.trim().replace(/\/+$/, '');
}


type ApiFetchOptions = RequestInit & {
  accessToken?: string;
  auth?: boolean;
};

async function parseResponseSafely(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      message: text,
      raw: text,
    };
  }
}

function getAccessToken() {
  if (typeof window === 'undefined') return null;
  return (
    window.localStorage.getItem('kosmos.consoleAccessToken') ??
    window.localStorage.getItem('kosmos.accessToken')
  );
}

function clearAuthStorage() {
  if (typeof window === 'undefined') return;

  window.localStorage.removeItem('kosmos.consoleAccessToken');
  window.localStorage.removeItem('kosmos.accessToken');
  window.localStorage.removeItem('kosmos.refreshToken');
  window.localStorage.removeItem('kosmos.consoleSession');
}

function resolveLoginPath() {
  if (typeof window === 'undefined') return '/login';

  const path = window.location.pathname;

  if (path.startsWith('/admin')) return '/admin/login';
  if (path.startsWith('/manager')) return '/manager/login';
  if (path.startsWith('/operator')) return '/operator/login';
  if (path.startsWith('/member')) return '/member/login';
  if (path.startsWith('/visitor')) return '/visitor/login';

  return '/login';
}

function redirectToLoginForUnauthorized() {
  if (typeof window === 'undefined') return;

  clearAuthStorage();

  const loginPath = resolveLoginPath();
  const currentPath = `${window.location.pathname}${window.location.search}`;

  if (window.location.pathname === loginPath) return;

  const next = encodeURIComponent(currentPath);
  window.location.href = `${loginPath}?reason=session-expired&next=${next}`;
}

export async function apiFetch<T = any>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const headers = new Headers(options.headers);

  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const accessToken =
    options.accessToken ??
    (options.auth === false ? null : getAccessToken());

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(`${resolveApiBaseUrl()}${path}`, {
    ...options,
    headers,
    cache: 'no-store',
  });

  const payload = await parseResponseSafely(response);

  if (!response.ok) {
    if (response.status === 401 && options.auth !== false) {
      redirectToLoginForUnauthorized();
    }

    const message =
      payload &&
      typeof payload === 'object' &&
      'message' in payload &&
      typeof payload.message === 'string'
        ? payload.message
        : response.status === 401
          ? '세션이 만료되었습니다. 다시 로그인해 주세요.'
          : `API request failed: ${response.status}`;

    throw new Error(message);
  }

  return payload as T;
}
