import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { getPlatformAdmin } from '@/lib/api-auth';
import type { WorkshopAdminRow } from '@/lib/types';
import SuperadminClient from './SuperadminClient';

// Datos siempre frescos.
export const dynamic = 'force-dynamic';

type WorkshopRow = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  owner_id: string | null;
  order_limit: number | null;
  is_subscribed: boolean;
  is_test: boolean;
  whatsapp: string | null;
};

export default async function SuperadminDashboardPage() {
  const admin = await getPlatformAdmin();
  if (!admin) redirect('/superadmin/login');

  const service = createServiceClient();

  const [workshopsRes, ordersRes, settingsRes] = await Promise.all([
    service
      .from('workshops')
      .select('id, name, slug, created_at, owner_id, order_limit, is_subscribed, is_test, whatsapp')
      .order('created_at', { ascending: false }),
    // Solo el workshop_id de cada orden: contamos por taller en memoria.
    service.from('orders').select('workshop_id'),
    service
      .from('platform_settings')
      .select('free_order_limit, support_phones')
      .eq('id', 1)
      .single(),
  ]);

  const settings = settingsRes.data as unknown as
    | { free_order_limit: number; support_phones: string[] | null }
    | null;
  const freeOrderLimit = settings?.free_order_limit ?? 3;
  const supportPhones = settings?.support_phones ?? [];

  const workshops = (workshopsRes.data ?? []) as unknown as WorkshopRow[];
  const orderRows = (ordersRes.data ?? []) as unknown as { workshop_id: string }[];

  // Conteo de órdenes por taller.
  const countByWorkshop = new Map<string, number>();
  for (const o of orderRows) {
    countByWorkshop.set(o.workshop_id, (countByWorkshop.get(o.workshop_id) ?? 0) + 1);
  }

  // Nombre del dueño de cada taller (join manual a profiles).
  const ownerIds = workshops.map((w) => w.owner_id).filter((id): id is string => !!id);
  const ownerNameById = new Map<string, string>();
  if (ownerIds.length > 0) {
    const { data: owners } = await service
      .from('profiles')
      .select('id, full_name')
      .in('id', ownerIds);
    for (const p of (owners ?? []) as unknown as { id: string; full_name: string }[]) {
      ownerNameById.set(p.id, p.full_name);
    }
  }

  // Correo de registro del dueño (vive en auth.users; se lee con la admin API).
  const emailById = new Map<string, string | null>();
  const { data: usersData } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const u of usersData?.users ?? []) {
    emailById.set(u.id, u.email ?? null);
  }

  const rows: WorkshopAdminRow[] = workshops.map((w) => ({
    id: w.id,
    name: w.name,
    slug: w.slug,
    created_at: w.created_at,
    is_subscribed: w.is_subscribed,
    is_test: w.is_test,
    order_limit: w.order_limit,
    owner_name: w.owner_id ? ownerNameById.get(w.owner_id) ?? null : null,
    owner_email: w.owner_id ? emailById.get(w.owner_id) ?? null : null,
    whatsapp: w.whatsapp,
    order_count: countByWorkshop.get(w.id) ?? 0,
  }));

  return (
    <SuperadminClient
      rows={rows}
      adminEmail={admin.email}
      freeOrderLimit={freeOrderLimit}
      supportPhones={supportPhones}
    />
  );
}
