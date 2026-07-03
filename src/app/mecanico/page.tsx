import { createClient } from '@/lib/supabase/server';
import type { Order, Profile } from '@/lib/types';
import MecanicoOrdenesClient from './OrdenesClient';

export const dynamic = 'force-dynamic';

export default async function MecanicoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Resolve the mechanic's workshop first, then scope everything to it.
  const { data: me } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  const wid = (me as unknown as Profile | null)?.workshop_id ?? '';

  const [ordersRes, mechanicsRes, workshopRes, settingsRes] = await Promise.all([
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
    supabase.from('workshops').select('order_limit, is_subscribed').eq('id', wid).single(),
    supabase.from('platform_settings').select('free_order_limit').eq('id', 1).single(),
  ]);
  const profileRes = { data: me };
  const workshop = workshopRes.data as unknown as
    | { order_limit: number | null; is_subscribed: boolean }
    | null;
  const globalLimit =
    (settingsRes.data as unknown as { free_order_limit: number } | null)?.free_order_limit ?? 3;
  const orderLimit = workshop?.order_limit ?? globalLimit;
  const isSubscribed = workshop?.is_subscribed ?? false;

  return (
    <MecanicoOrdenesClient
      initialOrders={(ordersRes.data ?? []) as unknown as Order[]}
      mechanics={(mechanicsRes.data ?? []) as unknown as Profile[]}
      profile={profileRes.data as unknown as Profile}
      orderLimit={orderLimit}
      isSubscribed={isSubscribed}
    />
  );
}
