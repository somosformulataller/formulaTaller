// ============================================================================
// Quién hace la petición, verificado UNA vez por el middleware
// ============================================================================
//
// El middleware ya valida la sesión con Supabase y lee el perfil (rol, activo,
// taller) en cada petición. Antes, cada página y cada API volvía a hacer esas
// dos consultas: cuatro viajes a Supabase por pantalla en vez de dos. Ahora el
// middleware pasa lo que ya sabe en estas cabeceras internas y `getCaller` las
// lee sin consultar nada.
//
// Seguridad: el middleware BORRA estas cabeceras de toda petición que entra
// (un cliente no puede inventárselas) y solo las pone después de verificar la
// sesión. Por eso el matcher del middleware debe seguir cubriendo todas las
// páginas y las /api.

export const H_USER = 'x-ft-user-id';
export const H_ROLE = 'x-ft-role';
export const H_WORKSHOP = 'x-ft-workshop-id';

export const CALLER_HEADERS = [H_USER, H_ROLE, H_WORKSHOP];
