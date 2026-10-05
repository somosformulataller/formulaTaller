'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, MessageCircle, Receipt } from 'lucide-react';
import BudgetList, { type Renglon } from '@/components/orders/BudgetList';
import { buildBudgetMessage, formatUsd, parseAmount, sumarTotal } from '@/lib/budget';
import { openWhatsApp } from '@/lib/utils';
import type { BudgetItem } from '@/lib/types';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

/**
 * El presupuesto dentro de la orden ya creada.
 *
 * Empieza plegado mostrando solo el total, porque en un teléfono la orden ya
 * es larga (datos, adjuntos, etapas) y el dato que se consulta de reojo es
 * cuánto va. Al desplegarlo se edita la lista completa, que se guarda sola.
 *
 * `abiertoInicial` lo usa la pantalla Presupuestos para llegar con la lista
 * ya abierta.
 *
 * Rapidez: la página manda los ítems ya leídos (`itemsIniciales`), así el
 * total aparece al instante y al desplegar no hay que esperar otra petición.
 * Una vez abierta, la lista queda montada (solo se oculta) para que plegar y
 * desplegar sea inmediato y no se pierda lo que se está guardando.
 */
export default function BudgetCard({
  orderId,
  abiertoInicial = false,
  itemsIniciales,
  cliente,
}: {
  orderId: string;
  abiertoInicial?: boolean;
  itemsIniciales?: BudgetItem[];
  /** Con estos datos aparece «Enviar presupuesto» por WhatsApp. */
  cliente?: { firstName: string; whatsapp: string; publicToken: string; carModel: string; workshopName?: string };
}) {
  const [abierto, setAbierto] = useState(abiertoInicial);
  const [montada, setMontada] = useState(abiertoInicial);
  const [items, setItems] = useState<BudgetItem[] | undefined>(itemsIniciales);
  // Lo que se está viendo en la lista (con lo recién editado), para el WhatsApp.
  const [filas, setFilas] = useState<Renglon[] | null>(null);
  const [total, setTotal] = useState<number | null>(
    itemsIniciales ? sumarTotal(itemsIniciales) : null
  );

  // Sin ítems de la página, se piden una sola vez (el total es lo que se
  // viene a ver) y la lista los reutiliza al desplegar.
  useEffect(() => {
    if (items || montada) return;
    let vivo = true;
    (async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}/budget`, { cache: 'no-store' });
        if (!res.ok) return;
        const data: BudgetItem[] = await res.json();
        if (!vivo) return;
        setItems(data);
        setTotal(sumarTotal(data));
      } catch {
        /* sin total; se ve al desplegar */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [orderId, items, montada]);

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <button
        type="button"
        onClick={() => {
          setAbierto((v) => !v);
          setMontada(true);
        }}
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

      {montada && (
        <div style={{ marginTop: 14, display: abierto ? undefined : 'none' }}>
          <BudgetList orderId={orderId} iniciales={items} onTotalChange={setTotal} onFilasChange={setFilas} />
        </div>
      )}

      {cliente && (total ?? 0) > 0 && (
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={() => {
              const lista = filas
                ? filas
                    .filter((f) => f.id && f.description.trim())
                    .map((f) => ({
                      description: f.description.trim(),
                      amount: parseAmount(f.amount) ?? 0,
                      labor: parseAmount(f.labor) ?? 0,
                    }))
                : (items ?? []).map((i) => ({
                    description: i.description,
                    amount: Number(i.amount),
                    labor: Number(i.labor_amount),
                  }));
              openWhatsApp(
                cliente.whatsapp,
                buildBudgetMessage(cliente.firstName, cliente.carModel, lista, cliente.publicToken, SITE_URL, cliente.workshopName)
              );
            }}
            title="Enviar el presupuesto al cliente por WhatsApp"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              background: 'rgba(37,211,102,0.12)',
              border: '1px solid rgba(37,211,102,0.2)',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              color: '#25D366',
              cursor: 'pointer',
            }}
          >
            <MessageCircle size={13} />
            Enviar presupuesto al cliente
          </button>
        </div>
      )}
    </div>
  );
}
