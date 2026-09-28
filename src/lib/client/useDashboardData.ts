'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { statusApi, websitesApi } from './api';
import type { StatusById, Website, WebsiteStatus } from './types';

const POLL_INTERVAL_MS = 15000;

/**
 * Une el catálogo de sitios con el estado en vivo. El estado llega por SSE
 * cuando el navegador puede, con polling como red de seguridad.
 */
export function useDashboardData() {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [statusById, setStatusById] = useState<StatusById>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [live, setLive] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const mergeStatuses = useCallback((list: WebsiteStatus[]) => {
    setStatusById((current) => {
      const next = { ...current };
      list.forEach((item) => {
        next[item.websiteId] = item;
      });
      return next;
    });
    setLastSync(new Date());
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [catalog, statuses] = await Promise.all([websitesApi.list(), statusApi.list()]);
      setWebsites(catalog);
      mergeStatuses(statuses);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [mergeStatuses]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (typeof EventSource === 'undefined') return undefined;

    const source = new EventSource(statusApi.streamUrl);
    eventSourceRef.current = source;

    source.onopen = () => setLive(true);
    source.addEventListener('status', (event) => {
      try {
        mergeStatuses([JSON.parse((event as MessageEvent<string>).data)]);
      } catch {
        /* payload no interpretable: el polling lo corregirá */
      }
    });
    source.onerror = () => setLive(false);

    return () => {
      source.close();
      eventSourceRef.current = null;
    };
  }, [mergeStatuses]);

  return { websites, statusById, loading, error, lastSync, live, refresh };
}
