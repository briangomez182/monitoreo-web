/**
 * Tipos compartidos del lado servidor.
 */

/** Sitio del catálogo tal como lo expone la API (mismo JSON que WebsiteResponse de Java). */
export interface Website {
  id: string;
  name: string;
  url: string;
  loginEndpoint: string;
  checkFrequencySeconds: number;
  active: boolean;
  /** Contacto del responsable del sitio (nombre, teléfono, correo). Opcional. */
  destacado: string | null;
  /** Última vez que el scheduler lanzó un chequeo de este sitio (ISO) o null si nunca. */
  lastEnqueuedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Datos de entrada ya validados y normalizados (trim, defaults) para alta/edición. */
export interface WebsiteInput {
  name: string;
  url: string;
  loginEndpoint: string;
  checkFrequencySeconds: number;
  active: boolean;
  destacado: string | null;
}

/** Error de validación de un campo (equivalente a un FieldError de Spring). */
export interface FieldError {
  field: string;
  message: string;
}

/** Resultado de un chequeo HTTP de un sitio. */
export interface HealthResult {
  websiteId: string;
  name: string;
  url: string;
  loginEndpoint: string;
  up: boolean;
  statusCode: number;
  responseTimeMs: number;
  /** ISO-8601 */
  checkedAt: string;
  error: string | null;
}
