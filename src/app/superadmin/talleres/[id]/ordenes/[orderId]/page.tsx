import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import { getPlatformAdmin } from '@/lib/api-auth';
import Badge from '@/components/ui/Badge';
import InitialAttachments from '@/components/orders/InitialAttachments';
import AttachmentGallery from '@/components/orders/AttachmentGallery';
import { formatDate } from '@/lib/utils';
import type { Order, OrderStage, StageStatus } from '@/lib/types';
import { ArrowLeft, Car, Phone, User, Calendar, ExternalLink, Clock } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

const STAGE_LABEL: Record<StageStatus, { text: string; color: string }> = {
  done: { text: 'Completada', color: '#34d399' },
  in_progress: { text: 'En progreso', color: '#fbbf24' },
  pending: { text: 'Pendiente', color: 'var(--color-text-muted)' },
};

interface Props {
  params: { id: string; orderId: string };
}

export default async function SuperadminOrderPage({ params }: Props) {
  const admin = await getPlatformAdmin();
  if (!admin) redirect('/superadmin/login');

  const service = createServiceClient();
  const { data } = await service
    .from('orders')
    .select(`
      *,
      assigned_mechanic:profiles!assigned_mechanic_id(full_name, phone),
      stages:order_stages(*, attachments:stage_attachments(*))
    `)
    .eq('id', params.orderId)
    .maybeSingle();

  const order = data as unknown as Order | null;
  if (!order || order.workshop_id !== params.id) notFound();

  const clientName = `${order.client_first_name} ${order.client_last_name}`;
  const trackingUrl = `${SITE_URL}/tracking/${order.public_token}`;
  const stages = (order.stages ?? []).slice().sort((a, b) => a.position - b.position);
  const serviceStages = stages.filter((s) => s.position > 0);
  const mechanic = order.assigned_mechanic as { full_name: string } | null | undefined;

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 16px 48px' }}>
      <Link
        href={`/superadmin/talleres/${params.id}`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 16 }}
      >
        <ArrowLeft size={16} />
        Volver al taller
      </Link>

      {/* Encabezado de la orden */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800 }}>{clientName}</h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: 2 }}>
              Orden #{order.id.slice(0, 8).toUpperCase()}
            </p>
          </div>
          <Badge status={order.status} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Row icon={<Car size={14} />} label="Vehículo" value={order.car_model} />
          <Row icon={<Phone size={14} />} label="WhatsApp" value={order.client_whatsapp} />
          <Row icon={<User size={14} />} label="Mecánico" value={mechanic?.full_name ?? 'Sin asignar'} />
          <Row icon={<Calendar size={14} />} label="Creado" value={formatDate(order.created_at)} />
        </div>

        {order.notes && (
          <>
            <div style={{ height: 1, background: 'var(--color-border)', margin: '12px 0' }} />
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap' }}>{order.notes}</p>
          </>
        )}

        <div style={{ marginTop: 14 }}>
          <a
            href={trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--color-surface-2)', color: 'var(--color-text-secondary)', borderRadius: 8, fontSize: 13, fontWeight: 600, border: '1px solid var(--color-border)', textDecoration: 'none' }}
          >
            <ExternalLink size={14} />
            Ver tracking del cliente
          </a>
        </div>
      </div>

      {/* Archivos de recepción (solo lectura) */}
      <InitialAttachments orderId={order.id} stages={stages} canEdit={false} />

      {/* Etapas del servicio (solo lectura) */}
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '8px 0 12px' }}>Etapas del servicio</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {serviceStages.map((stage: OrderStage) => {
          const st = STAGE_LABEL[stage.status];
          return (
            <div key={stage.id} className="card" style={{ padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{stage.name}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: st.color }}>{st.text}</span>
              </div>
              {stage.description && (
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 6, whiteSpace: 'pre-wrap' }}>
                  {stage.description}
                </p>
              )}
              {stage.completed_at && (
                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={10} /> {formatDate(stage.completed_at)}
                </p>
              )}
              {stage.attachments && stage.attachments.length > 0 && (
                <AttachmentGallery attachments={stage.attachments} tile={72} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 12, color: 'var(--color-text-muted)', minWidth: 70 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 500 }}>{value}</span>
    </div>
  );
}
