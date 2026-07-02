import { createClient } from '@/lib/supabase/server';
import { getCaller } from '@/lib/api-auth';
import { listMechanicsWithEmail } from '@/lib/mechanics';
import MecanicosClient from './MecanicosClient';

export const dynamic = 'force-dynamic';

export default async function MecanicosPage() {
  const caller = await getCaller();
  const wid = caller?.workshopId ?? '';

  const supabase = await createClient();
  const [mechanics, workshopRes] = await Promise.all([
    listMechanicsWithEmail(wid),
    supabase.from('workshops').select('name').eq('id', wid).single(),
  ]);

  const workshopName = (workshopRes.data as unknown as { name: string } | null)?.name ?? '';

  return <MecanicosClient initialMechanics={mechanics} workshopName={workshopName} />;
}
