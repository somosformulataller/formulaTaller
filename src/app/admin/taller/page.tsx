import { createClient } from '@/lib/supabase/server';
import { getCaller } from '@/lib/api-auth';
import type { Workshop } from '@/lib/types';
import TallerClient from './TallerClient';

export const dynamic = 'force-dynamic';

export default async function TallerPage() {
  const supabase = await createClient();
  const caller = await getCaller();
  const wid = caller?.workshopId ?? '';

  const { data } = await supabase.from('workshops').select('*').eq('id', wid).single();
  const workshop = data as unknown as Workshop | null;

  if (!workshop) return null;

  return <TallerClient workshop={workshop} />;
}
