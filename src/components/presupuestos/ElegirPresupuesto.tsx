'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Receipt, Search } from 'lucide-react';
import { formatUsd } from '@/lib/budget';
import { formatDateShort } from '@/lib/utils';
import { formatCita, totalQuote, type Quote } from '@/lib/presupuestos';

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Lista de los presupuestos sueltos que todavía no están en una orden (0028),
 * con buscador, para elegir uno.
 */
export default function ElegirPresupuesto({
  onElegir,
  ocupado,
}: {
  onElegir: (q: Quote) => void;
  /** Mientras se procesa la elección, la lista no responde. */
  ocupado?: boolean;
}) {
  const [lista, setLista] = useState<Quote[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/quotes?libres=1', { cache: 'no-store' });
        if (!res.ok) throw new Error('No se pudieron cargar los presupuestos');
        setLista(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar');
      }
    })();
  }, []);

  const visibles = useMemo(() => {
    const q = normalizar(busqueda.trim());
    if (!lista || !q) return lista ?? [];
    return lista.filter((p) =>
      normalizar(`${p.client_first_name} ${p.client_last_name} ${p.car_model} ${p.client_whatsapp}`).includes(q)
    );
  }, [lista, busqueda]);

  if (error) return <p style={{ fontSize: 13, color: 'var(--color-danger)' }}>{error}</p>;
  if (!lista) return <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Cargando…</p>;
  if (lista.length === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
        No hay presupuestos guardados sin orden. Se crean con «Enviar presupuesto».
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {lista.length > 4 && (
        <div style={{ position: 'relative' }}>
          <Search
            size={15}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-text-muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            className="form-input"
            placeholder="Buscar por cliente o vehículo"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ paddingLeft: 34 }}
          />
        </div>
      )}
      {visibles.map((p) => (
        <button
          key={p.id}
          type="button"
          disabled={ocupado}
          onClick={() => onElegir(p)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface-2)',
            color: 'inherit',
            textAlign: 'left',
            cursor: ocupado ? 'wait' : 'pointer',
          }}
        >
          <Receipt size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 600, overflowWrap: 'anywhere' }}>
              {`${p.client_first_name} ${p.client_last_name}`.trim()}
              {p.car_model && ` · ${p.car_model}`}
            </span>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              {formatDateShort(p.created_at)} · {p.items.length} ítem{p.items.length === 1 ? '' : 's'}
            </span>
            {p.cita && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                <CalendarClock size={12} />
                {formatCita(p.cita.day, p.cita.at_time)}
              </span>
            )}
          </span>
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-brand-400)', whiteSpace: 'nowrap' }}>
            {formatUsd(totalQuote(p.items, p.labor_general_usd))}
          </span>
        </button>
      ))}
    </div>
  );
}
