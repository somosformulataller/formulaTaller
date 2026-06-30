import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { ProfileUpdate } from '@/lib/types';

type Params = { params: { id: string } };

// PATCH /api/mechanics/:id  (admin only)
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

  const body: ProfileUpdate = await req.json();
  const service = createServiceClient();

  // service client uses 'any' type, so update works without TypeScript issues
  const { data, error } = await service
    .from('profiles')
    .update(body)
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
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
