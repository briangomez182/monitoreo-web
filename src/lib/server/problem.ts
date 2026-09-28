/**
 * Respuestas de error con el mismo formato que ProblemDetail (RFC 7807) de Spring:
 * { type, title, status, detail, instance } con Content-Type application/problem+json.
 * El frontend lee `detail` para mostrar el mensaje.
 */
export function problem(status: number, title: string, detail: string, instance?: string): Response {
  return new Response(
    JSON.stringify({ type: 'about:blank', title, status, detail, instance }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

export function notFoundWebsite(id: string, instance?: string): Response {
  return problem(404, 'Sitio no encontrado', `No existe ningún sitio monitorizado con id ${id}`, instance);
}

/** Equivale al 400 que da Spring cuando el {id} no se puede convertir a UUID. */
export function invalidId(id: string, instance?: string): Response {
  return problem(400, 'Bad Request', `Failed to convert 'id' with value: '${id}'`, instance);
}

/** Equivale al 400 de HttpMessageNotReadableException (JSON mal formado). */
export function unreadableBody(instance?: string): Response {
  return problem(400, 'Bad Request', 'Failed to read request', instance);
}

/** Lee el body JSON; devuelve undefined si no es JSON válido. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
