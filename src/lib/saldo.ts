import type { createServiceClient } from '@/lib/supabase/server';

// ============================================================================
// Saldo prepagado (0025) — lo que usan las API del servidor.
// El saldo SOLO se mueve con la función mover_saldo de la base, que es
// atómica y nunca lo deja en negativo.
// ============================================================================

type Service = ReturnType<typeof createServiceClient>;

export interface Precios {
  orden: number;
  preguntaIa: number;
}

export interface PagoMovil {
  bank: string | null;
  phone: string | null;
  document: string | null;
  holder: string | null;
}

export type MotivoCobro = 'orden' | 'pregunta_ia';

/** Compra mínima y máxima en USD. */
export const COMPRA_MIN_USD = 1;
export const COMPRA_MAX_USD = 1000;
/** Comprobante: imagen de hasta 4 MB (llega comprimida desde el navegador). */
export const COMPROBANTE_MAX_BYTES = 4 * 1024 * 1024;

export const MENSAJE_SIN_SALDO: Record<MotivoCobro, string> = {
  orden: 'No tienes saldo suficiente para crear la orden. Compra saldo para seguir usando la app.',
  pregunta_ia: 'No tienes saldo suficiente para preguntarle al asistente. Compra saldo para seguir usándolo.',
};

/** Carpeta del bucket privado donde viven los comprobantes de un taller. */
export function carpetaComprobantes(workshopId: string): string {
  return `pagos/${workshopId}/`;
}

export async function leerPrecios(service: Service): Promise<Precios> {
  const { data } = await service
    .from('platform_settings')
    .select('price_order_usd, price_ai_question_usd')
    .eq('id', 1)
    .maybeSingle();
  const d = data as unknown as { price_order_usd: number | string; price_ai_question_usd: number | string } | null;
  return {
    orden: Number(d?.price_order_usd ?? 0.2),
    preguntaIa: Number(d?.price_ai_question_usd ?? 0.035),
  };
}

/**
 * Descuenta `monto` del saldo del taller. Devuelve el saldo nuevo, o
 * `insuficiente` si no alcanza (en ese caso no se cobró nada).
 */
export async function cobrar(
  service: Service,
  workshopId: string,
  monto: number,
  motivo: MotivoCobro,
  opts: { userId?: string | null; note?: string | null } = {}
): Promise<{ ok: true; saldo: number } | { ok: false; insuficiente: boolean; error: string }> {
  if (monto <= 0) {
    const { data } = await service.from('workshops').select('balance_usd').eq('id', workshopId).single();
    return { ok: true, saldo: Number((data as unknown as { balance_usd: number } | null)?.balance_usd ?? 0) };
  }
  const { data, error } = await service.rpc('mover_saldo', {
    p_workshop: workshopId,
    p_monto: -monto,
    p_kind: motivo,
    p_note: opts.note ?? null,
    p_user: opts.userId ?? null,
  });
  if (error) {
    const insuficiente = error.message.includes('SALDO_INSUFICIENTE');
    if (!insuficiente) console.error('[saldo] cobrar', error.message);
    return { ok: false, insuficiente, error: insuficiente ? MENSAJE_SIN_SALDO[motivo] : 'No se pudo cobrar el saldo.' };
  }
  return { ok: true, saldo: Number(data) };
}

/** Devuelve un cobro cuando lo que se pagó no llegó a hacerse. */
export async function devolver(
  service: Service,
  workshopId: string,
  monto: number,
  note: string,
  userId?: string | null
): Promise<number | null> {
  if (monto <= 0) return null;
  const { data, error } = await service.rpc('mover_saldo', {
    p_workshop: workshopId,
    p_monto: monto,
    p_kind: 'reverso',
    p_note: note,
    p_user: userId ?? null,
  });
  if (error) {
    console.error('[saldo] devolver', error.message);
    return null;
  }
  return Number(data);
}

/** Redondea a centavos de dólar. */
export function centavos(n: number): number {
  return Math.round(n * 100) / 100;
}
