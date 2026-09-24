'use client';

import { useEffect, useRef, useState } from 'react';
import type { Profile } from '@/lib/types';
import { ChevronDown, Check, Plus, Store } from 'lucide-react';

interface MechanicSelectProps {
  mechanics: Profile[];
  /**
   * Nombre del taller. Si se pasa, abajo aparece la casilla para enseñarle al
   * cliente el nombre del taller en lugar de los nombres de las personas.
   */
  workshopName?: string | null;
  /** Los mecánicos asignados hoy. Varios: todos iguales (migración 0021). */
  value: string[];
  /** Si al cliente se le enseña el nombre del taller (migración 0020). */
  comoTaller?: boolean;
  onChange: (ids: string[], comoTaller: boolean) => void;
  disabled?: boolean;
  /** Texto cuando no hay nadie elegido (default "Sin asignar"). */
  placeholder?: string;
  /** Botón compacto de ancho automático (para la tarjeta de orden). */
  compact?: boolean;
  /** Lista flotante (absoluta) en vez de empujar el contenido. */
  float?: boolean;
  /** Si se pasa, agrega al final una opción para crear un mecánico nuevo. */
  onAddNew?: () => void;
}

/**
 * Selector de los mecánicos de una orden. Es de **varios**: un carro lo puede
 * tocar el de latonería, el de electricidad y quien hace la prueba de ruta, y
 * los tres tienen que poder abrirlo (migración 0021). Por eso son casillas y
 * no una lista de una sola opción, y por eso el menú NO se cierra al elegir:
 * casi siempre se marca a más de uno de una vez.
 *
 * El dueño del taller sale en la lista como cualquier otro —muchos dueños
 * también reparan carros— y va marcado «(dueño)» para distinguirlo.
 *
 * Aparte va una casilla más, la de mostrar el nombre del taller: eso no cambia
 * QUIÉN trabaja el carro, sino qué lee el CLIENTE en su seguimiento. Con dos
 * mecánicos asignados no tendría sentido como una entrada más de la lista, que
 * es como estaba antes de poder asignar a varios.
 */
export default function MechanicSelect({
  mechanics,
  workshopName,
  value,
  comoTaller = false,
  onChange,
  disabled,
  placeholder = 'Sin asignar',
  compact = false,
  float = false,
  onAddNew,
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

  const elegidos = mechanics.filter((m) => value.includes(m.id));

  // Lo que se lee en el botón cerrado. Con el taller de por medio, el botón
  // dice lo que va a ver el cliente, que es la decisión que se acaba de tomar.
  const resumen =
    elegidos.length === 0
      ? null
      : comoTaller && workshopName
      ? workshopName
      : elegidos.length === 1
      ? elegidos[0].full_name
      : `${elegidos.length} mecánicos`;

  function alternar(id: string) {
    const nuevos = value.includes(id) ? value.filter((v) => v !== id) : [...value, id];
    // Sin nadie asignado no hay nombre que tapar: la casilla del taller se
    // apaga sola para no dejarla encendida y olvidada.
    onChange(nuevos, nuevos.length > 0 && comoTaller);
  }

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
            color: resumen ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {resumen ?? placeholder}
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
          aria-multiselectable
          style={
            float
              ? { position: 'absolute', top: '100%', left: 0, zIndex: 30, minWidth: 230 }
              : undefined
          }
        >
          {mechanics.length === 0 && (
            <li>
              <span
                className="select-option"
                style={{ color: 'var(--color-text-muted)', cursor: 'default' }}
              >
                Todavía no hay mecánicos
              </span>
            </li>
          )}

          {mechanics.map((m) => {
            const marcado = value.includes(m.id);
            return (
              <li key={m.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={marcado}
                  className="select-option"
                  onClick={() => alternar(m.id)}
                >
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {m.full_name}
                    {m.role === 'admin' && (
                      <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>(dueño)</span>
                    )}
                  </span>
                  {marcado && (
                    <Check size={16} style={{ flexShrink: 0, color: 'var(--color-brand-500)' }} />
                  )}
                </button>
              </li>
            );
          })}

          {workshopName && (
            <li style={{ borderTop: '1px solid var(--color-border)', marginTop: 2, paddingTop: 2 }}>
              <button
                type="button"
                className="select-option"
                disabled={value.length === 0}
                onClick={() => onChange(value, !comoTaller)}
                style={{
                  opacity: value.length === 0 ? 0.5 : 1,
                  cursor: value.length === 0 ? 'default' : 'pointer',
                }}
                title={
                  value.length === 0
                    ? 'Primero elige quién trabaja el carro'
                    : `Al cliente le aparecerá "${workshopName}"`
                }
              >
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Store size={15} style={{ flexShrink: 0 }} />
                  Mostrarle al cliente «{workshopName}»
                </span>
                {comoTaller && value.length > 0 && (
                  <Check size={16} style={{ flexShrink: 0, color: 'var(--color-brand-500)' }} />
                )}
              </button>
            </li>
          )}

          {onAddNew && (
            <li style={{ borderTop: '1px solid var(--color-border)', marginTop: 2, paddingTop: 2 }}>
              <button
                type="button"
                className="select-option"
                onClick={() => {
                  setOpen(false);
                  onAddNew();
                }}
                style={{ color: 'var(--color-brand-400)', fontWeight: 700 }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Plus size={15} style={{ flexShrink: 0 }} />
                  {mechanics.length ? 'Agregar otro mecánico' : 'Agregar mecánico'}
                </span>
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
