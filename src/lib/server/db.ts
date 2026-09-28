import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Conexión SQLite única (better-sqlite3 es síncrono y seguro para un solo proceso).
 * Se guarda en globalThis para que el HMR de Next no abra una conexión por recarga.
 *
 * Reemplaza a:
 *   - PostgreSQL (tabla websites, migraciones Flyway V1..V3)
 *   - Redis `website:status:{id}`  -> tabla website_status
 *   - Redis `website:history:{id}` -> tabla website_history
 */

type Db = Database.Database;

const globalForDb = globalThis as unknown as { __monitoringDb?: Db };

const SCHEMA = `
CREATE TABLE IF NOT EXISTS websites (
  id                      TEXT    PRIMARY KEY,
  name                    TEXT    NOT NULL,
  url                     TEXT    NOT NULL,
  login_endpoint          TEXT    NOT NULL,
  check_frequency_seconds INTEGER NOT NULL CHECK (check_frequency_seconds >= 10),
  active                  INTEGER NOT NULL DEFAULT 1,
  destacado               TEXT,
  last_enqueued_at        TEXT,
  created_at              TEXT    NOT NULL,
  updated_at              TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_websites_active ON websites (active);

CREATE TABLE IF NOT EXISTS website_status (
  website_id TEXT PRIMARY KEY,
  payload    TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS website_history (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  website_id TEXT    NOT NULL,
  payload    TEXT    NOT NULL,
  checked_at TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_website_history_site ON website_history (website_id, id DESC);

CREATE TABLE IF NOT EXISTS status_change_log (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  website_id           TEXT    NOT NULL,
  changed_at           TEXT    NOT NULL,
  changed_at_ms        INTEGER NOT NULL,
  up                   INTEGER NOT NULL,
  status_code          INTEGER NOT NULL,
  previous_status_code INTEGER,
  error                TEXT
);
CREATE INDEX IF NOT EXISTS idx_status_change_log_site_time ON status_change_log (website_id, changed_at_ms);
`;

/** Los 10 sitios de prueba de la migración V2 (todos cada 300 s, activos). */
const SEED: Array<[string, string, string, string]> = [
  ['11111111-0000-4000-8000-000000000001', 'Hey Bear Sensory - Smoothie Mix Fun Dance',
    'https://www.youtube.com', 'https://www.youtube.com/watch?v=Rw9wJRcnhbs'],
  ['11111111-0000-4000-8000-000000000002', 'Google',
    'https://www.google.com', 'https://www.google.com'],
  ['11111111-0000-4000-8000-000000000003', 'GitHub',
    'https://github.com', 'https://github.com/login'],
  ['11111111-0000-4000-8000-000000000004', 'Wikipedia',
    'https://www.wikipedia.org', 'https://www.wikipedia.org'],
  ['11111111-0000-4000-8000-000000000005', 'Cloudflare',
    'https://www.cloudflare.com', 'https://www.cloudflare.com'],
  ['11111111-0000-4000-8000-000000000006', 'Stack Overflow',
    'https://stackoverflow.com', 'https://stackoverflow.com/users/login'],
  ['11111111-0000-4000-8000-000000000007', 'Spring',
    'https://spring.io', 'https://spring.io/projects/spring-boot'],
  ['11111111-0000-4000-8000-000000000008', 'Apache Kafka',
    'https://kafka.apache.org', 'https://kafka.apache.org/documentation/'],
  ['11111111-0000-4000-8000-000000000009', 'Redis',
    'https://redis.io', 'https://redis.io/docs/latest/'],
  ['11111111-0000-4000-8000-00000000000a', 'HTTPBin (200 OK de control)',
    'https://httpbin.org', 'https://httpbin.org/status/200'],
];

function seedIfEmpty(db: Db): void {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM websites').get() as { n: number };
  if (n > 0) return;
  const now = new Date().toISOString();
  const insert = db.prepare(
    `INSERT INTO websites (id, name, url, login_endpoint, check_frequency_seconds, active,
                           destacado, last_enqueued_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, 300, 1, NULL, NULL, ?, ?)`,
  );
  db.transaction(() => {
    for (const [id, name, url, loginEndpoint] of SEED) {
      insert.run(id, name, url, loginEndpoint, now, now);
    }
  })();
}

function open(): Db {
  const file = process.env.DATABASE_PATH
    ? path.resolve(process.env.DATABASE_PATH)
    : path.join(process.cwd(), 'data', 'monitoring.db');
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.exec(SCHEMA);
  seedIfEmpty(db);
  return db;
}

export function getDb(): Db {
  if (!globalForDb.__monitoringDb) {
    globalForDb.__monitoringDb = open();
  }
  return globalForDb.__monitoringDb;
}
