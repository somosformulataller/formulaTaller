import { createServiceClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { leerPresupuestoPublico } from '@/lib/presupuesto-publico';
import PresupuestoClient from './PresupuestoClient';

// Siempre lo último que respondió el cliente o cambió el taller.
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Props {
  params: { token: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await leerPresupuestoPublico(createServiceClient(), params.token);
  if (!p) return { title: 'Presupuesto' };
  return {
    title: `Presupuesto de ${p.publico.client_first_name} ${p.publico.client_last_name} — ${p.publico.workshop.name}`.replace(/\s+/g, ' '),
    description: p.publico.car_model ? `Presupuesto para ${p.publico.car_model}` : 'Presupuesto del taller',
  };
}

export default async function PresupuestoPublicoPage({ params }: Props) {
  const p = await leerPresupuestoPublico(createServiceClient(), params.token);
  if (!p) notFound();
  return <PresupuestoClient inicial={p.publico} />;
}
