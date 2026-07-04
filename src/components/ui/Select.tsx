'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  /** Texto atenuado (ej. la opción "Sin asignar"). */
  muted?: boolean;
}

interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Texto cuando `value` no coincide con ninguna opción. */
  placeholder?: string;
  /** Botón compacto de ancho automático (para tarjetas). */
  compact?: boolean;
  /** Lista flotante (absoluta) en vez de empujar el contenido. */
  float?: boolean;
  id?: string;
}

/**
 * Desplegable con **lista propia** de la app (clases `.select-menu` /
 * `.select-option`) — NO el `<select>` nativo, que abre el picker del sistema.
 * Base reutilizable para cualquier selector de opciones (estado, mecánico, etc.).
 */
export default function Select({
  options,
  value,
  onChange,
  disabled,
  placeholder = 'Seleccionar',
  compact = false,
  float = false,
  id,
}: SelectProps) {
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

  const selected = options.find((o) => o.value === value) ?? null;

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
        id={id}
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
          {selected ? selected.label : placeholder}
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
            const isSelected = opt.value === value;
            return (
              <li key={opt.value || '__none__'}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className="select-option"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  style={{
                    color: opt.muted ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {opt.label}
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
