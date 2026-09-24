import { createClient, createServiceClient } from '@/lib/supabase/server';
import { mecanicosDeLaOrden } from '@/lib/mecanicos-orden';
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
 * Correo de cada usuario (vive en auth.users, no en profiles). La admin API
 * pagina de a 1000; hay que recorrer TODAS las páginas o los dueños que caen
 * fuera de la primera se pintarían como "sin correo" y sin botón de reset. Se
 * detiene cuando una página trae menos de perPage (la última).
 */
export async function fetchAllAuthEmails(
  service: ReturnType<typeof createServiceClient>
): Promise<Map<string, string | null>> {
  const emailById = new Map<string, string | null>();
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage });
    if (error) break;
    const users = data?.users ?? [];
    for (const u of users) emailById.set(u.id, u.email ?? null);
    if (users.length < perPage) break;
  }
  return emailById;
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
 * True if the caller may manage (edit / change status / update stages,
 * attachments and budget) the given order.
 *
 * El administrador gestiona cualquier orden de SU taller. El mecánico, solo
 * aquellas en cuya lista está: ni las de otros compañeros ni las que están sin
 * asignar (migraciones 0019 y 0021).
 *
 * Esta comprobación no es un adorno de la de la base de datos: los endpoints
 * escriben con la clave de servicio, que se SALTA RLS. Aquí es donde de verdad
 * se cierra la puerta.
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

  // Primera frontera, la de siempre: el taller.
  if (order.workshop_id !== caller.workshopId) return false;

  if (caller.role === 'admin') return true;

  // Segunda frontera: al mecánico solo lo suyo. Desde la 0021 «suyo» es estar
  // en la lista de la orden, que puede tener varios.
  return (await mecanicosDeLaOrden(service, orderId)).includes(caller.userId);
}

/**
 * True if the caller may DELETE the given order. El admin puede eliminar
 * cualquier orden de su taller; el mecánico, solo aquellas en cuya lista de
 * mecánicos está.
 *
 * Haber creado la orden ya no cuenta: desde la 0019 el mecánico no crea
 * órdenes, y las que creó antes solo las ve si además se las asignaron.
 */
export async function canDeleteOrder(caller: Caller, orderId: string): Promise<boolean> {
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
  if (order.workshop_id !== caller.workshopId) return false;

  if (caller.role === 'admin') return true;
  return (await mecanicosDeLaOrden(service, orderId)).includes(caller.userId);
}
