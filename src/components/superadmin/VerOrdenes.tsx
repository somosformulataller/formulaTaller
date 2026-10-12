'use client';

import { useState } from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';
import OrdenarChips from './OrdenarChips';

/** Una orden en las listas del superadmin (Métricas y Talleres). */
export interface OrdenResumen {
  id: string;
  workshop_id: string;
  created_at: string;
  cliente: string;
  carro: string;
  status: string;
  /** #1 es la primera orden que creó el taller. */
  numero: number;
  total: number;
}

const ESTADO: Record<string, string> = {
  sin_mecanico: 'Sin mecánico',
  con_mecanico: 'En el taller',
  lista: 'Lista',
};

export function fechaHora(iso: string): string {
  return new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas',
    day: '2-digit',
    month: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function Orden({ o }: { o: OrdenResumen }) {
  return (
    <div
      style={{
        marginTop: 8,
        background: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: '8px 10px',
        fontSize: 13,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 800,
            padding: '2px 7px',
            borderRadius: 999,
            background: 'rgba(245,158,11,0.15)',
            color: 'var(--color-brand-400)',
          }}
        >
          #{o.numero} de {o.total}
        </span>
        <span style={{ fontWeight: 600 }}>
          {o.carro || 'Sin modelo'} · {o.cliente || 'Sin nombre'}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', color: 'var(--color-text-muted)', fontSize: 12, marginTop: 3 }}>
        <span>
          {fechaHora(o.created_at)} · {ESTADO[o.status] ?? o.status}
        </span>
        <a
          href={`/superadmin/talleres/${o.workshop_id}/ordenes/${o.id}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--color-brand-400)', fontWeight: 600 }}
        >
          Ver orden <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
}

/** Despliega todas las órdenes del taller, de la más reciente o de la más antigua. */
export function VerOrdenes({ ordenes }: { ordenes: OrdenResumen[] }) {
  const [abierto, setAbierto] = useState(false);
  const [antiguas, setAntiguas] = useState(false);
  if (ordenes.length === 0) return null;
  // ordenes viene de la #1 (la más antigua) a la última.
  const lista = antiguas ? ordenes : [...ordenes].reverse();
  return (
    <div style={{ marginTop: 8 }}>
      <button
        onClick={() => setAbierto((v) => !v)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          fontSize: 12.5,
          fontWeight: 700,
          color: 'var(--color-text-secondary)',
        }}
      >
        {abierto ? 'Ocultar' : 'Ver'} {ordenes.length === 1 ? 'su orden' : `sus ${ordenes.length} órdenes`}
        <ChevronDown size={14} style={{ transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>
      {abierto && ordenes.length > 1 && (
        <div style={{ marginTop: 8 }}>
          <OrdenarChips
            pequeno
            opciones={[
              { key: 'recientes', label: 'Más recientes' },
              { key: 'antiguas', label: 'Más antiguas' },
            ]}
            valor={antiguas ? 'antiguas' : 'recientes'}
            onChange={(k) => setAntiguas(k === 'antiguas')}
          />
        </div>
      )}
      {abierto && lista.map((o) => <Orden key={o.id} o={o} />)}
    </div>
  );
}

