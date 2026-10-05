import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { carpetaRecordatorios } from '@/lib/admin-taller';
import { NOTIFY_OFFSETS } from '@/lib/recordatorios';
import type { NotifyOffset, ReminderStatus } from '@/lib/types';

export const REMINDER_SELECT = `
  id, workshop_id, client_id, order_id, title, body, audio_path, transcript, image_path,
  tag_id, due_date, notify_offset, notify_on, status, sent_at, created_at,
  client:clients(id, first_name, last_name, whatsapp),
  tag:reminder_tags(id, label, color)
`;

type Service = ReturnType<typeof createServiceClient>;

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const ESTADOS: ReminderStatus[] = ['pendiente', 'enviado', 'hecho'];

/**
 * Valida y limpia el cuerpo de un recordatorio. `parcial` = PATCH (solo lo que
 * venga). Todo lo que apunte a otra fila (cliente, orden, etiqueta, archivos)
 * se comprueba contra el taller de quien llama: un id ajeno se rechaza.
 */
export async function limpiarRecordatorio(
  service: Service,
  workshopId: string,
  body: Record<string, unknown>,
  parcial: boolean
): Promise<{ datos: Record<string, unknown>; error?: string }> {
  const datos: Record<string, unknown> = {};
  const viene = (k: string) => k in body && body[k] !== undefined;

  if (!parcial || viene('title')) {
    const t = String(body.title ?? '').trim().slice(0, 120);
    if (!t) return { datos, error: 'Escribe un título para el recordatorio.' };
    datos.title = t;
  }
  if (viene('body')) datos.body = String(body.body ?? '').trim().slice(0, 2000) || null;
  if (viene('transcript')) datos.transcript = String(body.transcript ?? '').trim().slice(0, 5000) || null;

  if (!parcial || viene('due_date')) {
    const d = String(body.due_date ?? '');
    if (!FECHA.test(d) || Number.isNaN(Date.parse(d))) return { datos, error: 'Elige la fecha del recordatorio.' };
    datos.due_date = d;
  }
  if (!parcial || viene('notify_offset')) {
    const o = String(body.notify_offset ?? 'mismo_dia') as NotifyOffset;
    if (!NOTIFY_OFFSETS.some((x) => x.value === o)) return { datos, error: 'Aviso inválido.' };
    datos.notify_offset = o;
  }
  if (viene('status')) {
    const s = String(body.status) as ReminderStatus;
    if (!ESTADOS.includes(s)) return { datos, error: 'Estado inválido.' };
    datos.status = s;
    datos.sent_at = s === 'enviado' ? new Date().toISOString() : s === 'pendiente' ? null : undefined;
    if (datos.sent_at === undefined) delete datos.sent_at;
  }

  for (const k of ['audio_path', 'image_path'] as const) {
    if (!viene(k)) continue;
    const p = body[k];
    if (p === null || p === '') datos[k] = null;
    else if (typeof p === 'string' && p.startsWith(carpetaRecordatorios(workshopId)) && !p.includes('..')) datos[k] = p;
    else return { datos, error: 'Archivo inválido.' };
  }

  if (!parcial || viene('client_id')) {
    const { data } = await service
      .from('clients')
      .select('id')
      .eq('id', String(body.client_id ?? ''))
      .eq('workshop_id', workshopId)
      .maybeSingle();
    if (!data) return { datos, error: 'Cliente no encontrado.' };
    datos.client_id = (data as unknown as { id: string }).id;
  }

  if (viene('order_id')) {
    if (body.order_id === null || body.order_id === '') datos.order_id = null;
    else {
      const { data } = await service
        .from('orders')
        .select('id')
        .eq('id', String(body.order_id))
        .eq('workshop_id', workshopId)
        .maybeSingle();
      if (!data) return { datos, error: 'Orden no encontrada.' };
      datos.order_id = (data as unknown as { id: string }).id;
    }
  }

  if (viene('tag_id')) {
    if (body.tag_id === null || body.tag_id === '') datos.tag_id = null;
    else {
      const { data } = await service
        .from('reminder_tags')
        .select('id, workshop_id')
        .eq('id', String(body.tag_id))
        .maybeSingle();
      const tag = data as unknown as { id: string; workshop_id: string | null } | null;
      if (!tag || (tag.workshop_id !== null && tag.workshop_id !== workshopId)) {
        return { datos, error: 'Etiqueta no encontrada.' };
      }
      datos.tag_id = tag.id;
    }
  }

  return { datos };
}
