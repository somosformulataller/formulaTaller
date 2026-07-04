'use client';

import type { Profile } from '@/lib/types';
import Select, { type SelectOption } from '@/components/ui/Select';

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
}: MechanicSelectProps) {
  const options: SelectOption[] = [
    ...(includeNone ? [{ value: '', label: 'Sin asignar', muted: true }] : []),
    ...mechanics.map((m) => ({ value: m.id, label: m.full_name })),
  ];

  return (
    <Select
      options={options}
      value={value ?? ''}
      onChange={(v) => onChange(v || null)}
      disabled={disabled}
      placeholder={placeholder}
      compact={compact}
      float={float}
    />
  );
}
