import { createClient, createServiceClient } from '@/lib/supabase/server';
import { signStageAttachments } from '@/lib/storage';
import { notFound } from 'next/navigation';
import type { Order, Profile, OrderStage } from '@/lib/types';
import MecanicoOrderDetailClient from './OrderDetailClient';

interface Props {
  params: { id: string };
}

export default async function MecanicoOrderDetailPage({ params }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const [orderRes, mechanicsRes] = await Promise.all([
    supabase
      .from('orders')
      .select(`
        *,
        assigned_mechanic:profiles!assigned_mechanic_id(id, full_name, phone),
        stages:order_stages(*, attachments:stage_attachments(*))
      `)
      .eq('id', params.id)
      // Solo si esta orden es suya (0019). Sin esto, un mecánico que conociera
      // el identificador de una orden ajena entraría a su ficha escribiendo la
      // dirección a mano.
      .eq('assigned_mechanic_id', user.id)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('*')
      // El dueño también atiende carros: entra como 'admin' pero se le pueden
      // asignar órdenes igual que a un mecánico (no necesita una segunda cuenta).
      .in('role', ['mechanic', 'admin'])
      .eq('active', true)
      .order('full_name'),
  ]);

  const orderData = orderRes.data;
  if (!orderData) notFound();

  const order = orderData as unknown as Order;

  // Fotos del bucket privado: firmar sus URLs (service client) antes de pasarlas.
  await signStageAttachments(
    createServiceClient(),
    (order as unknown as { stages?: OrderStage[] }).stages
  );

  return (
    <MecanicoOrderDetailClient
      order={order}
      mechanics={(mechanicsRes.data ?? []) as unknown as Profile[]}
      currentUserId={user.id}
    />
  );
}
