'use client';

import { ArrowUpDown } from 'lucide-react';

/** Fila de botones para elegir el orden de una lista del superadmin. */
export default function OrdenarChips<K extends string>({
  opciones,
  valor,
  onChange,
  pequeno = false,
}: {
  opciones: readonly { key: K; label: string }[];
  valor: K;
  onChange: (k: K) => void;
  pequeno?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <ArrowUpDown size={pequeno ? 12 : 14} style={{ color: 'var(--color-text-muted)' }} />
      {opciones.map((o) => {
        const activo = o.key === valor;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            style={{
              padding: pequeno ? '3px 9px' : '5px 11px',
              borderRadius: 999,
              fontSize: pequeno ? 11.5 : 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              border: `1px solid ${activo ? 'var(--color-brand-500)' : 'var(--color-border)'}`,
              background: activo ? 'rgba(245,158,11,0.15)' : 'var(--color-surface-2)',
              color: activo ? 'var(--color-brand-400)' : 'var(--color-text-secondary)',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
