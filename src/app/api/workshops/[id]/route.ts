import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCaller } from '@/lib/api-auth';
import type { WorkshopUpdate } from '@/lib/types';

type Params = { params: { id: string } };

// PATCH /api/workshops/:id — edit the workshop profile (admin of that workshop).
export async function PATCH(req: Request, { params }: Params) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (caller.role !== 'admin' || caller.workshopId !== params.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as WorkshopUpdate | null;
  const updates: WorkshopUpdate = {};
  if (typeof body?.name === 'string' && body.name.trim()) updates.name = body.name.trim();
  if (body?.whatsapp !== undefined) updates.whatsapp = (body.whatsapp || '').trim() || null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar.' }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from('workshops')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/workshops/:id — permanently delete the workshop and all its data
// (users, orders, stages, attachments). Admin owner of that workshop only.
export async function DELETE(_: Request, { params }: Params) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (caller.role !== 'admin' || caller.workshopId !== params.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const service = createServiceClient();

  // Collect the workshop's user ids before deleting (to remove their auth users).
  const { data: profiles } = await service
    .from('profiles')
    .select('id')
    .eq('workshop_id', params.id);
  const userIds = ((profiles ?? []) as unknown as { id: string }[]).map((p) => p.id);

  // Deleting the workshop cascades: profiles, orders → stages → attachments.
  const { error } = await service.from('workshops').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Remove the auth users so their emails are freed and they can't log in.
  for (const id of userIds) {
    try {
      await service.auth.admin.deleteUser(id);
    } catch {
      // Ignore individual failures; the workshop data is already gone.
    }
  }

  return NextResponse.json({ ok: true });
}
