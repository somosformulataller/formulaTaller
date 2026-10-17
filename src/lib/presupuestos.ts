import { formatUsd } from '@/lib/budget';
import { formatDia } from '@/lib/recordatorios';
import { saludoTaller } from '@/lib/utils';

// ============================================================================
// Presupuestos sueltos y citas (0028) — tipos y helpers del navegador y el
// servidor.
// ============================================================================

export interface QuoteItem {
  description: string;
  amount: number;
  labor_amount: number;
}

export type TipoCita = 'cita' | 'ocupado';

/** Respuesta del cliente al presupuesto (0030). */
export type DecisionQuote = 'pendiente' | 'aprobado' | 'rechazado';
/** Respuesta del cliente a la cita (0030). */
export type EstadoCita = 'pendiente' | 'confirmada' | 'rechazada';

export interface Cita {
  id: string;
  workshop_id: string;
  kind: TipoCita;
  client_id: string | null;
  quote_id: string | null;
  order_id: string | null;
  /** AAAA-MM-DD */
  day: string;
  /** HH:MM, o null = sin hora (cita) / todo el día (ocupado). */
  at_time: string | null;
  note: string | null;
  status: EstadoCita;
  /** La eligió el cliente en el enlace del presupuesto. */
  chosen_by_client: boolean;
  created_at: string;
  client?: { first_name: string; last_name: string; whatsapp: string } | null;
}

export interface Quote {
  id: string;
  workshop_id: string;
  client_id: string | null;
  client_first_name: string;
  client_last_name: string;
  client_whatsapp: string;
  car_model: string;
  items: QuoteItem[];
  labor_general_usd: number;
  order_id: string | null;
  linked_at: string | null;
  sent_at: string | null;
  /** Enlace público /tracking/presupuesto/<public_token> (0030). */
  public_token: string;
  /** El cliente elige el día y la hora de la cita en el enlace. */
  client_picks_date: boolean;
  client_decision: DecisionQuote;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
  /** La cita agendada con el presupuesto, si hay. */
  cita?: Cita | null;
}

/** Horas que se ofrecen para una cita (sin duración: solo la hora de llegada). */
export const HORAS_CITA = Array.from({ length: 13 }, (_, i) => `${String(i + 7).padStart(2, '0')}:00`);

/** «09:00» → «9:00 a. m.» */
export function formatHora(hhmm: string | null | undefined): string {
  if (!hhmm) return '';
  const [h, m] = hhmm.slice(0, 5).split(':').map(Number);
  const sufijo = h < 12 ? 'a. m.' : 'p. m.';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${sufijo}`;
}

/** «jue, 23 oct a las 9:00 a. m.» */
export function formatCita(day: string, hora: string | null | undefined): string {
  const fecha = formatDia(day, false);
  return hora ? `${fecha} a las ${formatHora(hora)}` : fecha;
}

/** Hora (HH) de una cita, para comparar con los horarios ocupados. */
export function horaDe(hhmm: string | null | undefined): string | null {
  return hhmm ? hhmm.slice(0, 2) : null;
}

/** ¿El taller marcó ocupado ese día (completo) o esa hora? */
export function estaOcupado(citas: Cita[], day: string, hora: string | null): boolean {
  return citas.some(
    (c) => c.kind === 'ocupado' && c.day === day && (c.at_time === null || (hora !== null && horaDe(c.at_time) === horaDe(hora)))
  );
}

export function totalQuote(items: QuoteItem[], manoGeneral: number): number {
  return (
    items.reduce((acc, i) => acc + Math.round(Number(i.amount || 0) * 100) + Math.round(Number(i.labor_amount || 0) * 100), 0) +
    Math.round(Number(manoGeneral || 0) * 100)
  ) / 100;
}

/** Enlace público del presupuesto para el cliente. */
export function enlacePresupuesto(siteUrl: string, token: string): string {
  return `${siteUrl}/tracking/presupuesto/${token}`;
}

/**
 * Mensaje de WhatsApp con el presupuesto (y la cita, si hay) para el cliente,
 * con el enlace donde lo aprueba y elige o confirma la cita.
 */
export function buildQuoteMessage(opts: {
  nombre: string;
  carro: string;
  items: QuoteItem[];
  manoGeneral: number;
  taller?: string;
  cita?: { day: string; at_time: string | null; confirmada?: boolean } | null;
  /** Enlace público del presupuesto. */
  enlace?: string;
  /** El cliente elige el día de la cita en el enlace. */
  eligeCliente?: boolean;
}): string {
  const lineas = opts.items.map(
    (i) => `• ${i.description || 'Servicio'}: ${formatUsd((Math.round(i.amount * 100) + Math.round(i.labor_amount * 100)) / 100)}`
  );
  if (opts.manoGeneral > 0) lineas.push(`• Mano de obra: ${formatUsd(opts.manoGeneral)}`);
  const carro = opts.carro.trim() ? `tu ${opts.carro.trim()}` : 'tu carro';
  const partes = [`${saludoTaller(opts.nombre, opts.taller)} ¿Cómo estás? Te paso el presupuesto para ${carro}:`];
  if (lineas.length > 0) {
    partes.push(lineas.join('\n'), `Total: ${formatUsd(totalQuote(opts.items, opts.manoGeneral))}`);
  }
  if (opts.cita && !opts.eligeCliente) {
    const cuando = formatCita(opts.cita.day, opts.cita.at_time);
    partes.push(conPunto(opts.cita.confirmada ? `Tu cita quedó agendada para el ${cuando}` : `Te propongo la cita en el taller para el ${cuando}`));
  }
  if (opts.enlace) {
    const que = opts.eligeCliente
      ? 'aprobarlo y escoger el día y la hora en que puedes traer el carro'
      : opts.cita && !opts.cita.confirmada
      ? 'aprobarlo y confirmar la cita'
      : 'aprobarlo o rechazarlo';
    partes.push(`Aquí puedes ver el detalle, ${que}:
${opts.enlace}`);
  }
  partes.push('Cualquier duda me escribes y te explico con gusto.');
  return partes.join('\n\n');
}

/** Termina la frase en punto sin duplicarlo («9:00 a. m.» ya lo trae). */
export function conPunto(s: string): string {
  return s.endsWith('.') ? s : `${s}.`;
}

/** Hora actual en Venezuela, «HH». */
export function horaVE(): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Caracas', hour: '2-digit', hourCycle: 'h23' }).format(new Date());
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

/** Mensaje de WhatsApp de un presupuesto ya guardado, con su enlace. */
export function mensajeQuote(q: Quote, taller: string): string {
  return buildQuoteMessage({
    nombre: q.client_first_name,
    carro: q.car_model,
    items: q.items,
    manoGeneral: Number(q.labor_general_usd) || 0,
    taller,
    cita: q.cita ? { day: q.cita.day, at_time: q.cita.at_time, confirmada: q.cita.status === 'confirmada' } : null,
    enlace: q.public_token ? enlacePresupuesto(SITE_URL, q.public_token) : undefined,
    eligeCliente: q.client_picks_date && !q.cita,
  });
}

/** Lo que respondió el cliente en el enlace, para mostrarlo al taller. */
export function respuestaCliente(q: Quote): { texto: string; color: string }[] {
  const r: { texto: string; color: string }[] = [];
  if (q.client_decision === 'aprobado') r.push({ texto: 'Presupuesto aprobado', color: '#34d399' });
  else if (q.client_decision === 'rechazado') r.push({ texto: 'Presupuesto rechazado', color: '#f87171' });
  if (q.cita?.status === 'confirmada') {
    r.push({ texto: q.cita.chosen_by_client ? 'Cita elegida por el cliente' : 'Cita confirmada', color: '#34d399' });
  } else if (q.cita?.status === 'rechazada') r.push({ texto: 'Cita rechazada', color: '#f87171' });
  else if (q.client_picks_date && !q.cita) r.push({ texto: 'El cliente elige la cita', color: '#fbbf24' });
  return r;
}
