/** Contrato de datos que consume el dashboard (mismo shape que el backend Java anterior). */

export interface Website {
  id: string;
  name: string;
  url: string;
  loginEndpoint: string;
  checkFrequencySeconds: number;
  active: boolean;
  /** Contacto del dueño del sitio (texto libre, opcional). */
  destacado?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type WebsitePayload = Omit<Website, 'id' | 'createdAt' | 'updatedAt'>;

export interface WebsiteStatus {
  websiteId: string;
  name: string;
  url: string;
  loginEndpoint: string;
  /** "UP" | "DOWN": lo que el dashboard lee para pintar el estado. */
  status?: 'UP' | 'DOWN';
  /** Booleano equivalente; se acepta como alternativa a `status`. */
  up?: boolean;
  statusCode: number;
  responseTimeMs: number;
  checkedAt: string;
  error: string | null;
}

export interface StatusChangeLog {
  changedAt: string;
  up: boolean;
  statusCode: number;
  previousStatusCode: number | null;
  error: string | null;
}

export type StatusById = Record<string, WebsiteStatus | undefined>;

/** Estado normalizado: acepta tanto `status: "UP"` como `up: true`. */
export function isUp(status: WebsiteStatus | undefined | null): boolean {
  if (!status) return false;
  if (status.status) return status.status === 'UP';
  return status.up === true;
}

export function isDown(status: WebsiteStatus | undefined | null): boolean {
  if (!status) return false;
  if (status.status) return status.status === 'DOWN';
  return status.up === false;
}
