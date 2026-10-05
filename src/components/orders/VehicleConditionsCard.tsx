'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import CampoNotaDeVoz from '@/components/orders/CampoNotaDeVoz';
import type { Order } from '@/lib/types';

/**
 * Condiciones previas del vehículo dentro de la orden ya creada: el mismo
 * campo con nota de voz del alta (0024), con un botón para guardar los cambios.
 */
export default function VehicleConditionsCard({
  order,
  onSaved,
}: {
  order: Order;
  onSaved?: (o: Order) => void;
}) {
  const inicial = order.vehicle_notes ?? '';
  const [valor, setValor] = useState(inicial);
  const [guardado, setGuardado] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const cambiado = valor !== guardado;

  async function guardar() {
    setGuardando(true);
    setError(null);
    setOk(false);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicle_notes: valor.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar');
      setGuardado(valor);
      setOk(true);
      onSaved?.(data as Order);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <CampoNotaDeVoz
        value={valor}
        onChange={(v) => {
          setValor(v);
          setOk(false);
        }}
        disabled={guardando}
      />
      {(cambiado || ok || error) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          {error && <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>{error}</span>}
          {ok && !cambiado && <span style={{ fontSize: 12, color: '#34d399' }}>Guardado</span>}
          {cambiado && (
            <>
              <Button type="button" variant="ghost" size="sm" onClick={() => setValor(guardado)} disabled={guardando}>
                Deshacer
              </Button>
              <Button type="button" variant="primary" size="sm" onClick={guardar} loading={guardando}>
                Guardar condiciones
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
