// Per-workshop branded login page: /login/<slug>
// Shows the workshop's name + logo above the standard login form.
export const dynamic = 'force-dynamic';

import { createServiceClient } from '@/lib/supabase/server';
import LoginForm from '../LoginForm';

interface Props {
  params: { slug: string };
}

export default async function WorkshopLoginPage({ params }: Props) {
  const service = createServiceClient();
  const { data } = await service
    .from('workshops')
    .select('name, logo_url')
    .eq('slug', params.slug)
    .maybeSingle();

  const workshop = data as unknown as { name: string; logo_url: string | null } | null;

  // Unknown slug → fall back to the generic login (still fully usable).
  return <LoginForm workshopName={workshop?.name} logoUrl={workshop?.logo_url} />;
}
