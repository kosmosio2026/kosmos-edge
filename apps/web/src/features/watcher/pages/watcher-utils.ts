export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:3000/api';

export function getToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('kosmos.watcherAccessToken') ?? '';
}

export function clearToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('kosmos.watcherAccessToken');
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(options.headers ?? {});

  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  if (token) {
    headers.set('authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    cache: 'no-store',
  });

  const json = await res.json().catch(() => null);

  if (res.status === 401) {
    throw new Error('로그인이 필요합니다. /watcher 화면에서 먼저 로그인하세요.');
  }

  if (!res.ok) {
    throw new Error(json?.message ?? '요청에 실패했습니다.');
  }

  return json;
}
