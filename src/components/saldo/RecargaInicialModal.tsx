'use client';

import { Wallet } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

/** Video de la asesoría personalizada (bucket público «tutorials»). */
export const VIDEO_RECARGA_URL =
  'https://tsvaagakjkemavhdcroy.supabase.co/storage/v1/object/public/tutorials/recargar-saldo-2026-10-15.mp4';

/** Lo que se le pide recargar la primera vez. */
export const RECARGA_INICIAL_USD = 3;

/**
 * Sale cada vez que entra un taller que NUNCA ha recargado saldo: título, el
 * video, el texto y el botón para recargar. Tras la primera recarga ya no sale.
 */
export default function RecargaInicialModal({
  onRecargar,
  onClose,
}: {
  onRecargar: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      isOpen
      onClose={onClose}
      titleStyle={{ fontSize: 15.5, lineHeight: 1.35 }}
      title="En este video de solo 4 minutos, te indico como recibir la asesoría personalizada de nuestros asesores para aprender a usar la herramienta."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <video
          src={VIDEO_RECARGA_URL}
          controls
          playsInline
          preload="metadata"
          style={{
            width: '100%',
            maxHeight: '42dvh',
            borderRadius: 'var(--border-radius-sm)',
            border: '1px solid var(--color-border)',
            background: '#000',
          }}
        />
        <p style={{ fontSize: 13.5, color: 'var(--color-text-secondary)', textAlign: 'center' }}>
          Recuerda que solo debes recargar 3 dólares a través de Pago Móvil y si luego de 7 días, decides que no
          quieres usarla más, te devolveremos 5$.
        </p>
        <Button type="button" variant="primary" fullWidth onClick={onRecargar}>
          <Wallet size={18} /> Recargar 3$ por Pago Móvil
        </Button>
      </div>
    </Modal>
  );
}
