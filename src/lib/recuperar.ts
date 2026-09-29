import { waNumber } from '@/lib/whatsapp';

// Recuperar la contraseña con tres datos: correo, WhatsApp y nombre del
// taller, los mismos que se piden al registrarse. Es el esquema de La Mejor
// Llave, que allí usa correo, cédula y teléfono.
//
// Aquí vive SOLO lo que no toca la red: limpiar lo que escribió la persona y
// decidir si cuadra con su cuenta.
//
//  · Limpiar antes que rechazar: «+58 412-123 4567» y «04121234567» son el
//    mismo número, y «Taller El Rayo, C.A.» y «taller el rayo ca» el mismo
//    nombre. Rechazar por un guion o una tilde deja a la gente fuera.
//  · Comparar sin manga ancha: después de limpiar, o es idéntico o no vale.

/** Intentos fallidos por correo y por IP en una hora antes de cortar */
export const LIMITE_POR_CORREO = 5;
export const LIMITE_POR_IP = 10;

/** Minutos que vale el permiso entre «tus datos cuadran» y la nueva contraseña */
export const MINUTOS_PERMISO = 10;

/** Igual que en el registro */
export const CLAVE_MINIMA = 8;

/**
 * El mismo mensaje para todo fallo de identidad. No se dice nunca cuál de los
 * tres datos falló, ni siquiera si existe una cuenta con ese correo: eso
 * convertiría una adivinanza de tres datos en tres adivinanzas sueltas.
 */
export const NO_CUADRA =
  'Esos datos no coinciden con ninguna cuenta de administrador. Revisa que el correo, el ' +
  'WhatsApp y el nombre del taller sean los que registraste. Si no lo consigues, escríbenos y te ayudamos.';

export interface DatosDeIdentidad {
  correo: string;
  whatsapp: string;
  taller: string;
}

/** Lo que la cuenta tiene guardado, para comparar */
export interface CuentaGuardada {
  /** profiles.phone del administrador */
  telefono?: string | null;
  /** workshops.whatsapp, respaldo si el perfil no tiene teléfono */
  whatsappTaller?: string | null;
  /** workshops.name */
  nombreTaller?: string | null;
}

export const limpiarCorreo = (v: string) => String(v ?? '').trim().toLowerCase();

/** Solo letras y números, en minúsculas y sin tildes */
export const limpiarNombre = (v: string) =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/** Número con código de país (58412…), o null si no tiene forma de teléfono */
export function limpiarTelefono(v: string): string | null {
  const n = waNumber(v);
  return n && n.length >= 10 && n.length <= 15 ? n : null;
}

export function limpiarDatos(entrada: DatosDeIdentidad) {
  const taller = limpiarNombre(entrada.taller);
  return {
    correo: limpiarCorreo(entrada.correo) || null,
    whatsapp: limpiarTelefono(entrada.whatsapp),
    taller: taller.length >= 2 ? taller : null,
  };
}

/** ¿Están los tres campos con pinta de dato? (antes de mirar la cuenta) */
export function faltaAlgo(entrada: DatosDeIdentidad): boolean {
  const d = limpiarDatos(entrada);
  return !d.correo || !d.whatsapp || !d.taller;
}

/** El teléfono del perfil manda; el del taller es el respaldo si está vacío */
export function telefonoCuadra(escrito: string | null, cuenta: CuentaGuardada): boolean {
  if (!escrito) return false;
  const guardado = cuenta.telefono?.trim() ? cuenta.telefono : cuenta.whatsappTaller;
  if (!guardado?.trim()) return false;
  return limpiarTelefono(guardado) === escrito;
}

export function tallerCuadra(escrito: string | null, cuenta: CuentaGuardada): boolean {
  if (!escrito || !cuenta.nombreTaller) return false;
  return limpiarNombre(cuenta.nombreTaller) === escrito;
}

/** Todo o nada: quien llama solo sabe sí o no */
export function esElDueno(entrada: DatosDeIdentidad, cuenta: CuentaGuardada): boolean {
  const d = limpiarDatos(entrada);
  if (!d.correo || !d.whatsapp || !d.taller) return false;
  return telefonoCuadra(d.whatsapp, cuenta) && tallerCuadra(d.taller, cuenta);
}

export function revisarClaveNueva(
  clave: string,
  repetida: string
): { ok: true } | { ok: false; error: string } {
  if (!clave || clave.length < CLAVE_MINIMA) {
    return { ok: false, error: `La contraseña debe tener al menos ${CLAVE_MINIMA} caracteres.` };
  }
  if (clave !== repetida) return { ok: false, error: 'Las dos contraseñas no son iguales.' };
  return { ok: true };
}
