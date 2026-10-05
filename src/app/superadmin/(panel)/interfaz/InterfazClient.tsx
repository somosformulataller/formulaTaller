'use client';

import { useState } from 'react';
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import LoadError from '@/components/ui/LoadError';
import type { ReminderTag, ReminderTagColor } from '@/lib/types';
import { TAG_COLORS, TAG_COLOR_HEX } from '@/lib/recordatorios';

async function api<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'No se pudo guardar');
  return data as T;
}

export default function InterfazClient({
  initialTags,
  loadError,
}: {
  initialTags: ReminderTag[];
  loadError: string | null;
}) {
  if (loadError) {
    return <LoadError message="No se pudo cargar la configuración. ¿Corriste la migración 0023?" detail={loadError} />;
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 16px 48px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Interfaz talleres</h1>
      <p style={{ fontSize: 13.5, color: 'var(--color-text-secondary)', marginBottom: 18 }}>
        Lo que cambies aquí aplica a todos los talleres.
      </p>
      <Etiquetas inicial={initialTags} />
    </div>
  );
}

const iconBtn = {
  width: 32,
  height: 32,
  flexShrink: 0,
  borderRadius: 7,
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface-2)',
  color: 'var(--color-text-secondary)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
} as const;

// ---------------------------------------------------------------------------
// Etiquetas de recordatorios
// ---------------------------------------------------------------------------
function Etiquetas({ inicial }: { inicial: ReminderTag[] }) {
  const [tags, setTags] = useState(inicial);
  const [error, setError] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState('');
  const [color, setColor] = useState<ReminderTagColor>('gold');

  async function hacer(fn: () => Promise<void>) {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    }
  }
  const reemplazar = (t: ReminderTag) => setTags((prev) => prev.map((x) => (x.id === t.id ? t : x)));
  const patch = (t: ReminderTag, body: Record<string, unknown>) =>
    hacer(async () => reemplazar(await api(`/api/superadmin/reminder-tags/${t.id}`, 'PATCH', body)));

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
        Estas etiquetas las ven todos los talleres al crear un recordatorio. Cada taller puede además crear las suyas.
      </p>
      {error && <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p>}

      {tags.map((t) => (
        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: t.active ? 1 : 0.5, flexWrap: 'wrap' }}>
          <input
            className="form-input"
            defaultValue={t.label}
            maxLength={40}
            onBlur={(e) => {
              const l = e.target.value.trim();
              if (l && l !== t.label) patch(t, { label: l });
            }}
            style={{ flex: 1, minWidth: 140 }}
          />
          <div style={{ display: 'flex', gap: 4 }}>
            {TAG_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                onClick={() => c !== t.color && patch(t, { color: c })}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: TAG_COLOR_HEX[c],
                  border: t.color === c ? '3px solid var(--color-text-primary)' : '2px solid transparent',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
          <button type="button" style={iconBtn} onClick={() => patch(t, { active: !t.active })} aria-label={t.active ? 'Ocultar' : 'Mostrar'}>
            {t.active ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          <button
            type="button"
            style={{ ...iconBtn, color: '#ef4444' }}
            aria-label="Eliminar"
            onClick={() => {
              if (!confirm(`¿Eliminar la etiqueta «${t.label}»? Los recordatorios que la usan quedarán sin etiqueta.`)) return;
              hacer(async () => {
                await api(`/api/superadmin/reminder-tags/${t.id}`, 'DELETE');
                setTags((prev) => prev.filter((x) => x.id !== t.id));
              });
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
        <input
          className="form-input"
          placeholder="Nueva etiqueta"
          maxLength={40}
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          style={{ flex: 1, minWidth: 140 }}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          {TAG_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Color ${c}`}
              onClick={() => setColor(c)}
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: TAG_COLOR_HEX[c],
                border: color === c ? '3px solid var(--color-text-primary)' : '2px solid transparent',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
        <button
          type="button"
          style={{ ...iconBtn, width: 'auto', padding: '0 12px', gap: 4, fontSize: 12.5, fontWeight: 700 }}
          onClick={() => {
            if (!nuevo.trim()) return;
            hacer(async () => {
              const t = await api<ReminderTag>('/api/superadmin/reminder-tags', 'POST', { label: nuevo, color });
              setTags((prev) => [...prev, t]);
              setNuevo('');
            });
          }}
        >
          <Plus size={14} />
          Agregar
        </button>
      </div>
    </div>
  );
}
