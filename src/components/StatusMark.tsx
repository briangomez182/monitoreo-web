import { statusColor, statusMarkLabel } from '@/lib/client/httpStatus';

export type StatusState = 'UP' | 'DOWN' | 'UNKNOWN';

/**
 * Marca de estado. Si hay código HTTP, el color y la etiqueta salen de su
 * familia (100 → azul "INFO", 404 → rojo "ERROR CLIENTE", …). Sin código se
 * cae al estado crudo del backend (UP / DOWN / desconocido).
 */
const FALLBACK: Record<StatusState, { color: string; label: string }> = {
  UP: { color: 'var(--color-status-up)', label: 'OK' },
  DOWN: { color: 'var(--color-status-down)', label: 'FALLO' },
  UNKNOWN: { color: 'var(--color-border-soft)', label: 'SIN DATOS' },
};

export default function StatusMark({ status, code }: { status: StatusState; code?: number | null }) {
  const color = code ? statusColor(code) : (FALLBACK[status] ?? FALLBACK.UNKNOWN).color;
  const label = code ? statusMarkLabel(code) : (FALLBACK[status] ?? FALLBACK.UNKNOWN).label;

  return (
    <span className="status-mark inline-flex items-center gap-2" style={{ minWidth: 0 }}>
      <span
        aria-hidden="true"
        style={{ background: color, width: 8, height: 8, borderRadius: 9999, flexShrink: 0 }}
      />
      <span
        className="status-mark__label supply-micro"
        style={{
          color,
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '0.04em',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label}
      </span>
    </span>
  );
}
