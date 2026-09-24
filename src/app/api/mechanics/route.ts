import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { CreateMechanicPayload, ProfileInsert } from '@/lib/types';
import { listMechanicsWithEmail } from '@/lib/mechanics';
import { getCaller, type Caller } from '@/lib/api-auth';

/** ¿El fallo es "ese correo ya tiene cuenta"? */
function esCorreoRepetido(error: { message?: string; code?: string }): boolean {
  const code = error.code ?? '';
  const msg = (error.message ?? '').toLowerCase();
  return (
    code === 'email_exists' ||
    msg.includes('already been registered') ||
    msg.includes('already registered') ||
    msg.includes('already exists')
  );
}

/** Los fallos de Supabase llegan en inglés; aquí los que puede ver un taller. */
function traducirErrorDeAuth(error: { message?: string }): string {
  const msg = (error.message ?? '').toLowerCase();
  if (msg.includes('invalid email') || msg.includes('unable to validate email')) {
    return 'Ese correo no es válido. Revísalo y vuelve a intentarlo.';
  }
  if (msg.includes('password')) {
    return 'La contraseña no cumple los requisitos: usa al menos 8 caracteres.';
  }
  return 'No se pudo crear el mecánico. Vuelve a intentarlo en un momento.';
}

/**
 * Cuando el correo ya tiene cuenta, dice de QUIÉN es — que es lo único que
 * permite al taller saber qué hacer:
 *   · es el suyo          → no hace falta registrarse: ya puede asignarse órdenes;
 *   · es de su equipo     → se nombra a la persona;
 *   · es de otro taller   → se dice que está ocupado, SIN revelar de quién
 *     (el correo de otro taller no es asunto de este).
 */
async function explicarCorreoRepetido(
  service: ReturnType<typeof createServiceClient>,
  email: string,
  caller: Caller
): Promise<string> {
  const buscado = email.trim().toLowerCase();

  // No hay búsqueda por correo en la API de administración, así que se recorre
  // el listado. Solo ocurre en este camino de error, nunca en el alta normal.
  let encontrado: { id: string } | null = null;
  for (let page = 1; page <= 20 && !encontrado; page++) {
    const { data } = await service.auth.admin.listUsers({ page, perPage: 1000 });
    const users = data?.users ?? [];
    if (users.length === 0) break;
    encontrado = users.find((u) => (u.email ?? '').toLowerCase() === buscado) ?? null;
  }

  if (!encontrado) {
    return 'Ese correo ya está registrado en Formula Taller. Usa otro para este mecánico.';
  }

  if (encontrado.id === caller.userId) {
    return 'Ese correo es el tuyo, el del administrador del taller. No hace falta registrarte como mecánico: ya apareces en la lista de asignación como «(dueño)» y puedes asignarte órdenes a ti mismo.';
  }

  const { data } = await service
    .from('profiles')
    .select('full_name, role, workshop_id')
    .eq('id', encontrado.id)
    .maybeSingle();
  const perfil = data as unknown as {
    full_name: string;
    role: string;
    workshop_id: string;
  } | null;

  if (perfil && perfil.workshop_id === caller.workshopId) {
    return perfil.role === 'admin'
      ? `Ese correo ya es el de ${perfil.full_name}, administrador de este taller.`
      : `Ese correo ya es el de ${perfil.full_name}, que ya está registrado como mecánico de este taller.`;
  }

  return 'Ese correo ya está registrado en Formula Taller. Usa otro para este mecánico.';
}

// GET /api/mechanics — mechanics of the caller's workshop only.
export async function GET() {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!caller.workshopId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  // Esta lista trae el CORREO de cada compañero. Desde la 0019 el mecánico no
  // asigna órdenes, así que no la necesita para nada: queda solo para el admin.
  if (caller.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const mechanics = await listMechanicsWithEmail(caller.workshopId);
  return NextResponse.json(mechanics);
}

// POST /api/mechanics  (admin only) — creates a mechanic in the admin's workshop.
export async function POST(req: Request) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (caller.role !== 'admin' || !caller.workshopId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body: CreateMechanicPayload = await req.json();

  // Coincide con el aviso "Mínimo 8 caracteres" del formulario.
  if (!body.password || body.password.length < 8) {
    return NextResponse.json(
      { error: 'La contraseña debe tener al menos 8 caracteres.' },
      { status: 400 }
    );
  }

  const service = createServiceClient();

  // Create auth user, tagged with this workshop.
  const { data: authData, error: authError } = await service.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
    user_metadata: {
      full_name: body.full_name,
      role: 'mechanic',
      workshop_id: caller.workshopId,
    },
  });

  if (authError) {
    // Supabase responde en inglés ("A user with this email address has already
    // been registered") y el taller lo veía tal cual, sin entender por qué.
    // Peor: el caso más común es que el correo sea el DEL PROPIO dueño
    // intentando darse de alta como mecánico, y el aviso no lo decía.
    if (esCorreoRepetido(authError)) {
      return NextResponse.json(
        { error: await explicarCorreoRepetido(service, body.email, caller) },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: traducirErrorDeAuth(authError) }, { status: 400 });
  }

  // Upsert profile
  const profileData: ProfileInsert = {
    id: authData.user.id,
    workshop_id: caller.workshopId,
    full_name: body.full_name,
    role: 'mechanic',
    phone: body.phone ?? null,
    active: true,
  };

  const { data: newProfile, error: profileError } = await service
    .from('profiles')
    .upsert(profileData, { onConflict: 'id' })
    .select()
    .single();

  if (profileError) {
    // Revertir el usuario de auth para no dejar una cuenta huérfana sin perfil.
    try {
      await service.auth.admin.deleteUser(authData.user.id);
    } catch {
      /* si falla el rollback, igual reportamos el error original */
    }
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ ...newProfile, email: body.email }, { status: 201 });
}
