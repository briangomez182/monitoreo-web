import { requestCheck } from '@/lib/server/scheduler';
import { getWebsite, isValidId } from '@/lib/server/websites';
import { invalidId, notFoundWebsite } from '@/lib/server/problem';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/websites/{id}/check -> 202 sin cuerpo; 404 si no existe.
 * El resultado llega al dashboard por SSE cuando termina el chequeo.
 */
export async function POST(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const path = `/api/v1/websites/${id}/check`;
  if (!isValidId(id)) return invalidId(id, path);
  const website = getWebsite(id);
  if (!website) return notFoundWebsite(id.toLowerCase(), path);
  requestCheck(website);
  return new Response(null, { status: 202 });
}
