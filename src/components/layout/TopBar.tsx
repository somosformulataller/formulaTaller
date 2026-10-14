'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LogOut, PlayCircle, Sparkles, Wrench } from 'lucide-react';
import Modal from '@/components/ui/Modal';
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
  const [verTutorial, setVerTutorial] = useState(false);

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
        padding: '0 12px',
        gap: 8,
        zIndex: 50,
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      {/* Logo + Title. El nombre del taller se recorta con «…» para que los
          botones de la derecha quepan siempre en una sola línea. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
        <div
          style={{
            width: 34,
            height: 34,
            flexShrink: 0,
            background: 'linear-gradient(135deg, var(--color-brand-500), var(--color-brand-700))',
            borderRadius: 9,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Wrench size={18} color="#0D0F1A" strokeWidth={2.5} />
        </div>
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              fontSize: 14,
              fontWeight: 700,
              lineHeight: 1.1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title || 'Formula Taller'}
          </p>
          <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1, marginTop: 2 }}>
            {profile.role === 'admin' ? 'Administrador' : 'Mecánico'}
          </p>
        </div>
      </div>

      {/* Tutorial, asistente, campana y Salir: siempre en una línea (no se
          encogen; lo que cede es el nombre del taller). «Tutorial» va en letra
          pequeña para que quepa en un teléfono de 360 px. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {profile.role === 'admin' && (
          <>
            <button
              type="button"
              onClick={() => setVerTutorial(true)}
              title="Ver el video tutorial"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                background: 'rgba(245,158,11,0.12)',
                border: '1px solid rgba(245,158,11,0.35)',
                borderRadius: 8,
                padding: '6px 7px',
                color: 'var(--color-brand-400)',
                fontSize: 11,
                fontWeight: 700,
                lineHeight: 1,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              <PlayCircle size={14} />
              Tutorial
            </button>
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
            padding: '6px 8px',
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

      {/* El video se abre aquí mismo (ventana emergente) cargando /video, que
          lo toma de platform_settings. Solo se monta al abrir, para no
          descargar el video a quien no lo pide. */}
      {verTutorial && (
        <Modal isOpen onClose={() => setVerTutorial(false)} title="Tutorial">
          <iframe
            src="/video"
            title="Video tutorial de Formula Taller"
            allow="autoplay; fullscreen; picture-in-picture"
            style={{
              width: '100%',
              height: '65dvh',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--border-radius-sm)',
              background: '#000',
            }}
          />
        </Modal>
      )}
    </header>
  );
}
