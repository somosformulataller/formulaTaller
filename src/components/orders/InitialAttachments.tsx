'use client';

import { useState } from 'react';
import type { OrderStage, StageAttachment } from '@/lib/types';
import AttachmentGallery from './AttachmentGallery';
import AttachmentPicker from './AttachmentPicker';
import { uploadStageAttachment } from '@/lib/attachments';
import { Paperclip, Plus, Loader2 } from 'lucide-react';

/**
 * Muestra en el resumen de la orden (antes de las etapas de servicio) los
 * archivos adjuntados al crear la orden. Esos adjuntos viven en la etapa de
 * "Recepción" (posición 0), que es información principal de la orden y se
 * muestra aparte de las etapas del servicio (posición 1 en adelante).
 *
 * Con `canEdit` se pueden ver, agregar y eliminar. Si la orden es antigua y no
 * tiene etapa de recepción, se crea la primera vez que se sube un archivo.
 */
interface InitialAttachmentsProps {
  orderId: string;
  stages: OrderStage[];
  canEdit?: boolean;
}

export default function InitialAttachments({
  orderId,
  stages,
  canEdit = false,
}: InitialAttachmentsProps) {
  const intake = stages.find((s) => s.position === 0);
  const [stageId, setStageId] = useState<string | null>(intake?.id ?? null);
  const [attachments, setAttachments] = useState<StageAttachment[]>(
    intake?.attachments ?? []
  );
  const [uploading, setUploading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  // Solo lectura y sin adjuntos: no hay nada que mostrar.
  if (!canEdit && attachments.length === 0) return null;

  // Devuelve el id de la etapa de recepción, creándola si la orden no la tiene.
  async function ensureStageId(): Promise<string | null> {
    if (stageId) return stageId;
    const res = await fetch(`/api/orders/${orderId}/stages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Recepción', position: 0 }),
    });
    if (!res.ok) return null;
    const created: OrderStage = await res.json();
    setStageId(created.id);
    return created.id;
  }

  async function handleFiles(files: File[]) {
    setUploading(true);
    const sid = await ensureStageId();
    if (!sid) {
      setUploading(false);
      alert('No se pudo preparar la sección de recepción. Intenta de nuevo.');
      return;
    }
    for (const file of files) {
      try {
        const att = await uploadStageAttachment(orderId, sid, file);
        setAttachments((prev) => [...prev, att]);
      } catch (err) {
        alert(err instanceof Error ? err.message : `No se pudo subir "${file.name}"`);
      }
    }
    setUploading(false);
  }

  async function handleDelete(attachmentId: string) {
    if (!stageId) return;
    if (!confirm('¿Eliminar este adjunto?')) return;

    // Optimista: quitarlo de inmediato y revertir si el servidor falla.
    const snapshot = attachments;
    setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));

    let res: Response;
    try {
      res = await fetch(
        `/api/orders/${orderId}/stages/${stageId}/attachments?id=${attachmentId}`,
        { method: 'DELETE' }
      );
    } catch {
      setAttachments(snapshot);
      alert('No se pudo eliminar el adjunto: revisa tu conexión e intenta de nuevo.');
      return;
    }

    if (!res.ok) {
      setAttachments(snapshot);
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'No se pudo eliminar el adjunto. Intenta de nuevo.');
    }
  }

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

      {attachments.length > 0 ? (
        <AttachmentGallery
          attachments={attachments}
          canEdit={canEdit}
          onDelete={canEdit ? handleDelete : undefined}
          tile={72}
        />
      ) : (
        canEdit && (
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 10 }}>
            Aún no hay archivos. Agrega fotos, videos, notas de voz o documentos.
          </p>
        )
      )}

      {canEdit && (
        <button
          onClick={() => setShowPicker(true)}
          disabled={uploading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 12,
            padding: '6px 12px',
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            cursor: uploading ? 'default' : 'pointer',
          }}
        >
          {uploading ? (
            <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} />
          ) : (
            <Plus size={13} />
          )}
          {uploading ? 'Subiendo...' : 'Agregar foto, video, nota de voz o documento'}
        </button>
      )}

      {showPicker && (
        <AttachmentPicker
          onFiles={handleFiles}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
