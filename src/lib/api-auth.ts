import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { UserRole } from '@/lib/types';

export interface Caller {
  userId: string;
  role: UserRole | null;
}

/**
 * Resolves the authenticated caller and their role from the session cookie.
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
    .select('role')
    .eq('id', user.id)
    .single();

  const role = (data as unknown as { role: UserRole } | null)?.role ?? null;
  return { userId: user.id, role };
}

/**
 * True if the caller may manage the given order:
 * admins can manage any order; mechanics only orders assigned to them.
 */
export async function canManageOrder(caller: Caller, orderId: string): Promise<boolean> {
  if (caller.role === 'admin') return true;
  if (caller.role !== 'mechanic') return false;

  const service = createServiceClient();
  const { data } = await service
    .from('orders')
    .select('assigned_mechanic_id')
    .eq('id', orderId)
    .single();

  const assigned = (data as unknown as { assigned_mechanic_id: string | null } | null)
    ?.assigned_mechanic_id;
  return assigned === caller.userId;
}
