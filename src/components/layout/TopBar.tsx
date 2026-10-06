'use client';

import Link from 'next/link';
import { LogOut, Sparkles, Wrench } from 'lucide-react';
import NotificationBell from '@/components/layout/NotificationBell';
import { createClient } from '@/lib/supabase/client';
import { usePathname, useRouter } from 'next/navigation';
import type { Profile } from '@/lib/types';

interface TopBarProps {
  profile: Profile;
  title?: string;
}

export default function TopBar({ profile, title }: TopBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 'var(--top-bar-height)',
        background: 'rgba(13,15,26,0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        zIndex: 50,
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      {/* Logo + Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 34,
            height: 34,
            background: 'linear-gradient(135deg, var(--color-brand-500), var(--color-brand-700))',
            borderRadius: 9,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Wrench size={18} color="#0D0F1A" strokeWidth={2.5} />
        </div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, lineHeight: 1 }}>
            {title || 'Formula Taller'}
          </p>
          <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1, marginTop: 2 }}>
            {profile.role === 'admin' ? 'Administrador' : 'Mecánico'}
          </p>
        </div>
      </div>

      {/* Asistente, campana y Salir.
          Antes había aquí el tutorial y un círculo con las iniciales del
          taller. Se quitaron los dos a propósito: en un teléfono no cabían
          junto a "Presupuestos", que es un acceso de uso diario, y las
          iniciales no hacían nada (el nombre del taller ya está a la
          izquierda). El tutorial sigue en /video. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {profile.role === 'admin' && (
          <>
            <Link
              href="/admin/asistente"
              aria-label="Asistente"
              title="Asistente"
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                padding: '6px 8px',
                color: pathname.startsWith('/admin/asistente')
                  ? 'var(--color-brand-400)'
                  : 'var(--color-text-secondary)',
              }}
            >
              <Sparkles size={16} />
            </Link>
            <NotificationBell workshopName={title || 'el taller'} />
          </>
        )}
        {/* «Presupuestos» salió del encabezado; el botón está guardado en
            components/layout/BotonPresupuestos.tsx hasta decidir dónde va. */}
        <button
          onClick={handleLogout}
          style={{
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: '6px 10px',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 12,
            fontWeight: 500,
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-primary)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-secondary)';
          }}
        >
          <LogOut size={14} />
          <span className="tb-label">Salir</span>
        </button>
      </div>
    </header>
  );
}
