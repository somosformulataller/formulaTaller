import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { CreateMechanicPayload, ProfileInsert } from '@/lib/types';
import { listMechanicsWithEmail } from '@/lib/mechanics';
import { getCaller } from '@/lib/api-auth';

// GET /api/mechanics — mechanics of the caller's workshop only.
export async function GET() {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!caller.workshopId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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
    return NextResponse.json({ error: authError.message }, { status: 400 });
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
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ ...newProfile, email: body.email }, { status: 201 });
}
