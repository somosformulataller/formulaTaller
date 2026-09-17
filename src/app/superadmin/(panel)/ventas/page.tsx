import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { getPlatformAdmin } from '@/lib/api-auth';
import LoadError from '@/components/ui/LoadError';
import type { CrmTag, SalesClientRow } from '@/lib/types';
import VentasClient from './VentasClient';

export const dynamic = 'force-dynamic';

type WorkshopRow = {
  id: string;
  name: string;
  created_at: string;
  owner_id: string | null;
  whatsapp: string | null;
  is_subscribed: boolean;
  is_test: boolean;
  tutorial_sent_at: string | null;
};

export default async function VentasPage() {
  const admin = await getPlatformAdmin();
  if (!admin) redirect('/superadmin/login');

  const service = createServiceClient();

  const [workshopsRes, countsRes, tagsRes, settingsRes] = await Promise.all([
    service
      .from('workshops')
      .select('id, name, created_at, owner_id, whatsapp, is_subscribed, is_test, tutorial_sent_at')
      .order('created_at', { ascending: false }),
    service.rpc('admin_order_counts_by_workshop'),
    service
      .from('crm_tags')
      .select('id, label, color, sort, created_at')
      .order('sort', { ascending: true })
      .order('created_at', { ascending: true }),
    service
      .from('platform_settings')
      .select('tutorial_video_url, tutorial_message')
      .eq('id', 1)
      .single(),
  ]);

  if (workshopsRes.error) {
    return (
      <LoadError
        message="No se pudieron cargar los clientes. Reintenta en un momento."
        detail={workshopsRes.error.message}
      />
    );
  }

  const workshops = (workshopsRes.data ?? []) as unknown as WorkshopRow[];
  const tags = (tagsRes.data ?? []) as unknown as CrmTag[];

  // Conteo de órdenes por taller (ya agrupado en Postgres, no lo topa el
  // límite de 1000 filas de PostgREST).
  const countRows = (countsRes.data ?? []) as unknown as {
    workshop_id: string;
    order_count: number;
  }[];
  const countByWorkshop = new Map<string, number>();
  for (const c of countRows) countByWorkshop.set(c.workshop_id, Number(c.order_count));

  // Asignaciones etiqueta<->taller. Se pagina para no perder filas si algún día
  // superan las 1000 (el tope silencioso de PostgREST).
  const tagsByWorkshop = new Map<string, string[]>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await service
      .from('workshop_tags')
      .select('workshop_id, tag_id')
      .range(from, from + 999);
    if (error) break;
    const batch = (data ?? []) as unknown as { workshop_id: string; tag_id: string }[];
    for (const a of batch) {
      const list = tagsByWorkshop.get(a.workshop_id) ?? [];
      list.push(a.tag_id);
      tagsByWorkshop.set(a.workshop_id, list);
    }
    if (batch.length < 1000) break;
  }

  // Nombre del dueño (profiles) — email no se usa aquí, pero el teléfono del
  // registro (whatsapp) vive en workshops.
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

  const settings = settingsRes.data as unknown as
    | { tutorial_video_url: string | null; tutorial_message: string | null }
    | null;

  const rows: SalesClientRow[] = workshops.map((w) => ({
    id: w.id,
    name: w.name,
    owner_name: w.owner_id ? ownerNameById.get(w.owner_id) ?? null : null,
    whatsapp: w.whatsapp,
    created_at: w.created_at,
    order_count: countByWorkshop.get(w.id) ?? 0,
    is_subscribed: w.is_subscribed,
    is_test: w.is_test,
    tutorial_sent_at: w.tutorial_sent_at,
    tag_ids: tagsByWorkshop.get(w.id) ?? [],
  }));

  return (
    <VentasClient
      initialRows={rows}
      initialTags={tags}
      videoUrl={settings?.tutorial_video_url ?? null}
      message={settings?.tutorial_message ?? ''}
    />
  );
}
