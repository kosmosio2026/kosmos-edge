'use client';

import { useRouter, usePathname } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();
  const pathname = usePathname();

  function getLoginPath() {
    if (pathname.startsWith('/admin')) return '/admin/login';
    if (pathname.startsWith('/manager')) return '/manager/login';
    if (pathname.startsWith('/operator')) return '/operator/login';
    return '/login';
  }

  function logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    sessionStorage.clear();

    router.replace(getLoginPath());
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-slate-50"
    >
      Logout
    </button>
  );
}