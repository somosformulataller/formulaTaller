// Copiado de La Mejor Llave (lib/payments/exchangeRate.ts).
// Tasa oficial BCV vía dolarapi.com (la web del BCV falla TLS desde
// servidores; dolarapi replica el mismo valor oficial).
//
// Caché EN MEMORIA de 1 h con respaldo: si dolarapi falla o tarda,
// se sirve la última tasa conocida (aunque esté vencida) y no se
// vuelve a intentar hasta pasado un enfriamiento — una API externa
// lenta NO puede volver lento el panel ni la compra del jugador.
// (Antes: timeout de 5 s + reintento en línea = hasta 10 s bloqueando
// /api/admin/payments y /api/purchases en cada llamada fallida.)
//
// Fin de semana (tasaBcv.md): sábado y domingo se usa la tasa del lunes.
// El BCV la publica el viernes en la tarde y dolarapi ya la tiene en su
// histórico, aunque /dolares/oficial siga mostrando la del viernes.

const DOLARAPI_URL = 'https://ve.dolarapi.com/v1/dolares/oficial';
const HISTORICO_URL = 'https://ve.dolarapi.com/v1/historicos/dolares/oficial';

const FRESH_MS = 60 * 60_000; // frescura normal de la tasa (1 h)
const FAIL_COOLDOWN_MS = 5 * 60_000; // espera tras un fallo (5 min)
const FETCH_TIMEOUT_MS = 3_000;
const HISTORICO_TIMEOUT_MS = 5_000; // ~110 KB desde 2023

export interface ExchangeRate {
  rate: number;
  source: 'bcv';
  fetchedAt: string;
}

let cached: ExchangeRate | null = null;
let cachedAt = 0;
let cachedFinDeSemana = false;
let failedAt = 0;

// Sábado o domingo en Venezuela, no en la hora UTC del servidor
export function esFinDeSemanaEnVenezuela(ahora = new Date()): boolean {
  const dia = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Caracas',
    weekday: 'short',
  }).format(ahora);
  return dia === 'Sat' || dia === 'Sun';
}

async function fetchTasaOficial(): Promise<ExchangeRate> {
  const res = await fetch(DOLARAPI_URL, {
    cache: 'no-store', // la caché la maneja este módulo
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`dolarapi respondió ${res.status}`);
  const data = await res.json();
  const rate = Number(data?.promedio);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('Tasa inválida');
  return {
    rate,
    source: 'bcv',
    fetchedAt: data?.fechaActualizacion ?? new Date().toISOString(),
  };
}

// La tasa publicada con la fecha valor más reciente: el fin de semana es
// la del lunes (o la del siguiente día hábil si el lunes es feriado).
async function fetchTasaMasReciente(): Promise<ExchangeRate> {
  const res = await fetch(HISTORICO_URL, {
    cache: 'no-store',
    signal: AbortSignal.timeout(HISTORICO_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`dolarapi histórico respondió ${res.status}`);
  const filas: unknown = await res.json();
  if (!Array.isArray(filas)) throw new Error('Histórico inválido');

  let mejor: { fecha: string; rate: number } | null = null;
  for (const f of filas) {
    const fecha = typeof f?.fecha === 'string' ? f.fecha : '';
    const rate = Number(f?.promedio);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !Number.isFinite(rate) || rate <= 0) continue;
    if (!mejor || fecha > mejor.fecha) mejor = { fecha, rate };
  }
  if (!mejor) throw new Error('Histórico sin tasas');
  return { rate: mejor.rate, source: 'bcv', fetchedAt: `${mejor.fecha}T00:00:00-04:00` };
}

export async function fetchExchangeRate(): Promise<ExchangeRate> {
  if (esFinDeSemanaEnVenezuela()) {
    try {
      return await fetchTasaMasReciente();
    } catch {
      // Sin histórico: la del viernes, como antes
    }
  }
  return fetchTasaOficial();
}

export async function fetchExchangeRateSafe(): Promise<ExchangeRate | null> {
  const now = Date.now();
  const finDeSemana = esFinDeSemanaEnVenezuela();
  // Al cruzar viernes→sábado o domingo→lunes la caché no sirve
  const vigente = cached && cachedFinDeSemana === finDeSemana;
  if (vigente && now - cachedAt < FRESH_MS) return cached;
  // Falló hace poco: no insistir todavía; va la última conocida (o null)
  if (failedAt && now - failedAt < FAIL_COOLDOWN_MS) return cached;
  try {
    cached = await fetchExchangeRate();
    cachedAt = now;
    cachedFinDeSemana = finDeSemana;
    failedAt = 0;
  } catch {
    failedAt = now;
  }
  return cached;
}
