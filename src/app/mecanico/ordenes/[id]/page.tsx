import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import type { Order, Profile } from '@/lib/types';
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
        stages:order_stages(*)
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

  const orderData = orderRes.data;
  if (!orderData) notFound();

  const order = orderData as unknown as Order;

  return (
    <MecanicoOrderDetailClient
      order={order}
      mechanics={(mechanicsRes.data ?? []) as unknown as Profile[]}
      currentUserId={user.id}
    />
  );
}
