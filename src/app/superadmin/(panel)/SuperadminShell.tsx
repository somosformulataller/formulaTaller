'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Building2, TrendingUp, LogOut, Menu, X, Wrench } from 'lucide-react';

const NAV = [
  { href: '/superadmin', label: 'Talleres', icon: Building2, exact: true },
  { href: '/superadmin/ventas', label: 'Ventas', icon: TrendingUp, exact: false },
];

export default function SuperadminShell({
  adminEmail,
  children,
}: {
  adminEmail: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } finally {
      router.replace('/superadmin/login');
    }
  }

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <div className="sa-shell">
      {/* Barra superior (solo mobile) */}
      <div className="sa-topbar">
        <button
          className="sa-hamburger"
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
        >
          <Menu size={20} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BrandMark />
          <span style={{ fontWeight: 800, fontSize: 15 }}>Formula Taller</span>
        </div>
      </div>

      {/* Fondo oscuro al abrir el drawer en mobile */}
      {open && <div className="sa-overlay" onClick={() => setOpen(false)} />}

      {/* Menú lateral */}
      <aside className={`sa-sidebar${open ? ' open' : ''}`}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 18,
            paddingLeft: 4,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <BrandMark />
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, lineHeight: 1.1 }}>Formula Taller</div>
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>
                Plataforma
              </div>
            </div>
          </div>
          {/* Cerrar (solo visible en mobile porque el sidebar se superpone) */}
          <button
            onClick={() => setOpen(false)}
            aria-label="Cerrar menú"
            style={{
              display: 'inline-flex',
              background: 'none',
              border: 'none',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
            }}
            className="sa-close"
          >
            <X size={18} />
          </button>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`sa-navitem${isActive(item.href, item.exact) ? ' active' : ''}`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: 16 }}>
          <div
            style={{
              fontSize: 11,
              color: 'var(--color-text-muted)',
              padding: '0 12px 10px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {adminEmail ?? 'Superadministrador'}
          </div>
          <button
            onClick={handleLogout}
            className="sa-navitem"
            style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer' }}
          >
            <LogOut size={18} />
            Salir
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <main className="sa-main">{children}</main>
    </div>
  );
}

function BrandMark() {
  return (
    <div
      style={{
        width: 30,
        height: 30,
        borderRadius: 9,
        background: 'linear-gradient(135deg, var(--color-brand-500), var(--color-brand-700))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Wrench size={17} color="#0D0F1A" strokeWidth={2.5} />
    </div>
  );
}
