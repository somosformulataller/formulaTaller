import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { slugify } from '@/lib/utils';
import type { RegisterWorkshopPayload } from '@/lib/types';

// Builds a URL-friendly, unique slug for the workshop (e.g. taller-el-rayo).
async function uniqueSlug(
  service: ReturnType<typeof createServiceClient>,
  name: string
): Promise<string> {
  const base = slugify(name) || 'taller';
  let slug = base;
  for (let i = 0; i < 5; i++) {
    const { data } = await service.from('workshops').select('id').eq('slug', slug).maybeSingle();
    if (!data) return slug;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return slug;
}

// POST /api/register — public self-registration of a new workshop (taller).
// Creates the workshop, then its first user (admin, auto-confirmed) linked to it.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as RegisterWorkshopPayload | null;
  if (!body) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

  const workshopName = body.workshop_name?.trim();
  const email = body.email?.trim().toLowerCase();
  const whatsapp = body.whatsapp?.trim();
  const firstName = body.first_name?.trim();
  const lastName = body.last_name?.trim();
  const password = body.password ?? '';

  // --- Validation ----------------------------------------------------------
  if (!workshopName || !email || !whatsapp || !firstName || !lastName) {
    return NextResponse.json({ error: 'Completa todos los campos.' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'El correo no es válido.' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: 'La contraseña debe tener al menos 6 caracteres.' },
      { status: 400 }
    );
  }
  if (password !== body.password_confirm) {
    return NextResponse.json({ error: 'Las contraseñas no coinciden.' }, { status: 400 });
  }

  const service = createServiceClient();

  // 1. Create the workshop (with a unique login slug).
  const slug = await uniqueSlug(service, workshopName);
  const { data: workshop, error: wsError } = await service
    .from('workshops')
    .insert({ name: workshopName, whatsapp, slug })
    .select()
    .single();

  if (wsError || !workshop) {
    return NextResponse.json(
      { error: wsError?.message || 'No se pudo crear el taller.' },
      { status: 500 }
    );
  }
  const workshopId = (workshop as unknown as { id: string }).id;

  // 2. Create the admin user (auto-confirmed) linked to the workshop.
  const fullName = `${firstName} ${lastName}`;
  const { data: authData, error: authError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role: 'admin', workshop_id: workshopId },
  });

  if (authError || !authData?.user) {
    // Roll back the workshop so a failed signup doesn't leave an orphan.
    await service.from('workshops').delete().eq('id', workshopId);
    const msg = /already been registered|already exists/i.test(authError?.message ?? '')
      ? 'Ya existe una cuenta con ese correo.'
      : authError?.message || 'No se pudo crear la cuenta.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // 3. Ensure the profile row (the trigger also creates it; upsert to be safe
  //    and to store the phone + workshop link).
  const { error: profileError } = await service.from('profiles').upsert(
    {
      id: authData.user.id,
      workshop_id: workshopId,
      full_name: fullName,
      role: 'admin',
      phone: whatsapp,
      active: true,
    },
    { onConflict: 'id' }
  );

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // 4. Mark the admin as the workshop owner.
  await service.from('workshops').update({ owner_id: authData.user.id }).eq('id', workshopId);

  return NextResponse.json({ ok: true }, { status: 201 });
}
