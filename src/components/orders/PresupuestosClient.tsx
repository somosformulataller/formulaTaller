'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ExternalLink, Receipt, Search } from 'lucide-react';
import BudgetList from '@/components/orders/BudgetList';
import LoadError from '@/components/ui/LoadError';
import type { BudgetSummary } from '@/lib/types';
import { formatUsd } from '@/lib/budget';
import { formatDateShort } from '@/lib/utils';

/**
 * Pantalla "Presupuestos" (la del botón del header).
 *
 * Lista TODAS las órdenes del taller con su total, tengan presupuesto o no,
 * porque desde aquí también se empieza uno nuevo. Al tocar una orden se
 * despliega su lista ahí mismo, editable: es el camino corto para cobrar sin
 * tener que entrar a la orden completa.
 */
export default function PresupuestosClient({ basePath }: { basePath: string }) {
  const [filas, setFilas] = useState<BudgetSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  // Totales que reporta la lista abierta, para que la fila se actualice sin
  // tener que recargar toda la pantalla.
  const [totales, setTotales] = useState<Record<string, number>>({});

  async function cargar() {
    setError(null);
    try {
      const res = await fetch('/api/budgets', { cache: 'no-store' });
      if (!res.ok) throw new Error('No se pudieron cargar los presupuestos');
      setFilas(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  const visibles = useMemo(() => {
    if (!filas) return [];
    const q = busqueda.trim().toLowerCase();
    if (!q) return filas;
    return filas.filter(
      (f) =>
        f.client_name.toLowerCase().includes(q) || f.car_model.toLowerCase().includes(q)
    );
  }, [filas, busqueda]);

  const totalGeneral = useMemo(
    () => visibles.reduce((a, f) => a + Math.round((totales[f.order_id] ?? f.total) * 100), 0) / 100,
    [visibles, totales]
  );

  if (error) return <LoadError message={error} detail="Recarga la página para volver a intentarlo." />;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Presupuestos</h1>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
          Toca una orden para ver o editar lo que se le cobra.
        </p>
      </div>

      {filas && filas.length > 0 && (
        <div style={{ position: 'relative', marginBottom: 14 }}>
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

      {!filas && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Cargando…</p>
      )}

      {filas && filas.length === 0 && (
        <div className="empty-state">
          <Receipt size={40} />
          <p>Todavía no hay órdenes. Crea una y podrás armarle su presupuesto.</p>
        </div>
      )}

      {filas && filas.length > 0 && visibles.length === 0 && (
        <div className="empty-state">
          <Search size={40} />
          <p>Ninguna orden coincide con «{busqueda}».</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visibles.map((f) => {
          const estaAbierta = abierta === f.order_id;
          const total = totales[f.order_id] ?? f.total;
          return (
            <div key={f.order_id} className="card">
              <button
                type="button"
                onClick={() => setAbierta(estaAbierta ? null : f.order_id)}
                aria-expanded={estaAbierta}
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
                <span style={{ minWidth: 0 }}>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 15,
                      fontWeight: 700,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {f.client_name}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 12,
                      color: 'var(--color-text-secondary)',
                      marginTop: 2,
                    }}
                  >
                    {f.car_model} · {formatDateShort(f.created_at)}
                    {f.item_count > 0 && ` · ${f.item_count} ítem${f.item_count === 1 ? '' : 's'}`}
                  </span>
                </span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: total > 0 ? 'var(--color-brand-400)' : 'var(--color-text-muted)',
                    }}
                  >
                    {formatUsd(total)}
                  </span>
                  <ChevronDown
                    size={16}
                    style={{
                      color: 'var(--color-text-muted)',
                      transform: estaAbierta ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.15s',
                    }}
                  />
                </span>
              </button>

              {estaAbierta && (
                <div style={{ marginTop: 14 }}>
                  <BudgetList
                    orderId={f.order_id}
                    onTotalChange={(t) =>
                      setTotales((prev) => (prev[f.order_id] === t ? prev : { ...prev, [f.order_id]: t }))
                    }
                  />
                  <Link
                    href={`${basePath}/ordenes/${f.order_id}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      marginTop: 14,
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: 'var(--color-text-secondary)',
                      textDecoration: 'none',
                    }}
                  >
                    <ExternalLink size={13} />
                    Abrir la orden completa
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {visibles.length > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginTop: 18,
            paddingTop: 14,
            borderTop: '1px solid var(--color-border)',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
            Total de {visibles.length} órdenes
          </span>
          <span style={{ fontSize: 18, fontWeight: 800 }}>{formatUsd(totalGeneral)}</span>
        </div>
      )}
    </div>
  );
}
