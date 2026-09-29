import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { limpiarCorreo, revisarClaveNueva } from '@/lib/recuperar';
import { apuntarIntento, gastarPermiso, ipDe } from '@/lib/recuperar-servidor';

export const dynamic = 'force-dynamic';

// POST /api/auth/recuperar/clave — paso 2: poner la contraseña nueva.
//
// Solo se llega con el permiso del paso 1, que vale una vez y caduca a los 10
// minutos. El cambio lo hace el servidor con la clave de servicio, que es la
// única forma de cambiársela a alguien que no puede iniciar sesión. Al
// cambiarla, las sesiones abiertas dejan de renovarse: si alguien había
// entrado a la cuenta, se queda fuera.
export async function POST(req: Request) {
  try {
    const service = createServiceClient();
    const body = await req.json().catch(() => ({}));
    const clave = String(body.clave ?? '');
    const repetida = String(body.repetida ?? '');

    // Primero la contraseña y después se gasta el permiso: si la escribió mal,
    // no pierde el permiso por eso.
    const revision = revisarClaveNueva(clave, repetida);
    if (!revision.ok) {
      return NextResponse.json({ error: revision.error }, { status: 400 });
    }

    const permiso = await gastarPermiso(service, String(body.permiso ?? ''));
    if (!permiso) {
      return NextResponse.json(
        { error: 'Este permiso ya se usó o pasaron más de 10 minutos. Vuelve a empezar con tus datos.' },
        { status: 401 }
      );
    }

    const { error } = await service.auth.admin.updateUserById(permiso.userId, { password: clave });
    if (error) {
      const msg = /password/i.test(error.message)
        ? 'Esa contraseña no es válida. Prueba con otra.'
        : 'No se pudo cambiar la contraseña. Vuelve a intentarlo.';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    await apuntarIntento(service, {
      email: limpiarCorreo(String(body.correo ?? '')),
      userId: permiso.userId,
      ip: ipDe(req),
      resultado: 'cambiada',
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
