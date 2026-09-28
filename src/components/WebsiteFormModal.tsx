'use client';

import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import type { Website, WebsitePayload } from '@/lib/client/types';

interface FormState {
  name: string;
  url: string;
  loginEndpoint: string;
  checkFrequencySeconds: number | string;
  active: boolean;
  destacado: string;
}

interface WebsiteFormModalProps {
  open: boolean;
  initialValue: Website | null;
  onClose: () => void;
  onSubmit: (payload: WebsitePayload) => Promise<void>;
}

const EMPTY: FormState = {
  name: '',
  url: '',
  loginEndpoint: '',
  checkFrequencySeconds: 300,
  active: true,
  destacado: '',
};

// La entrada lenta (2s) la define el CSS (.supply-modal__panel--in). Aquí solo
// necesitamos cuánto esperar antes de desmontar en la salida rápida.
const EXIT_MS = 320;

/** Modal de alta/edición. Sigue el patrón Modal Panel de 099 SUPPLY. */
export default function WebsiteFormModal({ open, initialValue, onClose, onSubmit }: WebsiteFormModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `mounted` mantiene el modal en el DOM mientras dura la animación de salida.
  // `leaving` cambia los keyframes de entrada por los de salida.
  const [mounted, setMounted] = useState(open);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (open) {
      setLeaving(false);
      setMounted(true);
      return undefined;
    }
    if (!mounted) return undefined;
    setLeaving(true);
    const timer = setTimeout(() => {
      setMounted(false);
      setLeaving(false);
    }, EXIT_MS);
    return () => clearTimeout(timer);
  }, [open, mounted]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(initialValue
      ? {
          name: initialValue.name,
          url: initialValue.url,
          loginEndpoint: initialValue.loginEndpoint,
          checkFrequencySeconds: initialValue.checkFrequencySeconds,
          active: initialValue.active,
          destacado: initialValue.destacado ?? '',
        }
      : EMPTY);
  }, [open, initialValue]);

  if (!mounted) return null;

  const update = (field: keyof FormState) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = field === 'active' ? (event.target as HTMLInputElement).checked : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        ...form,
        checkFrequencySeconds: Number(form.checkFrequencySeconds),
      });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      className={`supply-modal catalog-modal supply-modal--${leaving ? 'leave' : 'enter'}`}
    >
      <form
        onSubmit={handleSubmit}
        className={`supply-card supply-modal__panel catalog-modal__panel supply-modal__panel--${leaving ? 'leave' : 'enter'}`}
      >
        <h3 style={{ fontSize: 16, fontWeight: 400, margin: '0 0 12px' }}>
          {initialValue ? 'Editar sitio' : 'Nuevo sitio'}
        </h3>

        <Field label="Nombre">
          <input className="supply-input" value={form.name} onChange={update('name')} required maxLength={120} />
        </Field>

        <Field label="URL">
          <input className="supply-input" type="url" value={form.url} onChange={update('url')} required placeholder="https://ejemplo.com" />
        </Field>

        <Field label="Endpoint de login a validar">
          <input className="supply-input" type="url" value={form.loginEndpoint} onChange={update('loginEndpoint')} required placeholder="https://ejemplo.com/login" />
        </Field>

        <Field label="Frecuencia de chequeo (segundos)">
          <input className="supply-input" type="number" min={10} max={86400} value={form.checkFrequencySeconds} onChange={update('checkFrequencySeconds')} required />
        </Field>

        <Field label="Destacado">
          <textarea
            className="supply-input"
            rows={3}
            maxLength={500}
            value={form.destacado}
            onChange={update('destacado')}
            placeholder="El nombre del dueño de la página, número de teléfono y correo del dueño para contactarlo por si pasa algo"
            style={{ resize: 'vertical' }}
          />
        </Field>

        <label className="supply-label" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <input type="checkbox" checked={form.active} onChange={update('active')} />
          Activo
        </label>

        {error ? (
          <p style={{ fontSize: 11, color: 'var(--color-status-down)', marginTop: 12 }}>{error}</p>
        ) : null}

        <footer className="catalog-modal__footer">
          <button type="button" className="supply-btn supply-btn--ghost" onClick={onClose} disabled={submitting}>
            Cerrar
          </button>
          <button type="submit" className="supply-btn supply-btn--primary" disabled={submitting}>
            {submitting ? 'Guardando' : 'Guardar'}
          </button>
        </footer>
      </form>
    </div>
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
