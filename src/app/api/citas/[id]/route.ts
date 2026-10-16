import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { soloAdmin } from '@/lib/admin-taller';

type Params = { params: { id: string } };

// DELETE /api/citas/:id — quita una cita o un horario ocupado.
export async function DELETE(_: Request, { params }: Params) {
  const { caller, error: e } = await soloAdmin();
  if (e) return e;
  const { error } = await createServiceClient()
    .from('appointments')
    .delete()
    .eq('id', params.id)
    .eq('workshop_id', caller.workshopId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
