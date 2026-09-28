/**
 * STATUS STORE — reemplaza a status-service (Redis + Kafka listener + SSE).
 *
 * - `website_status`  -> último estado por sitio (antes: website:status:{id} + índice).
 * - `website_history` -> últimos 50 resultados por sitio (antes: LPUSH + LTRIM 0..49).
 * - `status_change_log` (tabla propia de este módulo, se crea al primer uso)
 *   -> registro de cambios de estatus de las últimas 24 h (antes: sorted set website:log:{id}).
 * - Bus en proceso (EventEmitter en globalThis) -> sustituye al broadcast SSE de Java.
 */
import { EventEmitter } from 'node:events';
import { getDb } from '@/lib/server/db';
import type { HealthResult } from '@/lib/server/types';

/** monitoring.history.max-entries */
export const HISTORY_MAX_ENTRIES = 50;
/** monitoring.log.retention-hours */
export const LOG_RETENTION_MS = 24 * 60 * 60 * 1000;
const OK = 200;
const EVENT = 'status';

/** DTO de salida (WebsiteStatusResponse de Java): `up` pasa a `status: "UP" | "DOWN"`. */
export interface WebsiteStatusResponse {
  websiteId: string;
  name: string;
  url: string;
  loginEndpoint: string;
  status: 'UP' | 'DOWN';
  statusCode: number;
  responseTimeMs: number;
  checkedAt: string;
  error: string | null;
}

/** DTO de la vista "Logs" (StatusChangeLogResponse de Java). */
export interface StatusChangeLogResponse {
  changedAt: string;
  up: boolean;
  statusCode: number;
  previousStatusCode: number | null;
  error: string | null;
}

export function toStatusResponse(r: HealthResult): WebsiteStatusResponse {
  return {
    websiteId: r.websiteId,
    name: r.name,
    url: r.url,
    loginEndpoint: r.loginEndpoint,
    status: r.up ? 'UP' : 'DOWN',
    statusCode: r.statusCode,
    responseTimeMs: r.responseTimeMs,
    checkedAt: r.checkedAt,
    error: r.error ?? null,
  };
}

// ---------------------------------------------------------------------------
// Bus de eventos en proceso (singleton que sobrevive al HMR de Next en dev)
// ---------------------------------------------------------------------------
const g = globalThis as typeof globalThis & {
  __statusBus?: EventEmitter;
  __statusLogReady?: WeakSet<object>;
};

function bus(): EventEmitter {
  if (!g.__statusBus) {
    g.__statusBus = new EventEmitter();
    g.__statusBus.setMaxListeners(0);
  }
  return g.__statusBus;
}

/** Suscribe un listener a cada resultado guardado. Devuelve la función para desuscribir. */
export function subscribe(listener: (r: HealthResult) => void): () => void {
  // Un suscriptor que falla (p. ej. stream ya cerrado) no debe cortar a los demás.
  const safe = (r: HealthResult) => {
    try {
      listener(r);
    } catch {
      /* ignorado: el suscriptor se limpia en su propio cancel/abort */
    }
  };
  bus().on(EVENT, safe);
  return () => {
    bus().off(EVENT, safe);
  };
}

// ---------------------------------------------------------------------------
// Tabla propia del registro de cambios
// ---------------------------------------------------------------------------
type Db = ReturnType<typeof getDb>;

function db(): Db {
  const instance = getDb();
  if (!g.__statusLogReady) g.__statusLogReady = new WeakSet();
  if (!g.__statusLogReady.has(instance)) {
    instance.exec(`
      CREATE TABLE IF NOT EXISTS status_change_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        website_id TEXT NOT NULL,
        changed_at TEXT NOT NULL,
        changed_at_ms INTEGER NOT NULL,
        up INTEGER NOT NULL,
        status_code INTEGER NOT NULL,
        previous_status_code INTEGER,
        error TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_status_change_log_site_time
        ON status_change_log (website_id, changed_at_ms);
    `);
    g.__statusLogReady.add(instance);
  }
  return instance;
}

function parse(payload: string): HealthResult | null {
  try {
    return JSON.parse(payload) as HealthResult;
  } catch {
    return null;
  }
}

function toMs(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : Date.now();
}

// ---------------------------------------------------------------------------
// Escritura (equivale a HealthResultListener.onHealthResult)
// ---------------------------------------------------------------------------
export function saveResult(result: HealthResult): void {
  const conn = db();
  const id = result.websiteId;
  const payload = JSON.stringify(result);
  const now = new Date().toISOString();

  conn.transaction(() => {
    // PASO 1: código previo (null = sin estado previo) para detectar cambios.
    const prevRow = conn
      .prepare('SELECT payload FROM website_status WHERE website_id = ?')
      .get(id) as { payload: string } | undefined;
    const previousCode = prevRow ? parse(prevRow.payload)?.statusCode ?? null : null;

    // PASO 2: último estado (upsert) + histórico recortado a los N más recientes.
    conn
      .prepare(
        `INSERT INTO website_status (website_id, payload, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(website_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
      )
      .run(id, payload, now);
    conn
      .prepare('INSERT INTO website_history (website_id, payload, checked_at) VALUES (?, ?, ?)')
      .run(id, payload, result.checkedAt);
    conn
      .prepare(
        `DELETE FROM website_history WHERE website_id = ? AND id NOT IN (
           SELECT id FROM website_history WHERE website_id = ? ORDER BY id DESC LIMIT ?)`,
      )
      .run(id, id, HISTORY_MAX_ENTRIES);

    // PASO 4 (Java): solo se anota si el código CAMBIA y además no es 200.
    const changed = previousCode === null || previousCode !== result.statusCode;
    if (changed && result.statusCode !== OK) {
      const changedMs = toMs(result.checkedAt);
      conn
        .prepare(
          `INSERT INTO status_change_log
             (website_id, changed_at, changed_at_ms, up, status_code, previous_status_code, error)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(id, result.checkedAt, changedMs, result.up ? 1 : 0, result.statusCode, previousCode, result.error ?? null);
      conn
        .prepare('DELETE FROM status_change_log WHERE website_id = ? AND changed_at_ms <= ?')
        .run(id, changedMs - LOG_RETENTION_MS);
    }
  })();

  // PASO 3: difusión en vivo (tras el commit).
  bus().emit(EVENT, result);
}

// ---------------------------------------------------------------------------
// Lectura (equivale a StatusQueryService / WebsiteStatusRepository)
// ---------------------------------------------------------------------------

/** Estado de todos los sitios, ordenado por nombre sin distinguir mayúsculas. */
export function getAllStatuses(): HealthResult[] {
  const rows = db().prepare('SELECT payload FROM website_status').all() as { payload: string }[];
  return rows
    .map((r) => parse(r.payload))
    .filter((r): r is HealthResult => r !== null)
    .sort((a, b) => {
      const x = (a.name ?? '').toLowerCase();
      const y = (b.name ?? '').toLowerCase();
      return x < y ? -1 : x > y ? 1 : 0;
    });
}

export function getStatus(websiteId: string): HealthResult | null {
  const row = db().prepare('SELECT payload FROM website_status WHERE website_id = ?').get(websiteId) as
    | { payload: string }
    | undefined;
  return row ? parse(row.payload) : null;
}

/** Los `limit` resultados más recientes (más reciente primero, como LRANGE 0..limit-1). */
export function getHistory(websiteId: string, limit: number): HealthResult[] {
  const rows = db()
    .prepare('SELECT payload FROM website_history WHERE website_id = ? ORDER BY id DESC LIMIT ?')
    .all(websiteId, Math.max(0, Math.floor(limit))) as { payload: string }[];
  return rows.map((r) => parse(r.payload)).filter((r): r is HealthResult => r !== null);
}

/** Cambios de estatus dentro de la ventana de retención, del más reciente al más antiguo. */
export function getChangeLog(websiteId: string): StatusChangeLogResponse[] {
  const now = Date.now();
  const rows = db()
    .prepare(
      `SELECT changed_at, up, status_code, previous_status_code, error FROM status_change_log
       WHERE website_id = ? AND changed_at_ms BETWEEN ? AND ?
       ORDER BY changed_at_ms DESC, id DESC`,
    )
    .all(websiteId, now - LOG_RETENTION_MS, now) as {
    changed_at: string;
    up: number;
    status_code: number;
    previous_status_code: number | null;
    error: string | null;
  }[];
  return rows.map((r) => ({
    changedAt: r.changed_at,
    up: r.up === 1,
    statusCode: r.status_code,
    previousStatusCode: r.previous_status_code,
    error: r.error,
  }));
}
