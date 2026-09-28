'use client';

import { useMemo, useState } from 'react';
import TopNav from './TopNav';
import WebsiteFormModal from './WebsiteFormModal';
import DashboardView from './views/DashboardView';
import CatalogView from './views/CatalogView';
import LogsView from './views/LogsView';
import { websitesApi } from '@/lib/client/api';
import { useDashboardData } from '@/lib/client/useDashboardData';
import { useHashRoute, navigate } from '@/lib/client/useHashRoute';
import { isDown, isUp } from '@/lib/client/types';
import type { Website, WebsitePayload } from '@/lib/client/types';

export default function App() {
  const { websites, statusById, loading, error, lastSync, live, refresh } = useDashboardData();
  const route = useHashRoute();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Website | null>(null);

  const logsMatch = route.match(/^\/logs\/(.+)$/);
  const logsWebsiteId = logsMatch ? logsMatch[1] : null;
  const onCatalog = route === '/catalogo';
  // Los logs se abren desde el catálogo: mantenemos ese enlace resaltado.
  const navRoute = logsWebsiteId ? '/catalogo' : route;

  const summary = useMemo(() => {
    const total = websites.length;
    const up = websites.filter((site) => isUp(statusById[site.id])).length;
    const down = websites.filter((site) => isDown(statusById[site.id])).length;
    return { total, up, down, unknown: total - up - down };
  }, [websites, statusById]);

  // "Nuevo sitio" siempre lleva al Catálogo (donde se ve el listado) y abre el alta.
  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
    navigate('/catalogo');
  };

  const openEdit = (website: Website) => {
    setEditing(website);
    setModalOpen(true);
  };

  const handleSubmit = async (payload: WebsitePayload) => {
    if (editing) {
      await websitesApi.update(editing.id, payload);
    } else {
      await websitesApi.create(payload);
    }
    await refresh();
  };

  const handleDelete = async (website: Website) => {
    if (!window.confirm(`¿Eliminar "${website.name}" del catálogo?`)) return;
    await websitesApi.remove(website.id);
    await refresh();
  };

  // Encola un chequeo inmediato de un solo sitio. El resultado nuevo llega
  // solo por SSE (o por el sondeo de 15s como red de seguridad).
  const handleRecheck = (website: Website) => websitesApi.check(website.id);

  return (
    <div className="app-shell p-[40px_24px_80px]">
      <TopNav
        route={navRoute}
        live={live}
        lastSync={lastSync}
        loading={loading}
        onNewSite={openCreate}
        onRefresh={refresh}
      />

      {error ? (
        <p
          className="supply-card"
          style={{ padding: 12, marginTop: 24, fontSize: 11, color: 'var(--color-status-down)' }}
        >
          No se pudo hablar con la API: {error}
        </p>
      ) : null}

      {logsWebsiteId ? (
        <LogsView
          websiteId={logsWebsiteId}
          website={websites.find((site) => site.id === logsWebsiteId)}
        />
      ) : onCatalog ? (
        <CatalogView
          websites={websites}
          statusById={statusById}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      ) : (
        <DashboardView
          summary={summary}
          websites={websites}
          statusById={statusById}
          onRecheck={handleRecheck}
        />
      )}

      <WebsiteFormModal
        open={modalOpen}
        initialValue={editing}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
