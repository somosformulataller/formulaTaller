import { createClient } from '@/lib/supabase/server';
import { getCaller } from '@/lib/api-auth';
import { idsDeMisOrdenes } from '@/lib/mecanicos-orden';
import type { Order, Profile } from '@/lib/types';
import MecanicoOrdenesClient from './OrdenesClient';

export const dynamic = 'force-dynamic';

export default async function MecanicoPage() {
  const caller = await getCaller();
  if (!caller) return null;
  const supabase = await createClient();
  const wid = caller.workshopId ?? '';

  // Su perfil y sus órdenes: aquellas en cuya lista de mecánicos está (0021),
  // porque un carro puede tener varios y el segundo también tiene que verlo.
  const [{ data: me }, mias] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', caller.userId).single(),
    idsDeMisOrdenes(supabase, caller.userId),
  ]);

  const [ordersRes, mechanicsRes] = await Promise.all([
    supabase
      .from('orders')
      .select(`
        *,
        assigned_mechanic:profiles!assigned_mechanic_id(id, full_name, phone),
        mechanics:profiles!order_mechanics(id, full_name, phone),
        workshop:workshops(name)
      `)
      .eq('workshop_id', wid)
      // Solo las órdenes que el administrador le asignó (0019, 0021). El
      // filtro va aquí además de en la política de la base de datos: esta
      // consulta usa la sesión del usuario, así que RLS ya lo cubriría, pero
      // dejarlo explícito evita que un cambio futuro en las políticas abra la
      // lista sin que nadie se dé cuenta.
      .in('id', mias.length ? mias : ['00000000-0000-0000-0000-000000000000'])
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
  ]);

  return (
    <MecanicoOrdenesClient
      initialOrders={(ordersRes.data ?? []) as unknown as Order[]}
      mechanics={(mechanicsRes.data ?? []) as unknown as Profile[]}
      profile={me as unknown as Profile}
    />
  );
}
