'use client';

import { Check, Store } from 'lucide-react';

/**
 * «En el seguimiento del cliente, en vez de los nombres de los mecánicos,
 * enseñar el nombre del taller» (migración 0020).
 *
 * Va DEBAJO del selector de mecánicos y no dentro de su lista: ahí se leía
 * como si fuera un mecánico más, y además no es lo mismo —no cambia quién
 * trabaja el carro, cambia lo que lee el cliente—. Aquí hay sitio para
 * decirlo con todas las letras.
 *
 * Sin nadie asignado no tiene sentido, así que ni se muestra.
 */
export default function CasillaComoTaller({
  workshopName,
  hayAsignados,
  marcada,
  disabled,
  onChange,
}: {
  workshopName?: string | null;
  hayAsignados: boolean;
  marcada: boolean;
  disabled?: boolean;
  onChange: (valor: boolean) => void;
}) {
  if (!workshopName || !hayAsignados) return null;

  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!marcada)}
      disabled={disabled}
      aria-pressed={marcada}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        width: '100%',
        marginTop: 8,
        padding: '10px 12px',
        background: 'var(--color-surface-2)',
        border: `1px solid ${marcada ? 'var(--color-brand-500)' : 'var(--color-border)'}`,
        borderRadius: 8,
        textAlign: 'left',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 18,
          height: 18,
          flexShrink: 0,
          marginTop: 1,
          borderRadius: 5,
          border: `1.5px solid ${marcada ? 'var(--color-brand-500)' : 'var(--color-border)'}`,
          background: marcada ? 'var(--color-brand-500)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#1a1a1a',
        }}
      >
        {marcada && <Check size={13} strokeWidth={3} />}
      </span>
      <span style={{ minWidth: 0 }}>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--color-text-primary)',
          }}
        >
          <Store size={14} style={{ flexShrink: 0, color: 'var(--color-text-muted)' }} />
          Mostrarle al cliente «{workshopName}»
        </span>
        <span
          style={{
            display: 'block',
            fontSize: 12,
            color: 'var(--color-text-muted)',
            marginTop: 2,
          }}
        >
          En su seguimiento verá el nombre del taller en lugar de los nombres de los mecánicos.
        </span>
      </span>
    </button>
  );
}
