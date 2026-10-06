'use client';

import { useEffect, useState } from 'react';
import { Loader2, MessageCircle, RefreshCw } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { mensajeRecordatorio } from '@/lib/recordatorios';
import { waLink } from '@/lib/whatsapp';
import type { Reminder } from '@/lib/types';

/**
 * Antes de mandar un recordatorio por WhatsApp: la IA redacta el mensaje en
 * tono cercano (como si lo escribiera el mecánico), el taller lo lee, lo
 * corrige si quiere y lo envía. El envío abre WhatsApp en el mismo toque del
 * botón, para que el navegador del teléfono no lo bloquee.
 */
export default function EnviarRecordatorioModal({
  reminder: r,
  workshopName,
  onClose,
  onEnviado,
}: {
  reminder: Reminder;
  workshopName: string;
  onClose: () => void;
  onEnviado: () => void;
}) {
  const respaldo = () =>
    mensajeRecordatorio({
      nombreCliente: r.client?.first_name ?? '',
      taller: workshopName,
      titulo: r.title,
      texto: r.body || r.transcript,
      fecha: r.due_date,
    });
  const [mensaje, setMensaje] = useState('');
  const [redactando, setRedactando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function redactar() {
    setRedactando(true);
    setError(null);
    try {
      const res = await fetch(`/api/reminders/${r.id}/mensaje`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      setMensaje(String(data.mensaje || respaldo()));
    } catch {
      setMensaje(respaldo());
    } finally {
      setRedactando(false);
    }
  }

  useEffect(() => {
    redactar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function enviar() {
    const link = waLink(r.client?.whatsapp, mensaje.trim());
    if (!link) {
      setError('Este cliente no tiene un WhatsApp válido.');
      return;
    }
    window.open(link, '_blank', 'noopener');
    onEnviado();
    onClose();
  }

  return (
    <Modal isOpen onClose={onClose} title={`Mensaje para ${r.client?.first_name ?? 'el cliente'}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {redactando ? (
          <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-secondary)', padding: '24px 0' }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
            Redactando el mensaje…
          </p>
        ) : (
          <>
            <textarea
              className="form-input"
              rows={9}
              maxLength={2000}
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <p style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>Puedes corregirlo antes de enviarlo.</p>
              <button
                type="button"
                onClick={redactar}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-brand-400)',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <RefreshCw size={13} /> Redactar otro
              </button>
            </div>
          </>
        )}
        {error && <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 10 }}>
          <Button type="button" variant="secondary" fullWidth onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" fullWidth disabled={redactando || !mensaje.trim()} onClick={enviar}>
            <MessageCircle size={16} />
            Enviar por WhatsApp
          </Button>
        </div>
      </div>
    </Modal>
  );
}
