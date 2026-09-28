import { getStatus, toStatusResponse } from '@/lib/server/status-store';
import { isValidId } from '@/lib/server/websites';
import { invalidId } from '@/lib/server/problem';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/status/{websiteId} -> 200 con el estado o 404 sin cuerpo. */
export async function GET(request: Request, { params }: { params: Promise<{ websiteId: string }> }) {
  const websiteId = (await params).websiteId.toLowerCase();
  if (!isValidId(websiteId)) return invalidId(websiteId, new URL(request.url).pathname);
  const status = getStatus(websiteId);
  return status ? Response.json(toStatusResponse(status)) : new Response(null, { status: 404 });
}
