'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Lock, X } from 'lucide-react';
import Button from '@/components/ui/Button';

interface SubscriptionModalProps {
  onClose: () => void;
  message?: string;
}

// Shown when a workshop hits its free-plan order limit. Payment flow is not
// defined yet, so this is informational only.
export default function SubscriptionModal({ onClose, message }: SubscriptionModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

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
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
          {message ||
            'Alcanzaste el máximo de órdenes gratuitas. Para seguir usando la aplicación debes pagar la suscripción.'}
        </p>

        <Button variant="primary" fullWidth onClick={onClose}>
          Entendido
        </Button>
      </div>
    </div>,
    document.body
  );
}
