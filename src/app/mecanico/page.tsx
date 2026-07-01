import { createClient } from '@/lib/supabase/server';
import type { Order, Profile } from '@/lib/types';
import MecanicoOrdenesClient from './OrdenesClient';

export const dynamic = 'force-dynamic';

export default async function MecanicoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const [ordersRes, mechanicsRes, profileRes] = await Promise.all([
    supabase
      .from('orders')
      .select(`
        *,
        assigned_mechanic:profiles!assigned_mechanic_id(id, full_name, phone),
        stages:order_stages(*)
      `)
      .order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('*')
      .eq('role', 'mechanic')
      .eq('active', true)
      .order('full_name'),
    supabase.from('profiles').select('*').eq('id', user.id).single(),
  ]);

  return (
    <MecanicoOrdenesClient
      initialOrders={(ordersRes.data ?? []) as unknown as Order[]}
      mechanics={(mechanicsRes.data ?? []) as unknown as Profile[]}
      profile={profileRes.data as unknown as Profile}
    />
  );
}
