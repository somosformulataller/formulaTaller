'use client';

import { useEffect, useRef, useState } from 'react';
import type { Profile } from '@/lib/types';
import { ChevronDown, Check } from 'lucide-react';

interface MechanicSelectProps {
  mechanics: Profile[];
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
  /** Mostrar la opción "Sin asignar" (default true). */
  includeNone?: boolean;
  /** Texto cuando no hay mecánico elegido (default "Sin asignar"). */
  placeholder?: string;
  /** Botón compacto de ancho automático (para la tarjeta de orden). */
  compact?: boolean;
  /** Lista flotante (absoluta) en vez de empujar el contenido en flujo. */
  float?: boolean;
}

/**
 * Selector de mecánico con **lista desplegable propia** de la app (no el
 * <select> nativo, que abre el picker del sistema). Muestra la lista de
 * mecánicos en pantalla. Reutilizado en el formulario de orden y en la tarjeta.
 */
export default function MechanicSelect({
  mechanics,
  value,
  onChange,
  disabled,
  includeNone = true,
  placeholder = 'Sin asignar',
  compact = false,
  float = false,
}: MechanicSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const selected = mechanics.find((m) => m.id === value) ?? null;
  const options: { id: string | null; name: string }[] = [
    ...(includeNone ? [{ id: null, name: 'Sin asignar' }] : []),
    ...mechanics.map((m) => ({ id: m.id, name: m.full_name })),
  ];

  const buttonStyle: React.CSSProperties = compact
    ? {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: '8px 12px',
        background: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? 'default' : 'pointer',
        width: 'auto',
      }
    : {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        textAlign: 'left',
        cursor: disabled ? 'not-allowed' : 'pointer',
      };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className={compact ? undefined : 'form-input'}
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={buttonStyle}
      >
        <span
          style={{
            color: selected ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {selected ? selected.full_name : placeholder}
        </span>
        <ChevronDown
          size={16}
          style={{
            flexShrink: 0,
            color: 'var(--color-text-muted)',
            transition: 'transform 0.15s',
            transform: open ? 'rotate(180deg)' : 'none',
          }}
        />
      </button>

      {open && (
        <ul
          className="select-menu"
          role="listbox"
          style={
            float
              ? { position: 'absolute', top: '100%', left: 0, zIndex: 30, minWidth: 200 }
              : undefined
          }
        >
          {options.map((opt) => {
            const isSelected = opt.id === value;
            return (
              <li key={opt.id ?? '__none__'}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className="select-option"
                  onClick={() => {
                    onChange(opt.id);
                    setOpen(false);
                  }}
                  style={{
                    color: opt.id === null ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {opt.name}
                  </span>
                  {isSelected && (
                    <Check size={16} style={{ flexShrink: 0, color: 'var(--color-brand-500)' }} />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
