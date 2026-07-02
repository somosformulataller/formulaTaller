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

/**
 * True if the caller may manage the given order. The order must belong to the
 * caller's workshop (tenant isolation); then admins can manage any order and
 * mechanics only orders assigned to them.
 */
export async function canManageOrder(caller: Caller, orderId: string): Promise<boolean> {
  if (!caller.workshopId) return false;
  if (caller.role !== 'admin' && caller.role !== 'mechanic') return false;

  const service = createServiceClient();
  const { data } = await service
    .from('orders')
    .select('assigned_mechanic_id, workshop_id')
    .eq('id', orderId)
    .single();

  const order = data as unknown as
    | { assigned_mechanic_id: string | null; workshop_id: string }
    | null;
  if (!order) return false;

  // Never allow acting on an order from another workshop.
  if (order.workshop_id !== caller.workshopId) return false;

  if (caller.role === 'admin') return true;
  return order.assigned_mechanic_id === caller.userId;
}
