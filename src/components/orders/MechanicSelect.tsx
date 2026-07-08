'use client';

import type { Profile } from '@/lib/types';
import Select, { type SelectOption } from '@/components/ui/Select';

const ADD_NEW = '__add_new_mechanic__';

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
  value,
  onChange,
  disabled,
  includeNone = true,
  placeholder = 'Sin asignar',
  compact = false,
  float = false,
  onAddNew,
}: MechanicSelectProps) {
  const options: SelectOption[] = [
    ...(includeNone ? [{ value: '', label: 'Sin asignar', muted: true }] : []),
    ...mechanics.map((m) => ({ value: m.id, label: m.full_name })),
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
