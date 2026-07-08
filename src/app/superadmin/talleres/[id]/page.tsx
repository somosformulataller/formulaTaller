import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import { getPlatformAdmin } from '@/lib/api-auth';
import Badge from '@/components/ui/Badge';
import { formatDate } from '@/lib/utils';
import type { OrderStatus } from '@/lib/types';
import { ArrowLeft, Car, Mail, Phone, User, ChevronRight, ClipboardList, Users } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Props {
  params: { id: string };
}

type WorkshopRow = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  owner_id: string | null;
  order_limit: number | null;
  is_subscribed: boolean;
  whatsapp: string | null;
};

type OrderRow = {
  id: string;
  client_first_name: string;
  client_last_name: string;
  car_model: string;
  status: OrderStatus;
  created_at: string;
  assigned_mechanic_id: string | null;
  created_by: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string;
  role: string;
  phone: string | null;
  active: boolean;
};

export default async function SuperadminWorkshopPage({ params }: Props) {
  const admin = await getPlatformAdmin();
  if (!admin) redirect('/superadmin/login');

  const service = createServiceClient();

  const { data: wsData } = await service
    .from('workshops')
    .select('id, name, slug, created_at, owner_id, order_limit, is_subscribed, whatsapp')
    .eq('id', params.id)
    .maybeSingle();
  const workshop = wsData as unknown as WorkshopRow | null;
  if (!workshop) notFound();

  const [ordersRes, profilesRes] = await Promise.all([
    service
      .from('orders')
      .select('id, client_first_name, client_last_name, car_model, status, created_at, assigned_mechanic_id, created_by')
      .eq('workshop_id', params.id)
      .order('created_at', { ascending: false }),
    service
      .from('profiles')
      .select('id, full_name, role, phone, active')
      .eq('workshop_id', params.id)
      .order('role', { ascending: true }),
  ]);

  const orders = (ordersRes.data ?? []) as unknown as OrderRow[];
  const profiles = (profilesRes.data ?? []) as unknown as ProfileRow[];

  // Correos (viven en auth.users).
  const emailById = new Map<string, string | null>();
  const { data: usersData } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const u of usersData?.users ?? []) emailById.set(u.id, u.email ?? null);

  const nameById = new Map(profiles.map((p) => [p.id, p.full_name]));

  // Conteos por persona.
  const assignedCount = new Map<string, number>();
  const createdCount = new Map<string, number>();
  for (const o of orders) {
    if (o.assigned_mechanic_id) assignedCount.set(o.assigned_mechanic_id, (assignedCount.get(o.assigned_mechanic_id) ?? 0) + 1);
    if (o.created_by) createdCount.set(o.created_by, (createdCount.get(o.created_by) ?? 0) + 1);
  }

  const mechanics = profiles.filter((p) => p.role === 'mechanic');
  const admins = profiles.filter((p) => p.role === 'admin');
  const globalLimitLabel = workshop.is_subscribed
    ? 'Ilimitado (suscrito)'
    : `${orders.length} / ${workshop.order_limit ?? '(límite global)'}`;

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 16px 48px' }}>
      <Link
        href="/superadmin"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 16 }}
      >
        <ArrowLeft size={16} />
        Volver al panel
      </Link>

      {/* Encabezado del taller */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800 }}>{workshop.name}</h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: 2 }}>
              /{workshop.slug} · alta {formatDate(workshop.created_at)}
            </p>
          </div>
          {workshop.is_subscribed && (
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-brand-400)', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 999, padding: '3px 10px' }}>
              PRO
            </span>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
          <Row icon={<User size={14} />} label="Dueño" value={workshop.owner_id ? nameById.get(workshop.owner_id) ?? '—' : '—'} />
          <Row icon={<Mail size={14} />} label="Correo" value={workshop.owner_id ? emailById.get(workshop.owner_id) ?? '—' : '—'} />
          <Row icon={<Phone size={14} />} label="Teléfono" value={workshop.whatsapp ?? '—'} />
          <Row icon={<ClipboardList size={14} />} label="Órdenes" value={globalLimitLabel} />
        </div>
      </div>

      {/* Mecánicos */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Users size={16} /> Mecánicos ({mechanics.length})
      </h2>
      {admins.length > 0 && (
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>
          Administrador(es): {admins.map((a) => a.full_name).join(', ')}
        </p>
      )}
      {mechanics.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>Este taller no tiene mecánicos.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {mechanics.map((m) => (
            <div key={m.id} className="card" style={{ padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{m.full_name}</span>
                {!m.active && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', borderRadius: 999, padding: '2px 8px' }}>
                    Inactivo
                  </span>
                )}
              </div>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
                {emailById.get(m.id) ?? 'sin correo'}
                {m.phone ? ` · ${m.phone}` : ''}
              </p>
              <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                {assignedCount.get(m.id) ?? 0} asignadas · {createdCount.get(m.id) ?? 0} creadas
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Órdenes */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <ClipboardList size={16} /> Órdenes ({orders.length})
      </h2>
      {orders.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Este taller no tiene órdenes.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {orders.map((o) => (
            <Link
              key={o.id}
              href={`/superadmin/talleres/${params.id}/ordenes/${o.id}`}
              className="card"
              style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, textDecoration: 'none', color: 'inherit' }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {o.client_first_name} {o.client_last_name}
                  </span>
                  <Badge status={o.status} />
                </div>
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Car size={12} /> {o.car_model}
                  {o.assigned_mechanic_id ? ` · ${nameById.get(o.assigned_mechanic_id) ?? 'mecánico'}` : ' · sin asignar'}
                  {' · '}{formatDate(o.created_at)}
                </p>
              </div>
              <ChevronRight size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 12, color: 'var(--color-text-muted)', minWidth: 70 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
}
