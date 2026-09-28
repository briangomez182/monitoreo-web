'use client';

import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { authApi } from '@/lib/client/api';

/** Acceso del administrador. Mismo lenguaje que el modal de alta: tarjeta, micro-labels y botón pill. */
export default function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await authApi.login(username, password);
      window.location.replace('/');
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <main
      className="login-shell p-[40px_24px_80px]"
      style={{
        minHeight: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ width: 'min(400px, 100%)' }}>
        <h1 className="supply-heading" style={{ margin: '0 0 4px' }}>Acceso</h1>
        <p className="supply-micro" style={{ margin: '0 0 16px' }}>Status dashboard · solo administrador</p>

        <form onSubmit={handleSubmit} className="supply-card supply-card--enter" style={{ padding: 16 }}>
          <Field label="Usuario">
            <input
              className="supply-input"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </Field>

          <Field label="Contraseña">
            <input
              className="supply-input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>

          {error ? (
            <p style={{ fontSize: 11, color: 'var(--color-status-down)', margin: '12px 0 0' }}>{error}</p>
          ) : null}

          <footer style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 16 }}>
            {submitting ? <span className="supply-loader" aria-label="Cargando" /> : null}
            <button type="submit" className="supply-btn supply-btn--primary" disabled={submitting}>
              {submitting ? 'Entrando' : 'Entrar'}
            </button>
          </footer>
        </form>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block', marginTop: 12 }}>
      <span className="supply-micro" style={{ display: 'block', marginBottom: 4 }}>{label}</span>
      {children}
    </label>
  );
}
