const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3000/api';

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
  return window.localStorage.getItem('kosmos.consoleAccessToken') ?? window.localStorage.getItem('kosmos.accessToken');
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

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    cache: 'no-store',
  });

  const payload = await parseResponseSafely(response);

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === 'object' &&
      'message' in payload &&
      typeof payload.message === 'string'
        ? payload.message
        : `API request failed: ${response.status}`;

    throw new Error(message);
  }

  return payload as T;
}