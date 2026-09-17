import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getPlatformAdmin } from '@/lib/api-auth';
import type { CrmTagColor } from '@/lib/types';

const COLORS: CrmTagColor[] = ['neutral', 'gold', 'green', 'red', 'blue'];
const MAX_LABEL = 40;
const MAX_TAGS = 100;

// GET /api/superadmin/tags — catálogo de etiquetas del CRM. Solo superadmin.
export async function GET() {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const service = createServiceClient();
  const { data, error } = await service
    .from('crm_tags')
    .select('id, label, color, sort, created_at')
    .order('sort', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tags: data ?? [] });
}

// POST /api/superadmin/tags — crea una etiqueta nueva. Body: { label, color? }
export async function POST(req: Request) {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const label = typeof body?.label === 'string' ? body.label.trim() : '';
  const color: CrmTagColor = COLORS.includes(body?.color) ? body.color : 'neutral';

  if (!label || label.length > MAX_LABEL) {
    return NextResponse.json(
      { error: `La etiqueta debe tener entre 1 y ${MAX_LABEL} caracteres.` },
      { status: 400 }
    );
  }

  const service = createServiceClient();

  const { count } = await service
    .from('crm_tags')
    .select('id', { count: 'exact', head: true });
  if ((count ?? 0) >= MAX_TAGS) {
    return NextResponse.json({ error: `Máximo ${MAX_TAGS} etiquetas.` }, { status: 400 });
  }

  const { data, error } = await service
    .from('crm_tags')
    .insert({ label, color, sort: count ?? 0 })
    .select('id, label, color, sort, created_at')
    .single();

  if (error) {
    // 23505 = unique_violation (ya existe una etiqueta con ese nombre).
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'Ya existe una etiqueta con ese nombre.' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
