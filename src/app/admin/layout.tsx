import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCaller } from '@/lib/api-auth';
import TopBar from '@/components/layout/TopBar';
import BottomNav from '@/components/layout/BottomNav';
import SupportButton from '@/components/layout/SupportButton';
import type { Profile } from '@/lib/types';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // La sesión ya la verificó el middleware: perfil y nombre del taller van
  // en una sola consulta.
  const caller = await getCaller();
  if (!caller) redirect('/login');

  const supabase = await createClient();
  const { data: profileData } = await supabase
    .from('profiles')
    .select('*, workshop:workshops(name)')
    .eq('id', caller.userId)
    .single();

  const fila = profileData as unknown as (Profile & { workshop: { name: string } | null }) | null;
  const { workshop, ...resto } = fila ?? ({} as Partial<NonNullable<typeof fila>>);
  const profile = fila ? (resto as Profile) : null;

  if (!profile || profile.role !== 'admin') redirect('/mecanico');

  const workshopName = workshop?.name;

  return (
    <>
      <TopBar profile={profile as Profile} title={workshopName} />
      <main className="page-container">{children}</main>
      <SupportButton />
      <BottomNav role="admin" />
    </>
  );
}
