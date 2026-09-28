/**
 * Metadatos de los códigos de estado HTTP más habituales.
 * `statusPhrase` da la frase corta que sustituye al índice de catálogo en la
 * tarjeta; `statusDescription` da el texto largo que aparece en el tooltip.
 */
const STATUS_TEXT: Record<number, [string, string]> = {
  // 1xx — Informativas
  100: ['Continue', 'El servidor recibió las cabeceras de la petición y el cliente puede continuar enviando el cuerpo.'],
  101: ['Switching Protocols', 'El servidor acepta cambiar al protocolo que el cliente solicitó en la cabecera Upgrade.'],

  // 2xx — Éxito
  200: ['OK', 'La petición se resolvió correctamente y la respuesta incluye el recurso solicitado.'],
  201: ['Created', 'La petición se completó y, como resultado, se creó un nuevo recurso en el servidor.'],
  202: ['Accepted', 'El servidor aceptó la petición para procesarla, pero todavía no ha terminado de hacerlo.'],
  204: ['No Content', 'La petición se resolvió correctamente, pero no hay contenido que devolver en el cuerpo.'],
  206: ['Partial Content', 'El servidor devuelve solo la parte del recurso que el cliente pidió mediante un rango.'],

  // 3xx — Redirección
  301: ['Moved Permanently', 'El recurso cambió de dirección de forma permanente; las próximas peticiones deben usar la nueva URL.'],
  302: ['Found', 'El recurso está temporalmente en otra dirección; el cliente debería seguir la redirección sin cambiar la URL original.'],
  303: ['See Other', 'La respuesta a la petición se encuentra en otra URL, a la que se debe acceder mediante GET.'],
  304: ['Not Modified', 'El recurso no ha cambiado desde la última consulta; el cliente puede usar la copia que tiene en caché.'],
  307: ['Temporary Redirect', 'El recurso está temporalmente en otra URL y el cliente debe repetir la petición con el mismo método.'],
  308: ['Permanent Redirect', 'El recurso cambió de dirección de forma permanente y el cliente debe repetir la petición con el mismo método.'],

  // 4xx — Error del cliente
  400: ['Bad Request', 'El servidor no puede procesar la petición porque está mal formada o contiene datos no válidos.'],
  401: ['Unauthorized', 'La petición requiere autenticación y el cliente no la ha proporcionado o sus credenciales no son válidas.'],
  403: ['Forbidden', 'El servidor entendió la petición pero se niega a atenderla: el cliente no tiene permiso sobre ese recurso.'],
  404: ['Not Found', 'Este código indica que el host ha sido capaz de comunicarse con el servidor, pero no existe el recurso que ha sido pedido.'],
  405: ['Method Not Allowed', 'El recurso existe, pero no admite el método HTTP utilizado en la petición.'],
  408: ['Request Timeout', 'El servidor cerró la conexión porque el cliente tardó demasiado en enviar la petición completa.'],
  409: ['Conflict', 'La petición choca con el estado actual del recurso, por ejemplo una edición sobre una versión ya modificada.'],
  410: ['Gone', 'El recurso existió pero se eliminó de forma permanente y no se conoce una dirección alternativa.'],
  418: ["I'm a teapot", 'Respuesta de broma de un RFC humorístico: el servidor es una tetera y se niega a preparar café.'],
  429: ['Too Many Requests', 'El cliente ha enviado demasiadas peticiones en poco tiempo y el servidor le pide que reduzca el ritmo.'],

  // 5xx — Error del servidor
  500: ['Internal Server Error', 'El servidor encontró un error inesperado que le impide completar la petición.'],
  501: ['Not Implemented', 'El servidor no reconoce el método de la petición o no tiene la capacidad de atenderla.'],
  502: ['Bad Gateway', 'El servidor, actuando como pasarela, recibió una respuesta no válida del servidor al que consultó.'],
  503: ['Service Unavailable', 'El servidor no está disponible temporalmente, normalmente por sobrecarga o tareas de mantenimiento.'],
  504: ['Gateway Timeout', 'El servidor, actuando como pasarela, no recibió a tiempo la respuesta del servidor al que consultó.'],
};

const FAMILY_TEXT: Record<number, [string, string]> = {
  1: ['Información', 'Respuesta informativa: el servidor recibió la petición y el proceso continúa.'],
  2: ['Éxito', 'La petición se recibió, se entendió y se procesó correctamente.'],
  3: ['Redirección', 'Hace falta una acción adicional del cliente para completar la petición.'],
  4: ['Error de cliente', 'La petición contiene un error o no puede atenderse tal y como está planteada.'],
  5: ['Error de servidor', 'El servidor falló al intentar procesar una petición aparentemente válida.'],
};

/** Color por familia de código HTTP: 1xx info, 2xx ok, 3xx redirección, 4xx cliente, 5xx servidor. */
const FAMILY_COLOR: Record<number, string> = {
  1: '#2f6f9f',
  2: 'var(--color-status-up)',
  3: '#8a6d1d',
  4: '#a11213',
  5: 'var(--color-status-down)',
};

/** Etiqueta corta por familia para la marca de estado. */
const FAMILY_MARK: Record<number, string> = {
  1: 'INFO',
  2: 'OK',
  3: 'REDIRECCIÓN',
  4: 'ERROR CLIENTE',
  5: 'ERROR SERVIDOR',
};

/** Color asociado al código; casi-negro si no hay código. */
export function statusColor(code: number | null | undefined) {
  if (!code) return 'var(--color-ink)';
  return FAMILY_COLOR[Math.floor(code / 100)] ?? 'var(--color-ink)';
}

/** Texto de la marca de estado, p. ej. 100 → "100 INFO", 404 → "404 ERROR CLIENTE". */
export function statusMarkLabel(code: number | null | undefined) {
  if (!code) return null;
  const family = FAMILY_MARK[Math.floor(code / 100)];
  return family ? `${code} ${family}` : `${code}`;
}

/** Frase corta del código, p. ej. 404 → "Not Found". */
export function statusPhrase(code: number | null | undefined) {
  if (!code) return '—';
  const known = STATUS_TEXT[code];
  if (known) return known[0];
  const family = FAMILY_TEXT[Math.floor(code / 100)];
  return family ? family[0] : `Código ${code}`;
}

/** Texto largo para el tooltip, con el número delante. */
export function statusDescription(code: number | null | undefined) {
  if (!code) return 'Todavía no hay una respuesta registrada para este sitio.';
  const known = STATUS_TEXT[code];
  if (known) return `${code} ${known[0]} — ${known[1]}`;
  const family = FAMILY_TEXT[Math.floor(code / 100)];
  return family ? `${code} — ${family[1]}` : `Código HTTP ${code}.`;
}
