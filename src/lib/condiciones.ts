import type { FuelLevel, VehicleCondition } from '@/lib/types';

// ============================================================================
// Condiciones previas del vehículo (0023) — helpers compartidos
// ============================================================================

export const FUEL_LEVELS: { value: FuelLevel; label: string }[] = [
  { value: 'reserva', label: 'Reserva' },
  { value: '1/4', label: '¼' },
  { value: '1/2', label: '½' },
  { value: '3/4', label: '¾' },
  { value: 'lleno', label: 'Lleno' },
];

export function fuelLabel(v: FuelLevel | null | undefined): string | null {
  return FUEL_LEVELS.find((f) => f.value === v)?.label ?? null;
}

/**
 * Limpia lo que manda el navegador antes de guardarlo en la orden. Se usa en
 * la API: el cuerpo de la petición no es de fiar (tamaños, tipos, basura).
 * Devuelve undefined para los campos que no vinieron.
 */
export function limpiarCondiciones(body: Record<string, unknown>): {
  vehicle_conditions?: VehicleCondition[];
  mileage?: number | null;
  fuel_level?: FuelLevel | null;
  vehicle_notes?: string | null;
  error?: string;
} {
  const out: {
    vehicle_conditions?: VehicleCondition[];
    mileage?: number | null;
    fuel_level?: FuelLevel | null;
    vehicle_notes?: string | null;
    error?: string;
  } = {};

  if ('vehicle_conditions' in body) {
    const raw = body.vehicle_conditions;
    if (!Array.isArray(raw)) return { error: 'Condiciones inválidas' };
    const vistos = new Set<string>();
    const lista: VehicleCondition[] = [];
    for (const c of raw.slice(0, 150)) {
      const o = (c ?? {}) as Record<string, unknown>;
      const group = String(o.group ?? '').trim().slice(0, 60);
      const label = String(o.label ?? '').trim().slice(0, 120);
      const note = String(o.note ?? '').trim().slice(0, 200);
      if (!label) continue;
      const clave = `${group}|${label}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      lista.push(note ? { group, label, note } : { group, label });
    }
    out.vehicle_conditions = lista;
  }

  if ('mileage' in body) {
    const m = body.mileage;
    if (m === null || m === '' || m === undefined) out.mileage = null;
    else {
      const n = Math.round(Number(String(m).replace(/[^\d]/g, '')));
      if (!Number.isFinite(n) || n < 0 || n >= 10_000_000) return { error: 'Kilometraje inválido' };
      out.mileage = n;
    }
  }

  if ('fuel_level' in body) {
    const f = body.fuel_level;
    if (f === null || f === '' || f === undefined) out.fuel_level = null;
    else if (FUEL_LEVELS.some((x) => x.value === f)) out.fuel_level = f as FuelLevel;
    else return { error: 'Nivel de combustible inválido' };
  }

  if ('vehicle_notes' in body) {
    const t = String(body.vehicle_notes ?? '').trim().slice(0, 2000);
    out.vehicle_notes = t || null;
  }

  return out;
}

/** Agrupa los ítems marcados por su grupo, respetando el orden de llegada. */
export function agrupar(conditions: VehicleCondition[]): Array<{ group: string; items: VehicleCondition[] }> {
  const grupos: Array<{ group: string; items: VehicleCondition[] }> = [];
  for (const c of conditions) {
    const g = grupos.find((x) => x.group === c.group);
    if (g) g.items.push(c);
    else grupos.push({ group: c.group, items: [c] });
  }
  return grupos;
}
