import { getHistory, toStatusResponse, HISTORY_MAX_ENTRIES } from '@/lib/server/status-store';
import { isValidId } from '@/lib/server/websites';
import { invalidId, problem } from '@/lib/server/problem';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 20;

/** GET /api/v1/status/{websiteId}/history?limit=N -> N (por defecto 20, acotado a [1, 50]) más recientes primero. */
export async function GET(request: Request, { params }: { params: Promise<{ websiteId: string }> }) {
  const websiteId = (await params).websiteId.toLowerCase();
  const url = new URL(request.url);
  if (!isValidId(websiteId)) return invalidId(websiteId, url.pathname);

  const raw = url.searchParams.get('limit');
  let limit = DEFAULT_LIMIT;
  if (raw !== null && raw.trim() !== '') {
    if (!/^[+-]?\d+$/.test(raw.trim())) return problem(400, 'Bad Request', `Failed to convert 'limit' with value: '${raw}'`, url.pathname);
    limit = Number.parseInt(raw.trim(), 10);
  }
  limit = Math.min(Math.max(limit, 1), HISTORY_MAX_ENTRIES);

  return Response.json(getHistory(websiteId, limit).map(toStatusResponse));
}
