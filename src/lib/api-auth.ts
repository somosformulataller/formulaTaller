import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { UserRole } from '@/lib/types';

export interface Caller {
  userId: string;
  role: UserRole | null;
  workshopId: string | null;
}

/**
 * Resolves the authenticated caller (id, role, workshop) from the session cookie.
 * Returns null if there is no valid session.
 */
export async function getCaller(): Promise<Caller | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('role, workshop_id')
    .eq('id', user.id)
    .single();

  const profile = data as unknown as { role: UserRole; workshop_id: string } | null;
  return {
    userId: user.id,
    role: profile?.role ?? null,
    workshopId: profile?.workshop_id ?? null,
  };
}

export interface PlatformAdmin {
  userId: string;
  email: string | null;
}

/**
 * Resolves the current user IF they are a platform superadmin (a row in
 * platform_admins). Uses the service client to read that table, which is
 * locked by RLS. Returns null for anyone who isn't a platform admin.
 */
export async function getPlatformAdmin(): Promise<PlatformAdmin | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const service = createServiceClient();
  const { data } = await service
    .from('platform_admins')
    .select('user_id, email')
    .eq('user_id', user.id)
    .maybeSingle();

  const row = data as unknown as { user_id: string; email: string | null } | null;
  if (!row) return null;
  return { userId: row.user_id, email: row.email };
}

/**
 * True if the caller may manage (edit / change status / assign / update stages
 * and attachments) the given order. Any staff member (admin or mechanic) may
 * manage any order of THEIR workshop — mismo flujo para admin y mecánico. La
 * única frontera es el taller (aislamiento por tenant).
 */
export async function canManageOrder(caller: Caller, orderId: string): Promise<boolean> {
  if (!caller.workshopId) return false;
  if (caller.role !== 'admin' && caller.role !== 'mechanic') return false;

  const service = createServiceClient();
  const { data } = await service
    .from('orders')
    .select('workshop_id')
    .eq('id', orderId)
    .single();

  const order = data as unknown as { workshop_id: string } | null;
  if (!order) return false;

  // Solo órdenes del propio taller.
  return order.workshop_id === caller.workshopId;
}

/**
 * True if the caller may DELETE the given order. Más estricto que gestionar:
 * el admin puede eliminar cualquier orden de su taller; el mecánico solo las
 * suyas (asignadas a él o creadas por él).
 */
export async function canDeleteOrder(caller: Caller, orderId: string): Promise<boolean> {
  if (!caller.workshopId) return false;
  if (caller.role !== 'admin' && caller.role !== 'mechanic') return false;

  const service = createServiceClient();
  const { data } = await service
    .from('orders')
    .select('assigned_mechanic_id, workshop_id, created_by')
    .eq('id', orderId)
    .single();

  const order = data as unknown as
    | { assigned_mechanic_id: string | null; workshop_id: string; created_by: string | null }
    | null;
  if (!order) return false;
  if (order.workshop_id !== caller.workshopId) return false;

  if (caller.role === 'admin') return true;
  return order.assigned_mechanic_id === caller.userId || order.created_by === caller.userId;
}
