// ============================================================================
// Conexión con la Bank Automation API (la misma que usa La Mejor Llave).
// Solo servidor: BANK_API_URL, BANK_API_TOKEN y BANK_API_ACCOUNT_NAME.
//
// Formula Taller cobra en la MISMA cuenta del Banco de Venezuela que La Mejor
// Llave. Por eso no se abre otra sesión en el banco: las dos apps leen el mismo
// estado de cuenta que guarda la API. Que un pago no se lo quede la app
// equivocada lo garantizan dos cosas:
//   1. Cada compra solo empareja con SU referencia (últimos 6 dígitos), dentro
//      de una ventana de tiempo y con el monto que cuadra.
//   2. Al acreditar, el movimiento se marca como USADO en la API
//      (set_used=true). Un movimiento usado no lo vuelve a tomar ninguna de las
//      dos apps.
//
// La API tiene DOS puertas muy distintas:
//   GET /transaction          → estado de cuenta YA GUARDADO. Gratis, no toca el banco.
//   GET /transaction/validate → si no encuentra la referencia, ENTRA AL BANCO.
//                               El banco solo aguanta ~1 entrada por minuto.
// ============================================================================

/** La cuenta en la que cobramos (la de La Mejor Llave). Doble cerrojo: la
 *  etiqueta de la API y el número enmascarado del banco. */
export const CUENTA_API = 'llave-bdv-4';
export const CUENTA_BANCO = '0102***7113';

const TIMEOUT_LECTURA_MS = 15_000;
// Entrar al banco tarda entre 20 y 60 s. Se corta antes para no pasarse del
// tiempo máximo de la función en Vercel: aunque se corte, la API termina de
// bajar el estado de cuenta y la siguiente pasada lo lee.
const TIMEOUT_SCRAPEO_MS = 45_000;
const TIMEOUT_RECLAMO_MS = 20_000;

export interface Movimiento {
  id: number;
  /** Cuenta del banco enmascarada, p. ej. 0102***7113 */
  cuenta: string;
  accountName: string;
  fecha: string;
  referencia: string;
  descripcion: string;
  tipo: string;
  monto: number;
  saldo?: number;
  scrapedAt?: string;
  /** true = ya reclamado (por esta app o por La Mejor Llave) */
  used: boolean;
}

const limpiar = (v: string | undefined) => (v ?? '').trim().replace(/^"|"$/g, '');

function config() {
  const url = limpiar(process.env.BANK_API_URL);
  const token = limpiar(process.env.BANK_API_TOKEN);
  const cuenta = limpiar(process.env.BANK_API_ACCOUNT_NAME) || CUENTA_API;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ''), token, cuenta };
}

export function bancoConfigurado(): boolean {
  return config() !== null;
}

/** Un movimiento solo se toca si viene de NUESTRA cuenta (etiqueta + número). */
export function esCuentaNuestra(m: Movimiento): boolean {
  return m.accountName === CUENTA_API && m.cuenta === CUENTA_BANCO;
}

async function llamar(path: string, timeoutMs: number) {
  const c = config();
  if (!c) return { ok: false as const, status: 0, data: null };
  try {
    const res = await fetch(`${c.url}${path}`, {
      headers: { Authorization: `Bearer ${c.token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false as const, status: 0, data: null };
  }
}

/** Día AAAA-MM-DD en hora de Venezuela (el banco lista en hora local). */
export const diaCaracas = (fecha: string | number | Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(fecha));

/** Estado de cuenta guardado, del más reciente al más antiguo. No toca el banco. */
export async function leerEstadoDeCuenta(limite = 200): Promise<Movimiento[]> {
  const c = config();
  if (!c) return [];
  const qs = new URLSearchParams({ account_name: c.cuenta, limit: String(limite) });
  const r = await llamar(`/transaction?${qs}`, TIMEOUT_LECTURA_MS);
  if (!r.ok || !Array.isArray(r.data)) return [];
  return (r.data as Movimiento[]).filter(esCuentaNuestra);
}

/** Movimientos guardados cuya referencia termina en esta cola, sin límite de fecha. */
export async function buscarPorReferencia(cola: string): Promise<Movimiento[]> {
  const c = config();
  if (!c) return [];
  const qs = new URLSearchParams({ account_name: c.cuenta, referencia: cola, limit: '20' });
  const r = await llamar(`/transaction?${qs}`, TIMEOUT_LECTURA_MS);
  if (!r.ok || !Array.isArray(r.data)) return [];
  return (r.data as Movimiento[]).filter(esCuentaNuestra);
}

export type Latido = 'scrapeada' | 'encontrada' | 'enfriamiento' | 'error' | 'sin_config';

/**
 * Obliga a la API a bajar el estado de cuenta fresco: se le pregunta por una
 * referencia que NO puede existir (set_used=false, no reclama nada). Solo
 * cuando no la encuentra entra al banco. Lo que dice si entró es lo que tardó:
 * de su tabla contesta en menos de 1 s; entrando al banco, en 18 s o más.
 */
export async function refrescarEstadoDeCuenta(referenciaImposible: string): Promise<Latido> {
  const c = config();
  if (!c) return 'sin_config';
  const qs = new URLSearchParams({
    account_name: c.cuenta,
    reference: referenciaImposible,
    date: diaCaracas(Date.now()),
    set_used: 'false',
    get_used: 'false',
  });
  const t0 = Date.now();
  const r = await llamar(`/transaction/validate?${qs}`, TIMEOUT_SCRAPEO_MS);
  if (r.status === 429) return 'enfriamiento';
  if (r.status === 0 && Date.now() - t0 >= TIMEOUT_SCRAPEO_MS - 1000) return 'scrapeada'; // cortado, pero entró
  if (r.status === 404 || r.status === 200) return Date.now() - t0 >= 5_000 ? 'scrapeada' : 'encontrada';
  return 'error';
}

/** Una cola de 6 dígitos que ningún movimiento tiene (para el latido). */
export function referenciaImposible(movimientos: Movimiento[]): string {
  const usadas = new Set(movimientos.map((m) => String(m.referencia).replace(/\D/g, '').slice(-6)));
  for (let n = 100000; n <= 999999; n++) {
    if (!usadas.has(String(n))) return String(n);
  }
  return '100000';
}

/**
 * Marca el movimiento como usado (set_used=true) para que ninguna de las dos
 * apps lo vuelva a tomar. Se prueba con el día de Caracas y con el día UTC:
 * un pago de la noche cae en dos días distintos según cómo cuente la API.
 */
export async function reclamarMovimiento(m: Movimiento): Promise<boolean> {
  const c = config();
  if (!c || !esCuentaNuestra(m)) return false;
  const dias = Array.from(new Set([diaCaracas(m.fecha), m.fecha.slice(0, 10)]));
  for (const date of dias) {
    const qs = new URLSearchParams({
      account_name: c.cuenta,
      reference: m.referencia,
      date,
      set_used: 'true',
      get_used: 'false',
      monto: m.monto.toFixed(2),
    });
    const r = await llamar(`/transaction/validate?${qs}`, TIMEOUT_RECLAMO_MS);
    if (r.ok) return true;
  }
  return false;
}
