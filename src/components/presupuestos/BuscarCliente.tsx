'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { ClientRow } from '@/lib/types';

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Buscador de los clientes del taller para elegir uno. */
export default function BuscarCliente({ onElegir }: { onElegir: (c: ClientRow) => void }) {
  const [clientes, setClientes] = useState<ClientRow[] | null>(null);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    fetch('/api/clients', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then(setClientes)
      .catch(() => setClientes([]));
  }, []);

  const visibles = useMemo(() => {
    const q = normalizar(busqueda.trim());
    const digitos = busqueda.replace(/\D/g, '');
    const l = clientes ?? [];
    return (
      q
        ? l.filter(
            (c) =>
              normalizar(`${c.first_name} ${c.last_name} ${c.last_car_model ?? ''}`).includes(q) ||
              (digitos.length >= 3 && c.whatsapp.includes(digitos))
          )
        : l
    ).slice(0, 8);
  }, [clientes, busqueda]);

  return (
    <div>
      <div style={{ position: 'relative', marginBottom: 6 }}>
        <Search
          size={15}
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }}
        />
        <input
          className="form-input"
          placeholder="Buscar cliente por nombre, vehículo o teléfono"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{ paddingLeft: 34 }}
        />
      </div>
      {!clientes && <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>Cargando…</p>}
      {clientes && clientes.length === 0 && (
        <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>
          No hay clientes todavía. Se agregan en Clientes o al crear órdenes o presupuestos.
        </p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {visibles.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onElegir(c)}
            style={{
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface-2)',
              color: 'inherit',
              textAlign: 'left',
              fontSize: 13.5,
              cursor: 'pointer',
            }}
          >
            {`${c.first_name} ${c.last_name}`.trim() || 'Sin nombre'}
            {c.last_car_model && <span style={{ color: 'var(--color-text-muted)' }}> · {c.last_car_model}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
