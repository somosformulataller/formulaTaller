import { createClient } from '@/lib/supabase/server';
import type { Order, Profile } from '@/lib/types';
import AdminDashboardClient from './DashboardClient';

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [ordersRes, mechanicsRes] = await Promise.all([
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
      .order('full_name', { ascending: true }),
  ]);

  return (
    <AdminDashboardClient
      initialOrders={(ordersRes.data ?? []) as unknown as Order[]}
      mechanics={(mechanicsRes.data ?? []) as unknown as Profile[]}
    />
  );
}
