'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Loader2, Wallet } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useSaldo } from '@/components/saldo/SaldoProvider';
import { EVENTO_COMPRA } from '@/components/saldo/CompraSaldoModal';
import { formatPrecioUsd, formatUsd } from '@/lib/budget';
import { formatDate } from '@/lib/utils';

interface Compra {
  id: string;
  amount_usd: number;
  amount_ves: number | null;
  reference: string;
  status: 'pendiente' | 'aprobado' | 'rechazado';
  note: string | null;
  created_at: string;
}

interface Movimiento {
  id: string;
  kind: 'bienvenida' | 'recarga' | 'orden' | 'pregunta_ia' | 'ajuste' | 'reverso';
  amount_usd: number;
  balance_after: number;
  note: string | null;
  created_at: string;
}

const NOMBRE_MOVIMIENTO: Record<Movimiento['kind'], string> = {
  bienvenida: 'Saldo de bienvenida',
  recarga: 'Recarga',
  orden: 'Orden creada',
  pregunta_ia: 'Pregunta al asistente',
  ajuste: 'Ajuste',
  reverso: 'Devolución',
};

const ESTADO: Record<Compra['status'], { texto: string; color: string }> = {
  pendiente: { texto: 'En revisión', color: '#fbbf24' },
  aprobado: { texto: 'Aprobado', color: '#34d399' },
  rechazado: { texto: 'Rechazado', color: '#f87171' },
};

/**
 * Saldo del taller (0025): cuánto queda, cuánto cuesta cada cosa, el botón
 * para comprar, los pagos enviados y en qué se fue el saldo.
 */
export default function SaldoClient() {
  const saldo = useSaldo();
  const [compras, setCompras] = useState<Compra[] | null>(null);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [verTodo, setVerTodo] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/saldo', { cache: 'no-store' });
      if (!r.ok) return;
      const d = await r.json();
      setCompras(d.compras ?? []);
      setMovimientos(d.movimientos ?? []);
      if (typeof d.saldo === 'number') saldo?.setSaldo(d.saldo);
    } catch {
      setCompras((c) => c ?? []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cargar();
    window.addEventListener(EVENTO_COMPRA, cargar);
    return () => window.removeEventListener(EVENTO_COMPRA, cargar);
  }, [cargar]);

  if (!saldo) return null;
  const pendiente = (compras ?? []).find((c) => c.status === 'pendiente');
  const listaMov = verTodo ? movimientos : movimientos.slice(0, 15);

  return (
    <div style={{ paddingTop: 16, paddingBottom: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800 }}>Saldo</h1>

      {/* Saldo y comprar */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'rgba(245,158,11,0.12)',
              color: 'var(--color-brand-400)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Wallet size={24} />
          </div>
          <div>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>Tu saldo</p>
            <p style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>{formatPrecioUsd(saldo.saldo)}</p>
          </div>
        </div>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
          Cada orden cuesta <b>{formatPrecioUsd(saldo.precios.orden)}</b> y cada pregunta al asistente IA{' '}
          <b>{formatPrecioUsd(saldo.precios.preguntaIa)}</b>.
        </p>
        {pendiente && (
          <p
            style={{
              fontSize: 13,
              padding: '8px 10px',
              borderRadius: 8,
              background: 'rgba(251,191,36,0.1)',
              border: '1px solid rgba(251,191,36,0.35)',
              color: '#fbbf24',
            }}
          >
            Tienes un pago de {formatUsd(Number(pendiente.amount_usd))} en revisión. Cuando lo aprobemos, se suma solo.
          </p>
        )}
        <Button type="button" variant="primary" fullWidth onClick={saldo.abrirCompra}>
          Comprar saldo
        </Button>
      </div>

      {/* Pagos enviados */}
      <div className="card">
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Tus pagos</h2>
        {compras === null ? (
          <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-text-muted)' }}>
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Cargando…
          </p>
        ) : compras.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Todavía no has comprado saldo.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {compras.map((c) => (
              <div
                key={c.id}
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface-2)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <b style={{ fontSize: 14 }}>{formatUsd(Number(c.amount_usd))}</b>
                  <span style={{ fontSize: 12, fontWeight: 700, color: ESTADO[c.status].color }}>
                    {ESTADO[c.status].texto}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  Ref. {c.reference} · {formatDate(c.created_at)}
                </p>
                {c.status === 'rechazado' && c.note && (
                  <p style={{ fontSize: 12, color: '#f87171', marginTop: 4 }}>Motivo: {c.note}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Movimientos */}
      <div className="card">
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Movimientos</h2>
        {movimientos.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Sin movimientos todavía.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {listaMov.map((m) => {
              const monto = Number(m.amount_usd);
              const entra = monto > 0;
              return (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 0',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  <span style={{ color: entra ? '#34d399' : 'var(--color-text-muted)', display: 'flex', flexShrink: 0 }}>
                    {entra ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600 }}>{NOMBRE_MOVIMIENTO[m.kind] ?? m.kind}</p>
                    <p
                      style={{
                        fontSize: 11.5,
                        color: 'var(--color-text-muted)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatDate(m.created_at)}
                      {m.note && m.kind !== 'bienvenida' ? ` · ${m.note.replace(/^(Orden|Asistente): /, '')}` : ''}
                    </p>
                  </div>
                  <b style={{ fontSize: 13, color: entra ? '#34d399' : 'inherit', whiteSpace: 'nowrap' }}>
                    {entra ? '+' : '−'}
                    {formatPrecioUsd(Math.abs(monto))}
                  </b>
                </div>
              );
            })}
            {movimientos.length > 15 && !verTodo && (
              <button
                type="button"
                onClick={() => setVerTodo(true)}
                style={{
                  marginTop: 10,
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-brand-400)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Ver más
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
