'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Order, OrderStatus } from '@/lib/types';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import StageTimeline from '@/components/orders/StageTimeline';
import { formatDate, buildWhatsAppLink, buildTrackingMessage } from '@/lib/utils';
import {
  ArrowLeft,
  Car,
  User,
  Phone,
  Calendar,
  MessageCircle,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';

interface MecanicoOrderDetailClientProps {
  order: Order;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export default function MecanicoOrderDetailClient({
  order: initialOrder,
}: MecanicoOrderDetailClientProps) {
  const router = useRouter();
  const [order, setOrder] = useState<Order>(initialOrder);
  const [markingReady, setMarkingReady] = useState(false);

  const clientName = `${order.client_first_name} ${order.client_last_name}`;
  const trackingUrl = `${SITE_URL}/tracking/${order.public_token}`;
  const waLink = buildWhatsAppLink(
    order.client_whatsapp,
    buildTrackingMessage(order.client_first_name, order.public_token, SITE_URL)
  );

  async function markAsReady() {
    setMarkingReady(true);
    const res = await fetch(`/api/orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'lista' as OrderStatus }),
    });
    setMarkingReady(false);
    if (res.ok) {
      const updated = await res.json();
      setOrder(updated);
    }
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
        Mis órdenes
      </button>

      {/* Order card */}
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
              #{order.id.slice(0, 8).toUpperCase()}
            </p>
          </div>
          <Badge status={order.status} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          <InfoRow icon={<Car size={14} />} label="Vehículo" value={order.car_model} />
          <InfoRow icon={<Phone size={14} />} label="WhatsApp" value={order.client_whatsapp} />
          <InfoRow icon={<Calendar size={14} />} label="Creado" value={formatDate(order.created_at)} />
        </div>

        {order.notes && (
          <>
            <div style={{ height: 1, background: 'var(--color-border)', marginBottom: 12 }} />
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 14 }}>
              {order.notes}
            </p>
          </>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
            WhatsApp
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

          {order.status !== 'lista' && (
            <Button
              variant="primary"
              size="sm"
              loading={markingReady}
              onClick={markAsReady}
            >
              <CheckCircle2 size={14} />
              Marcar como lista
            </Button>
          )}
        </div>
      </div>

      {/* Stages */}
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
          Etapas del servicio
        </h2>
        <StageTimeline
          orderId={order.id}
          initialStages={stages}
          canEdit={order.status !== 'lista'}
        />
      </div>
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
