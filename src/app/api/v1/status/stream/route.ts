import { subscribe, toStatusResponse } from '@/lib/server/status-store';
import type { HealthResult } from '@/lib/server/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEARTBEAT_MS = 20_000;

/**
 * GET /api/v1/status/stream -> canal Server-Sent Events.
 * Cada resultado guardado se envía como evento `status` con el JSON de
 * WebsiteStatusResponse en `data` (el frontend usa addEventListener('status', ...)).
 */
export function GET(request: Request) {
  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          stop();
        }
      };

      const unsubscribe = subscribe((result: HealthResult) => {
        send(`event: status\ndata: ${JSON.stringify(toStatusResponse(result))}\n\n`);
      });
      const heartbeat = setInterval(() => send(': ping\n\n'), HEARTBEAT_MS);

      const onAbort = () => {
        stop();
        try {
          controller.close();
        } catch {
          /* ya cerrado */
        }
      };

      function stop() {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        request.signal.removeEventListener('abort', onAbort);
      }
      cleanup = stop;

      if (request.signal.aborted) {
        onAbort();
        return;
      }
      request.signal.addEventListener('abort', onAbort);

      // Comentario inicial: fuerza el envío de cabeceras/primer byte a través de proxies.
      send(': connected\n\n');
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
