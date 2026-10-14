import { createServiceClient } from '@/lib/supabase/server';
import {
  bancoConfigurado,
  buscarPorReferencia,
  diaCaracas,
  esCuentaNuestra,
  leerEstadoDeCuenta,
  reclamarMovimiento,
  refrescarEstadoDeCuenta,
  referenciaImposible,
  type Latido,
  type Movimiento,
} from './banco';

// ============================================================================
// Conciliación de las compras de saldo contra el estado de cuenta del banco.
// Adaptada de La Mejor Llave (lib/payments/conciliar.ts). Una pasada:
//   1. LEER     el estado de cuenta guardado (gratis).
//   2. LATIDO   solo si falta algún pago reciente y nos toca el turno: una
//               entrada al banco para traer lo nuevo.
//   3. EMPAREJAR cada compra pendiente con su movimiento.
//   4. RECLAMAR el movimiento en el banco y ACREDITAR el saldo.
// El sistema NUNCA rechaza solo: lo que no cuadra queda pendiente, con el
// motivo, para que lo decida una persona en el superadmin.
// ============================================================================

import {
  MAX_AUTO_USD,
  MINUTOS_ANTES_DE_REVISION,
  VALIDACION_ACTIVA,
  VENTANA_ANTES_MS,
  VENTANA_DESPUES_MS,
  cola6,
  emparejar,
  sigueAutomatica,
  tolerancia,
  type CompraPendiente,
  type Revision,
} from './reglas';

export * from './reglas';

type Service = ReturnType<typeof createServiceClient>;

/** Solo las compras de la última media hora justifican entrar al banco. */
const LATIDO_SI_MENOS_DE_MS = 30 * 60 * 1000;
/** Entre dos entradas nuestras al banco (la cuenta la comparte La Mejor Llave). */
const SEGUNDOS_ENTRE_LATIDOS = 120;
const bs = (n: number) =>
  `Bs. ${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const COLUMNAS =
  'id, workshop_id, reference, amount_usd, amount_ves, exchange_rate, ocr_amount, created_at, revision, bank_note, check_count';

/** Movimientos que ya pagaron una compra nuestra (registro propio, sin depender del banco). */
async function movimientosTomados(service: Service): Promise<Set<number>> {
  const ids = new Set<number>();
  const { data } = await service
    .from('balance_purchases')
    .select('bank_tx_id')
    .eq('status', 'aprobado')
    .not('bank_tx_id', 'is', null)
    .gte('created_at', new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString())
    .limit(1000);
  for (const f of (data ?? []) as { bank_tx_id: number | string }[]) ids.add(Number(f.bank_tx_id));
  return ids;
}

export interface InformePasada {
  ok: boolean;
  motivo?: string;
  latido?: Latido | 'no_hizo_falta' | 'turno_ocupado';
  cola_al_dia?: string | null;
  movimientos?: number;
  pendientes: number;
  aprobadas: number;
  detalle: { compra: string; estado: string; nota?: string }[];
}

export interface OpcionesPasada {
  origen: 'cron' | 'taller' | 'superadmin';
  /** Solo las compras de este taller (la pantalla del taller). */
  taller?: string;
  /** Solo esta compra, aunque esté marcada para revisión (botón «Revalidar»). */
  compra?: string;
}

/** La pasada completa. Nunca lanza: ante un problema todo queda pendiente. */
export async function conciliar(op: OpcionesPasada): Promise<InformePasada> {
  const t0 = Date.now();
  const informe: InformePasada = await pasada(op).catch((e) => ({
    ok: false,
    motivo: e instanceof Error ? e.message : 'error',
    pendientes: 0,
    aprobadas: 0,
    detalle: [],
  }));
  // El diario guarda las pasadas del cron y del superadmin, y las del taller
  // solo si entraron al banco o aprobaron algo (si no, serían cientos de filas).
  const vale =
    op.origen !== 'taller' || informe.aprobadas > 0 || (informe.latido && !['no_hizo_falta', 'turno_ocupado'].includes(informe.latido));
  if (vale && (informe.pendientes > 0 || op.origen !== 'cron' || !informe.ok)) {
    try {
      const service = createServiceClient();
      await service.from('pagos_pasadas').insert({
        origen: op.origen,
        ok: informe.ok,
        motivo: informe.motivo ?? null,
        latido: informe.latido ?? null,
        cola_al_dia: informe.cola_al_dia ?? null,
        pendientes: informe.pendientes,
        aprobadas: informe.aprobadas,
        ms: Date.now() - t0,
      });
      if (new Date().getUTCMinutes() === 7) {
        await service.from('pagos_pasadas').delete().lt('created_at', new Date(Date.now() - 7 * 864e5).toISOString());
      }
    } catch {}
  }
  return informe;
}

async function pasada(op: OpcionesPasada): Promise<InformePasada> {
  const vacio = { pendientes: 0, aprobadas: 0, detalle: [] };
  if (!VALIDACION_ACTIVA) return { ok: false, motivo: 'validación automática apagada', ...vacio };
  if (!bancoConfigurado()) return { ok: false, motivo: 'Bank API no configurada', ...vacio };

  const service = createServiceClient();
  let q = service.from('balance_purchases').select(COLUMNAS).eq('status', 'pendiente');
  if (op.compra) q = q.eq('id', op.compra);
  else q = q.gte('created_at', new Date(Date.now() - VENTANA_ANTES_MS).toISOString());
  if (op.taller) q = q.eq('workshop_id', op.taller);
  const { data } = await q.order('created_at', { ascending: true }).limit(60);
  const pendientes = ((data ?? []) as CompraPendiente[]).filter((c) => op.compra || sigueAutomatica(c.revision));
  if (!pendientes.length) return { ok: true, latido: 'no_hizo_falta', ...vacio };

  let movs = await leerEstadoDeCuenta(200);

  // Latido: solo si algún pago reciente todavía no está en la cola, y solo si
  // nadie de Formula Taller entró al banco hace poco. Así no le quitamos el
  // turno a La Mejor Llave, que comparte la cuenta (el banco responde 429 si
  // se entra seguido).
  const falta = pendientes.some(
    (c) =>
      cola6(c.reference).length === 6 &&
      (op.compra || Date.now() - Date.parse(c.created_at) < LATIDO_SI_MENOS_DE_MS) &&
      !movs.some((m) => String(m.referencia).endsWith(cola6(c.reference)))
  );
  let latido: InformePasada['latido'] = 'no_hizo_falta';
  if (falta) {
    const { data: turno } = await service.rpc('tomar_turno_banco', {
      p_segundos: op.origen === 'taller' ? SEGUNDOS_ENTRE_LATIDOS : 60,
    });
    if (turno === true) {
      latido = await refrescarEstadoDeCuenta(referenciaImposible(movs));
      movs = await leerEstadoDeCuenta(200);
    } else {
      latido = 'turno_ocupado';
    }
  }

  const tomados = await movimientosTomados(service);
  const detalle: InformePasada['detalle'] = [];
  let aprobadas = 0;

  for (const c of pendientes) {
    await service
      .from('balance_purchases')
      .update({ last_checked_at: new Date().toISOString(), check_count: (c.check_count ?? 0) + 1 })
      .eq('id', c.id);

    const r = emparejar(c, movs, tomados);

    if (r.estado === 'no_encontrado' || r.estado === 'sin_referencia') {
      const esperandoDeMas = Date.now() - Date.parse(c.created_at) > MINUTOS_ANTES_DE_REVISION * 60_000;
      if (esperandoDeMas && c.revision !== 'no_aparece' && c.revision !== 'fuera_de_ventana') {
        // ¿Existe el pago pero con una fecha lejana? (pagó hace días y avisó hoy)
        const viejo = cola6(c.reference).length === 6
          ? (await buscarPorReferencia(cola6(c.reference))).find(
              (m) => m.tipo === 'CREDITO' && String(m.referencia).endsWith(cola6(c.reference))
            )
          : undefined;
        await marcar(service, c, viejo ? 'fuera_de_ventana' : 'no_aparece',
          viejo
            ? `Hay un pago con esa referencia (${bs(viejo.monto)}, del ${diaCaracas(viejo.fecha)}${viejo.used ? ', ya usado' : ''}) fuera de la ventana de 24 h. Verificar el comprobante antes de acreditar.`
            : r.estado === 'sin_referencia'
              ? 'La referencia tiene menos de 6 dígitos: no se puede buscar en el banco.'
              : `Sin rastro en el banco tras ${MINUTOS_ANTES_DE_REVISION} min. Se sigue buscando solo durante 24 h.`,
          viejo);
      }
      detalle.push({ compra: c.id, estado: r.estado });
      continue;
    }

    if (r.estado === 'revision') {
      await marcar(service, c, r.revision, r.detalle, r.movimiento);
      detalle.push({ compra: c.id, estado: r.revision });
      continue;
    }

    if (r.acreditar > MAX_AUTO_USD) {
      await marcar(service, c, 'monto_alto',
        `El banco confirma ${bs(r.movimiento.monto)} ($${r.acreditar.toFixed(2)}). Por encima de $${MAX_AUTO_USD} se aprueba a mano.`,
        r.movimiento);
      detalle.push({ compra: c.id, estado: 'monto_alto' });
      continue;
    }

    tomados.add(r.movimiento.id);
    // Reclamar primero: si falla, no se acredita nada y se reintenta luego.
    if (!(await reclamarMovimiento(r.movimiento))) {
      await service
        .from('balance_purchases')
        .update({ bank_note: 'Pago encontrado; el banco no respondió al marcarlo como usado. Se reintenta solo.' })
        .eq('id', c.id)
        .eq('status', 'pendiente');
      detalle.push({ compra: c.id, estado: 'no_reclamado' });
      continue;
    }

    const { error } = await service.rpc('aprobar_recarga', {
      p_purchase: c.id,
      p_admin: null,
      p_monto: r.acreditar,
      p_origen: 'auto',
      p_bank: r.movimiento as unknown as Record<string, unknown>,
    });
    if (error) {
      console.error('[pagos] aprobar_recarga tras reclamar', c.id, error.message);
      await marcar(service, c, 'reclamo',
        `Pago verificado y marcado como usado en el banco (ref ${r.movimiento.referencia}, ${bs(r.movimiento.monto)}), pero falló la acreditación: ${error.message}`,
        r.movimiento);
      detalle.push({ compra: c.id, estado: 'reclamado_sin_acreditar' });
      continue;
    }
    if (r.detalle) {
      await service.from('balance_purchases').update({ bank_note: r.detalle }).eq('id', c.id);
    }
    aprobadas++;
    detalle.push({ compra: c.id, estado: 'aprobada', nota: `$${r.acreditar.toFixed(2)}` });
  }

  return {
    ok: true,
    latido,
    cola_al_dia: movs.map((m) => m.scrapedAt ?? '').sort().at(-1) || null,
    movimientos: movs.length,
    pendientes: pendientes.length,
    aprobadas,
    detalle,
  };
}

/** Deja la compra en «Por revisar» con su motivo, solo si sigue pendiente. */
async function marcar(service: Service, c: CompraPendiente, revision: Revision, nota: string, mov?: Movimiento) {
  if (c.revision === revision && c.bank_note === nota) return;
  await service
    .from('balance_purchases')
    .update({ revision, bank_note: nota, ...(mov ? { bank_response: mov } : {}) })
    .eq('id', c.id)
    .eq('status', 'pendiente');
}

/**
 * Al aprobar A MANO también se marca el pago como usado en el banco, para que
 * ni esta app ni La Mejor Llave lo vuelvan a tomar. Aquí NO se exige que el
 * monto cuadre (quien aprueba ya lo decidió): la identidad es la referencia.
 * Nunca bloquea: si no se puede, se aprueba igual y se deja constancia.
 */
export async function reclamarPagoManual(
  c: Pick<CompraPendiente, 'reference' | 'created_at' | 'amount_ves'>
): Promise<{ estado: 'reclamado'; movimiento: Movimiento } | { estado: 'ninguno' | 'varios' | 'fallo' | 'apagado' }> {
  if (!VALIDACION_ACTIVA || !bancoConfigurado()) return { estado: 'apagado' };
  const cola = cola6(c.reference);
  if (cola.length < 6) return { estado: 'ninguno' };
  const service = createServiceClient();
  const [movs, tomados] = await Promise.all([leerEstadoDeCuenta(200), movimientosTomados(service)]);
  const t = Date.parse(c.created_at);
  let cand = movs.filter((m) => {
    if (m.used || tomados.has(m.id) || m.tipo !== 'CREDITO' || !String(m.referencia).endsWith(cola)) return false;
    const tm = Date.parse(m.fecha);
    return Number.isFinite(tm) && tm >= t - VENTANA_ANTES_MS && tm <= t + VENTANA_DESPUES_MS;
  });
  if (cand.length > 1 && c.amount_ves !== null) {
    const e = Number(c.amount_ves);
    const ex = cand.filter((m) => Math.abs(m.monto - e) <= tolerancia(e));
    if (ex.length === 1) cand = ex;
  }
  if (!cand.length) return { estado: 'ninguno' };
  if (cand.length > 1) return { estado: 'varios' };
  return (await reclamarMovimiento(cand[0])) ? { estado: 'reclamado', movimiento: cand[0] } : { estado: 'fallo' };
}

/** Semáforo para el superadmin: cómo van las pasadas y lo fresco del estado de cuenta. */
export async function saludValidacion(service: Service) {
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [{ data: ultimas }, { count: auto24 }, { count: manual24 }] = await Promise.all([
    service.from('pagos_pasadas').select('created_at, origen, ok, motivo, latido, cola_al_dia').order('created_at', { ascending: false }).limit(30),
    service.from('balance_purchases').select('id', { count: 'exact', head: true }).eq('approved_origin', 'auto').gte('reviewed_at', desde),
    service.from('balance_purchases').select('id', { count: 'exact', head: true }).eq('approved_origin', 'manual').gte('reviewed_at', desde),
  ]);
  const filas = (ultimas ?? []) as { created_at: string; origen: string; ok: boolean; motivo: string | null; latido: string | null; cola_al_dia: string | null }[];
  const cron = filas.find((f) => f.origen === 'cron') ?? null;
  const cola = filas.map((f) => f.cola_al_dia ?? '').sort().at(-1) || null;
  return {
    activa: VALIDACION_ACTIVA && bancoConfigurado(),
    motivo: !VALIDACION_ACTIVA ? 'Apagada (PAGOS_VALIDACION_AUTOMATICA=false)' : !bancoConfigurado() ? 'Faltan BANK_API_URL / BANK_API_TOKEN en Vercel' : null,
    ultima: filas[0] ?? null,
    ultimo_cron: cron?.created_at ?? null,
    cola_al_dia: cola,
    aprobadas_auto_24h: auto24 ?? 0,
    aprobadas_manual_24h: manual24 ?? 0,
    max_auto_usd: MAX_AUTO_USD,
  };
}
