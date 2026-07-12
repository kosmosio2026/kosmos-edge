'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

const roleDefaults = {
  ADMIN: { email: 'admin@parking.local', password: 'admin1234' },
  MANAGER: { email: 'manager@parking.local', password: 'manager1234' },
  OPERATOR: { email: 'operator@parking.local', password: 'operator1234' },
  MEMBER: { email: 'member@parking.local', password: 'member1234' },
  VISITOR: { email: 'visitor@parking.local', password: 'visitor1234' },
} as const;

type LoginRole = keyof typeof roleDefaults;

type LoginUser = {
  role?: string;
  roles?: string[];
};

function normalizeRoles(user?: LoginUser | null): string[] {
  if (!user) return [];

  if (Array.isArray(user.roles)) {
    return user.roles.map((role) => role.toUpperCase());
  }

  if (typeof user.role === 'string') {
    return [user.role.toUpperCase()];
  }

  return [];
}

function getRoleBasedRedirect(user?: LoginUser | null): string {
  const roles = normalizeRoles(user);

  if (roles.includes('ADMIN')) return '/admin/dashboard';
  if (roles.includes('MANAGER')) return '/manager/dashboard';
  if (roles.includes('OPERATOR')) return '/operator/dashboard';
  if (roles.includes('MEMBER')) return '/member/parking/status';
  if (roles.includes('VISITOR')) return '/visitor/parking/status';

  return '/login';
}

function isSafeInternalRedirect(path: string | null): path is string {
  return Boolean(path && path.startsWith('/') && !path.startsWith('//'));
}

function getAuthLinks(pathname: string) {
  if (pathname.startsWith('/operator/login')) {
    return {
      registerHref: '/operator/register',
      forgotPasswordHref: '/operator/forgot-password',
      label: 'Operator',
    };
  }

  if (pathname.startsWith('/manager/login')) {
    return {
      registerHref: '/manager/register',
      forgotPasswordHref: '/manager/forgot-password',
      label: 'Manager',
    };
  }

  if (pathname.startsWith('/admin/login')) {
    return {
      registerHref: '/admin/register',
      forgotPasswordHref: '/admin/forgot-password',
      label: 'Admin',
    };
  }

  if (pathname.startsWith('/visitor/login')) {
  return {
    registerHref: '/visitor/register',
    forgotPasswordHref: '/visitor/forgot-password',
    label: 'Visitor',
  };
}

  return {
    registerHref: '/register',
    forgotPasswordHref: '/forgot-password',
    label: 'Member',
  };
}

export function LoginForm() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const authLinks = getAuthLinks(pathname);

  const requestedRedirect = searchParams.get('redirect');
  const roleParam = (searchParams.get('role') ?? authLinks.label).toUpperCase();
  const role = (roleParam in roleDefaults ? roleParam : 'MEMBER') as LoginRole;

  const defaults = useMemo(
    () => roleDefaults[role] ?? roleDefaults.MEMBER,
    [role],
  );

  const [email, setEmail] = useState<string>(defaults.email);
  const [password, setPassword] = useState<string>(defaults.password);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

if (!response.ok || !result.ok) {
  throw new Error(result.message ?? 'Login failed');
}

const accessToken =
  result.accessToken ??
  result.data?.accessToken ??
  result.token ??
  result.data?.token;

if (accessToken) {
  localStorage.setItem('accessToken', accessToken);
}

      const user = result.user ?? result.data?.user ?? result.data;
      const nextPath = isSafeInternalRedirect(requestedRedirect)
        ? requestedRedirect
        : getRoleBasedRedirect(user);

      router.replace(nextPath);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Role: <span className="font-medium">{role}</span>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Email</label>
        <input
          className="w-full rounded-2xl border px-4 py-3 text-sm outline-none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Password</label>
        <input
          className="w-full rounded-2xl border px-4 py-3 text-sm outline-none"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          autoComplete="current-password"
        />
      </div>

      {error ? (
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <button
        disabled={loading}
        className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? 'Signing in...' : 'Sign in'}
      </button>

      <div className="flex items-center justify-center gap-3 text-sm text-slate-600">
        <Link className="hover:text-slate-900 hover:underline" href={authLinks.registerHref}>
          Register
        </Link>
        <span>|</span>
        <Link className="hover:text-slate-900 hover:underline" href={authLinks.forgotPasswordHref}>
          Forgot Password
        </Link>
      </div>
    </form>
  );
}