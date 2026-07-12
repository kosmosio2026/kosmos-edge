import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = new Set([
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/admin/login',
  '/admin/forgot-password',
  '/manager/login',
  '/manager/register',
  '/manager/forgot-password',
  '/operator/login',
  '/operator/register',
  '/operator/forgot-password',
  '/visitor/register',
  '/visitor/forgot-password',
]);

function isStaticAsset(pathname: string) {
  return (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/images/') ||
    pathname.startsWith('/assets/') ||
    pathname.includes('.')
  );
}

function isPublicPath(pathname: string) {
  return (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith('/pay/invoice/') ||
    pathname.startsWith('/api/')
  );
}

function getLoginPath(pathname: string) {
  if (pathname.startsWith('/admin')) return '/admin/login';
  if (pathname.startsWith('/manager')) return '/manager/login';
  if (pathname.startsWith('/operator')) return '/operator/login';
  return '/login';
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isStaticAsset(pathname) || isPublicPath(pathname)) {
    return NextResponse.next();
  }

  /*
   Current auth session is stored client-side by AuthProvider.
   Middleware cannot reliably read it yet unless we also store an httpOnly cookie.
   So for now, do not block protected routes here.
   We keep this middleware ready for cookie-based protection later.
  */

  const loginPath = getLoginPath(pathname);

  if (
    pathname === '/admin' ||
    pathname === '/manager' ||
    pathname === '/operator'
  ) {
    return NextResponse.next();
  }

  void loginPath;

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};