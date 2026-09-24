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
      // Solo las órdenes que el administrador le asignó (0019). El filtro va
      // aquí además de en la política de la base de datos: esta consulta usa
      // la sesión del usuario, así que RLS ya lo cubriría, pero dejarlo
      // explícito evita que un cambio futuro en las políticas abra la lista
      // sin que nadie se dé cuenta.
      .eq('assigned_mechanic_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('*')
      .eq('workshop_id', wid)
      // El dueño también atiende carros: entra como 'admin' pero se le pueden
      // asignar órdenes igual que a un mecánico (no necesita una segunda cuenta).
      .in('role', ['mechanic', 'admin'])
      .eq('active', true)
      .order('full_name'),
    supabase.from('workshops').select('order_limit, is_subscribed').eq('id', wid).single(),
    supabase
      .from('platform_settings')
      .select('free_order_limit, support_phones')
      .eq('id', 1)
      .single(),
  ]);
  const profileRes = { data: me };
  const workshop = workshopRes.data as unknown as
    | { order_limit: number | null; is_subscribed: boolean }
    | null;
  const settings = settingsRes.data as unknown as
    | { free_order_limit: number; support_phones: string[] | null }
    | null;
  const globalLimit = settings?.free_order_limit ?? 3;
  const orderLimit = workshop?.order_limit ?? globalLimit;
  const isSubscribed = workshop?.is_subscribed ?? false;

  return (
    <MecanicoOrdenesClient
      initialOrders={(ordersRes.data ?? []) as unknown as Order[]}
      mechanics={(mechanicsRes.data ?? []) as unknown as Profile[]}
      profile={profileRes.data as unknown as Profile}
    />
  );
}
