'use client';

import { useEffect, useState } from 'react';

/** Normaliza el hash actual a una ruta tipo "/" o "/catalogo". */
function currentRoute(): string {
  const raw = window.location.hash.replace(/^#/, '');
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return path === '/' ? '/' : path.replace(/\/+$/, '');
}

/** Cambia de ruta (routing por hash, sin dependencias). */
export function navigate(path: string) {
  window.location.hash = path.startsWith('#') ? path : `#${path}`;
}

/** Devuelve la ruta activa y re-renderiza al navegar (incluido el botón atrás). */
export function useHashRoute(): string {
  const [route, setRoute] = useState(currentRoute);
  useEffect(() => {
    const onChange = () => setRoute(currentRoute());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
