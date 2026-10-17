'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, Car, ClipboardList, MessageCircle, Pencil, Phone, Receipt } from 'lucide-react';
import { formatUsd } from '@/lib/budget';
import { formatDateShort, openWhatsApp } from '@/lib/utils';
import { formatCita, mensajeQuote, respuestaCliente, totalQuote, type Quote } from '@/lib/presupuestos';

/**
 * «Presupuestos enviados» en Inicio (0028): los presupuestos sueltos del
 * taller, del más nuevo al más viejo, con lo que se hace con cada uno.
 */
export default function ListaPresupuestos({
  workshopName,
  version,
  onEditar,
  onCrearOrden,
  onNuevo,
}: {
  workshopName: string;
  /** Cambia cuando hay que volver a pedir la lista. */
  version: number;
  onEditar: (q: Quote) => void;
  onCrearOrden: (q: Quote) => void;
  onNuevo: () => void;
}) {
  const [lista, setLista] = useState<Quote[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await fetch('/api/quotes', { cache: 'no-store' });
        if (!res.ok) throw new Error('No se pudieron cargar los presupuestos');
        const d = await res.json();
        if (vivo) setLista(d);
      } catch (e) {
        if (vivo) setError(e instanceof Error ? e.message : 'Error al cargar');
      }
    })();
    return () => {
      vivo = false;
    };
  }, [version]);

  function enviar(q: Quote) {
    openWhatsApp(q.client_whatsapp, mensajeQuote(q, workshopName));
    if (!q.sent_at) {
      setLista((p) => (p ?? []).map((x) => (x.id === q.id ? { ...x, sent_at: new Date().toISOString() } : x)));
      fetch(`/api/quotes/${q.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ solo_enviado: true }),
      }).catch(() => {});
    }
  }

  if (error) return <p style={{ fontSize: 13, color: 'var(--color-danger)' }}>{error}</p>;
  if (!lista) return <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Cargando…</p>;
  if (lista.length === 0) {
    return (
      <div className="empty-state">
        <Receipt size={48} />
        <p>Todavía no has enviado presupuestos.</p>
        <button type="button" className="btn btn-primary btn-sm" onClick={onNuevo}>
          Enviar presupuesto
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {lista.map((q) => {
        const estado = q.order_id
          ? { texto: 'En una orden', color: '#34d399' }
          : q.sent_at
          ? { texto: 'Enviado', color: '#60a5fa' }
          : { texto: 'Sin enviar', color: 'var(--color-text-muted)' };
        return (
          <div key={q.id} className="card">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 16, fontWeight: 700, overflowWrap: 'anywhere' }}>
                  {`${q.client_first_name} ${q.client_last_name}`.trim()}
                </p>
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{formatDateShort(q.created_at)}</p>
              </div>
              <span
                style={{
                  flexShrink: 0,
                  fontSize: 11.5,
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: 999,
                  color: estado.color,
                  border: `1px solid ${estado.color}`,
                }}
              >
                {estado.texto}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                marginTop: 10,
                paddingTop: 10,
                borderTop: '1px solid var(--color-border)',
                fontSize: 13,
                color: 'var(--color-text-secondary)',
              }}
            >
              {q.car_model && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Car size={14} /> {q.car_model}
                </span>
              )}
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Phone size={14} /> {q.client_whatsapp}
              </span>
              {q.cita && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CalendarClock size={14} /> Cita: {formatCita(q.cita.day, q.cita.at_time)}
                </span>
              )}
              {!q.order_id && respuestaCliente(q).length > 0 && (
                <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '2px 0' }}>
                  {respuestaCliente(q).map((r) => (
                    <span
                      key={r.texto}
                      style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 9px', borderRadius: 999, color: r.color, border: `1px solid ${r.color}` }}
                    >
                      {r.texto}
                    </span>
                  ))}
                </span>
              )}
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--color-brand-400)' }}>
                <Receipt size={14} /> {formatUsd(totalQuote(q.items, q.labor_general_usd))}
                <span style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}>
                  · {q.items.length} ítem{q.items.length === 1 ? '' : 's'}
                </span>
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              <button type="button" onClick={() => enviar(q)} style={accion('#25d366')}>
                <MessageCircle size={14} />
                {q.sent_at ? 'Reenviar' : 'Enviar'}
              </button>
              {q.order_id ? (
                <Link href={`/admin/ordenes/${q.order_id}`} style={{ ...accion('var(--color-text-secondary)'), textDecoration: 'none' }}>
                  <ClipboardList size={14} />
                  Ver orden
                </Link>
              ) : (
                <>
                  <button type="button" onClick={() => onEditar(q)} style={accion('var(--color-text-secondary)')}>
                    <Pencil size={14} />
                    Editar
                  </button>
                  <button type="button" onClick={() => onCrearOrden(q)} style={accion('var(--color-brand-400)')}>
                    <ClipboardList size={14} />
                    Crear orden
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function accion(color: string) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 12px',
    borderRadius: 8,
    fontSize: 12.5,
    fontWeight: 700,
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface-2)',
    color,
    cursor: 'pointer',
  } as const;
}
