'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Car, ChevronRight, ClipboardList } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import type { OrderStatus } from '@/lib/types';
import { formatUsd } from '@/lib/budget';
import { formatDateShort } from '@/lib/utils';

interface Fila {
  id: string;
  car_model: string;
  status: OrderStatus;
  created_at: string;
  notes: string | null;
  mileage: number | null;
  budget_total: number;
  budget_items: number;
}

/** «Historial clínico» del cliente: todas sus órdenes, de la más nueva a la más vieja. */
export default function ClientHistory({ clientId }: { clientId: string }) {
  const [ordenes, setOrdenes] = useState<Fila[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/clients/${clientId}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('No se pudo cargar el historial');
        const data = await res.json();
        setOrdenes(data.orders);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar');
      }
    })();
  }, [clientId]);

  if (error) return <p style={{ fontSize: 12.5, color: 'var(--color-danger)' }}>{error}</p>;
  if (!ordenes) return <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>Cargando…</p>;
  if (ordenes.length === 0) {
    return (
      <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--color-text-muted)' }}>
        <ClipboardList size={14} />
        Este cliente no tiene órdenes.
      </p>
    );
  }

  const gastado = ordenes.reduce((a, o) => a + Math.round(o.budget_total * 100), 0) / 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {ordenes.map((o) => (
        <Link
          key={o.id}
          href={`/admin/ordenes/${o.id}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface-2)',
            color: 'inherit',
            textDecoration: 'none',
          }}
        >
          <Car size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 600, overflowWrap: 'anywhere' }}>{o.car_model}</span>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              {formatDateShort(o.created_at)}
              {o.mileage !== null && ` · ${new Intl.NumberFormat('es-VE').format(o.mileage)} km`}
              {o.budget_items > 0 && ` · ${formatUsd(o.budget_total)}`}
            </span>
            {o.notes && (
              <span
                style={{
                  display: 'block',
                  fontSize: 12,
                  color: 'var(--color-text-muted)',
                  marginTop: 2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {o.notes}
              </span>
            )}
          </span>
          <Badge status={o.status} />
          <ChevronRight size={15} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
        </Link>
      ))}
      {ordenes.length > 1 && (
        <p style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', textAlign: 'right' }}>
          {ordenes.length} órdenes · Total presupuestado {formatUsd(gastado)}
        </p>
      )}
    </div>
  );
}
