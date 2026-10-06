import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCaller } from '@/lib/api-auth';
import TopBar from '@/components/layout/TopBar';
import BottomNav from '@/components/layout/BottomNav';
import SupportButton from '@/components/layout/SupportButton';
import SaldoProvider from '@/components/saldo/SaldoProvider';
import type { Profile } from '@/lib/types';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // La sesión ya la verificó el middleware: perfil, nombre y saldo del taller
  // van en una sola consulta; los precios, en paralelo.
  const caller = await getCaller();
  if (!caller) redirect('/login');

  const supabase = await createClient();
  const [{ data: profileData }, { data: ajustes }] = await Promise.all([
    supabase.from('profiles').select('*, workshop:workshops(name, balance_usd)').eq('id', caller.userId).single(),
    supabase.from('platform_settings').select('price_order_usd, price_ai_question_usd').eq('id', 1).maybeSingle(),
  ]);

  const fila = profileData as unknown as
    | (Profile & { workshop: { name: string; balance_usd: number | string } | null })
    | null;
  const { workshop, ...resto } = fila ?? ({} as Partial<NonNullable<typeof fila>>);
  const profile = fila ? (resto as Profile) : null;

  if (!profile || profile.role !== 'admin') redirect('/mecanico');

  const workshopName = workshop?.name;
  const precios = ajustes as unknown as { price_order_usd: number | string; price_ai_question_usd: number | string } | null;

  return (
    <SaldoProvider
      saldoInicial={Number(workshop?.balance_usd ?? 0)}
      precios={{
        orden: Number(precios?.price_order_usd ?? 0.2),
        preguntaIa: Number(precios?.price_ai_question_usd ?? 0.035),
      }}
    >
      <TopBar profile={profile as Profile} title={workshopName} />
      <main className="page-container">{children}</main>
      <SupportButton />
      <BottomNav role="admin" />
    </SaldoProvider>
  );
}
