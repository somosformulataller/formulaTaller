'use client';

import { useState } from 'react';
import type { Order, Profile, OrderStatus } from '@/lib/types';
import OrderCard from '@/components/orders/OrderCard';
import OrderForm from '@/components/orders/OrderForm';
import SubscriptionModal from '@/components/orders/SubscriptionModal';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Plus, ClipboardList, CheckCircle2, Wrench, Clock } from 'lucide-react';

interface AdminDashboardClientProps {
  initialOrders: Order[];
  mechanics: Profile[];
  orderLimit: number;
  isSubscribed: boolean;
}

type FilterStatus = 'all' | OrderStatus;

export default function AdminDashboardClient({
  initialOrders,
  mechanics,
  orderLimit,
  isSubscribed,
}: AdminDashboardClientProps) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [showCreate, setShowCreate] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>('all');

  function handleNew() {
    if (!isSubscribed && orders.length >= orderLimit) {
      setShowPaywall(true);
    } else {
      setShowCreate(true);
    }
  }

  const filtered =
    filter === 'all' ? orders : orders.filter((o) => o.status === filter);

  const stats = {
    total: orders.length,
    sin_mecanico: orders.filter((o) => o.status === 'sin_mecanico').length,
    con_mecanico: orders.filter((o) => o.status === 'con_mecanico').length,
    lista: orders.filter((o) => o.status === 'lista').length,
  };

  function handleCreated(order: Order) {
    setOrders((prev) => [order, ...prev]);
    setShowCreate(false);
  }

  function handleDelete(id: string) {
    setOrders((prev) => prev.filter((o) => o.id !== id));
  }

  function handleStatusChange(id: string, status: OrderStatus) {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status } : o))
    );
  }

  function handleUpdate(updated: Order) {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  }

  const FILTERS: { value: FilterStatus; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'sin_mecanico', label: 'Sin asignar' },
    { value: 'con_mecanico', label: 'En progreso' },
    { value: 'lista', label: 'Listas' },
  ];

  return (
    <div className="animate-fade-in" style={{ paddingTop: 16 }}>
      {/* Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 10,
          marginBottom: 20,
        }}
      >
        <StatCard
          icon={<ClipboardList size={18} />}
          label="Total"
          value={stats.total}
          color="var(--color-brand-400)"
        />
        <StatCard
          icon={<Clock size={18} />}
          label="Sin asignar"
          value={stats.sin_mecanico}
          color="var(--color-text-secondary)"
        />
        <StatCard
          icon={<Wrench size={18} />}
          label="En progreso"
          value={stats.con_mecanico}
          color="#fbbf24"
        />
        <StatCard
          icon={<CheckCircle2 size={18} />}
          label="Listas"
          value={stats.lista}
          color="#34d399"
        />
      </div>

      {/* Header + Create */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>Órdenes recientes</h2>
        <Button variant="primary" size="sm" onClick={handleNew}>
          <Plus size={15} />
          Nueva orden
        </Button>
      </div>

      {/* Filter tabs */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          marginBottom: 16,
          overflowX: 'auto',
          paddingBottom: 4,
        }}
      >
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            style={{
              padding: '6px 14px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              border: '1px solid',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s',
              background:
                filter === f.value
                  ? 'var(--color-brand-500)'
                  : 'var(--color-surface-2)',
              color:
                filter === f.value
                  ? '#0D0F1A'
                  : 'var(--color-text-secondary)',
              borderColor:
                filter === f.value
                  ? 'var(--color-brand-500)'
                  : 'var(--color-border)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Order list */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <ClipboardList size={48} />
          <p>No hay órdenes {filter !== 'all' ? 'con este filtro' : 'aún'}</p>
          {filter === 'all' && (
            <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={14} />
              Crear primera orden
            </Button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              mechanics={mechanics}
              role="admin"
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
              onUpdate={handleUpdate}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Nueva orden"
      >
        <OrderForm
          mechanics={mechanics}
          onSuccess={handleCreated}
          onCancel={() => setShowCreate(false)}
        />
      </Modal>

      {showPaywall && <SubscriptionModal onClose={() => setShowPaywall(false)} />}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      className="card"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: `${color}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <p style={{ fontSize: 22, fontWeight: 800, color }}>{value}</p>
        <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 1 }}>
          {label}
        </p>
      </div>
    </div>
  );
}
