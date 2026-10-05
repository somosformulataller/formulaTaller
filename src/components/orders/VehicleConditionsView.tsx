'use client';

import { ClipboardCheck, Gauge, Fuel } from 'lucide-react';
import type { FuelLevel, VehicleCondition } from '@/lib/types';
import { agrupar, fuelLabel } from '@/lib/condiciones';

/**
 * Cómo llegó el carro, en solo lectura: lo que marcó el taller al recibirlo,
 * con sus observaciones, el kilometraje y el combustible. Lo ven el cliente
 * en su enlace y el mecánico en la orden. Si no se marcó nada, no se pinta.
 */
export default function VehicleConditionsView({
  conditions,
  mileage,
  fuelLevel,
  notes = null,
  variant = 'order',
}: {
  conditions: VehicleCondition[];
  mileage: number | null;
  fuelLevel: FuelLevel | null;
  /** Lo dictado por voz al recibir el carro (0024). */
  notes?: string | null;
  variant?: 'order' | 'tracking';
}) {
  const combustible = fuelLabel(fuelLevel);
  if (conditions.length === 0 && mileage === null && !combustible && !notes) return null;

  return (
    <div className="card animate-fade-in" style={{ marginBottom: variant === 'tracking' ? 16 : 16 }}>
      <p
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
          marginBottom: 10,
        }}
      >
        <ClipboardCheck size={13} />
        {variant === 'tracking' ? 'Estado del vehículo al recibirlo' : 'Condiciones previas del vehículo'}
      </p>

      {notes && (
        <p style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', marginBottom: 10 }}>{notes}</p>
      )}

      {(mileage !== null || combustible) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 13, marginBottom: conditions.length ? 10 : 0 }}>
          {mileage !== null && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Gauge size={14} style={{ color: 'var(--color-text-muted)' }} />
              {new Intl.NumberFormat('es-VE').format(mileage)} km
            </span>
          )}
          {combustible && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Fuel size={14} style={{ color: 'var(--color-text-muted)' }} />
              Combustible: {combustible}
            </span>
          )}
        </div>
      )}

      {agrupar(conditions).map((g) => (
        <div key={g.group} style={{ marginTop: 8 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
            {g.group}
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {g.items.map((c) => (
              <li key={c.label} style={{ fontSize: 13 }}>
                {c.label}
                {c.note && <span style={{ color: 'var(--color-text-secondary)' }}> — {c.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
