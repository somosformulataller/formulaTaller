import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getPlatformAdmin } from '@/lib/api-auth';
import type { CrmTagColor } from '@/lib/types';

type Params = { params: { id: string } };

const COLORS: CrmTagColor[] = ['neutral', 'gold', 'green', 'red', 'blue'];
const MAX_LABEL = 40;

// PATCH /api/superadmin/tags/:id — renombra / recolorea / reordena una etiqueta.
// Body admite: { label?, color?, sort? }
export async function PATCH(req: Request, { params }: Params) {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const updates: { label?: string; color?: CrmTagColor; sort?: number } = {};

  if ('label' in (body ?? {})) {
    const label = typeof body.label === 'string' ? body.label.trim() : '';
    if (!label || label.length > MAX_LABEL) {
      return NextResponse.json(
        { error: `La etiqueta debe tener entre 1 y ${MAX_LABEL} caracteres.` },
        { status: 400 }
      );
    }
    updates.label = label;
  }
  if ('color' in (body ?? {})) {
    if (!COLORS.includes(body.color)) {
      return NextResponse.json({ error: 'Color inválido.' }, { status: 400 });
    }
    updates.color = body.color;
  }
  if ('sort' in (body ?? {})) {
    if (typeof body.sort !== 'number' || !Number.isInteger(body.sort)) {
      return NextResponse.json({ error: 'sort debe ser un entero.' }, { status: 400 });
    }
    updates.sort = body.sort;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nada para actualizar' }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from('crm_tags')
    .update(updates)
    .eq('id', params.id)
    .select('id, label, color, sort, created_at')
    .single();

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'Ya existe una etiqueta con ese nombre.' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

// DELETE /api/superadmin/tags/:id — borra la etiqueta (y sus asignaciones, por
// el ON DELETE CASCADE de workshop_tags).
export async function DELETE(_req: Request, { params }: Params) {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const service = createServiceClient();
  const { error } = await service.from('crm_tags').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
