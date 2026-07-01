import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { UpdateMechanicPayload } from '@/lib/types';

type Params = { params: { id: string } };

// PATCH /api/mechanics/:id  (admin only)
// Updates profile fields (full_name, phone, active) and/or auth
// credentials (email, password).
export async function PATCH(req: Request, { params }: Params) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const profileResult = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const callerRole = (profileResult.data as unknown as { role: string } | null)?.role;

  if (callerRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body: UpdateMechanicPayload = await req.json();
  const service = createServiceClient();

  // 1. Auth credentials (email / password) live in auth.users.
  const authUpdate: { email?: string; password?: string } = {};
  if (typeof body.email === 'string' && body.email.length) authUpdate.email = body.email;
  if (typeof body.password === 'string' && body.password.length) authUpdate.password = body.password;

  if (Object.keys(authUpdate).length) {
    const { error: authError } = await service.auth.admin.updateUserById(params.id, authUpdate);
    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  // 2. Profile fields (only the ones actually provided).
  const profileUpdate: Record<string, unknown> = {};
  if (typeof body.full_name === 'string') profileUpdate.full_name = body.full_name;
  if (body.phone !== undefined) profileUpdate.phone = body.phone || null;
  if (typeof body.active === 'boolean') profileUpdate.active = body.active;

  let profile: unknown = null;
  if (Object.keys(profileUpdate).length) {
    const { data, error } = await service
      .from('profiles')
      .update(profileUpdate)
      .eq('id', params.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    profile = data;
  } else {
    const { data } = await service
      .from('profiles')
      .select('*')
      .eq('id', params.id)
      .single();
    profile = data;
  }

  // 3. Canonical email for the response.
  let email: string | null = authUpdate.email ?? null;
  if (!email) {
    const { data: userData } = await service.auth.admin.getUserById(params.id);
    email = userData?.user?.email ?? null;
  }

  return NextResponse.json({ ...(profile as Record<string, unknown>), email });
}

// DELETE /api/mechanics/:id  (admin only)
export async function DELETE(_: Request, { params }: Params) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const profileResult = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const callerRole = (profileResult.data as unknown as { role: string } | null)?.role;

  if (callerRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const service = createServiceClient();

  // Deactivate instead of hard delete to preserve order history
  const { data, error } = await service
    .from('profiles')
    .update({ active: false })
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
