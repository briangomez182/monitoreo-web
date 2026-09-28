'use client';

import type { ReactNode } from 'react';
import { navigate } from '@/lib/client/useHashRoute';
import { authApi } from '@/lib/client/api';

async function logout() {
  try {
    await authApi.logout();
  } finally {
    window.location.replace('/login');
  }
}

function NavLink({ to, active, children }: { to: string; active: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className="supply-micro"
      style={{
        background: 'none',
        border: 'none',
        borderBottom: `1px solid ${active ? 'var(--color-ink)' : 'transparent'}`,
        padding: '4px 0',
        cursor: 'pointer',
        color: active ? 'var(--color-ink)' : 'var(--color-muted-soft)',
        letterSpacing: '0.08em',
      }}
    >
      {children}
    </button>
  );
}

interface TopNavProps {
  route: string;
  live: boolean;
  lastSync: Date | null;
  loading: boolean;
  onNewSite: () => void;
  onRefresh: () => void;
}

/** Barra superior común: navegación entre vistas + controles globales. */
export default function TopNav({ route, live, lastSync, loading, onNewSite, onRefresh }: TopNavProps) {
  const modeLabel = live ? 'STREAM EN VIVO' : 'SONDEO 15S';
  const syncLabel = lastSync ? lastSync.toLocaleTimeString('es-ES') : null;

  return (
    <header className="topnav flex flex-wrap items-center justify-between gap-4">
      <nav className="topnav__nav flex gap-5">
        <NavLink to="/" active={route === '/'}>Dashboard</NavLink>
        <NavLink to="/catalogo" active={route === '/catalogo'}>Catálogo</NavLink>
      </nav>

      {/* Solo mobile: indicador reducido (punto + modo, sin la hora). */}
      <span
        className="topnav__live supply-micro md:hidden"
        data-live={live ? 'true' : 'false'}
        title={syncLabel ? `${modeLabel} · ${syncLabel}` : modeLabel}
      >
        <span className="topnav__live-dot" aria-hidden="true" />
        {live ? 'EN VIVO' : 'SONDEO'}
      </span>

      <div className="topnav__actions flex items-center gap-3">
        <span className="supply-micro hidden md:inline">
          {modeLabel}
          {syncLabel ? ` · ${syncLabel}` : ''}
        </span>
        {loading ? <span className="supply-loader" aria-label="Cargando" /> : null}
        <button
          type="button"
          className="topnav__refresh supply-btn supply-btn--ghost"
          onClick={onRefresh}
          aria-label="Refrescar"
        >
          <span className="hidden md:inline">Refrescar</span>
          <span className="md:hidden" aria-hidden="true">⟳</span>
        </button>
        <button type="button" className="supply-btn supply-btn--primary" onClick={onNewSite}>
          Nuevo sitio
        </button>
        <button type="button" className="supply-btn supply-btn--ghost" onClick={logout}>
          Salir
        </button>
      </div>
    </header>
  );
}
