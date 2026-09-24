'use client';

import type { Profile } from '@/lib/types';
import Select, { type SelectOption } from '@/components/ui/Select';

const ADD_NEW = '__add_new_mechanic__';

/**
 * Valor especial: «se la queda el dueño, pero al cliente le sale el nombre del
 * taller». Asigna a la misma persona que la entrada con su nombre; lo que
 * cambia es lo que lee el cliente en su seguimiento (migración 0020).
 */
export const COMO_TALLER = '__como_taller__';

interface MechanicSelectProps {
  mechanics: Profile[];
  /**
   * Nombre del taller. Si se pasa y el dueño está en la lista, aparece una
   * entrada más con el nombre del taller, por encima de la del dueño.
   */
  workshopName?: string | null;
  /** El id del mecánico, o COMO_TALLER. */
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
  /** Mostrar la opción "Sin asignar" (default true). */
  includeNone?: boolean;
  /** Texto cuando no hay mecánico elegido (default "Sin asignar"). */
  placeholder?: string;
  /** Botón compacto de ancho automático (para la tarjeta de orden). */
  compact?: boolean;
  /** Lista flotante (absoluta) en vez de empujar el contenido. */
  float?: boolean;
  /** Si se pasa, agrega al final una opción para crear un mecánico nuevo. */
  onAddNew?: () => void;
}

/**
 * Selector de mecánico con **lista desplegable propia** de la app. Es una capa
 * fina sobre el componente genérico `Select` (misma línea visual en todos lados).
 */
export default function MechanicSelect({
  mechanics,
  workshopName,
  value,
  onChange,
  disabled,
  includeNone = true,
  placeholder = 'Sin asignar',
  compact = false,
  float = false,
  onAddNew,
}: MechanicSelectProps) {
  // El dueño del taller aparece en la lista porque también atiende carros. Y
  // aparece DOS VECES: una con el nombre del taller y otra con el suyo. Las
  // dos le asignan la orden a él; lo que cambia es el nombre que verá el
  // cliente en su seguimiento (ver la migración 0020). Si el taller no tiene
  // dueño en esta lista, no se ofrece la entrada del taller: no habría a quién
  // asignarle la orden.
  const hayDueno = mechanics.some((m) => m.role === 'admin');
  const entradaTaller: SelectOption[] =
    workshopName && hayDueno ? [{ value: COMO_TALLER, label: workshopName }] : [];

  const options: SelectOption[] = [
    ...(includeNone ? [{ value: '', label: 'Sin asignar', muted: true }] : []),
    ...entradaTaller,
    ...mechanics.map((m) => ({
      value: m.id,
      label: m.role === 'admin' ? `${m.full_name} (dueño)` : m.full_name,
    })),
    ...(onAddNew
      ? [
          {
            value: ADD_NEW,
            label: mechanics.length ? 'Agregar otro mecánico' : 'Agregar mecánico',
            action: true,
          },
        ]
      : []),
  ];

  return (
    <Select
      options={options}
      value={value ?? ''}
      onChange={(v) => {
        if (v === ADD_NEW) {
          onAddNew?.();
          return;
        }
        onChange(v || null);
      }}
      disabled={disabled}
      placeholder={placeholder}
      compact={compact}
      float={float}
    />
  );
}
