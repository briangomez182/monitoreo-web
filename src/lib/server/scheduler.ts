import { checkWebsite } from '@/lib/server/checker';
import { saveResult } from '@/lib/server/status-store';
import type { Website } from '@/lib/server/types';
import { listDueWebsites, markChecked } from '@/lib/server/websites';

/**
 * EL "RELOJ" DEL SISTEMA (port de WebsiteCheckScheduler.java + el consumo del checker).
 *
 * Tras un retardo inicial, cada SWEEP_INTERVAL_MS barre los sitios vencidos
 * (listDueWebsites decide con active + lastCheckedAt + checkFrequencySeconds),
 * marca cada uno como chequeado "ahora" y lanza su chequeo en segundo plano con
 * un límite de concurrencia. Cada resultado se entrega a saveResult (persistencia + SSE).
 *
 * Como fixedDelay de Spring: el siguiente barrido se programa cuando termina el
 * anterior (el barrido solo encola; no espera a que terminen los chequeos).
 */

const SWEEP_INTERVAL_MS = Number(process.env.SCHEDULER_SWEEP_INTERVAL_MS) || 10_000;
const INITIAL_DELAY_MS = Number(process.env.SCHEDULER_INITIAL_DELAY_MS) || 5_000;
const MAX_CONCURRENCY = Number(process.env.SCHEDULER_MAX_CONCURRENCY) || 10;

interface SchedulerState {
  started: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  /** Sitios encolados o en vuelo: no se vuelven a lanzar hasta que terminen. */
  inFlight: Set<string>;
  queue: Website[];
  running: number;
}

const globalKey = Symbol.for('monitoreo-web.scheduler');
type GlobalWithScheduler = typeof globalThis & { [globalKey]?: SchedulerState };

function state(): SchedulerState {
  const g = globalThis as GlobalWithScheduler;
  if (!g[globalKey]) {
    g[globalKey] = { started: false, timer: null, inFlight: new Set(), queue: [], running: 0 };
  }
  return g[globalKey]!;
}

function pump(s: SchedulerState): void {
  while (s.running < MAX_CONCURRENCY && s.queue.length > 0) {
    const site = s.queue.shift()!;
    s.running++;
    void runCheck(site).finally(() => {
      s.running--;
      s.inFlight.delete(site.id);
      pump(s);
    });
  }
}

async function runCheck(site: Website): Promise<void> {
  try {
    const result = await checkWebsite(site);
    saveResult(result);
  } catch (err) {
    // checkWebsite no lanza; esto cubre fallos de saveResult (BD, SSE...).
    console.error(`[scheduler] Error procesando el chequeo de ${site.name}:`, err);
  }
}

function sweep(s: SchedulerState): void {
  const now = new Date();
  let enqueued = 0;
  try {
    for (const site of listDueWebsites(now)) {
      if (s.inFlight.has(site.id)) continue; // su chequeo anterior todavía no terminó
      markChecked(site.id, now);
      s.inFlight.add(site.id);
      s.queue.push(site);
      enqueued++;
    }
  } catch (err) {
    console.error('[scheduler] Error en el barrido de sitios vencidos:', err);
  }
  if (enqueued > 0) {
    console.info(`[scheduler] Encolados ${enqueued} chequeos`);
    pump(s);
  }
}

/**
 * Chequeo inmediato a pedido (botón ⟳, POST /api/v1/websites/{id}/check).
 * Usa la misma cola que el barrido y marca lastEnqueuedAt para que el
 * scheduler no lo vuelva a encolar justo después.
 */
export function requestCheck(site: Website): void {
  const s = state();
  const now = new Date();
  markChecked(site.id, now);
  if (s.inFlight.has(site.id)) return; // ya hay un chequeo en curso para este sitio
  s.inFlight.add(site.id);
  s.queue.push(site);
  pump(s);
}

function scheduleNext(s: SchedulerState, delayMs: number): void {
  s.timer = setTimeout(() => {
    try {
      sweep(s);
    } finally {
      scheduleNext(s, SWEEP_INTERVAL_MS);
    }
  }, delayMs);
  // No mantener vivo el proceso solo por el scheduler.
  s.timer.unref?.();
}

/** Arranca el scheduler. Idempotente: llamadas repetidas (HMR, varios imports) no duplican timers. */
export function startScheduler(): void {
  const s = state();
  if (s.started) return;
  s.started = true;
  console.info(
    `[scheduler] Iniciado: primer barrido en ${INITIAL_DELAY_MS} ms, luego cada ${SWEEP_INTERVAL_MS} ms (concurrencia ${MAX_CONCURRENCY})`,
  );
  scheduleNext(s, INITIAL_DELAY_MS);
}
