import { isEdgeWeb } from '@/lib/app-profile';
import type { AuthSession } from '@/types/auth';

const STORAGE_KEY = 'parking.auth.session';

function normalizeBaseUrl(value?: string) {
  return (value ?? '').replace(/\/$/, '');
}

export function getStoredSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as AuthSession;

    if (!parsed?.accessToken || !parsed?.user) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function setStoredSession(session: AuthSession) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession() {
  if (typeof window === 'undefined') return;

  window.localStorage.removeItem(STORAGE_KEY);
}

export async function login(
  email: string,
  password: string,
): Promise<AuthSession> {
  const apiBaseUrl = normalizeBaseUrl(
    process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api',
  );

  const response = await fetch(`${apiBaseUrl}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const contentType = response.headers.get('content-type') ?? '';

  if (!contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(`Invalid API response: ${text.slice(0, 120)}`);
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message ?? 'Invalid email or password');
  }

  return data as AuthSession;
}

export function getDefaultRedirectPath(session: AuthSession) {
  const roles = session.user.roles ?? [];

  if (roles.includes('ADMIN') && !isEdgeWeb()) return '/admin/dashboard';
  if (roles.includes('MANAGER')) return '/manager/dashboard';
  if (roles.includes('OPERATOR')) return '/operator';
  if (roles.includes('MEMBER')) return '/member';
  if (roles.includes('VISITOR')) return '/visitor';

  return '/login';
}