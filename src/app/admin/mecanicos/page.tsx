import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types';
import MecanicosClient from './MecanicosClient';

export default async function MecanicosPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'mechanic')
    .order('full_name', { ascending: true });

  return <MecanicosClient initialMechanics={(data ?? []) as unknown as Profile[]} />;
}
