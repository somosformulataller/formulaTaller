'use client';

import { useState } from 'react';
import { FileInput } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import ElegirPresupuesto from '@/components/presupuestos/ElegirPresupuesto';
import type { Quote } from '@/lib/presupuestos';

/**
 * «Vincular presupuesto» en una orden ya creada (0028): los ítems y la mano de
 * obra general del presupuesto suelto se suman al de la orden.
 */
export default function VincularPresupuesto({ orderId }: { orderId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function vincular(q: Quote) {
    const nombre = `${q.client_first_name} ${q.client_last_name}`.trim();
    if (!confirm(`¿Sumar el presupuesto de ${nombre} a esta orden?`)) return;
    setOcupado(true);
    setError(null);
    try {
      const res = await fetch(`/api/quotes/${q.id}/vincular`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'No se pudo vincular el presupuesto.');
      // El presupuesto de la orden cambió en el servidor: se recarga entero.
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo vincular el presupuesto.');
      setOcupado(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          width: '100%',
          padding: '10px 12px',
          marginBottom: 12,
          borderRadius: 10,
          border: '1px dashed var(--color-border)',
          background: 'transparent',
          color: 'var(--color-text-secondary)',
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        <FileInput size={15} />
        Vincular presupuesto
      </button>
      {abierto && (
        <Modal isOpen onClose={() => !ocupado && setAbierto(false)} title="Vincular presupuesto">
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
            Elige un presupuesto guardado: sus ítems se suman al presupuesto de esta orden.
          </p>
          {error && <p style={{ fontSize: 13, color: 'var(--color-danger)', marginBottom: 10 }}>{error}</p>}
          <ElegirPresupuesto onElegir={vincular} ocupado={ocupado} />
        </Modal>
      )}
    </>
  );
}
