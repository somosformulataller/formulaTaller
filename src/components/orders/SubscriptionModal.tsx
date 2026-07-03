'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Lock, X, MessageCircle } from 'lucide-react';
import Button from '@/components/ui/Button';
import { buildWhatsAppLink } from '@/lib/utils';

interface SubscriptionModalProps {
  onClose: () => void;
  message?: string;
  /** Números de atención al cliente para pagar la suscripción. */
  phones?: string[];
}

const WHATSAPP_MESSAGE =
  'Hola, quiero suscribirme al plan pago de Formula Taller para crear más órdenes.';

// Shown when a workshop hits its free-plan order limit. Lists the support
// numbers (managed from the superadmin panel) so the user can pay/subscribe.
export default function SubscriptionModal({ onClose, message, phones }: SubscriptionModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const numbers = (phones ?? []).filter((p) => p.trim().length > 0);

  return createPortal(
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content" style={{ maxWidth: 400, textAlign: 'center', padding: 28 }}>
        <button
          onClick={onClose}
          aria-label="Cerrar"
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            background: 'transparent',
            border: 'none',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            display: 'flex',
          }}
        >
          <X size={18} />
        </button>

        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'rgba(245,158,11,0.15)',
            border: '1px solid rgba(245,158,11,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-brand-400)',
            margin: '4px auto 16px',
          }}
        >
          <Lock size={28} />
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>
          Límite del plan gratuito
        </h2>
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: numbers.length ? 16 : 20 }}>
          {message ||
            'Alcanzaste el máximo de órdenes gratuitas. Para seguir usando la aplicación debes pagar la suscripción.'}
        </p>

        {numbers.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
              Escríbenos para activar tu plan:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {numbers.map((phone) => (
                <a
                  key={phone}
                  href={buildWhatsAppLink(phone, WHATSAPP_MESSAGE)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '10px 14px',
                    background: 'rgba(37,211,102,0.12)',
                    border: '1px solid rgba(37,211,102,0.25)',
                    borderRadius: 10,
                    color: '#25D366',
                    fontSize: 15,
                    fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  <MessageCircle size={16} />
                  {phone}
                </a>
              ))}
            </div>
          </div>
        )}

        <Button variant="primary" fullWidth onClick={onClose}>
          Entendido
        </Button>
      </div>
    </div>,
    document.body
  );
}
