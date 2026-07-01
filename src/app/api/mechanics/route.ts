import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { CreateMechanicPayload, ProfileInsert } from '@/lib/types';
import { listMechanicsWithEmail } from '@/lib/mechanics';

// GET /api/mechanics
export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const mechanics = await listMechanicsWithEmail();
  return NextResponse.json(mechanics);
}

// POST /api/mechanics  (admin only)
export async function POST(req: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const profileResult = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const callerProfile = profileResult.data as { role: string } | null;

  if (callerProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body: CreateMechanicPayload = await req.json();
  const service = createServiceClient();

  // Create auth user
  const { data: authData, error: authError } = await service.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
    user_metadata: { full_name: body.full_name, role: 'mechanic' },
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  // Upsert profile
  const profileData: ProfileInsert = {
    id: authData.user.id,
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
