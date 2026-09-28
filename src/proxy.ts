import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/server/auth';

/**
 * Guardia global: todo está cerrado salvo /login y el endpoint de login.
 * - Páginas sin sesión  -> redirección a /login
 * - API sin sesión      -> 401 (ProblemDetail)
 * - /login con sesión   -> redirección al dashboard
 */
const PUBLIC_PATHS = new Set(['/login', '/api/auth/login']);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authenticated = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (PUBLIC_PATHS.has(pathname)) {
    if (authenticated && pathname === '/login') {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  if (authenticated) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return new NextResponse(
      JSON.stringify({
        type: 'about:blank',
        title: 'Unauthorized',
        status: 401,
        detail: 'Sesión requerida',
        instance: pathname,
      }),
      { status: 401, headers: { 'Content-Type': 'application/problem+json' } },
    );
  }

  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  // Todo menos los assets estáticos de Next, los íconos y el manifest
  // (el navegador los pide también desde /login, sin sesión).
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|icon\\.png|apple-icon\\.png|icon-192\\.png|icon-512\\.png|manifest\\.webmanifest).*)'],
};
