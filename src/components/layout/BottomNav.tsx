'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ClipboardList, Users, LayoutDashboard, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const ADMIN_NAV: NavItem[] = [
  {
    href: '/admin',
    label: 'Inicio',
    icon: <LayoutDashboard size={22} />,
  },
  {
    href: '/admin/ordenes',
    label: 'Órdenes',
    icon: <ClipboardList size={22} />,
  },
  {
    href: '/admin/mecanicos',
    label: 'Mecánicos',
    icon: <Users size={22} />,
  },
];

const MECHANIC_NAV: NavItem[] = [
  {
    href: '/mecanico',
    label: 'Mis Órdenes',
    icon: <ClipboardList size={22} />,
  },
];

interface BottomNavProps {
  role: 'admin' | 'mechanic';
}

export default function BottomNav({ role }: BottomNavProps) {
  const pathname = usePathname();
  const items = role === 'admin' ? ADMIN_NAV : MECHANIC_NAV;

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'var(--bottom-nav-height)',
        background: 'rgba(13,15,26,0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingBottom: 'env(safe-area-inset-bottom)',
        zIndex: 50,
      }}
    >
      {items.map((item) => {
        const isActive =
          item.href === '/admin' || item.href === '/mecanico'
            ? pathname === item.href
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '8px 20px',
              borderRadius: 12,
              color: isActive ? 'var(--color-brand-400)' : 'var(--color-text-muted)',
              transition: 'color 0.15s, transform 0.1s',
              transform: isActive ? 'scale(1.05)' : 'scale(1)',
              textDecoration: 'none',
              WebkitTapHighlightColor: 'transparent',
              minWidth: 64,
              justifyContent: 'center',
            }}
          >
            {item.icon}
            <span
              style={{
                fontSize: 10,
                fontWeight: isActive ? 700 : 500,
                letterSpacing: '0.03em',
              }}
            >
              {item.label}
            </span>
            {isActive && (
              <span
                style={{
                  position: 'absolute',
                  bottom: 6,
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: 'var(--color-brand-400)',
                  marginTop: 2,
                }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
