import { createClient } from '@/lib/supabase/server';
import type { Order, Profile } from '@/lib/types';
import MecanicoOrdenesClient from './OrdenesClient';

export default async function MecanicoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const [ordersRes, profileRes] = await Promise.all([
    supabase
      .from('orders')
      .select(`
        *,
        assigned_mechanic:profiles!assigned_mechanic_id(id, full_name, phone),
        stages:order_stages(*)
      `)
      .eq('assigned_mechanic_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single(),
  ]);

  return (
    <MecanicoOrdenesClient
      initialOrders={(ordersRes.data ?? []) as unknown as Order[]}
      profile={profileRes.data as unknown as Profile}
    />
  );
}
