import {
  deleteWebsite,
  formatFieldErrors,
  getWebsite,
  isValidId,
  updateWebsite,
  validateWebsiteInput,
} from '@/lib/server/websites';
import { invalidId, notFoundWebsite, problem, readJson, unreadableBody } from '@/lib/server/problem';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const pathFor = (id: string) => `/api/v1/websites/${id}`;

/** GET /api/v1/websites/{id} -> 200, 404 si no existe. */
export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  if (!isValidId(id)) return invalidId(id, pathFor(id));
  const website = getWebsite(id);
  return website ? Response.json(website) : notFoundWebsite(id.toLowerCase(), pathFor(id));
}

/** PUT /api/v1/websites/{id} -> 200 con el sitio editado; 400 validación; 404 si no existe. */
export async function PUT(request: Request, { params }: Ctx) {
  const { id } = await params;
  if (!isValidId(id)) return invalidId(id, pathFor(id));

  const body = await readJson(request);
  if (body === undefined) return unreadableBody(pathFor(id));

  const result = validateWebsiteInput(body);
  if (!result.ok) return problem(400, 'Datos inválidos', formatFieldErrors(result.errors), pathFor(id));

  const updated = updateWebsite(id, result.value);
  return updated ? Response.json(updated) : notFoundWebsite(id.toLowerCase(), pathFor(id));
}

/** DELETE /api/v1/websites/{id} -> 204 sin cuerpo, 404 si no existe. */
export async function DELETE(_request: Request, { params }: Ctx) {
  const { id } = await params;
  if (!isValidId(id)) return invalidId(id, pathFor(id));
  return deleteWebsite(id)
    ? new Response(null, { status: 204 })
    : notFoundWebsite(id.toLowerCase(), pathFor(id));
}
