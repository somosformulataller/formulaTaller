'use client';

import type { OrderStage } from '@/lib/types';
import AttachmentGallery from './AttachmentGallery';
import { Paperclip } from 'lucide-react';

/**
 * Muestra en el resumen de la orden (antes de las etapas de servicio) los
 * archivos adjuntados al crear la orden. Esos adjuntos viven en la etapa de
 * "Recepción" (posición 0), que es información principal de la orden y se
 * muestra aparte de las etapas del servicio (posición 1 en adelante).
 * Es solo lectura.
 */
export default function InitialAttachments({ stages }: { stages: OrderStage[] }) {
  const intake = stages.find((s) => s.position === 0);
  const attachments = intake?.attachments ?? [];
  if (attachments.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h2
        style={{
          fontSize: 16,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Paperclip size={16} />
        Archivos adjuntos
      </h2>
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
        Fotos, videos y notas de voz cargados al crear la orden.
      </p>
      <AttachmentGallery attachments={attachments} tile={72} />
    </div>
  );
}
