'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Receipt } from 'lucide-react';
import type { UserRole } from '@/lib/types';

/**
 * Acceso a la pantalla Presupuestos (la lista de presupuestos del taller).
 * Estaba en el encabezado (TopBar); se sacó de ahí para dejar sitio y queda
 * guardado aquí, sin usar, hasta decidir dónde ubicarlo.
 */
export default function BotonPresupuestos({ role }: { role: UserRole | null }) {
  const pathname = usePathname();
  // Cada rol tiene su propia sección, protegida por su layout.
  const href = role === 'admin' ? '/admin/presupuestos' : '/mecanico/presupuestos';
  const activo = pathname.startsWith(href);

  return (
    <Link
      href={href}
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
      <span className="tb-label">Presupuestos</span>
    </Link>
  );
}
