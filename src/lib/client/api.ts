/**
 * Cliente HTTP del dashboard.
 * Las rutas son relativas: el mismo servidor Next atiende la UI y la API,
 * así que no hay URLs hardcodeadas.
 */
import type { StatusChangeLog, Website, WebsitePayload, WebsiteStatus } from './types';

const WEBSITES_URL = '/api/v1/websites';
const STATUS_URL = '/api/v1/status';
const AUTH_URL = '/api/auth';

async function request<T = unknown>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  // Sesión vencida o ausente: volver al login (salvo en el propio login).
  if (response.status === 401 && !url.startsWith(AUTH_URL)) {
    window.location.replace('/login');
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const problem = await response.json();
      detail = problem.detail || problem.message || detail;
    } catch {
      /* la respuesta no era JSON: nos quedamos con el código */
    }
    throw new Error(detail);
  }

  // 204 (delete, login, logout) y 202 (chequeo encolado) no traen cuerpo.
  return (response.status === 204 || response.status === 202 ? null : response.json()) as Promise<T>;
}

export const websitesApi = {
  list: () => request<Website[]>(WEBSITES_URL),
  create: (payload: WebsitePayload) =>
    request<Website>(WEBSITES_URL, { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: WebsitePayload) =>
    request<Website>(`${WEBSITES_URL}/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  remove: (id: string) => request<null>(`${WEBSITES_URL}/${id}`, { method: 'DELETE' }),
  check: (id: string) => request<null>(`${WEBSITES_URL}/${id}/check`, { method: 'POST' }),
};

export const statusApi = {
  list: () => request<WebsiteStatus[]>(STATUS_URL),
  streamUrl: `${STATUS_URL}/stream`,
  // Registro de cambios de estatus (código != 200) de las últimas 24 h.
  logs: (id: string) => request<StatusChangeLog[]>(`${STATUS_URL}/${id}/logs`),
};

export const authApi = {
  login: (username: string, password: string) =>
    request<null>(`${AUTH_URL}/login`, { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => request<null>(`${AUTH_URL}/logout`, { method: 'POST' }),
};
