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
