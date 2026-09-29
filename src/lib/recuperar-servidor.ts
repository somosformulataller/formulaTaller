import { createHash, randomBytes } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { LIMITE_POR_CORREO, LIMITE_POR_IP, MINUTOS_PERMISO } from '@/lib/recuperar';

// La parte de la recuperación que sí toca la base: la bitácora, el freno por
// intentos y los permisos de un solo uso (migración 0022). Solo servidor y con
// la clave de servicio: desde el navegador no se puede ni leer la bitácora ni
// fabricar un permiso.

type Service = ReturnType<typeof createServiceClient>;

export type Resultado =
  | 'verificado'
  | 'no_coincide'
  | 'sin_cuenta'
  | 'no_admin'
  | 'inactivo'
  | 'frenado'
  | 'cambiada';

/** De dónde viene la petición. Vercel la pone en x-forwarded-for. */
export function ipDe(req: Request): string | null {
  const cabecera = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip');
  return cabecera?.split(',')[0]?.trim().slice(0, 64) || null;
}

/** Deja constancia del intento. Nunca lanza, pero se escribe ANTES de responder. */
export async function apuntarIntento(
  service: Service,
  datos: { email: string; userId?: string | null; ip?: string | null; resultado: Resultado }
): Promise<void> {
  try {
    await service.from('password_reset_attempts').insert({
      email: datos.email.slice(0, 200),
      user_id: datos.userId ?? null,
      ip: datos.ip ?? null,
      resultado: datos.resultado,
    });
  } catch {}
}

/**
 * ¿Se pasó de intentos fallidos en la última hora? Por correo (quien prueba
 * datos contra una misma cuenta) y por IP (quien barre muchas cuentas).
 * Si la consulta falla se deja pasar: detrás siguen los tres datos.
 */
export async function estaFrenado(service: Service, email: string, ip: string | null): Promise<boolean> {
  const desde = new Date(Date.now() - 3_600_000).toISOString();
  const fallidos = ['no_coincide', 'sin_cuenta', 'frenado'];
  try {
    const porCorreo = await service
      .from('password_reset_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('email', email)
      .in('resultado', fallidos)
      .gte('created_at', desde);
    if ((porCorreo.count ?? 0) >= LIMITE_POR_CORREO) return true;

    if (ip) {
      const porIp = await service
        .from('password_reset_attempts')
        .select('id', { count: 'exact', head: true })
        .eq('ip', ip)
        .in('resultado', fallidos)
        .gte('created_at', desde);
      if ((porIp.count ?? 0) >= LIMITE_POR_IP) return true;
    }
  } catch {
    return false;
  }
  return false;
}

const huella = (token: string) => createHash('sha256').update(token).digest('hex');

/** Crea el permiso y devuelve el token en claro; en la base queda solo su huella. */
export async function crearPermiso(service: Service, userId: string, ip: string | null): Promise<string | null> {
  const token = randomBytes(32).toString('base64url');
  const { error } = await service.from('password_reset_grants').insert({
    token_hash: huella(token),
    user_id: userId,
    expires_at: new Date(Date.now() + MINUTOS_PERMISO * 60_000).toISOString(),
    ip,
  });
  return error ? null : token;
}

/**
 * Gasta el permiso: existe, no caducó y no se usó. El marcado va en el mismo
 * UPDATE con `is('used_at', null)`, así dos peticiones a la vez con el mismo
 * token no pasan las dos.
 */
export async function gastarPermiso(service: Service, token: string): Promise<{ userId: string } | null> {
  if (!token || token.length < 20) return null;
  const { data, error } = await service
    .from('password_reset_grants')
    .update({ used_at: new Date().toISOString() })
    .eq('token_hash', huella(token))
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('user_id')
    .maybeSingle();
  if (error || !data) return null;
  return { userId: (data as { user_id: string }).user_id };
}

/** La cuenta de auth con ese correo, paginando de verdad (no «las primeras 1.000»). */
export async function buscarPorCorreo(service: Service, correo: string): Promise<{ id: string } | null> {
  for (let pagina = 1; pagina <= 20; pagina++) {
    const { data, error } = await service.auth.admin.listUsers({ page: pagina, perPage: 1000 });
    if (error) return null;
    const usuarios = data?.users ?? [];
    const encontrado = usuarios.find((u) => (u.email ?? '').toLowerCase() === correo);
    if (encontrado) return { id: encontrado.id };
    if (usuarios.length < 1000) return null;
  }
  return null;
}
