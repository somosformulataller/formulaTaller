import { createServiceClient } from '@/lib/supabase/server';
import { signStageAttachments } from '@/lib/storage';
import { notFound } from 'next/navigation';
import type { Order, OrderStage, BudgetItem } from '@/lib/types';
import { MECHANICS_EMBED } from '@/lib/mecanicos-orden';
import { nombresAsignados } from '@/lib/asignacion';
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
      show_workshop_as_mechanic,
      ${MECHANICS_EMBED},
      workshop:workshops(name, logo_url),
      stages:order_stages(id, name, description, position, status, completed_at, attachments:stage_attachments(id, path, url, name, mime, created_at)),
      budget:order_budget_items(id, order_id, description, amount, position, created_by, created_at, updated_at)
    `)
    .eq('public_token', params.token)
    .maybeSingle();

  const rawData = result.data;
  if (!rawData) notFound();

  const rawOrder = rawData as unknown as Order & {
    stages: OrderStage[];
    budget: BudgetItem[];
  };

  // El presupuesto llega sin orden garantizado desde PostgREST: se ordena por
  // position para que el cliente lo vea como lo armó el taller.
  const budget = (rawOrder.budget ?? [])
    .slice()
    .sort((a, b) => a.position - b.position);

  // Sort stages by position
  const sortedStages = (rawOrder.stages ?? []).sort(
    (a: OrderStage, b: OrderStage) => a.position - b.position
  );

  // Fotos del bucket privado: firmar sus URLs antes de mandarlas al cliente.
  await signStageAttachments(service, sortedStages);

  // Los nombres que verá el cliente se deciden AQUÍ, en el servidor. Si el
  // taller eligió dar la cara como taller y no como personas, los nombres de
  // esas personas ni siquiera salen de aquí: no basta con no pintarlos, iban
  // igual dentro del HTML y cualquiera que mirara el código fuente los leía.
  // Si se ocultan, se ocultan de verdad.
  const mecanicos = nombresAsignados(rawOrder, rawOrder.workshop?.name ?? 'Taller');

  // Y por lo mismo, la orden que baja al navegador va sin la lista de perfiles.
  const { mechanics: _perfiles, ...orderSinPerfiles } = rawOrder;
  void _perfiles;

  return (
    <TrackingClient
      order={{ ...orderSinPerfiles, stages: sortedStages, assigned_mechanic: null } as Order & { stages: OrderStage[] }}
      budget={budget}
      mecanicos={mecanicos}
    />
  );
}
