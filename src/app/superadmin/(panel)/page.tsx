import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { getPlatformAdmin, fetchAllAuthAccounts } from '@/lib/api-auth';
import type { WorkshopAdminRow } from '@/lib/types';
import LoadError from '@/components/ui/LoadError';
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
  logo_url: string | null;
};

export default async function SuperadminDashboardPage() {
  const admin = await getPlatformAdmin();
  if (!admin) redirect('/superadmin/login');

  const service = createServiceClient();

  const [workshopsRes, countsRes, settingsRes] = await Promise.all([
    service
      .from('workshops')
      .select('id, name, slug, created_at, owner_id, order_limit, is_subscribed, is_test, whatsapp, logo_url')
      .order('created_at', { ascending: false }),
    // Conteo por taller agregado en Postgres (GROUP BY): no lo topa el límite
    // de 1000 filas de PostgREST, a diferencia de traer todas las órdenes.
    // La RPC solo la puede ejecutar el service_role (ver 0015_order_counts_rpc.sql).
    service.rpc('admin_order_counts_by_workshop'),
    service
      .from('platform_settings')
      .select('free_order_limit, support_phones')
      .eq('id', 1)
      .single(),
  ]);

  // Si falla la consulta de talleres, NO seguir con una lista vacía (parecería
  // "0 talleres" cuando en realidad hubo un error). El conteo (RPC) y los ajustes
  // sí degradan: si faltan, el panel muestra 0 órdenes / límite por defecto.
  if (workshopsRes.error) {
    return (
      <LoadError
        message="No se pudieron cargar los talleres. Reintenta en un momento."
        detail={workshopsRes.error.message}
      />
    );
  }

  const settings = settingsRes.data as unknown as
    | { free_order_limit: number; support_phones: string[] | null }
    | null;
  const freeOrderLimit = settings?.free_order_limit ?? 3;
  const supportPhones = settings?.support_phones ?? [];

  const workshops = (workshopsRes.data ?? []) as unknown as WorkshopRow[];
  const countRows = (countsRes.data ?? []) as unknown as {
    workshop_id: string;
    order_count: number;
  }[];

  // Conteo de órdenes por taller (ya viene agrupado del servidor).
  const countByWorkshop = new Map<string, number>();
  for (const c of countRows) {
    countByWorkshop.set(c.workshop_id, Number(c.order_count));
  }

  // Nombre y teléfono del dueño de cada taller (join manual a profiles).
  const ownerIds = workshops.map((w) => w.owner_id).filter((id): id is string => !!id);
  const ownerById = new Map<string, { full_name: string; phone: string | null }>();
  if (ownerIds.length > 0) {
    const { data: owners } = await service
      .from('profiles')
      .select('id, full_name, phone')
      .in('id', ownerIds);
    for (const p of (owners ?? []) as unknown as {
      id: string;
      full_name: string;
      phone: string | null;
    }[]) {
      ownerById.set(p.id, { full_name: p.full_name, phone: p.phone });
    }
  }

  // Cuántos mecánicos tiene cada taller. Se trae por páginas: el tope de 1.000
  // filas de PostgREST se aplica solo y sin avisar, y un taller que se quedara
  // fuera aparecería con cero mecánicos como si fuera un dato real.
  const mecanicosPorTaller = new Map<string, number>();
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await service
      .from('profiles')
      .select('workshop_id')
      .eq('role', 'mechanic')
      .range(desde, desde + 999);
    if (error) break;
    const filas = (data ?? []) as unknown as { workshop_id: string | null }[];
    for (const f of filas) {
      if (f.workshop_id) mecanicosPorTaller.set(f.workshop_id, (mecanicosPorTaller.get(f.workshop_id) ?? 0) + 1);
    }
    if (filas.length < 1000) break;
  }

  // La cuenta de acceso del dueño (vive en auth.users; se lee con la admin API,
  // recorriendo todas las páginas para no perder dueños tras los primeros 1000).
  const cuentaById = await fetchAllAuthAccounts(service);

  const rows: WorkshopAdminRow[] = workshops.map((w) => ({
    id: w.id,
    name: w.name,
    slug: w.slug,
    created_at: w.created_at,
    is_subscribed: w.is_subscribed,
    is_test: w.is_test,
    order_limit: w.order_limit,
    owner_name: w.owner_id ? ownerById.get(w.owner_id)?.full_name ?? null : null,
    owner_email: w.owner_id ? cuentaById.get(w.owner_id)?.email ?? null : null,
    whatsapp: w.whatsapp,
    order_count: countByWorkshop.get(w.id) ?? 0,
    owner_phone: w.owner_id ? ownerById.get(w.owner_id)?.phone ?? null : null,
    owner_created_at: w.owner_id ? cuentaById.get(w.owner_id)?.created_at ?? null : null,
    owner_last_sign_in_at: w.owner_id ? cuentaById.get(w.owner_id)?.last_sign_in_at ?? null : null,
    owner_email_confirmed_at: w.owner_id
      ? cuentaById.get(w.owner_id)?.email_confirmed_at ?? null
      : null,
    mechanic_count: mecanicosPorTaller.get(w.id) ?? 0,
    has_logo: !!w.logo_url,
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
