import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { hoyVE } from '@/lib/recordatorios';
import { HORAS_CITA, formatCita, horaVE } from '@/lib/presupuestos';
import { leerPresupuestoPublico, ocupadoDelDia } from '@/lib/presupuesto-publico';

type Params = { params: { token: string } };

export const dynamic = 'force-dynamic';

// Freno contra abuso: el enlace es público (basta el token). Una persona real
// no pasa de unas pocas respuestas por minuto.
const MAX_POR_MINUTO = 20;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/tracking/presupuesto/:token?dia=AAAA-MM-DD — lo que el taller marcó
// ocupado ese día, para que el cliente no elija esas horas.
export async function GET(req: Request, { params }: Params) {
  const dia = new URL(req.url).searchParams.get('dia') ?? '';
  if (!FECHA.test(dia)) return NextResponse.json({ error: 'Día inválido' }, { status: 400 });
  const service = createServiceClient();
  const p = await leerPresupuestoPublico(service, params.token);
  if (!p) return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 });
  return NextResponse.json(await ocupadoDelDia(service, p.interno.workshop_id, dia));
}

// POST /api/tracking/presupuesto/:token — el cliente responde.
// Cuerpo (todo opcional, al menos uno; «Aceptar todo» manda varios juntos):
//   presupuesto: 'aprobado' | 'rechazado'
//   cita: 'confirmada' | 'rechazada'          (la cita que puso el taller)
//   elegir: { day, at_time }                   (si el taller lo dejó elegir)
export async function POST(req: Request, { params }: Params) {
  const body = (await req.json().catch(() => null)) as {
    presupuesto?: string;
    cita?: string;
    elegir?: { day?: string; at_time?: string };
  } | null;
  const presupuesto = body?.presupuesto;
  const respCita = body?.cita;
  const elegir = body?.elegir;
  if (presupuesto !== undefined && presupuesto !== 'aprobado' && presupuesto !== 'rechazado') {
    return NextResponse.json({ error: 'Respuesta inválida' }, { status: 400 });
  }
  if (respCita !== undefined && respCita !== 'confirmada' && respCita !== 'rechazada') {
    return NextResponse.json({ error: 'Respuesta inválida' }, { status: 400 });
  }
  if (!presupuesto && !respCita && !elegir) {
    return NextResponse.json({ error: 'No hay nada que guardar' }, { status: 400 });
  }

  const service = createServiceClient();
  const p = await leerPresupuestoPublico(service, params.token);
  if (!p) return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 });
  const { publico, interno } = p;
  if (interno.order_id) {
    return NextResponse.json(
      { error: 'Tu carro ya está en el taller: este presupuesto ya no se puede cambiar.' },
      { status: 409 }
    );
  }

  const haceUnMinuto = new Date(Date.now() - 60_000).toISOString();
  const { count } = await service
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('quote_id', interno.id)
    .gte('created_at', haceUnMinuto);
  if ((count ?? 0) >= MAX_POR_MINUTO) {
    return NextResponse.json({ error: 'Espera un momento antes de seguir.' }, { status: 429 });
  }

  // Se valida todo antes de guardar nada.
  let nuevaCita: { day: string; at_time: string } | null = null;
  if (elegir) {
    if (!publico.client_picks_date) {
      return NextResponse.json({ error: 'El taller ya te asignó la cita.' }, { status: 409 });
    }
    const day = String(elegir.day ?? '');
    const at_time = String(elegir.at_time ?? '').slice(0, 5);
    if (!FECHA.test(day) || day < hoyVE()) return NextResponse.json({ error: 'Elige un día desde hoy en adelante.' }, { status: 400 });
    if (!HORAS_CITA.includes(at_time)) return NextResponse.json({ error: 'Elige la hora de tu cita.' }, { status: 400 });
    if (day === hoyVE() && at_time.slice(0, 2) <= horaVE()) {
      return NextResponse.json({ error: 'Esa hora ya pasó. Elige otra.' }, { status: 400 });
    }
    const ocupado = await ocupadoDelDia(service, interno.workshop_id, day);
    if (ocupado.todo || ocupado.horas.includes(at_time)) {
      return NextResponse.json({ error: 'El taller no atiende a esa hora. Elige otra.' }, { status: 409 });
    }
    if (!interno.client_id) return NextResponse.json({ error: 'No se pudo agendar la cita.' }, { status: 500 });
    nuevaCita = { day, at_time };
  }
  if (respCita && !interno.citaId) {
    return NextResponse.json({ error: 'Este presupuesto no tiene cita.' }, { status: 409 });
  }

  const hechos: string[] = [];
  const ahora = new Date().toISOString();

  if (presupuesto && presupuesto !== publico.client_decision) {
    const { error } = await service
      .from('quotes')
      .update({ client_decision: presupuesto, decided_at: ahora })
      .eq('id', interno.id);
    if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 });
    hechos.push(presupuesto === 'aprobado' ? 'aprobó el presupuesto' : 'rechazó el presupuesto');
  }

  if (nuevaCita) {
    const igual = publico.cita && publico.cita.day === nuevaCita.day && publico.cita.at_time === nuevaCita.at_time;
    if (!igual) {
      await service.from('appointments').delete().eq('quote_id', interno.id).eq('kind', 'cita');
      const { error } = await service.from('appointments').insert({
        workshop_id: interno.workshop_id,
        kind: 'cita',
        client_id: interno.client_id,
        quote_id: interno.id,
        day: nuevaCita.day,
        at_time: nuevaCita.at_time,
        status: 'confirmada',
        chosen_by_client: true,
      });
      if (error) return NextResponse.json({ error: 'No se pudo agendar la cita' }, { status: 500 });
      hechos.push(`${publico.cita ? 'cambió su cita para' : 'agendó su cita para'} el ${formatCita(nuevaCita.day, nuevaCita.at_time)}`);
    }
  } else if (respCita && publico.cita && respCita !== publico.cita.status) {
    const { error } = await service.from('appointments').update({ status: respCita }).eq('id', interno.citaId as string);
    if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 });
    hechos.push(
      `${respCita === 'confirmada' ? 'confirmó' : 'rechazó'} la cita del ${formatCita(publico.cita.day, publico.cita.at_time)}`
    );
  }

  if (hechos.length > 0) {
    const cliente = `${publico.client_first_name} ${publico.client_last_name}`.trim() || 'El cliente';
    const ultimo = hechos.pop() as string;
    const texto = hechos.length > 0 ? `${hechos.join(', ')} y ${ultimo}` : ultimo;
    await service.from('notifications').insert({
      workshop_id: interno.workshop_id,
      quote_id: interno.id,
      kind: 'presupuesto',
      message: `${cliente} ${texto}${publico.car_model ? ` (${publico.car_model})` : ''}.`.replace(/\.\.$/, '.'),
    });
  }

  const despues = await leerPresupuestoPublico(service, params.token);
  return NextResponse.json(despues?.publico ?? publico);
}
