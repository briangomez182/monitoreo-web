import { createWebsite, formatFieldErrors, listWebsites, validateWebsiteInput } from '@/lib/server/websites';
import { problem, readJson, unreadableBody } from '@/lib/server/problem';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PATH = '/api/v1/websites';

/** GET /api/v1/websites -> 200 con el listado ordenado por nombre. */
export function GET() {
  return Response.json(listWebsites());
}

/** POST /api/v1/websites -> 201 + Location, 400 si el body no es válido. */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (body === undefined) return unreadableBody(PATH);

  const result = validateWebsiteInput(body);
  if (!result.ok) return problem(400, 'Datos inválidos', formatFieldErrors(result.errors), PATH);

  const created = createWebsite(result.value);
  const location = new URL(`${PATH}/${created.id}`, request.url).toString();
  return Response.json(created, { status: 201, headers: { Location: location } });
}
