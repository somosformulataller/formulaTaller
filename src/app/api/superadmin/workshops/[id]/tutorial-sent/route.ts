import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getPlatformAdmin } from '@/lib/api-auth';

type Params = { params: { id: string } };

// POST /api/superadmin/workshops/:id/tutorial-sent
// Marca que al taller ya se le envió el video tutorial: sella tutorial_sent_at y,
// si existe la etiqueta "Video enviado" en el catálogo, se la asigna.
// Lo llama el botón de "Enviar video" del panel de Ventas (después de abrir
// WhatsApp), tanto en el envío individual como en el masivo.
export async function POST(_req: Request, { params }: Params) {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const service = createServiceClient();
  const now = new Date().toISOString();

  const { data, error } = await service
    .from('workshops')
    .update({ tutorial_sent_at: now })
    .eq('id', params.id)
    .select('id, tutorial_sent_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Asignar la etiqueta "Video enviado" si existe (no es un error si no está).
  let videoTagId: string | null = null;
  const { data: tag } = await service
    .from('crm_tags')
    .select('id')
    .ilike('label', 'Video enviado')
    .maybeSingle();
  const tagRow = tag as unknown as { id: string } | null;
  if (tagRow) {
    videoTagId = tagRow.id;
    await service
      .from('workshop_tags')
      .upsert(
        { workshop_id: params.id, tag_id: tagRow.id },
        { onConflict: 'workshop_id,tag_id' }
      );
  }

  return NextResponse.json({
    tutorial_sent_at: (data as unknown as { tutorial_sent_at: string }).tutorial_sent_at,
    video_tag_id: videoTagId,
  });
}
