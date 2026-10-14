import { createHash } from 'node:crypto';

// ============================================================================
// Lee la captura del Pago Móvil con el servicio de OCR (el mismo de La Mejor
// Llave). NO valida ni acredita nada: quien dice que un pago existe es el
// estado de cuenta del banco. Sirve para que el taller no tenga que teclear la
// referencia (un dígito mal es la causa nº 1 de «pagué y no se refleja») y
// para tener el monto del comprobante, que permite acreditar lo que de verdad
// se pagó cuando no coincide con lo elegido.
// Solo servidor: PAYMENT_OCR_URL y PAYMENT_OCR_API_KEY.
// ============================================================================

const OCR_URL = (process.env.PAYMENT_OCR_URL ?? 'https://payment-ocr-service-production.up.railway.app').replace(/\/$/, '');
const OCR_KEY = (process.env.PAYMENT_OCR_API_KEY ?? '').trim();
// Mediana 2,6 s y peor caso 11 s (medido en La Mejor Llave).
const TIMEOUT_MS = 15_000;

export interface DatosOcr {
  /** Los 6 dígitos con los que se empareja en el banco */
  reference: string;
  full_reference: string | null;
  amount: number | null;
  bank: string | null;
  raw: Record<string, unknown>;
}

export type ResultadoOcr =
  | { estado: 'leido'; datos: DatosOcr }
  | { estado: 'ilegible' }
  | { estado: 'error' };

export const ocrConfigurado = () => OCR_KEY.length > 0;

/** Manda la imagen al servicio. Nunca lanza: el peor caso es `error`. */
export async function leerComprobante(bytes: ArrayBuffer, nombre: string): Promise<ResultadoOcr> {
  if (!ocrConfigurado()) return { estado: 'error' };
  let res: Response;
  try {
    const fd = new FormData();
    fd.append('file', new Blob([bytes]), nombre || 'comprobante.jpg');
    res = await fetch(`${OCR_URL}/v1/extract?template=ve_pago_movil&refDigits=6`, {
      method: 'POST',
      headers: { 'x-api-key': OCR_KEY },
      body: fd,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return { estado: 'error' };
  }
  if (res.status === 422) return { estado: 'ilegible' };
  if (!res.ok) {
    console.error('[ocr] respuesta HTTP', res.status);
    return { estado: 'error' };
  }
  const r = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!r) return { estado: 'error' };

  const reference = typeof r.reference === 'string' ? r.reference.trim() : '';
  // Una referencia deforme NO puede colarse en el camino del dinero.
  if (r.legible !== true || !/^\d{6}$/.test(reference)) return { estado: 'ilegible' };

  return {
    estado: 'leido',
    datos: {
      reference,
      full_reference: typeof r.full_reference === 'string' ? r.full_reference.replace(/\D/g, '') || null : null,
      amount: typeof r.amount === 'number' && Number.isFinite(r.amount) ? r.amount : null,
      bank: typeof r.bank === 'string' && r.bank.trim() ? r.bank.trim() : null,
      raw: r,
    },
  };
}

// La misma foto se lee dos veces: al elegirla (para mostrar la referencia) y
// al enviar la compra (el servidor no se fía de lo que mande el navegador).
// Cada lectura cuesta: la segunda sale de aquí. Es memoria del proceso; si en
// Vercel toca otra instancia, se vuelve a leer y da lo mismo.
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map<string, { r: ResultadoOcr; t: number }>();

export async function leerComprobanteCacheado(
  taller: string,
  bytes: ArrayBuffer,
  nombre: string
): Promise<ResultadoOcr> {
  const ahora = Date.now();
  cache.forEach((v, k) => {
    if (ahora - v.t > CACHE_MS) cache.delete(k);
  });
  const clave = `${taller}:${createHash('sha256').update(Buffer.from(bytes)).digest('hex')}`;
  const guardado = cache.get(clave);
  if (guardado) return guardado.r;
  const r = await leerComprobante(bytes, nombre);
  if (r.estado !== 'error') cache.set(clave, { r, t: ahora });
  return r;
}
