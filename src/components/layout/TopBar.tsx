'use client';

import Link from 'next/link';
import { LogOut, Receipt, Wrench } from 'lucide-react';
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

  // Cada rol tiene su propia sección, protegida por su layout.
  const presupuestosHref =
    profile.role === 'admin' ? '/admin/presupuestos' : '/mecanico/presupuestos';
  const activo = pathname.startsWith(presupuestosHref);

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

      {/* Presupuestos + Logout.
          Antes había aquí el tutorial y un círculo con las iniciales del
          taller. Se quitaron los dos a propósito: en un teléfono no cabían
          junto a "Presupuestos", que es un acceso de uso diario, y las
          iniciales no hacían nada (el nombre del taller ya está a la
          izquierda). El tutorial sigue en /video. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link
          href={presupuestosHref}
          aria-label="Ver presupuestos"
          title="Presupuestos"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: '7px 12px',
            color: activo ? 'var(--color-brand-400)' : 'var(--color-text-secondary)',
            textDecoration: 'none',
            fontSize: 12.5,
            fontWeight: 600,
            transition: 'all 0.15s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-brand-400)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.color = activo
              ? 'var(--color-brand-400)'
              : 'var(--color-text-secondary)';
          }}
        >
          <Receipt size={15} />
          Presupuestos
        </Link>
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
