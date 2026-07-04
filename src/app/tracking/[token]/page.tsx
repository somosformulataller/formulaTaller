import { createServiceClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import type { Order, OrderStage } from '@/lib/types';
import TrackingClient from './TrackingClient';
import type { Metadata } from 'next';

// El seguimiento del cliente debe mostrar SIEMPRE el estado actual (etapas y
// adjuntos recién guardados).
// - force-dynamic: no cachear la PÁGINA (Full Route Cache).
// - force-no-store: no cachear las CONSULTAS a Supabase (Data Cache). Como el
//   tracking es público (sin cookies), sin esto Next.js servía datos viejos
//   (p. ej. faltaban los adjuntos de las etapas de servicio recién subidos).
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Props {
  params: { token: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const service = createServiceClient();
  const result = await service
    .from('orders')
    .select('client_first_name, client_last_name, car_model, workshop:workshops(name)')
    .eq('public_token', params.token)
    .maybeSingle();

  const data = result.data as unknown as
    | { client_first_name: string; client_last_name: string; car_model: string; workshop: { name: string } | null }
    | null;
  if (!data) return { title: 'Seguimiento de servicio' };

  const workshopName = data.workshop?.name ?? 'Taller';
  return {
    title: `Seguimiento de ${data.client_first_name} ${data.client_last_name} — ${workshopName}`,
    description: `Seguimiento de servicio para ${data.car_model}`,
  };
}

export default async function TrackingPage({ params }: Props) {
  const service = createServiceClient();

  const result = await service
    .from('orders')
    .select(`
      id,
      public_token,
      client_first_name,
      client_last_name,
      car_model,
      notes,
      status,
      created_at,
      updated_at,
      assigned_mechanic:profiles!assigned_mechanic_id(full_name),
      workshop:workshops(name, logo_url),
      stages:order_stages(id, name, description, position, status, completed_at, attachments:stage_attachments(id, url, name, mime, created_at))
    `)
    .eq('public_token', params.token)
    .maybeSingle();

  const rawData = result.data;
  if (!rawData) notFound();

  const rawOrder = rawData as unknown as Order & { stages: OrderStage[] };

  // Sort stages by position
  const sortedStages = (rawOrder.stages ?? []).sort(
    (a: OrderStage, b: OrderStage) => a.position - b.position
  );

  return <TrackingClient order={{ ...rawOrder, stages: sortedStages }} />;
}
