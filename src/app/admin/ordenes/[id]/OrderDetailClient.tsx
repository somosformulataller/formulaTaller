'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Order, Profile, OrderStatus } from '@/lib/types';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import OrderForm from '@/components/orders/OrderForm';
import StageTimeline from '@/components/orders/StageTimeline';
import CopyLinkButton from '@/components/orders/CopyLinkButton';
import {
  formatDate,
  buildWhatsAppLink,
  openWhatsApp,
  buildTrackingMessage,
} from '@/lib/utils';
import {
  ArrowLeft,
  MessageCircle,
  Edit2,
  Trash2,
  Car,
  User,
  Phone,
  Calendar,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';

interface OrderDetailClientProps {
  order: Order;
  mechanics: Profile[];
  startInEdit: boolean;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'sin_mecanico', label: 'Sin mecánico asignado' },
  { value: 'con_mecanico', label: 'En progreso' },
  { value: 'lista', label: 'Vehículo listo' },
];

export default function OrderDetailClient({
  order: initialOrder,
  mechanics,
  startInEdit,
}: OrderDetailClientProps) {
  const router = useRouter();
  const [order, setOrder] = useState<Order>(initialOrder);
  const [showEdit, setShowEdit] = useState(startInEdit);
  const [changingStatus, setChangingStatus] = useState(false);

  const clientName = `${order.client_first_name} ${order.client_last_name}`;
  const trackingUrl = `${SITE_URL}/tracking/${order.public_token}`;
  const waLink = buildWhatsAppLink(
    order.client_whatsapp,
    buildTrackingMessage(order.client_first_name, order.public_token, SITE_URL, order.workshop?.name)
  );

  async function handleDelete() {
    if (!confirm(`¿Eliminar la orden de ${clientName}?`)) return;
    const res = await fetch(`/api/orders/${order.id}`, { method: 'DELETE' });
    if (res.ok) router.push('/admin/ordenes');
  }

  async function handleStatusChange(newStatus: OrderStatus) {
    setChangingStatus(true);
    const res = await fetch(`/api/orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    setChangingStatus(false);
    if (res.ok) {
      const updated = await res.json();
      setOrder(updated);
    }
  }

  function handleEdited(updated: Order) {
    setOrder(updated);
    setShowEdit(false);
  }

  const stages = order.stages ?? [];

  return (
    <div className="animate-fade-in" style={{ paddingTop: 16 }}>
      {/* Back */}
      <button
        onClick={() => router.back()}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: 'var(--color-text-secondary)',
          fontSize: 14,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          marginBottom: 16,
          padding: 0,
        }}
      >
        <ArrowLeft size={16} />
        Volver
      </button>

      {/* Order header */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 14,
          }}
        >
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800 }}>{clientName}</h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: 2 }}>
              Orden #{order.id.slice(0, 8).toUpperCase()}
            </p>
          </div>
          <Badge status={order.status} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <InfoRow icon={<Car size={14} />} label="Vehículo" value={order.car_model} />
          <InfoRow icon={<Phone size={14} />} label="WhatsApp" value={order.client_whatsapp} />
          <InfoRow
            icon={<User size={14} />}
            label="Mecánico"
            value={order.assigned_mechanic?.full_name ?? 'Sin asignar'}
          />
          <InfoRow
            icon={<Calendar size={14} />}
            label="Creado"
            value={formatDate(order.created_at)}
          />
        </div>

        {order.notes && (
          <>
            <div style={{ height: 1, background: 'var(--color-border)', margin: '12px 0' }} />
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{order.notes}</p>
          </>
        )}

        <div
          style={{
            height: 1,
            background: 'var(--color-border)',
            margin: '14px 0',
          }}
        />

        {/* Change status */}
        <div className="form-field" style={{ marginBottom: 12 }}>
          <label className="form-label">Cambiar estado</label>
          <div style={{ position: 'relative' }}>
            <select
              className="form-input"
              value={order.status}
              onChange={(e) => handleStatusChange(e.target.value as OrderStatus)}
              disabled={changingStatus}
              style={{ paddingRight: 36 }}
              id="order-status-select"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={15}
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-muted)',
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.preventDefault();
              openWhatsApp(
                order.client_whatsapp,
                buildTrackingMessage(order.client_first_name, order.public_token, SITE_URL, order.workshop?.name)
              );
            }}
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
            Enviar tracking
          </a>

          <a
            href={trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              background: 'var(--color-surface-2)',
              color: 'var(--color-text-secondary)',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              border: '1px solid var(--color-border)',
              textDecoration: 'none',
            }}
          >
            <ExternalLink size={14} />
            Ver tracking
          </a>

          <CopyLinkButton url={trackingUrl} />

          <Button variant="secondary" size="sm" onClick={() => setShowEdit(true)}>
            <Edit2 size={13} />
            Editar
          </Button>

          <Button variant="danger" size="sm" onClick={handleDelete}>
            <Trash2 size={13} />
            Eliminar
          </Button>
        </div>
      </div>

      {/* Stages */}
      <div style={{ marginBottom: 8 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
          Etapas de servicio
        </h2>
        <StageTimeline
          orderId={order.id}
          initialStages={stages}
          canEdit={true}
        />
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        title="Editar orden"
      >
        <OrderForm
          mechanics={mechanics}
          order={order}
          onSuccess={handleEdited}
          onCancel={() => setShowEdit(false)}
        />
      </Modal>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 12, color: 'var(--color-text-muted)', minWidth: 70 }}>
        {label}
      </span>
      <span style={{ fontSize: 14, fontWeight: 500 }}>{value}</span>
    </div>
  );
}
