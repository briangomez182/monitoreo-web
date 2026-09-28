import { randomUUID } from 'node:crypto';
import { getDb } from './db';
import type { FieldError, Website, WebsiteInput } from './types';

/**
 * Repositorio + servicio del catálogo de sitios (reemplaza a monitors-service:
 * Website, WebsiteRepository, WebsiteMapper, WebsiteService y WebsiteRequest).
 */

interface WebsiteRow {
  id: string;
  name: string;
  url: string;
  login_endpoint: string;
  check_frequency_seconds: number;
  active: number;
  destacado: string | null;
  last_enqueued_at: string | null;
  created_at: string;
  updated_at: string;
}

function toWebsite(row: WebsiteRow): Website {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    loginEndpoint: row.login_endpoint,
    checkFrequencySeconds: row.check_frequency_seconds,
    active: row.active === 1,
    destacado: row.destacado,
    lastEnqueuedAt: row.last_enqueued_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

/** Todos los sitios ordenados por nombre (GET /api/v1/websites). */
export function listWebsites(): Website[] {
  const rows = getDb()
    .prepare('SELECT * FROM websites ORDER BY name COLLATE NOCASE ASC, name ASC')
    .all() as WebsiteRow[];
  return rows.map(toWebsite);
}

export function getWebsite(id: string): Website | null {
  const row = getDb().prepare('SELECT * FROM websites WHERE id = ?').get(normalizeId(id)) as
    | WebsiteRow
    | undefined;
  return row ? toWebsite(row) : null;
}

export function createWebsite(input: WebsiteInput): Website {
  const id = randomUUID();
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO websites (id, name, url, login_endpoint, check_frequency_seconds, active,
                             destacado, last_enqueued_at, created_at, updated_at)
       VALUES (@id, @name, @url, @loginEndpoint, @checkFrequencySeconds, @active,
               @destacado, NULL, @now, @now)`,
    )
    .run({ ...input, id, active: input.active ? 1 : 0, now });
  return getWebsite(id)!;
}

/** Edición completa. null si el id no existe. */
export function updateWebsite(id: string, input: WebsiteInput): Website | null {
  const key = normalizeId(id);
  const result = getDb()
    .prepare(
      `UPDATE websites
          SET name = @name, url = @url, login_endpoint = @loginEndpoint,
              check_frequency_seconds = @checkFrequencySeconds, active = @active,
              destacado = @destacado, updated_at = @now
        WHERE id = @id`,
    )
    .run({ ...input, id: key, active: input.active ? 1 : 0, now: new Date().toISOString() });
  return result.changes > 0 ? getWebsite(key) : null;
}

/** Baja del sitio y de su estado/historial. false si el id no existe. */
export function deleteWebsite(id: string): boolean {
  const key = normalizeId(id);
  const db = getDb();
  return db.transaction(() => {
    db.prepare('DELETE FROM website_status WHERE website_id = ?').run(key);
    db.prepare('DELETE FROM website_history WHERE website_id = ?').run(key);
    db.prepare('DELETE FROM status_change_log WHERE website_id = ?').run(key);
    return db.prepare('DELETE FROM websites WHERE id = ?').run(key).changes > 0;
  })();
}

/**
 * Sitios activos a los que "les toca" chequeo (equivale a Website.isDue de Java):
 * nunca chequeados, o lastEnqueuedAt + frecuencia ya quedó en el pasado.
 */
export function listDueWebsites(now: Date): Website[] {
  const nowMs = now.getTime();
  const rows = getDb().prepare('SELECT * FROM websites WHERE active = 1').all() as WebsiteRow[];
  return rows
    .filter((row) => {
      if (!row.last_enqueued_at) return true;
      const last = Date.parse(row.last_enqueued_at);
      return Number.isNaN(last) || last + row.check_frequency_seconds * 1000 < nowMs;
    })
    .map(toWebsite);
}

/** Registra que se lanzó un chequeo en `at` (equivale a Website.markEnqueued). */
export function markChecked(id: string, at: Date): void {
  getDb()
    .prepare('UPDATE websites SET last_enqueued_at = ? WHERE id = ?')
    .run(at.toISOString(), normalizeId(id));
}

// ---------------------------------------------------------------------------
// Validación (réplica de las anotaciones Bean Validation de WebsiteRequest)
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** true si el texto es un UUID (el @PathVariable UUID de Java responde 400 si no lo es). */
export function isValidId(id: string): boolean {
  return UUID_RE.test(id);
}

function normalizeId(id: string): string {
  return id.toLowerCase();
}

/** Mismo regex que @Pattern("^https?://.+"): en Java debe casar la cadena completa. */
const HTTP_URL_RE = /^https?:\/\/.+$/;

/** Coerción de escalar a String como hace Jackson (números/booleanos -> texto). */
function asString(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined; // objeto/array: Jackson no lo puede leer como String
}

function isBlank(value: string | null): boolean {
  return value === null || value.trim().length === 0;
}

export type WebsiteValidation =
  | { ok: true; value: WebsiteInput }
  | { ok: false; errors: FieldError[] };

export function validateWebsiteInput(body: unknown): WebsiteValidation {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, errors: [{ field: 'body', message: 'El cuerpo debe ser un objeto JSON' }] };
  }
  const raw = body as Record<string, unknown>;
  const errors: FieldError[] = [];
  const typeError = (field: string) =>
    errors.push({ field, message: 'Tipo de dato inválido' });

  // name: @NotBlank + @Size(max = 120)
  const name = asString(raw.name);
  if (name === undefined) typeError('name');
  else if (isBlank(name)) errors.push({ field: 'name', message: 'El nombre es obligatorio' });
  else if (name!.length > 120) errors.push({ field: 'name', message: 'size must be between 0 and 120' });

  // url / loginEndpoint: @NotBlank + @Pattern(^https?://.+)
  const checkUrl = (field: string, value: string | null | undefined, blankMsg: string, patternMsg: string) => {
    if (value === undefined) return typeError(field);
    if (isBlank(value)) errors.push({ field, message: blankMsg });
    if (value !== null && !HTTP_URL_RE.test(value)) errors.push({ field, message: patternMsg });
  };
  const url = asString(raw.url);
  checkUrl('url', url, 'La URL es obligatoria', 'La URL debe empezar por http:// o https://');
  const loginEndpoint = asString(raw.loginEndpoint);
  checkUrl(
    'loginEndpoint',
    loginEndpoint,
    'El endpoint de login es obligatorio',
    'El endpoint debe empezar por http:// o https://',
  );

  // checkFrequencySeconds: int primitivo (ausente/null -> 0) + @Min(10) + @Max(86400)
  let frequency = 0;
  const rawFreq = raw.checkFrequencySeconds;
  if (rawFreq === undefined || rawFreq === null) frequency = 0;
  else if (typeof rawFreq === 'number' && Number.isFinite(rawFreq)) frequency = Math.trunc(rawFreq);
  else if (typeof rawFreq === 'string' && /^\s*-?\d+(\.\d+)?\s*$/.test(rawFreq)) frequency = Math.trunc(Number(rawFreq));
  else {
    typeError('checkFrequencySeconds');
    frequency = NaN;
  }
  if (!Number.isNaN(frequency)) {
    if (frequency < 10) errors.push({ field: 'checkFrequencySeconds', message: 'La frecuencia mínima es de 10 segundos' });
    else if (frequency > 86_400) errors.push({ field: 'checkFrequencySeconds', message: 'La frecuencia máxima es de 24 horas' });
  }

  // active: Boolean opcional (null/ausente -> true)
  let active = true;
  const rawActive = raw.active;
  if (rawActive === undefined || rawActive === null) active = true;
  else if (typeof rawActive === 'boolean') active = rawActive;
  else if (rawActive === 'true' || rawActive === 'false') active = rawActive === 'true';
  else typeError('active');

  // destacado: @Size(max = 500), opcional (vacío -> null)
  const destacado = asString(raw.destacado);
  if (destacado === undefined) typeError('destacado');
  else if (destacado !== null && destacado.length > 500) {
    errors.push({ field: 'destacado', message: 'El campo destacado admite como máximo 500 caracteres' });
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      name: name!.trim(),
      url: url!.trim(),
      loginEndpoint: loginEndpoint!.trim(),
      checkFrequencySeconds: frequency,
      active,
      destacado: isBlank(destacado ?? null) ? null : destacado!.trim(),
    },
  };
}

/** Une los errores como GlobalExceptionHandler: "campo: mensaje; campo: mensaje". */
export function formatFieldErrors(errors: FieldError[]): string {
  return errors.map((e) => `${e.field}: ${e.message}`).join('; ');
}
