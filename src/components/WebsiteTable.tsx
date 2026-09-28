'use client';

import type { CSSProperties } from 'react';
import StatusMark from './StatusMark';
import { useInView } from '@/lib/client/useInView';
import { navigate } from '@/lib/client/useHashRoute';
import { isUp } from '@/lib/client/types';
import { statusColor, statusMarkLabel } from '@/lib/client/httpStatus';
import type { StatusById, Website, WebsiteStatus } from '@/lib/client/types';

interface WebsiteTableProps {
  websites: Website[];
  statusById: StatusById;
  onEdit: (website: Website) => void;
  onDelete: (website: Website) => void;
}

export default function WebsiteTable({ websites, statusById, onEdit, onDelete }: WebsiteTableProps) {
  if (websites.length === 0) {
    return <p className="supply-label supply-table-in">No hay sitios registrados todavía.</p>;
  }

  return (
    <>
    <div className="supply-card supply-table-in catalog-desktop" style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
        <thead>
          <tr>
            {['SITIO', 'ENDPOINT DE LOGIN', 'FRECUENCIA', 'ACTIVO', 'ESTADO', ''].map((header) => (
              <th key={header} className="supply-micro" style={headStyle}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {websites.map((website, index) => (
            <Row
              key={website.id}
              website={website}
              status={statusById[website.id]}
              onEdit={onEdit}
              onDelete={onDelete}
              index={index}
            />
          ))}
        </tbody>
      </table>
    </div>

    {/* Markup compacto para < 768px; en desktop queda oculto por CSS (mobile-catalog.css). */}
    <ul className="supply-card supply-table-in catalog-mobile">
      {websites.map((website, index) => (
        <MobileItem
          key={website.id}
          website={website}
          status={statusById[website.id]}
          onEdit={onEdit}
          onDelete={onDelete}
          index={index}
        />
      ))}
    </ul>
    </>
  );
}

/** "300" → "5 MIN", "3600" → "1 H", "45" → "45 S". */
function formatFrequency(seconds: number) {
  if (seconds >= 3600 && seconds % 3600 === 0) return `${seconds / 3600} H`;
  if (seconds >= 60 && seconds % 60 === 0) return `${seconds / 60} MIN`;
  return `${seconds} S`;
}

/** Fila compacta del catálogo en mobile: estado, nombre, frecuencia y acciones. */
function MobileItem({ website, status, onEdit, onDelete, index }: RowProps) {
  const [ref, inView] = useInView<HTMLLIElement>();
  const code = status?.statusCode || null;
  const state = status ? (isUp(status) ? 'UP' : 'DOWN') : 'UNKNOWN';
  const color = code
    ? statusColor(code)
    : state === 'UP'
      ? 'var(--color-status-up)'
      : state === 'DOWN'
        ? 'var(--color-status-down)'
        : 'var(--color-border-soft)';
  const label = code ? statusMarkLabel(code) ?? String(code) : state === 'UNKNOWN' ? 'SIN DATOS' : state;

  return (
    <li
      ref={ref}
      className={`catalog-item supply-reveal${inView ? ' is-in' : ''}`}
      style={{ animationDelay: `${Math.min(index, 20) * 50}ms` }}
    >
      <span className="catalog-item__dot" style={{ background: color }} title={label} aria-label={label} role="img" />
      <div className="catalog-item__main">
        <span className="catalog-item__name" title={website.url}>{website.name}</span>
        <span className="catalog-item__meta">
          {formatFrequency(website.checkFrequencySeconds)}
          {website.active ? null : <span className="catalog-item__inactive">Inactivo</span>}
        </span>
      </div>
      <div className="catalog-item__actions">
        <button type="button" className="supply-btn supply-btn--ghost catalog-item__btn" onClick={() => onEdit(website)}>
          Editar
        </button>
        <button type="button" className="supply-btn supply-btn--ghost catalog-item__btn" onClick={() => navigate(`/logs/${website.id}`)}>
          Logs
        </button>
        <button
          type="button"
          className="supply-btn supply-btn--ghost catalog-item__btn"
          onClick={() => onDelete(website)}
          aria-label={`Borrar ${website.name}`}
        >
          Borrar
        </button>
      </div>
    </li>
  );
}

/** Fila que cae en cascada al aparecer y se re-anima al reentrar en el viewport. */
interface RowProps {
  website: Website;
  status: WebsiteStatus | undefined;
  onEdit: (website: Website) => void;
  onDelete: (website: Website) => void;
  index: number;
}

function Row({ website, status, onEdit, onDelete, index }: RowProps) {
  const [ref, inView] = useInView<HTMLTableRowElement>();

  return (
    <tr
      ref={ref}
      className={`supply-reveal${inView ? ' is-in' : ''}`}
      style={{ animationDelay: `${Math.min(index, 20) * 50}ms` }}
    >
      <td style={cellStyle}>{website.name}</td>
      <td style={{ ...cellStyle, color: 'var(--color-muted)', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {website.loginEndpoint}
      </td>
      <td style={cellStyle}>{website.checkFrequencySeconds}s</td>
      <td style={cellStyle}>{website.active ? 'SÍ' : 'NO'}</td>
      <td style={cellStyle}>
        <StatusMark status={status ? (isUp(status) ? 'UP' : 'DOWN') : 'UNKNOWN'} code={status?.statusCode} />
      </td>
      <td style={{ ...cellStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
        <button type="button" className="supply-btn supply-btn--ghost" onClick={() => navigate(`/logs/${website.id}`)}>
          Logs
        </button>{' '}
        <button type="button" className="supply-btn supply-btn--ghost" onClick={() => onEdit(website)}>
          Editar
        </button>{' '}
        <button type="button" className="supply-btn supply-btn--ghost" onClick={() => onDelete(website)}>
          Borrar
        </button>
      </td>
    </tr>
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
};
