'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

export interface Tasa {
  rate: number;
  fetchedAt: string | null;
}

function formatBs(n: number): string {
  return `Bs. ${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
}

/** «lunes 6 de octubre», en hora de Venezuela. */
function formatDia(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(d);
}

/**
 * La tasa BCV del día en Bs y en $, como en La Mejor Llave. Va arriba del
 * modal de compra (admin del taller) y de Pagos (superadmin), y se muestra
 * siempre: si dolarapi falla, lo dice y deja reintentar.
 * El fin de semana es la del lunes (ver lib/tasa-bcv.ts).
 */
export default function TasaDelDia({
  onTasa,
  url = '/api/tasa-bcv',
}: {
  onTasa?: (t: Tasa | null) => void;
  /** El superadmin la pide a /api/superadmin/tasa-bcv. */
  url?: string;
}) {
  const [tasa, setTasa] = useState<Tasa | null | undefined>(undefined);

  const cargar = useCallback(async () => {
    setTasa(undefined);
    const t = await fetch(url, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    const valor: Tasa | null = t?.rate ? { rate: Number(t.rate), fetchedAt: t.fetchedAt ?? null } : null;
    setTasa(valor);
    onTasa?.(valor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const dia = tasa ? formatDia(tasa.fetchedAt) : null;

  return (
    <div
      style={{
        background: 'rgba(245,158,11,0.08)',
        border: '1px solid rgba(245,158,11,0.35)',
        borderRadius: 12,
        padding: '10px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: 0.3 }}>
        💱 TASA BCV DEL DÍA
      </span>
      {tasa === undefined ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-text-secondary)' }}>
          <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
          Consultando la tasa…
        </span>
      ) : tasa ? (
        <>
          <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-brand-400)' }}>
            $1 = {formatBs(tasa.rate)}
          </span>
          {dia && <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Vigente para el {dia}</span>}
        </>
      ) : (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13, color: '#fbbf24' }}>
          No se pudo consultar la tasa ahora mismo.
          <button
            type="button"
            onClick={cargar}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface-2)',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={12} />
            Reintentar
          </button>
        </span>
      )}
    </div>
  );
}
