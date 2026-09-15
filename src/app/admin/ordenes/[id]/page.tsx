import { createClient, createServiceClient } from '@/lib/supabase/server';
import { signStageAttachments } from '@/lib/storage';
import { notFound } from 'next/navigation';
import type { Order, Profile, OrderStage } from '@/lib/types';
import OrderDetailClient from './OrderDetailClient';

// Datos siempre frescos (incluye los mecánicos disponibles para asignar).
export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string };
  searchParams: { edit?: string };
}

export default async function AdminOrderDetailPage({ params, searchParams }: Props) {
  const supabase = await createClient();

  const [orderResult, mechanicsResult] = await Promise.all([
    supabase
      .from('orders')
      .select(`
        *,
        assigned_mechanic:profiles!assigned_mechanic_id(id, full_name, phone),
        stages:order_stages(*, attachments:stage_attachments(*))
      `)
      .eq('id', params.id)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('*')
      .eq('role', 'mechanic')
      .eq('active', true)
      .order('full_name'),
  ]);

  const orderData = orderResult.data;
  if (!orderData) notFound();

  const order = orderData as unknown as Order;
  const mechanics = (mechanicsResult.data ?? []) as unknown as Profile[];

  // Fotos del bucket privado: firmar sus URLs (con el service client) antes de
  // pasarlas al componente. La página se lee con el cliente autenticado, pero
  // firmar es una operación de storage que exige service_role.
  await signStageAttachments(
    createServiceClient(),
    (order as unknown as { stages?: OrderStage[] }).stages
  );

  return (
    <OrderDetailClient
      order={order}
      mechanics={mechanics}
      startInEdit={searchParams.edit === '1'}
    />
  );
}
