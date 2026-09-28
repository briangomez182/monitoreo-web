import { getAllStatuses, toStatusResponse } from '@/lib/server/status-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/status -> estado actual de todos los sitios (ordenado por nombre). */
export function GET() {
  return Response.json(getAllStatuses().map(toStatusResponse));
}
