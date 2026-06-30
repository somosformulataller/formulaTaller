'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Order, Profile, OrderStatus } from '@/lib/types';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { formatDate, buildWhatsAppLink, buildTrackingMessage } from '@/lib/utils';
import { Car, User, Phone, MessageCircle, Edit2, Trash2, ChevronRight } from 'lucide-react';

interface OrderCardProps {
  order: Order;
  mechanics: Profile[];
  role: 'admin' | 'mechanic';
  onDelete?: (id: string) => void;
  onStatusChange?: (id: string, status: OrderStatus) => void;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export default function OrderCard({
  order,
  mechanics,
  role,
  onDelete,
  onStatusChange,
}: OrderCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const clientName = `${order.client_first_name} ${order.client_last_name}`;
  const trackingUrl = `${SITE_URL}/tracking/${order.public_token}`;
  const waLink = buildWhatsAppLink(
    order.client_whatsapp,
    buildTrackingMessage(order.client_first_name, order.public_token, SITE_URL)
  );

  async function handleDelete() {
    if (!confirm(`¿Eliminar la orden de ${clientName}?`)) return;
    setLoading(true);
    const res = await fetch(`/api/orders/${order.id}`, { method: 'DELETE' });
    setLoading(false);
    if (res.ok) onDelete?.(order.id);
  }

  async function handleStatusChange(newStatus: OrderStatus) {
    setLoading(true);
    const res = await fetch(`/api/orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    setLoading(false);
    if (res.ok) onStatusChange?.(order.id, newStatus);
  }

  const nextStatuses: Record<OrderStatus, { value: OrderStatus; label: string }[]> = {
    sin_mecanico: [{ value: 'con_mecanico', label: 'Asignar mecánico' }],
    con_mecanico: [{ value: 'lista', label: 'Marcar como lista' }],
    lista: [],
  };

  return (
    <article
      className="card animate-fade-in"
      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: 16 }}>{clientName}</p>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 12, marginTop: 2 }}>
            {formatDate(order.created_at)}
          </p>
        </div>
        <Badge status={order.status} />
      </div>

      <div style={{ height: 1, background: 'var(--color-border)' }} />

      {/* Details */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <InfoRow icon={<Car size={14} />} text={order.car_model} />
        <InfoRow icon={<Phone size={14} />} text={order.client_whatsapp} />
        {order.assigned_mechanic && (
          <InfoRow
            icon={<User size={14} />}
            text={order.assigned_mechanic.full_name}
            color="var(--color-brand-400)"
          />
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {/* WhatsApp share */}
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            background: 'rgba(37,211,102,0.12)',
            color: '#25D366',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            border: '1px solid rgba(37,211,102,0.2)',
            textDecoration: 'none',
          }}
        >
          <MessageCircle size={14} />
          Compartir
        </a>

        {/* Detail / Stages */}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            const base = role === 'admin' ? '/admin' : '/mecanico';
            router.push(`${base}/ordenes/${order.id}`);
          }}
        >
          <ChevronRight size={14} />
          Ver orden
        </Button>

        {/* Status transition (admin) */}
        {role === 'admin' && nextStatuses[order.status].map((s) => (
          <Button
            key={s.value}
            variant="secondary"
            size="sm"
            loading={loading}
            onClick={() => handleStatusChange(s.value)}
          >
            {s.label}
          </Button>
        ))}

        {/* Admin actions */}
        {role === 'admin' && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/admin/ordenes/${order.id}?edit=1`)}
            >
              <Edit2 size={13} />
            </Button>
            <Button variant="danger" size="sm" loading={loading} onClick={handleDelete}>
              <Trash2 size={13} />
            </Button>
          </>
        )}
      </div>
    </article>
  );
}

function InfoRow({
  icon,
  text,
  color,
}: {
  icon: React.ReactNode;
  text: string;
  color?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        color: color || 'var(--color-text-secondary)',
        fontSize: 13,
      }}
    >
      {icon}
      <span>{text}</span>
    </div>
  );
}
