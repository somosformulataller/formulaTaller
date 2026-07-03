import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getPlatformAdmin } from '@/lib/api-auth';

type Params = { params: { id: string } };

// PATCH /api/superadmin/workshops/:id — marca/desmarca la suscripción del
// taller. Solo superadmins de plataforma.
export async function PATCH(req: Request, { params }: Params) {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const isSubscribed = body?.is_subscribed;
  if (typeof isSubscribed !== 'boolean') {
    return NextResponse.json({ error: 'is_subscribed debe ser booleano' }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from('workshops')
    .update({ is_subscribed: isSubscribed })
    .eq('id', params.id)
    .select('id, is_subscribed')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
