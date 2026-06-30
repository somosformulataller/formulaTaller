import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import TopBar from '@/components/layout/TopBar';
import BottomNav from '@/components/layout/BottomNav';
import type { Profile } from '@/lib/types';

export default async function MecanicoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const profile = profileData as Profile | null;

  if (!profile) redirect('/login');

  return (
    <>
      <TopBar profile={profile as Profile} />
      <main className="page-container">{children}</main>
      <BottomNav role="mechanic" />
    </>
  );
}
