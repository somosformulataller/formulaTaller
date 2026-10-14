import { esCuentaNuestra, type Movimiento } from './banco';

// Reglas de la validación automática, sin red ni base de datos (se pueden
// probar solas). Las usa lib/pagos/conciliar.ts.

/** Apagado de emergencia sin tocar código: PAGOS_VALIDACION_AUTOMATICA=false */
export const VALIDACION_ACTIVA = process.env.PAGOS_VALIDACION_AUTOMATICA !== 'false';

/** Por encima de esto (USD acreditados) lo aprueba una persona aunque el banco lo confirme. */
export const MAX_AUTO_USD = 50;
/** El banco suele tardar 1–2 min; pasado esto se avisa en «Por revisar» (sin dejar de intentar). */
export const MINUTOS_ANTES_DE_REVISION = 10;
export const VENTANA_ANTES_MS = 24 * 60 * 60 * 1000; // pagó anoche y avisó hoy
export const VENTANA_DESPUES_MS = 2 * 60 * 60 * 1000; // reloj del banco adelantado

/** Tolerancia en Bs por arriba y por abajo: cubre a quien redondea al transferir. */
export const tolerancia = (bs: number) => Math.max(0.5, bs * 0.005);
export const cola6 = (v: string | null | undefined) => String(v ?? '').replace(/\D/g, '').slice(-6);
const centavos = (n: number) => Math.round(n * 100) / 100;
const bs = (n: number) =>
  `Bs. ${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Por qué una compra la tiene que mirar una persona. */
export type Revision =
  | 'referencia_repetida'
  | 'monto_alto'
  | 'monto_distinto'
  | 'pago_usado'
  | 'ambiguo'
  | 'sin_tasa'
  | 'fuera_de_ventana'
  | 'reclamo'
  | 'no_aparece';

export const REVISION_TEXTO: Record<Revision, string> = {
  referencia_repetida: 'Referencia repetida',
  monto_alto: `Monto alto (más de $${MAX_AUTO_USD})`,
  monto_distinto: 'El monto no cuadra',
  pago_usado: 'El pago ya figura usado en el banco',
  ambiguo: 'Varios pagos con esa referencia',
  sin_tasa: 'Sin tasa BCV',
  fuera_de_ventana: 'Pago con fecha lejana',
  reclamo: 'Verificado, falta acreditar',
  no_aparece: 'No aparece en el banco',
};

/** «No aparece» se sigue intentando solo; las demás las decide una persona. */
export const sigueAutomatica = (r: string | null) => r === null || r === 'no_aparece';

export interface CompraPendiente {
  id: string;
  workshop_id: string;
  reference: string;
  amount_usd: number;
  amount_ves: number | null;
  exchange_rate: number | null;
  ocr_amount: number | null;
  created_at: string;
  revision: string | null;
  bank_note: string | null;
  check_count?: number;
}


export type Emparejamiento =
  | { estado: 'ok'; movimiento: Movimiento; acreditar: number; detalle?: string }
  | { estado: 'sin_referencia' }
  | { estado: 'no_encontrado' }
  | { estado: 'revision'; revision: Revision; detalle: string; movimiento?: Movimiento };

/**
 * Las reglas, sin efectos secundarios. `tomados` son los movimientos que ya
 * pagaron otra compra nuestra: un movimiento paga UNA sola compra.
 *
 * Adaptación al saldo: si el monto del banco no es el elegido pero COINCIDE
 * con el que leyó el OCR en la captura, el pago está identificado por dos
 * lados (referencia + monto del comprobante) y se acredita lo pagado,
 * convertido a la tasa con la que se compró. Pagar de más o de menos no traba
 * la recarga: el taller recibe exactamente lo que pagó.
 */
export function emparejar(c: CompraPendiente, movs: Movimiento[], tomados: Set<number> = new Set()): Emparejamiento {
  const cola = cola6(c.reference);
  if (cola.length < 6) return { estado: 'sin_referencia' };
  const t = Date.parse(c.created_at);

  const conEsaCola = movs.filter((m) => {
    if (!esCuentaNuestra(m) || m.tipo !== 'CREDITO') return false;
    if (!String(m.referencia).endsWith(cola)) return false;
    const tm = Date.parse(m.fecha);
    return Number.isFinite(tm) && tm >= t - VENTANA_ANTES_MS && tm <= t + VENTANA_DESPUES_MS;
  });
  const libres = conEsaCola.filter((m) => !m.used && !tomados.has(m.id));

  if (!libres.length) {
    if (conEsaCola.length) {
      const m = conEsaCola[0];
      return {
        estado: 'revision',
        revision: 'pago_usado',
        movimiento: m,
        detalle: `El pago de ${bs(m.monto)} (ref ${m.referencia}) ya figura usado: pudo tomarlo otra compra o La Mejor Llave. Revisar antes de acreditar.`,
      };
    }
    return { estado: 'no_encontrado' };
  }

  const esperado = c.amount_ves === null ? null : Number(c.amount_ves);
  const leido = c.ocr_amount === null ? null : Number(c.ocr_amount);
  const cuadra = (m: Movimiento, bsx: number | null) => bsx !== null && Math.abs(m.monto - bsx) <= tolerancia(bsx);

  // Lo ideal: pagó justo lo elegido.
  const exactos = libres.filter((m) => cuadra(m, esperado));
  if (exactos.length === 1) return { estado: 'ok', movimiento: exactos[0], acreditar: Number(c.amount_usd) };
  if (exactos.length > 1) {
    return { estado: 'revision', revision: 'ambiguo', detalle: `${exactos.length} pagos comparten esa referencia y ese monto.` };
  }

  // Pagó otro monto, pero es el que dice su comprobante.
  const comoLaCaptura = libres.filter((m) => cuadra(m, leido));
  if (comoLaCaptura.length === 1) {
    const m = comoLaCaptura[0];
    const tasa = Number(c.exchange_rate ?? 0);
    if (!(tasa > 0)) {
      return { estado: 'revision', revision: 'sin_tasa', movimiento: m, detalle: `Pagó ${bs(m.monto)} y no hay tasa con qué convertirlo.` };
    }
    const acreditar = centavos(m.monto / tasa);
    if (acreditar < 0.01) {
      return { estado: 'revision', revision: 'monto_distinto', movimiento: m, detalle: `Pagó ${bs(m.monto)}.` };
    }
    const verbo = esperado !== null && m.monto < esperado ? 'menos' : 'más';
    return {
      estado: 'ok',
      movimiento: m,
      acreditar,
      detalle: `Pagó ${verbo} de lo elegido: ${bs(m.monto)} en vez de ${esperado !== null ? bs(esperado) : '—'}. Se acreditó lo pagado.`,
    };
  }

  // Ni lo elegido ni lo del comprobante: que lo mire una persona.
  const m = libres.reduce((a, b) =>
    esperado !== null && Math.abs(b.monto - esperado) < Math.abs(a.monto - esperado) ? b : a
  );
  return {
    estado: 'revision',
    revision: libres.length > 1 ? 'ambiguo' : 'monto_distinto',
    movimiento: m,
    detalle:
      `En el banco hay ${bs(m.monto)}; la compra era de ${esperado !== null ? bs(esperado) : '—'}` +
      (leido !== null ? ` y la captura dice ${bs(leido)}.` : ' y no se pudo leer el monto de la captura.'),
  };
}
