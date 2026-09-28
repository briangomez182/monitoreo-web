'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import SectionHeading from '../SectionHeading';
import { statusApi } from '@/lib/client/api';
import { statusColor, statusPhrase, statusDescription } from '@/lib/client/httpStatus';
import { navigate } from '@/lib/client/useHashRoute';
import type { StatusChangeLog, Website } from '@/lib/client/types';

const REFRESH_MS = 30000;

function formatWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Versión corta para mobile: "28/09 14:05". */
function formatWhenShort(iso: string) {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Registro de cambios de estatus (código != 200) de un sitio, últimas 24 h. */
export default function LogsView({ websiteId, website }: { websiteId: string; website: Website | undefined }) {
  const [rows, setRows] = useState<StatusChangeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await statusApi.logs(websiteId);
      setRows(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [websiteId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const title = website ? website.name : 'Sitio';

  return (
    <>
      <SectionHeading
        action={
          <button type="button" className="supply-btn supply-btn--ghost" onClick={() => navigate('/catalogo')}>
            ← Catálogo
          </button>
        }
      >
        Logs · {title}
      </SectionHeading>

      <p className="supply-micro" style={{ marginTop: -4, marginBottom: 12 }}>
        Cambios de estatus de las últimas 24 h · mientras responde 200 no se registra nada
      </p>

      {error ? (
        <p className="supply-card" style={{ padding: 12, fontSize: 11, color: 'var(--color-status-down)' }}>
          No se pudieron cargar los logs: {error}
        </p>
      ) : loading ? (
        <p className="supply-label">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="supply-label">Sin cambios de estatus en las últimas 24 h.</p>
      ) : (
        <>
        <div className="supply-card supply-table-in logs-desktop" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
            <thead>
              <tr>
                {['HORA', 'ESTATUS', 'ERROR', 'DESCRIPCIÓN'].map((h) => (
                  <th key={h} className="supply-micro" style={headStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const hasCode = r.statusCode > 0;
                return (
                  <tr key={`${r.changedAt}-${i}`}>
                    <td style={{ ...cellStyle, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                      {formatWhen(r.changedAt)}
                    </td>
                    <td style={{ ...cellStyle, whiteSpace: 'nowrap', color: statusColor(r.statusCode), fontWeight: 500 }}>
                      {r.previousStatusCode ? `${r.previousStatusCode} → ` : ''}
                      {hasCode ? `${r.statusCode} ${statusPhrase(r.statusCode)}` : 'Sin respuesta'}
                    </td>
                    <td style={{ ...cellStyle, color: 'var(--color-muted)', maxWidth: 260, overflowWrap: 'anywhere' }}>
                      {r.error || '—'}
                    </td>
                    <td style={{ ...cellStyle, color: 'var(--color-muted)', maxWidth: 420 }}>
                      {hasCode
                        ? statusDescription(r.statusCode)
                        : 'El servidor no respondió (fallo de conexión, DNS o timeout); no llegó ningún código HTTP.'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Lista compacta para < 768px; en desktop queda oculta por CSS (mobile-catalog.css). */}
        <ul className="supply-card supply-table-in logs-mobile">
          {rows.map((r, i) => {
            const hasCode = r.statusCode > 0;
            const color = hasCode ? statusColor(r.statusCode) : 'var(--color-status-down)';
            const detail = [
              hasCode ? `${r.statusCode} ${statusPhrase(r.statusCode)}` : 'Sin respuesta',
              r.error,
            ].filter(Boolean).join(' · ');
            return (
              <li key={`${r.changedAt}-${i}`} className="logs-item" title={detail}>
                <span className="logs-item__when">{formatWhenShort(r.changedAt)}</span>
                <span className="logs-item__codes">
                  {r.previousStatusCode ? (
                    <span className="logs-item__prev">{r.previousStatusCode} →</span>
                  ) : null}
                  <span style={{ color }}>{hasCode ? r.statusCode : '—'}</span>
                </span>
                <span className="logs-item__state" style={{ color }}>
                  <span aria-hidden="true" className="logs-item__dot" style={{ background: color }} />
                  {r.up ? 'OK' : 'Fallo'}
                </span>
                {r.error ? <span className="logs-item__error">{r.error}</span> : null}
              </li>
            );
          })}
        </ul>
        </>
      )}
    </>
  );
}

const headStyle: CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  borderBottom: '1px solid var(--color-border-subtle)',
  fontWeight: 400,
};

const cellStyle: CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid var(--color-border-subtle)',
  fontSize: 12,
  color: 'var(--color-ink)',
  verticalAlign: 'top',
};
