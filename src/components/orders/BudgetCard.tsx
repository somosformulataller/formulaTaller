'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Receipt } from 'lucide-react';
import BudgetList from '@/components/orders/BudgetList';
import { formatUsd } from '@/lib/budget';

/**
 * El presupuesto dentro de la orden ya creada.
 *
 * Empieza plegado mostrando solo el total, porque en un teléfono la orden ya
 * es larga (datos, adjuntos, etapas) y el dato que se consulta de reojo es
 * cuánto va. Al desplegarlo se edita la lista completa, que se guarda sola.
 *
 * `abiertoInicial` lo usa la pantalla Presupuestos para llegar con la lista
 * ya abierta.
 */
export default function BudgetCard({
  orderId,
  abiertoInicial = false,
}: {
  orderId: string;
  abiertoInicial?: boolean;
}) {
  const [abierto, setAbierto] = useState(abiertoInicial);
  const [total, setTotal] = useState<number | null>(null);

  // El total se pide aunque esté plegado: es justamente lo que se viene a ver.
  useEffect(() => {
    if (abierto) return; // desplegado, el total lo reporta la lista
    let vivo = true;
    (async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}/budget`, { cache: 'no-store' });
        if (!res.ok) return;
        const items: Array<{ amount: number }> = await res.json();
        if (!vivo) return;
        setTotal(items.reduce((a, i) => a + Math.round(Number(i.amount) * 100), 0) / 100);
      } catch {
        /* sin total; se ve al desplegar */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [orderId, abierto]);

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          width: '100%',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          textAlign: 'left',
          color: 'inherit',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Receipt size={17} style={{ color: 'var(--color-brand-400)' }} />
          <span style={{ fontSize: 16, fontWeight: 700 }}>Presupuesto</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--color-brand-400)' }}>
            {formatUsd(total ?? 0)}
          </span>
          <ChevronDown
            size={17}
            style={{
              color: 'var(--color-text-muted)',
              transform: abierto ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.15s',
            }}
          />
        </span>
      </button>

      {abierto && (
        <div style={{ marginTop: 14 }}>
          <BudgetList orderId={orderId} onTotalChange={setTotal} />
        </div>
      )}
    </div>
  );
}
