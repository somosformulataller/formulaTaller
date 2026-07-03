import { createClient } from '@/lib/supabase/server';
import { getCaller } from '@/lib/api-auth';
import type { Order, Profile } from '@/lib/types';
import OrdenesClient from './OrdenesClient';

// Siempre renderizar en el servidor con datos frescos (incluye la lista de
// mecánicos disponibles para asignar), sin servir una versión cacheada.
export const dynamic = 'force-dynamic';

export default async function OrdenesAdminPage() {
  const supabase = await createClient();
  const caller = await getCaller();
  const wid = caller?.workshopId ?? '';

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

  const workshop = workshopRes.data as unknown as
    | { order_limit: number | null; is_subscribed: boolean }
    | null;
  const globalLimit =
    (settingsRes.data as unknown as { free_order_limit: number } | null)?.free_order_limit ?? 3;
  const orderLimit = workshop?.order_limit ?? globalLimit;
  const isSubscribed = workshop?.is_subscribed ?? false;

  return (
    <OrdenesClient
      initialOrders={(ordersRes.data ?? []) as unknown as Order[]}
      mechanics={(mechanicsRes.data ?? []) as unknown as Profile[]}
      orderLimit={orderLimit}
      isSubscribed={isSubscribed}
    />
  );
}
