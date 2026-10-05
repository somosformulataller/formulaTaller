import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCaller } from '@/lib/api-auth';
import { mecanicosDeLaOrden } from '@/lib/mecanicos-orden';
import { signStageAttachments } from '@/lib/storage';
import { notFound } from 'next/navigation';
import type { Order, Profile, OrderStage, BudgetItem } from '@/lib/types';
import MecanicoOrderDetailClient from './OrderDetailClient';

interface Props {
  params: { id: string };
}

export default async function MecanicoOrderDetailPage({ params }: Props) {
  const caller = await getCaller();
  if (!caller) return null;
  const supabase = await createClient();
  const service = createServiceClient();

  // Todo a la vez; los datos solo se usan si la orden es suya (abajo).
  const [mecanicos, orderRes, mechanicsRes, budgetRes] = await Promise.all([
    mecanicosDeLaOrden(supabase, params.id),
    supabase
      .from('orders')
      .select(`
        *,
        assigned_mechanic:profiles!assigned_mechanic_id(id, full_name, phone),
        mechanics:profiles!order_mechanics(id, full_name, phone),
        stages:order_stages(*, attachments:stage_attachments(*))
      `)
      .eq('id', params.id)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('*')
      // El dueño también atiende carros: entra como 'admin' pero se le pueden
      // asignar órdenes igual que a un mecánico (no necesita una segunda cuenta).
      .in('role', ['mechanic', 'admin'])
      .eq('active', true)
      .order('full_name'),
    service.from('order_budget_items').select('*').eq('order_id', params.id).order('position'),
  ]);

  // ¿Está en la lista de esta orden? (0021). Si no, para él no existe.
  if (!mecanicos.includes(caller.userId)) notFound();

  const orderData = orderRes.data;
  if (!orderData) notFound();

  const order = orderData as unknown as Order;

  // Fotos del bucket privado: firmar sus URLs (service client) antes de pasarlas.
  await signStageAttachments(
    service,
    (order as unknown as { stages?: OrderStage[] }).stages
  );

  return (
    <MecanicoOrderDetailClient
      order={order}
      mechanics={(mechanicsRes.data ?? []) as unknown as Profile[]}
      currentUserId={caller.userId}
      budgetItems={(budgetRes.data ?? []) as unknown as BudgetItem[]}
    />
  );
}
