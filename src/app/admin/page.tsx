import { createClient } from '@/lib/supabase/server';
import { getCaller } from '@/lib/api-auth';
import type { Profile } from '@/lib/types';
import { paginaOrdenes, contarOrdenes } from '@/lib/ordenes-lista';
import AdminDashboardClient from './DashboardClient';

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const caller = await getCaller();
  const wid = caller?.workshopId ?? '';

  const [pagina, conteos, mechanicsRes, workshopRes, settingsRes] = await Promise.all([
    // Solo la primera página y los conteos (ver lib/ordenes-lista.ts).
    paginaOrdenes(supabase, wid),
    contarOrdenes(supabase, wid),
    supabase
      .from('profiles')
      .select('*')
      .eq('workshop_id', wid)
      // El dueño también atiende carros: entra como 'admin' pero se le pueden
      // asignar órdenes igual que a un mecánico (no necesita una segunda cuenta).
      .in('role', ['mechanic', 'admin'])
      .eq('active', true)
      .order('full_name', { ascending: true }),
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
    <AdminDashboardClient
      inicial={pagina}
      conteos={conteos}
      mechanics={(mechanicsRes.data ?? []) as unknown as Profile[]}
      orderLimit={orderLimit}
      isSubscribed={isSubscribed}
    />
  );
}
