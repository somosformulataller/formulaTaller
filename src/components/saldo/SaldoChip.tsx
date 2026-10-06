'use client';

import Link from 'next/link';
import { Wallet } from 'lucide-react';
import { useSaldo } from '@/components/saldo/SaldoProvider';
import { formatPrecioUsd } from '@/lib/budget';

/** El saldo del taller arriba, junto a la campana. Lleva a la pantalla de saldo. */
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
        gap: 5,
        background: bajo ? 'rgba(239,68,68,0.12)' : 'var(--color-surface-2)',
        border: `1px solid ${bajo ? 'rgba(239,68,68,0.4)' : 'var(--color-border)'}`,
        borderRadius: 8,
        padding: '5px 8px',
        fontSize: 12.5,
        fontWeight: 800,
        color: bajo ? '#f87171' : 'var(--color-brand-400)',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <Wallet size={14} />
      {formatPrecioUsd(saldo.saldo)}
    </Link>
  );
}
