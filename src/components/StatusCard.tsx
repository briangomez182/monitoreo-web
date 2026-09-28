'use client';

import { forwardRef, useEffect, useState } from 'react';
import type { CSSProperties, HTMLAttributes } from 'react';
import StatusMark from './StatusMark';
import { statusPhrase, statusDescription, statusColor } from '@/lib/client/httpStatus';
import { useCountUp } from '@/lib/client/useCountUp';
import { isUp } from '@/lib/client/types';
import type { Website, WebsiteStatus } from '@/lib/client/types';

// Duración (ms) de la animación del número de estatus. Súbelo para que sea más
// lenta, bájalo para acelerarla.
const COUNT_UP_MS = 3000;

const pad = (n: number) => String(n).padStart(2, '0');

/** Tiempo transcurrido como cronómetro que avanza segundo a segundo. */
function formatAgo(isoDate: string | null | undefined, now: number) {
  if (!isoDate) return '—';
  const total = Math.max(0, Math.floor((now - new Date(isoDate).getTime()) / 1000));
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  if (h > 0) return `HACE ${h}:${pad(m)}:${pad(s)}`;
  return `HACE ${m}:${pad(s)}`;
}

/**
 * Tarjeta-espécimen: el objeto (la latencia) ocupa el cuerpo y la tira de
 * metadatos inferior repite el patrón catálogo ID izquierda / nombre derecha.
 */
interface StatusCardProps {
  website: Website;
  status: WebsiteStatus | undefined;
  onRecheck?: (website: Website) => Promise<unknown>;
  index?: number;
  style?: CSSProperties;
  isDragging?: boolean;
  dragHandleRef?: (element: HTMLElement | null) => void;
  dragHandleProps?: HTMLAttributes<HTMLButtonElement>;
}

const StatusCard = forwardRef<HTMLElement, StatusCardProps>(function StatusCard(
  { website, status, onRecheck, index = 0, style, isDragging = false, dragHandleRef, dragHandleProps },
  ref,
) {
  const state = status ? (isUp(status) ? 'UP' : 'DOWN') : 'UNKNOWN';
  const latency = status ? `${status.responseTimeMs}` : '—';
  const code = status?.statusCode ?? null;
  // La marca de tiempo del chequeo cambia en cada evaluación del endpoint
  // (botón de re-chequeo o barrido periódico), así que sirve de disparador
  // para repetir la animación 0 → código aunque el código no cambie.
  const animatedCode = useCountUp(code, COUNT_UP_MS, status?.checkedAt);
  const [checking, setChecking] = useState(false);

  // Al terminar la animación de entrada quitamos la clase: su fill-mode "both"
  // mantendría el transform del keyframe y pisaría el que aplica el drag & drop.
  const [entered, setEntered] = useState(false);

  // Cronómetro: un tick por segundo para que el tiempo transcurrido avance solo.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Deja que el agua "suba" desde abajo en el primer frame tras montar.
  const [waveRaised, setWaveRaised] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setWaveRaised(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Nivel del agua del footer = cuenta atrás hasta el próximo chequeo.
  // 0 = recién evaluado (agua baja) · 1 = a punto de re-evaluar (llena arriba).
  const freqMs = (website.checkFrequencySeconds ?? 0) * 1000;
  const sinceCheck = status?.checkedAt ? now - new Date(status.checkedAt).getTime() : 0;
  const cycleProgress = freqMs > 0 ? Math.min(1, Math.max(0, sinceCheck / freqMs)) : 0;
  // Ease-in: sube despacio casi todo el ciclo y se dispara cuando falta poco.
  const waveFillPct = waveRaised ? 80 - Math.pow(cycleProgress, 1.7) * 92 : 101;

  const handleRecheck = async () => {
    if (checking || !onRecheck) return;
    setChecking(true);
    try {
      await onRecheck(website);
    } catch {
      /* el error de red ya se refleja en el banner global del dashboard */
    } finally {
      // El resultado real llega por SSE; mantenemos el botón "ocupado" un
      // instante para que se note que la orden salió.
      setTimeout(() => setChecking(false), 1500);
    }
  };

  const className = [
    'supply-card status-card flex flex-col',
    entered ? '' : 'supply-card--enter',
    isDragging ? 'supply-card--dragging' : '',
  ].filter(Boolean).join(' ');

  return (
    <article
      ref={ref}
      className={className}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) setEntered(true);
      }}
      style={{ animationDelay: `${Math.min(index, 30) * 60}ms`, ...style }}
    >
      <header className="supply-card__head flex items-start justify-between gap-3 px-3 pt-3">
        <div className="supply-card__group flex items-center gap-2">
          <button
            type="button"
            ref={dragHandleRef}
            className="supply-drag"
            title="Arrastrar para reordenar"
            aria-label="Arrastrar para reordenar"
            {...dragHandleProps}
          >
            ⠿
          </button>
          <StatusMark status={state} code={code} />
        </div>
        <div className="supply-card__group flex items-center gap-2">
          <span className="supply-card__ago supply-micro" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatAgo(status?.checkedAt, now)}
          </span>
          <button
            type="button"
            className="supply-recheck"
            onClick={handleRecheck}
            disabled={checking}
            title="Volver a chequear este sitio ahora"
            aria-label="Volver a chequear este sitio ahora"
          >
            {checking ? '···' : '⟳'}
          </button>
        </div>
      </header>

      <div className="supply-card__body flex flex-col items-center justify-center px-3 py-6" style={{ flexGrow: 1 }}>
        <div className="supply-card__code" style={{ color: statusColor(code) }}>
          {code ? animatedCode : '—'}
        </div>
        <div className="supply-card__code-label supply-micro mt-2">HTTP ESTATUS</div>
        <div className="supply-card__latency supply-micro mt-4" style={{ color: 'var(--color-muted)' }}>
          {latency} MS
        </div>
      </div>

      {status?.error ? (
        <p
          className="supply-card__error px-3 pb-3 m-0 text-center"
          style={{ fontSize: 10, color: code ? statusColor(code) : 'var(--color-status-down)', overflowWrap: 'anywhere' }}
          title={status.error}
        >
          {status.error.length > 90 ? `${status.error.slice(0, 90)}…` : status.error}
        </p>
      ) : null}

      <footer
        className="supply-footer flex items-center justify-between gap-3 px-3"
        style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 10, paddingBottom: 10 }}
      >
        {/* Marea: el nivel del agua sube conforme se acerca el próximo chequeo
            y baja de golpe al llegar un estatus nuevo. Se tiñe con el estado. */}
        <div
          className="supply-wave"
          aria-hidden="true"
          style={{
            '--wave-color': code ? statusColor(code) : 'var(--color-border-soft)',
            transform: `translateY(${waveFillPct}%)`,
          } as CSSProperties}
        >
          <span className="supply-wave__layer supply-wave__layer--back" />
          <span className="supply-wave__layer supply-wave__layer--front" />
        </div>

        <span
          className="supply-card__phrase supply-footer__fg"
          style={{
            fontSize: 11,
            color: statusColor(status?.statusCode),
            cursor: status?.statusCode ? 'help' : 'default',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '55%',
          }}
          title={statusDescription(status?.statusCode)}
        >
          {statusPhrase(status?.statusCode)}
        </span>
        <a
          className="supply-card__name supply-label supply-sitename supply-footer__fg"
          href={website.loginEndpoint}
          target="_blank"
          rel="noreferrer"
          title={website.loginEndpoint}
          style={{ textDecoration: 'none' }}
        >
          {website.name}
        </a>
      </footer>
    </article>
  );
});

export default StatusCard;
