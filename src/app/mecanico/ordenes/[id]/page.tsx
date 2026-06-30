import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import type { Order } from '@/lib/types';
import MecanicoOrderDetailClient from './OrderDetailClient';

interface Props {
  params: { id: string };
}

export default async function MecanicoOrderDetailPage({ params }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const result = await supabase
    .from('orders')
    .select(`
      *,
      assigned_mechanic:profiles!assigned_mechanic_id(id, full_name, phone),
      stages:order_stages(*)
    `)
    .eq('id', params.id)
    .eq('assigned_mechanic_id', user.id)
    .maybeSingle();

  const orderData = result.data;
  if (!orderData) notFound();

  const order = orderData as unknown as Order;

  return <MecanicoOrderDetailClient order={order} />;
}
