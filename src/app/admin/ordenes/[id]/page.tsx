import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCaller } from '@/lib/api-auth';
import { signStageAttachments } from '@/lib/storage';
import { notFound } from 'next/navigation';
import type { Order, Profile, OrderStage, BudgetItem } from '@/lib/types';
import OrderDetailClient from './OrderDetailClient';

// Datos siempre frescos (incluye los mecánicos disponibles para asignar).
export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string };
  searchParams: { edit?: string };
}

export default async function AdminOrderDetailPage({ params, searchParams }: Props) {
  const supabase = await createClient();
  const service = createServiceClient();
  const caller = await getCaller();
  const wid = caller?.workshopId ?? '';

  // Todo a la vez. El presupuesto se lee con la clave de servicio, filtrado por
  // la orden; solo se usa si la orden (leída con la sesión) existe.
  const [orderResult, mechanicsResult, budgetResult] = await Promise.all([
    supabase
      .from('orders')
      .select(`
        *,
        assigned_mechanic:profiles!assigned_mechanic_id(id, full_name, phone),
        mechanics:profiles!order_mechanics(id, full_name, phone),
        stages:order_stages(*, attachments:stage_attachments(*)),
        workshop:workshops(name)
      `)
      .eq('id', params.id)
      .eq('workshop_id', wid)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('*')
      // El dueño también atiende carros: entra como 'admin' pero se le pueden
      // asignar órdenes igual que a un mecánico (no necesita una segunda cuenta).
      .in('role', ['mechanic', 'admin'])
      .eq('active', true)
      .eq('workshop_id', wid)
      .order('full_name'),
    service.from('order_budget_items').select('*').eq('order_id', params.id).order('position'),
  ]);

  const orderData = orderResult.data;
  if (!orderData) notFound();

  const order = orderData as unknown as Order;
  const mechanics = (mechanicsResult.data ?? []) as unknown as Profile[];

  // Fotos del bucket privado: firmar sus URLs (con el service client) antes de
  // pasarlas al componente. La página se lee con el cliente autenticado, pero
  // firmar es una operación de storage que exige service_role.
  await signStageAttachments(
    service,
    (order as unknown as { stages?: OrderStage[] }).stages
  );

  return (
    <OrderDetailClient
      order={order}
      mechanics={mechanics}
      startInEdit={searchParams.edit === '1'}
      budgetItems={(budgetResult.data ?? []) as unknown as BudgetItem[]}
    />
  );
}
