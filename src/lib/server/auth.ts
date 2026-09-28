/**
 * AUTENTICACIÓN DEL ÚNICO ADMINISTRADOR.
 *
 * No hay registro ni tabla de usuarios: las credenciales viven en variables de
 * entorno (ADMIN_USERNAME / ADMIN_PASSWORD) y la sesión es una cookie httpOnly
 * firmada con HMAC-SHA256 (AUTH_SECRET). Si falta alguna variable, nadie puede
 * entrar (fail closed).
 *
 * Solo usa Web Crypto, así que funciona igual en proxy.ts y en route handlers.
 */

export const SESSION_COOKIE = 'mw_session';
export const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 h

interface SessionPayload {
  sub: string;
  exp: number; // epoch en segundos
}

const encoder = new TextEncoder();

function getSecret(): string | null {
  const secret = process.env.AUTH_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(data)));
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** true si las credenciales del administrador están configuradas. */
export function isAuthConfigured(): boolean {
  return Boolean(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD && getSecret());
}

/**
 * Compara usuario y contraseña en tiempo constante: se comparan los HMAC de
 * ambos valores, así la longitud de la entrada no filtra información.
 */
export async function verifyCredentials(username: string, password: string): Promise<boolean> {
  const secret = getSecret();
  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPass = process.env.ADMIN_PASSWORD;
  if (!secret || !expectedUser || !expectedPass) return false;

  const [u1, u2, p1, p2] = await Promise.all([
    hmac(secret, `user:${username}`),
    hmac(secret, `user:${expectedUser}`),
    hmac(secret, `pass:${password}`),
    hmac(secret, `pass:${expectedPass}`),
  ]);
  const userOk = constantTimeEqual(u1, u2);
  const passOk = constantTimeEqual(p1, p2);
  return userOk && passOk;
}

/** Crea el token de sesión: base64url(payload).base64url(firma). */
export async function createSessionToken(username: string): Promise<string> {
  const secret = getSecret();
  if (!secret) throw new Error('AUTH_SECRET no configurado');
  const payload: SessionPayload = {
    sub: username,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = toBase64Url(await hmac(secret, body));
  return `${body}.${signature}`;
}

/** Valida firma, expiración y que el usuario siga siendo el administrador. */
export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  const secret = getSecret();
  if (!token || !secret) return false;

  const [body, signature] = token.split('.');
  if (!body || !signature) return false;

  try {
    const expected = await hmac(secret, body);
    if (!constantTimeEqual(expected, fromBase64Url(signature))) return false;

    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as SessionPayload;
    if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) return false;
    return payload.sub === process.env.ADMIN_USERNAME;
  } catch {
    return false;
  }
}

function isHttps(request: Request): boolean {
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0].trim();
  return proto ? proto === 'https' : new URL(request.url).protocol === 'https:';
}

/** Opciones comunes de la cookie de sesión. */
export function sessionCookieOptions(request: Request, maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    // Secure solo si la petición llegó por HTTPS (Cloudflare Tunnel manda
    // X-Forwarded-Proto: https). En http://localhost el navegador la descartaría.
    secure: isHttps(request),
    path: '/',
    maxAge,
  };
}
