import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { getPlatformAdmin } from '@/lib/api-auth';
import type { ReminderTag } from '@/lib/types';
import InterfazClient from './InterfazClient';

export const dynamic = 'force-dynamic';

// «Interfaz talleres»: lo que se edita aquí aplica a TODOS los talleres — las
// etiquetas de recordatorios. (Las condiciones previas del vehículo ahora se
// dictan por voz en cada orden: ya no hay lista de casillas que editar.)
export default async function InterfazPage() {
  const admin = await getPlatformAdmin();
  if (!admin) redirect('/superadmin/login');

  const service = createServiceClient();
  const tags = await service
    .from('reminder_tags')
    .select('id, workshop_id, label, color, sort, active')
    .is('workshop_id', null)
    .order('sort', { ascending: true });

  return (
    <InterfazClient
      initialTags={(tags.data ?? []) as unknown as ReminderTag[]}
      loadError={tags.error?.message ?? null}
    />
  );
}
