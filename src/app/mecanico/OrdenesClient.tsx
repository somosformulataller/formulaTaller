'use client';

import { useState } from 'react';
import type { Order, Profile, OrderStatus } from '@/lib/types';
import OrderCard from '@/components/orders/OrderCard';
import OrderForm from '@/components/orders/OrderForm';
import SubscriptionModal from '@/components/orders/SubscriptionModal';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Plus, ClipboardList, Search } from 'lucide-react';

interface MecanicoOrdenesClientProps {
  initialOrders: Order[];
  mechanics: Profile[];
  profile: Profile;
  orderLimit: number;
  isSubscribed: boolean;
  supportPhones: string[];
}

type FilterKey = 'mine' | 'all' | OrderStatus;

export default function MecanicoOrdenesClient({
  initialOrders,
  mechanics,
  profile,
  orderLimit,
  isSubscribed,
  supportPhones,
}: MecanicoOrdenesClientProps) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [showCreate, setShowCreate] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('mine');
  const [search, setSearch] = useState('');

  function handleNew() {
    if (!isSubscribed && orders.length >= orderLimit) {
      setShowPaywall(true);
    } else {
      setShowCreate(true);
    }
  }

  const mineCount = orders.filter((o) => o.assigned_mechanic_id === profile.id).length;

  const filtered = orders.filter((o) => {
    const matchScope =
      filter === 'mine'
        ? o.assigned_mechanic_id === profile.id
        : filter === 'all'
        ? true
        : o.status === filter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      `${o.client_first_name} ${o.client_last_name}`.toLowerCase().includes(q) ||
      o.car_model.toLowerCase().includes(q) ||
      o.client_whatsapp.includes(q);
    return matchScope && matchSearch;
  });

  function handleCreated(order: Order) {
    setOrders((prev) => [order, ...prev]);
    setShowCreate(false);
  }

  function handleStatusChange(id: string, status: OrderStatus) {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
  }

  function handleDelete(id: string) {
    setOrders((prev) => prev.filter((o) => o.id !== id));
  }

  function handleUpdate(updated: Order) {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  }

  const FILTERS: { value: FilterKey; label: string }[] = [
    { value: 'mine', label: `Mis órdenes (${mineCount})` },
    { value: 'all', label: `Todas (${orders.length})` },
    { value: 'sin_mecanico', label: 'Sin asignar' },
    { value: 'con_mecanico', label: 'En progreso' },
    { value: 'lista', label: 'Listas' },
  ];

  return (
    <div className="animate-fade-in" style={{ paddingTop: 16 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 4,
        }}
      >
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>
            Hola, {profile.full_name.split(' ')[0]} 👋
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, marginTop: 2 }}>
            {mineCount === 0
              ? 'No tienes órdenes asignadas'
              : `Tienes ${mineCount} orden${mineCount > 1 ? 'es' : ''} asignada${mineCount > 1 ? 's' : ''}`}
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={handleNew}>
          <Plus size={15} />
          Nueva
        </Button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', margin: '16px 0 12px' }}>
        <Search
          size={15}
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--color-text-muted)',
          }}
        />
        <input
          className="form-input"
          placeholder="Buscar por nombre, vehículo o teléfono..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ paddingLeft: 36 }}
          id="orders-search"
        />
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
                filter === f.value ? 'var(--color-brand-500)' : 'var(--color-surface-2)',
              color: filter === f.value ? '#0D0F1A' : 'var(--color-text-secondary)',
              borderColor:
                filter === f.value ? 'var(--color-brand-500)' : 'var(--color-border)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <ClipboardList size={48} />
          <p>
            {search
              ? 'No hay resultados para tu búsqueda'
              : filter === 'mine'
              ? 'No tienes órdenes asignadas'
              : 'No hay órdenes con este filtro'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              mechanics={mechanics}
              role="mechanic"
              currentUserId={profile.id}
              onStatusChange={handleStatusChange}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Nueva orden">
        <OrderForm
          mechanics={mechanics}
          onSuccess={handleCreated}
          onCancel={() => setShowCreate(false)}
        />
      </Modal>

      {showPaywall && (
        <SubscriptionModal onClose={() => setShowPaywall(false)} phones={supportPhones} />
      )}
    </div>
  );
}
