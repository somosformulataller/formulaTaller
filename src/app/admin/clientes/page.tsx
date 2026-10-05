import { createServiceClient } from '@/lib/supabase/server';
import { getCaller } from '@/lib/api-auth';
import ClientesClient from './ClientesClient';

// La lista la trae el navegador desde /api/clients; aquí solo el nombre del
// taller, para el mensaje de WhatsApp de los recordatorios.
export const dynamic = 'force-dynamic';

export default async function ClientesPage() {
  const caller = await getCaller();
  const { data } = await createServiceClient()
    .from('workshops')
    .select('name')
    .eq('id', caller?.workshopId ?? '')
    .maybeSingle();
  const workshopName = (data as unknown as { name: string } | null)?.name ?? 'el taller';
  return <ClientesClient workshopName={workshopName} />;
}
