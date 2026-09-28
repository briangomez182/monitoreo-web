import { NextResponse } from 'next/server';
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  isAuthConfigured,
  sessionCookieOptions,
  verifyCredentials,
} from '@/lib/server/auth';
import { problem, readJson } from '@/lib/server/problem';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PATH = '/api/auth/login';
const MAX_FAILURES = 5;
const LOCK_WINDOW_MS = 15 * 60 * 1000;

// Freno contra fuerza bruta: 5 intentos fallidos por IP cada 15 min (en memoria).
type Attempts = Map<string, { count: number; firstAt: number }>;
const g = globalThis as typeof globalThis & { __loginAttempts?: Attempts };
const attempts: Attempts = (g.__loginAttempts ??= new Map());

function clientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
}

function isLocked(ip: string): boolean {
  const entry = attempts.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.firstAt > LOCK_WINDOW_MS) {
    attempts.delete(ip);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

function registerFailure(ip: string): void {
  const entry = attempts.get(ip);
  if (!entry || Date.now() - entry.firstAt > LOCK_WINDOW_MS) {
    attempts.set(ip, { count: 1, firstAt: Date.now() });
  } else {
    entry.count++;
  }
}

/** POST /api/auth/login -> 204 + cookie de sesión; 401 credenciales inválidas; 429 bloqueado. */
export async function POST(request: Request) {
  if (!isAuthConfigured()) {
    return problem(503, 'Service Unavailable', 'El acceso de administrador no está configurado', PATH);
  }

  const ip = clientIp(request);
  if (isLocked(ip)) {
    return problem(429, 'Too Many Requests', 'Demasiados intentos. Probá de nuevo en 15 minutos', PATH);
  }

  const body = (await readJson(request)) as { username?: unknown; password?: unknown } | undefined;
  const username = typeof body?.username === 'string' ? body.username : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!(await verifyCredentials(username, password))) {
    registerFailure(ip);
    return problem(401, 'Unauthorized', 'Usuario o contraseña incorrectos', PATH);
  }

  attempts.delete(ip);
  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(username), sessionCookieOptions(SESSION_TTL_SECONDS));
  return response;
}
