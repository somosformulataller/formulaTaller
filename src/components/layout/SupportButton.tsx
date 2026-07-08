'use client';

import { useEffect, useState } from 'react';
import { LifeBuoy } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { openWhatsApp } from '@/lib/utils';

const SUPPORT_MESSAGE =
  'Hola, tengo una consulta sobre el uso de la plataforma Formula Taller.';

/**
 * Botón flotante de Soporte (admin y mecánico). Abre WhatsApp al número de
 * atención al cliente (support_phones de platform_settings, gestionado desde el
 * panel de superadmin). Se oculta si no hay número configurado.
 */
export default function SupportButton() {
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    createClient()
      .from('platform_settings')
      .select('support_phones')
      .eq('id', 1)
      .single()
      .then(({ data }: { data: { support_phones?: string[] } | null }) => {
        const list = (data?.support_phones ?? []).filter((p) => p.trim().length > 0);
        if (active && list.length) setPhone(list[0]);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!phone) return null;

  return (
    <button
      type="button"
      onClick={() => openWhatsApp(phone, SUPPORT_MESSAGE)}
      aria-label="Soporte por WhatsApp"
      title="Soporte por WhatsApp"
      style={{
        position: 'fixed',
        right: 16,
        bottom: 'calc(var(--bottom-nav-height) + 16px + env(safe-area-inset-bottom))',
        zIndex: 60,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '11px 16px',
        background: '#25D366',
        color: '#fff',
        border: 'none',
        borderRadius: 999,
        fontSize: 14,
        fontWeight: 700,
        cursor: 'pointer',
        boxShadow: '0 6px 20px rgba(37,211,102,0.45)',
      }}
    >
      <LifeBuoy size={18} />
      Soporte
    </button>
  );
}
