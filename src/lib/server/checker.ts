import type { HealthResult, Website } from '@/lib/server/types';

/**
 * CHECKER: dado un sitio, hace la petición HTTP real a su loginEndpoint, mide la
 * latencia y decide si está "UP" o "DOWN" (port de WebsiteHealthChecker.java).
 *
 * Regla de negocio: un sitio está SANO solo si el login responde EXACTAMENTE 200.
 * Cualquier otro código (3xx no seguible, 4xx, 5xx) => DOWN con statusCode real.
 * Cualquier error de red / timeout / URL inválida => DOWN con statusCode = 0.
 *
 * Nunca lanza: todo error se convierte en un HealthResult.
 */

/** Timeout de la petición completa (monitoring.http.request-timeout-ms). */
const REQUEST_TIMEOUT_MS = Number(process.env.CHECKER_REQUEST_TIMEOUT_MS) || 10_000;

/** User-Agent con el que nos identificamos ante los sitios monitoreados. */
const USER_AGENT =
  process.env.CHECKER_USER_AGENT ||
  'monitoreo-web-checker/1.0 (+https://github.com/brian/monitoreo-web)';

function base(site: Website) {
  return {
    websiteId: site.id,
    name: site.name,
    url: site.url,
    loginEndpoint: site.loginEndpoint,
  };
}

function success(site: Website, statusCode: number, responseTimeMs: number): HealthResult {
  const up = statusCode === 200;
  return {
    ...base(site),
    up,
    statusCode,
    responseTimeMs,
    checkedAt: new Date().toISOString(),
    error: up ? null : `Se esperaba 200 OK y se recibió ${statusCode}`,
  };
}

function failure(site: Website, responseTimeMs: number, error: string): HealthResult {
  return {
    ...base(site),
    up: false,
    statusCode: 0,
    responseTimeMs,
    checkedAt: new Date().toISOString(),
    error,
  };
}

/** Equivalente a `ex.getClass().getSimpleName() + ": " + ex.getMessage()` en Java. */
function describeError(err: unknown, timedOut: boolean): string {
  if (timedOut) {
    return `HttpTimeoutException: request timed out after ${REQUEST_TIMEOUT_MS} ms`;
  }
  if (err instanceof Error) {
    // fetch de Node envuelve el error real (ECONNREFUSED, ENOTFOUND, certificados...)
    // en un TypeError("fetch failed") con `cause`; mostramos la causa, que es lo útil.
    const cause = (err as Error & { cause?: unknown }).cause;
    if (cause instanceof Error) {
      const code = (cause as Error & { code?: string }).code;
      const kind = code || cause.name;
      return cause.message ? `${kind}: ${cause.message}` : kind;
    }
    return err.message ? `${err.name}: ${err.message}` : err.name;
  }
  return String(err);
}

/** Consume y descarta el cuerpo (como BodyHandlers.discarding()), sin acumularlo en memoria. */
async function drainBody(res: Response): Promise<void> {
  if (!res.body) return;
  const reader = res.body.getReader();
  for (;;) {
    const { done } = await reader.read();
    if (done) return;
  }
}

export async function checkWebsite(site: Website): Promise<HealthResult> {
  let target: URL;
  try {
    target = new URL(site.loginEndpoint);
    if (target.protocol !== 'http:' && target.protocol !== 'https:') {
      throw new Error(`esquema no soportado: ${target.protocol}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return failure(site, 0, `URL inválida: ${msg}`);
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  const startedAt = performance.now();
  const elapsed = () => Math.round(performance.now() - startedAt);

  try {
    const res = await fetch(target, {
      method: 'GET',
      headers: { 'User-Agent': USER_AGENT, Accept: '*/*' },
      redirect: 'follow',
      cache: 'no-store',
      signal: controller.signal,
    });
    // Java mide tras descartar el cuerpo completo: replicamos drenándolo bajo el mismo timeout.
    await drainBody(res);
    return success(site, res.status, elapsed());
  } catch (err) {
    const reason = describeError(err, timedOut);
    console.warn(`[checker] Fallo al chequear ${site.name}: ${reason}`);
    return failure(site, elapsed(), reason);
  } finally {
    clearTimeout(timer);
  }
}
