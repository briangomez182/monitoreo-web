'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import type { Website } from './types';

const STORAGE_KEY = 'monitoreo-web:card-order';

function readStored(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function writeStored(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* almacenamiento no disponible: el orden solo durará esta sesión */
  }
}

/**
 * Mantiene un orden manual de las tarjetas del dashboard, persistido en
 * localStorage. Reconcilia el orden guardado con la lista real que llega de la
 * API: los sitios nuevos se añaden al final y los eliminados se descartan.
 */
export function useCardOrder(websites: Website[]) {
  const [orderIds, setOrderIds] = useState<string[]>(readStored);

  const orderedIds = useMemo(() => {
    const incoming = websites.map((w) => w.id);
    const present = new Set(incoming);
    const kept = orderIds.filter((id) => present.has(id));
    const known = new Set(kept);
    const appended = incoming.filter((id) => !known.has(id));
    return [...kept, ...appended];
  }, [websites, orderIds]);

  // Si altas/bajas cambiaron la lista reconciliada, la fijamos y persistimos.
  useEffect(() => {
    const changed =
      orderedIds.length !== orderIds.length ||
      orderedIds.some((id, i) => id !== orderIds[i]);
    if (changed) {
      setOrderIds(orderedIds);
      writeStored(orderedIds);
    }
  }, [orderedIds, orderIds]);

  const byId = useMemo(() => new Map(websites.map((w) => [w.id, w])), [websites]);

  const orderedWebsites = useMemo(
    () => orderedIds.map((id) => byId.get(id)).filter((w): w is Website => Boolean(w)),
    [orderedIds, byId],
  );

  const reorder = useCallback((activeId: string, overId: string | null | undefined) => {
    if (!overId || activeId === overId) return;
    setOrderIds((current) => {
      const from = current.indexOf(activeId);
      const to = current.indexOf(overId);
      if (from === -1 || to === -1) return current;
      const next = arrayMove(current, from, to);
      writeStored(next);
      return next;
    });
  }, []);

  return { orderedWebsites, orderedIds, reorder };
}
