'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { getDefaultRedirectPath } from '@/lib/auth';
import { useAuth } from '@/components/providers/auth-provider';
import { setAccessToken, setRefreshToken } from '@/lib/api';

type LoginRoleHint = 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'MEMBER' | 'VISITOR';

type LoginPageClientProps = {
  title?: string;
  description?: string;
  roleHint?: LoginRoleHint;
  defaultRedirect?: string;
  defaultEmail?: string;
};

const DEFAULT_PASSWORD = 'kosmos2026!!';

const ROLE_DEMO_EMAILS: Record<LoginRoleHint, string> = {
  ADMIN: 'admin@kosmos.test',
  MANAGER: 'manager@kosmos.test',
  OPERATOR: 'operator@kosmos.test',
  MEMBER: 'member@kosmos.test',
  VISITOR: 'visitor@kosmos.test',
};

function safeRedirectPath(value: string | null) {
  if (!value) return null;
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//')) return null;

  const loginPaths = [
    '/login',
    '/admin/login',
    '/manager/login',
    '/operator/login',
  ];

  if (loginPaths.includes(value)) return null;

  return value;
}


function isAllowedRedirectForRole(value: string | null, roleHint?: LoginRoleHint) {
  const path = safeRedirectPath(value);
  if (!path) return null;

  if (roleHint === 'ADMIN') {
    return path.startsWith('/admin') ? path : null;
  }

  if (roleHint === 'MANAGER') {
    return path.startsWith('/manager') ? path : null;
  }

  if (roleHint === 'OPERATOR') {
    return path.startsWith('/operator') ? path : null;
  }

  if (roleHint === 'MEMBER') {
    return path.startsWith('/mobile/member') || path.startsWith('/mobile')
      ? path
      : null;
  }

  if (roleHint === 'VISITOR') {
    return path.startsWith('/mobile/visitor') || path.startsWith('/mobile')
      ? path
      : null;
  }

  return path;
}

function normalizeRoles(session: any): string[] {
  const roles =
    session?.user?.roles ??
    session?.roles ??
    session?.user?.roleCodes ??
    [];

  return Array.isArray(roles)
    ? roles.map((role) => String(role).toUpperCase())
    : [];
}

function hasRole(session: any, role: LoginRoleHint) {
  return normalizeRoles(session).includes(role);
}

function getRoleDefaultRedirect(session: any) {
  const roles = normalizeRoles(session);

  if (roles.includes('ADMIN')) return '/admin/dashboard';
  if (roles.includes('MANAGER')) return '/manager/dashboard';
  if (roles.includes('OPERATOR')) return '/operator/dashboard';
  if (roles.includes('MEMBER')) return '/member';
  if (roles.includes('VISITOR')) return '/visitor';

  return getDefaultRedirectPath(session);
}

function getDefaultEmail(roleHint?: LoginRoleHint, defaultEmail?: string) {
  if (defaultEmail) return defaultEmail;
  if (roleHint) return ROLE_DEMO_EMAILS[roleHint];

  /*
   Root login is for member / visitor by default.
   Admin / manager / operator should use their dedicated URLs:
   /admin/login, /manager/login, /operator/login
  */
  return ROLE_DEMO_EMAILS.MEMBER;
}

function getWrongRoleLoginPath(roleHint: LoginRoleHint) {
  if (roleHint === 'ADMIN') return '/admin/login';
  if (roleHint === 'MANAGER') return '/manager/login';
  if (roleHint === 'OPERATOR') return '/operator/login';
  return '/login';
}

export default function LoginPageClient({
  title = 'Member / Visitor Login',
  description = '회원 또는 방문자 계정으로 로그인하세요.',
  roleHint,
  defaultRedirect,
  defaultEmail,
}: LoginPageClientProps) {
  const searchParams = useSearchParams();
  const { login, logout } = useAuth();

  const initialEmail = useMemo(
    () => getDefaultEmail(roleHint, defaultEmail),
    [defaultEmail, roleHint],
  );

  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [error, setError] = useState<string | null>(() => {
    const reason = searchParams.get('reason');

    if (reason === 'forbidden') {
      return '이 계정은 해당 콘솔에 접근할 권한이 없습니다. 올바른 계정으로 다시 로그인하세요.';
    }

    return null;
  });
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError(null);
    setLoading(true);

    try {
      const session = await login(email, password);

      /*
       Important:
       useAuth.login() stores the session immediately.
       If the role is wrong, clear it immediately so another console
       does not keep using the wrong account.
      */
      if (roleHint && !hasRole(session, roleHint)) {
        logout(`${getWrongRoleLoginPath(roleHint)}?reason=forbidden`);
        return;
      }

      const accessToken =
        (session as any).accessToken ??
        (session as any).token ??
        null;

      const refreshToken =
        (session as any).refreshToken ??
        null;

      if (accessToken) {
        setAccessToken(accessToken);
      }

      if (refreshToken) {
        setRefreshToken(refreshToken);
      }

      const requestedRedirect =
        isAllowedRedirectForRole(searchParams.get('redirect'), roleHint) ??
        isAllowedRedirectForRole(searchParams.get('next'), roleHint);

      const target =
        requestedRedirect ??
        defaultRedirect ??
        getRoleDefaultRedirect(session);

      window.location.assign(target);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Login failed',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl md:grid-cols-2">
        <div className="hidden bg-slate-950 p-10 text-white md:block">
          <p className="text-sm font-medium text-blue-300">
            Smart Parking Platform
          </p>

          <h1 className="mt-6 text-4xl font-bold leading-tight">
            Kosmos Parking Console
          </h1>

          <p className="mt-4 text-sm leading-6 text-slate-300">
            운영 현황, 주차장 관리, 장치 상태, 정산,
            권한 관리를 하나의 콘솔에서 처리합니다.
          </p>

          <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-200">
              Login URLs
            </p>

            <div className="mt-3 space-y-2 text-sm text-slate-300">
              <div>Admin: /admin/login</div>
              <div>Manager: /manager/login</div>
              <div>Operator: /operator/login</div>
              <div>Member / Visitor: /login</div>
            </div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="p-8 md:p-10">
          <h2 className="text-2xl font-semibold text-slate-900">
            {title}
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            {description}
          </p>

          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            테스트 계정이 자동 입력되어 있습니다. 필요하면 이메일을 바꿔서 로그인하세요.
          </div>

          <div className="mt-8 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Email
              </span>

              <input
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                autoComplete="email"
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Password
              </span>

              <input
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                autoComplete="current-password"
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
              />
            </label>
          </div>

          {error ? (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-2xl bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>

          <div className="mt-5 space-y-1 text-center text-xs text-slate-400">
            <p>Password: {DEFAULT_PASSWORD}</p>
            {roleHint ? (
              <p>Demo account: {ROLE_DEMO_EMAILS[roleHint]}</p>
            ) : (
              <>
                <p>Member demo: {ROLE_DEMO_EMAILS.MEMBER}</p>
                <p>Visitor demo: {ROLE_DEMO_EMAILS.VISITOR}</p>
              </>
            )}
          </div>
        </form>
      </section>
    </main>
  );
}