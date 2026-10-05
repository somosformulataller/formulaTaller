'use client';

import { useEffect, useState } from 'react';
import { BellRing, ChevronDown } from 'lucide-react';
import type { AppNotification } from '@/lib/types';
import { formatDate } from '@/lib/utils';

/**
 * Dentro de la orden: lo que el cliente respondió al presupuesto desde su
 * enlace. Las nuevas se destacan; al tocar «Entendido» quedan leídas (y se
 * apagan en la campana). Debajo, el historial completo de sus decisiones.
 */
export default function BudgetResponses({ orderId }: { orderId: string }) {
  const [lista, setLista] = useState<AppNotification[]>([]);
  const [verHistorial, setVerHistorial] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/notifications?order_id=${orderId}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => vivo && d && setLista(d.notifications ?? []))
      .catch(() => null);
    return () => {
      vivo = false;
    };
  }, [orderId]);

  if (lista.length === 0) return null;
  const nuevas = lista.filter((n) => !n.read_at);

  async function entendido() {
    setLista((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId }),
    }).catch(() => null);
  }

  return (
    <div
      className="card"
      style={{
        marginBottom: 16,
        borderColor: nuevas.length ? 'rgba(245,158,11,0.45)' : undefined,
        background: nuevas.length ? 'rgba(245,158,11,0.07)' : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <BellRing size={16} style={{ color: 'var(--color-brand-400)' }} />
        <span style={{ fontSize: 14, fontWeight: 700 }}>
          {nuevas.length ? 'El cliente respondió al presupuesto' : 'Respuestas del cliente'}
        </span>
      </div>

      {nuevas.map((n) => (
        <p key={n.id} style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>
          {n.message}{' '}
          <span style={{ fontSize: 11.5, fontWeight: 400, color: 'var(--color-text-muted)' }}>{formatDate(n.created_at)}</span>
        </p>
      ))}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 6 }}>
        <button
          type="button"
          onClick={() => setVerHistorial((v) => !v)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: 'none',
            border: 'none',
            padding: 0,
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
          }}
        >
          Historial ({lista.length})
          <ChevronDown size={14} style={{ transform: verHistorial ? 'rotate(180deg)' : 'none' }} />
        </button>
        {nuevas.length > 0 && (
          <button
            type="button"
            onClick={entendido}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface-2)',
              fontSize: 12.5,
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
            }}
          >
            Entendido
          </button>
        )}
      </div>

      {verHistorial && (
        <ul style={{ margin: '10px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {lista.map((n) => (
            <li key={n.id} style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
              {n.message} <span style={{ color: 'var(--color-text-muted)' }}>· {formatDate(n.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
