import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import type { Order, Profile } from '@/lib/types';
import OrderDetailClient from './OrderDetailClient';

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

  const orderData = orderResult.data;
  if (!orderData) notFound();

  const order = orderData as unknown as Order;
  const mechanics = (mechanicsResult.data ?? []) as unknown as Profile[];

  return (
    <OrderDetailClient
      order={order}
      mechanics={mechanics}
      startInEdit={searchParams.edit === '1'}
    />
  );
}
