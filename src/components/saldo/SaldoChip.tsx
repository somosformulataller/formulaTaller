'use client';

import Link from 'next/link';
import { Wallet } from 'lucide-react';
import { useSaldo } from '@/components/saldo/SaldoProvider';
import { formatPrecioUsd } from '@/lib/budget';

/** El saldo del taller, centrado debajo del encabezado. Lleva a la pantalla de saldo. */
export default function SaldoChip() {
  const saldo = useSaldo();
  if (!saldo) return null;
  const bajo = !saldo.alcanza(saldo.precios.orden);
  return (
    <Link
      href="/admin/saldo"
      aria-label={`Saldo: ${formatPrecioUsd(saldo.saldo)}`}
      title="Saldo"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: bajo ? 'rgba(239,68,68,0.12)' : 'var(--color-surface-2)',
        border: `1px solid ${bajo ? 'rgba(239,68,68,0.4)' : 'var(--color-border)'}`,
        borderRadius: 999,
        padding: '6px 14px',
        fontSize: 13,
        fontWeight: 800,
        color: bajo ? '#f87171' : 'var(--color-brand-400)',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <Wallet size={15} />
      <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>Saldo</span>
      {formatPrecioUsd(saldo.saldo)}
    </Link>
  );
}
