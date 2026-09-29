import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { esElDueno, faltaAlgo, limpiarCorreo, NO_CUADRA } from '@/lib/recuperar';
import {
  apuntarIntento,
  buscarPorCorreo,
  crearPermiso,
  estaFrenado,
  ipDe,
} from '@/lib/recuperar-servidor';

export const dynamic = 'force-dynamic';

// POST /api/auth/recuperar — paso 1 de recuperar la contraseña: «¿eres tú?».
//
// Recibe correo, WhatsApp y nombre del taller. Si los tres cuadran con una
// cuenta de ADMINISTRADOR de taller, devuelve un permiso de un solo uso para
// poner la contraseña nueva (paso 2). No manda ningún correo.
//
// Fuera de la respuesta buena, todas dicen exactamente lo mismo: no se
// distingue «ese correo no existe», «el WhatsApp no es ese» ni «es un
// mecánico». El motivo real queda en la bitácora (migración 0022).
//
// Los mecánicos no se recuperan por aquí: su administrador ya les puede
// cambiar la contraseña desde Mecánicos. Los superadmin tampoco: se cambian a
// mano desde Supabase.
export async function POST(req: Request) {
  try {
    const service = createServiceClient();
    const ip = ipDe(req);

    const body = await req.json().catch(() => ({}));
    const entrada = {
      correo: String(body.correo ?? ''),
      whatsapp: String(body.whatsapp ?? ''),
      taller: String(body.taller ?? ''),
    };
    const correo = limpiarCorreo(entrada.correo);

    // Un formulario a medias no gasta intentos ni ensucia la bitácora.
    if (faltaAlgo(entrada)) {
      return NextResponse.json(
        { error: 'Escribe tu correo, el WhatsApp y el nombre del taller para continuar.' },
        { status: 400 }
      );
    }

    if (await estaFrenado(service, correo, ip)) {
      await apuntarIntento(service, { email: correo, ip, resultado: 'frenado' });
      return NextResponse.json(
        { error: 'Demasiados intentos. Espera una hora y vuelve a probar, o escríbenos y te ayudamos.' },
        { status: 429 }
      );
    }

    const cuenta = await buscarPorCorreo(service, correo);
    if (!cuenta) {
      await apuntarIntento(service, { email: correo, ip, resultado: 'sin_cuenta' });
      return NextResponse.json({ error: NO_CUADRA }, { status: 401 });
    }

    const { data: superadmin } = await service
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', cuenta.id)
      .maybeSingle();

    const { data: perfil } = await service
      .from('profiles')
      .select('id, full_name, role, phone, active, workshop_id')
      .eq('id', cuenta.id)
      .maybeSingle();
    const p = perfil as {
      id: string;
      full_name: string | null;
      role: string;
      phone: string | null;
      active: boolean;
      workshop_id: string | null;
    } | null;

    if (superadmin || !p || p.role !== 'admin' || !p.workshop_id) {
      await apuntarIntento(service, { email: correo, userId: cuenta.id, ip, resultado: 'no_admin' });
      return NextResponse.json({ error: NO_CUADRA }, { status: 401 });
    }

    if (!p.active) {
      await apuntarIntento(service, { email: correo, userId: cuenta.id, ip, resultado: 'inactivo' });
      return NextResponse.json({ error: NO_CUADRA }, { status: 401 });
    }

    const { data: taller } = await service
      .from('workshops')
      .select('name, whatsapp')
      .eq('id', p.workshop_id)
      .maybeSingle();
    const t = taller as { name: string | null; whatsapp: string | null } | null;

    const cuadra = esElDueno(entrada, {
      telefono: p.phone,
      whatsappTaller: t?.whatsapp,
      nombreTaller: t?.name,
    });
    if (!cuadra) {
      await apuntarIntento(service, { email: correo, userId: cuenta.id, ip, resultado: 'no_coincide' });
      return NextResponse.json({ error: NO_CUADRA }, { status: 401 });
    }

    const permiso = await crearPermiso(service, cuenta.id, ip);
    if (!permiso) {
      return NextResponse.json(
        { error: 'No se pudo continuar. Vuelve a intentarlo en un momento.' },
        { status: 500 }
      );
    }
    await apuntarIntento(service, { email: correo, userId: cuenta.id, ip, resultado: 'verificado' });

    const nombre = p.full_name?.trim().split(/\s+/)[0] ?? null;
    return NextResponse.json({ ok: true, permiso, nombre });
  } catch {
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
