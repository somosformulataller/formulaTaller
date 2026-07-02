import { createClient } from '@/lib/supabase/server';
import { getCaller } from '@/lib/api-auth';
import type { Order, Profile } from '@/lib/types';
import OrdenesClient from './OrdenesClient';

export default async function OrdenesAdminPage() {
  const supabase = await createClient();
  const caller = await getCaller();
  const wid = caller?.workshopId ?? '';

  const [ordersRes, mechanicsRes, workshopRes] = await Promise.all([
    supabase
      .from('orders')
      .select(`
        *,
        assigned_mechanic:profiles!assigned_mechanic_id(id, full_name, phone),
        stages:order_stages(*),
        workshop:workshops(name)
      `)
      .eq('workshop_id', wid)
      .order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('*')
      .eq('workshop_id', wid)
      .eq('role', 'mechanic')
      .eq('active', true)
      .order('full_name'),
    supabase.from('workshops').select('order_limit').eq('id', wid).single(),
  ]);

  const orderLimit =
    (workshopRes.data as unknown as { order_limit: number } | null)?.order_limit ?? 3;

  return (
    <OrdenesClient
      initialOrders={(ordersRes.data ?? []) as unknown as Order[]}
      mechanics={(mechanicsRes.data ?? []) as unknown as Profile[]}
      orderLimit={orderLimit}
    />
  );
}
