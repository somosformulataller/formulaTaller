import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { CreateStagePayload } from '@/lib/types';

type Params = { params: { id: string } };

// GET /api/orders/:id/stages
export async function GET(_: Request, { params }: Params) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('order_stages')
    .select('*')
    .eq('order_id', params.id)
    .order('position', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/orders/:id/stages — add a custom stage
export async function POST(req: Request, { params }: Params) {
  const supabase = await createClient();
  const service = createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body: CreateStagePayload = await req.json();

  // Get the max position so we can append
  const { data: existing } = await supabase
    .from('order_stages')
    .select('position')
    .eq('order_id', params.id)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  const existingData = existing as unknown as { position: number } | null;
  const nextPosition = (existingData?.position ?? 0) + 1;

  const { data, error } = await service
    .from('order_stages')
    .insert({
      order_id: params.id,
      name: body.name,
      position: body.position ?? nextPosition,
      status: 'pending',
      completed_at: null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
