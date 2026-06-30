'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Order, Profile, OrderStatus } from '@/lib/types';
import OrderCard from '@/components/orders/OrderCard';
import Badge from '@/components/ui/Badge';
import { ClipboardList, Wrench } from 'lucide-react';

interface MecanicoOrdenesClientProps {
  initialOrders: Order[];
  profile: Profile;
}

export default function MecanicoOrdenesClient({
  initialOrders,
  profile,
}: MecanicoOrdenesClientProps) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);

  function handleStatusChange(id: string, status: OrderStatus) {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
  }

  const enProgreso = orders.filter((o) => o.status === 'con_mecanico');
  const listas = orders.filter((o) => o.status === 'lista');

  return (
    <div className="animate-fade-in" style={{ paddingTop: 16 }}>
      {/* Welcome */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>
          Hola, {profile.full_name.split(' ')[0]} 👋
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginTop: 4 }}>
          {orders.length === 0
            ? 'No tienes órdenes asignadas'
            : `Tienes ${orders.length} orden${orders.length > 1 ? 'es' : ''} asignada${orders.length > 1 ? 's' : ''}`}
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="empty-state">
          <Wrench size={48} />
          <p>No hay órdenes asignadas a ti</p>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            El administrador te asignará órdenes pronto
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* In progress */}
          {enProgreso.length > 0 && (
            <section>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#fbbf24',
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Wrench size={12} />
                En progreso ({enProgreso.length})
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {enProgreso.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    mechanics={[]}
                    role="mechanic"
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Ready */}
          {listas.length > 0 && (
            <section style={{ marginTop: 8 }}>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#34d399',
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <ClipboardList size={12} />
                Listas para entregar ({listas.length})
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {listas.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    mechanics={[]}
                    role="mechanic"
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
