'use client';

import { Wallet } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { formatUsd } from '@/lib/budget';

/** Aparece al intentar crear una orden o preguntar a la IA sin saldo. */
export default function SinSaldoModal({
  mensaje,
  saldo,
  onComprar,
  onClose,
}: {
  mensaje?: string;
  saldo: number;
  onComprar: () => void;
  onClose: () => void;
}) {
  return (
    <Modal isOpen onClose={onClose} title="Saldo insuficiente">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'rgba(245,158,11,0.12)',
            color: 'var(--color-brand-400)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Wallet size={26} />
        </div>
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
          {mensaje || 'No tienes saldo suficiente. Compra saldo para seguir usando la app.'}
        </p>
        <p style={{ fontSize: 13 }}>
          Tu saldo: <b>{formatUsd(saldo)}</b>
        </p>
        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          <Button type="button" variant="secondary" fullWidth onClick={onClose}>
            Ahora no
          </Button>
          <Button type="button" variant="primary" fullWidth onClick={onComprar}>
            Comprar saldo
          </Button>
        </div>
      </div>
    </Modal>
  );
}
