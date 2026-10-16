'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarPlus, ChevronRight, Plus, Receipt } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { formatUsd } from '@/lib/budget';
import { hoyVE } from '@/lib/recordatorios';
import { formatDateShort } from '@/lib/utils';
import { formatCita, totalQuote, type Cita, type Quote } from '@/lib/presupuestos';
import { CitaForm, FilaCita } from '@/components/presupuestos/Citas';

const botonNuevo = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  width: '100%',
  padding: '9px 10px',
  borderRadius: 8,
  border: '1px dashed var(--color-border)',
  background: 'transparent',
  color: 'var(--color-text-secondary)',
  fontSize: 13,
  fontWeight: 700,
  textDecoration: 'none',
  cursor: 'pointer',
} as const;

/** «Ver cita» en Clientes: sus citas de hoy en adelante y el botón para agendar otra. */
export function CitasDelCliente({ clientId, workshopName }: { clientId: string; workshopName: string }) {
  const [citas, setCitas] = useState<Cita[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agendar, setAgendar] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/citas?client_id=${clientId}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('No se pudieron cargar las citas');
        setCitas(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar');
      }
    })();
  }, [clientId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {error && <p style={{ fontSize: 12.5, color: 'var(--color-danger)' }}>{error}</p>}
      {!citas && !error && <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>Cargando…</p>}
      {citas && citas.length === 0 && (
        <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>No tiene citas agendadas.</p>
      )}
      {citas?.map((c) => (
        <FilaCita
          key={c.id}
          cita={c}
          workshopName={workshopName}
          conFecha
          onBorrada={(id) => setCitas((p) => (p ?? []).filter((x) => x.id !== id))}
        />
      ))}
      <button type="button" onClick={() => setAgendar(true)} style={botonNuevo}>
        <CalendarPlus size={15} />
        Agendar cita
      </button>
      {agendar && (
        <Modal isOpen onClose={() => setAgendar(false)} title="Agendar cita">
          <CitaForm
            dia={hoyVE()}
            delDia={[]}
            clienteId={clientId}
            onCreadas={(nuevas) => {
              setCitas((p) =>
                [...(p ?? []), ...nuevas].sort((a, b) =>
                  `${a.day} ${a.at_time ?? ''}`.localeCompare(`${b.day} ${b.at_time ?? ''}`)
                )
              );
              setAgendar(false);
            }}
            onCancel={() => setAgendar(false)}
          />
        </Modal>
      )}
    </div>
  );
}

/** «Presupuesto» en Clientes: sus presupuestos sueltos y el botón para enviarle uno. */
export function PresupuestosDelCliente({ clientId }: { clientId: string }) {
  const [lista, setLista] = useState<Quote[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/quotes?client_id=${clientId}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('No se pudieron cargar los presupuestos');
        setLista(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar');
      }
    })();
  }, [clientId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {error && <p style={{ fontSize: 12.5, color: 'var(--color-danger)' }}>{error}</p>}
      {!lista && !error && <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>Cargando…</p>}
      {lista && lista.length === 0 && (
        <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>
          No tiene presupuestos sin orden. Los de sus órdenes están en «Ver orden».
        </p>
      )}
      {lista?.map((q) => (
        <Link
          key={q.id}
          href={q.order_id ? `/admin/ordenes/${q.order_id}` : `/admin/presupuestos/enviar/${q.id}`}
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
          <Receipt size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 600, overflowWrap: 'anywhere' }}>
              {q.car_model || 'Presupuesto'} · {formatUsd(totalQuote(q.items, q.labor_general_usd))}
            </span>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              {formatDateShort(q.created_at)}
              {q.order_id ? ' · En una orden' : q.sent_at ? ' · Enviado' : ' · Sin enviar'}
              {q.cita && ` · Cita: ${formatCita(q.cita.day, q.cita.at_time)}`}
            </span>
          </span>
          <ChevronRight size={15} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
        </Link>
      ))}
      <Link href={`/admin/presupuestos/enviar?cliente=${clientId}`} style={botonNuevo}>
        <Plus size={15} />
        Enviar presupuesto
      </Link>
    </div>
  );
}
