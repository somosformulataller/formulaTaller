'use client';

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Sección del enlace del cliente que se abre y se cierra tocando el título.
 * Así la página muestra primero lo importante y el detalle queda a un toque.
 */
export default function Desplegable({
  titulo,
  icono,
  abiertoInicial = false,
  extra,
  children,
}: {
  titulo: string;
  icono?: React.ReactNode;
  abiertoInicial?: boolean;
  /** Algo pequeño a la derecha del título (p. ej. el estado). */
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(abiertoInicial);
  const id = useId();

  return (
    <div className="card animate-fade-in" style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-controls={id}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '16px 18px',
          background: 'transparent',
          border: 'none',
          color: 'inherit',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {icono && <span style={{ display: 'flex', color: 'var(--color-brand-400)', flexShrink: 0 }}>{icono}</span>}
        <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 700 }}>{titulo}</span>
        {extra}
        <ChevronDown
          size={18}
          style={{
            flexShrink: 0,
            color: 'var(--color-text-muted)',
            transform: abierto ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s ease',
          }}
        />
      </button>
      {abierto && (
        <div id={id} style={{ padding: '0 18px 18px' }}>
          {children}
        </div>
      )}
    </div>
  );
}

/** Etiqueta de estado para el lado derecho del título. */
export function Chip({ texto, color }: { texto: string; color: string }) {
  return (
    <span
      style={{
        flexShrink: 0,
        fontSize: 11,
        fontWeight: 700,
        padding: '2px 9px',
        borderRadius: 999,
        color,
        border: `1px solid ${color}`,
        whiteSpace: 'nowrap',
      }}
    >
      {texto}
    </span>
  );
}
