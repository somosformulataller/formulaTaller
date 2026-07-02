import { createServiceClient } from '@/lib/supabase/server';
import type { Mechanic, Profile } from '@/lib/types';

/**
 * Lists the mechanic profiles of a given workshop, enriched with their auth
 * email. Emails live in auth.users (not in the profiles table), so we read
 * them with the service client and merge by id. Server-side only.
 *
 * Scoping profiles by workshop first is what prevents leaking other tenants'
 * emails: we only ever map an email onto a profile that already belongs to
 * this workshop.
 */
export async function listMechanicsWithEmail(workshopId: string): Promise<Mechanic[]> {
  const service = createServiceClient();

  const { data: profiles } = await service
    .from('profiles')
    .select('*')
    .eq('role', 'mechanic')
    .eq('workshop_id', workshopId)
    .order('full_name', { ascending: true });

  const list = (profiles ?? []) as unknown as Profile[];

  const { data: usersData } = await service.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  const emailById = new Map<string, string | null>();
  for (const u of usersData?.users ?? []) {
    emailById.set(u.id, u.email ?? null);
  }

  return list.map((p) => ({ ...p, email: emailById.get(p.id) ?? null }));
}
