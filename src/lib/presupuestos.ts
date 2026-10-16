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

/**
 * Mensaje de WhatsApp con el presupuesto (y la cita, si hay) para el cliente.
 * No lleva enlace: el presupuesto suelto todavía no tiene seguimiento; el
 * cliente responde por el mismo chat.
 */
export function buildQuoteMessage(opts: {
  nombre: string;
  carro: string;
  items: QuoteItem[];
  manoGeneral: number;
  taller?: string;
  cita?: { day: string; at_time: string | null } | null;
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
  if (opts.cita) partes.push(conPunto(`Tu cita quedó agendada para el ${formatCita(opts.cita.day, opts.cita.at_time)}`));
  partes.push('Cualquier duda me escribes y te explico con gusto.');
  return partes.join('\n\n');
}

/** Termina la frase en punto sin duplicarlo («9:00 a. m.» ya lo trae). */
export function conPunto(s: string): string {
  return s.endsWith('.') ? s : `${s}.`;
}
