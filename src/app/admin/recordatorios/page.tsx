import { createServiceClient } from '@/lib/supabase/server';
import { getCaller } from '@/lib/api-auth';
import { firmarArchivos } from '@/lib/admin-taller';
import { REMINDER_SELECT } from '@/lib/recordatorios-servidor';
import { hoyVE } from '@/lib/recordatorios';
import type { Reminder } from '@/lib/types';
import { CITA_SELECT, normalizarCita } from '@/lib/presupuestos-servidor';
import type { Cita } from '@/lib/presupuestos';
import CalendarioClient from './CalendarioClient';

export const dynamic = 'force-dynamic';

export default async function RecordatoriosPage() {
  const caller = await getCaller();
  const wid = caller?.workshopId ?? '';
  const service = createServiceClient();

  // El mes actual viene con la página: el calendario abre ya con sus puntos,
  // sin esperar a que el teléfono lo pida después.
  const mes = hoyVE().slice(0, 7);
  const [y, m] = mes.split('-').map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const [{ data }, { data: recs }, { data: citas }] = await Promise.all([
    service.from('workshops').select('name').eq('id', wid).maybeSingle(),
    service
      .from('reminders')
      .select(REMINDER_SELECT)
      .eq('workshop_id', wid)
      .gte('due_date', `${mes}-01`)
      .lte('due_date', `${mes}-${String(ultimo).padStart(2, '0')}`)
      .order('due_date', { ascending: true })
      .limit(1000),
    // Citas y horarios ocupados (0028). Sin la tabla, llega vacío.
    service
      .from('appointments')
      .select(CITA_SELECT)
      .eq('workshop_id', wid)
      .gte('day', `${mes}-01`)
      .lte('day', `${mes}-${String(ultimo).padStart(2, '0')}`)
      .order('day', { ascending: true })
      .order('at_time', { ascending: true, nullsFirst: true })
      .limit(1000),
  ]);
  const workshopName = (data as unknown as { name: string } | null)?.name ?? 'el taller';
  const lista = await firmarArchivos(service, (recs ?? []) as unknown as Reminder[]);
  return (
    <CalendarioClient
      workshopName={workshopName}
      iniciales={{ mes, lista }}
      citasIniciales={{ mes, lista: ((citas ?? []) as unknown as Cita[]).map(normalizarCita) }}
    />
  );
}
