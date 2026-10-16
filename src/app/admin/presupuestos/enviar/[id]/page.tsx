import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { getCaller } from '@/lib/api-auth';
import { conCitas } from '@/lib/presupuestos-servidor';
import type { Quote } from '@/lib/presupuestos';
import QuoteForm from '@/components/presupuestos/QuoteForm';
import Encabezado from '@/components/presupuestos/Encabezado';

export const dynamic = 'force-dynamic';

// Un presupuesto suelto ya guardado (0028): se edita o se vuelve a enviar.
export default async function PresupuestoSueltoPage({ params }: { params: { id: string } }) {
  const caller = await getCaller();
  const wid = caller?.workshopId ?? '';
  const service = createServiceClient();

  const [{ data: taller }, { data: q }] = await Promise.all([
    service.from('workshops').select('name').eq('id', wid).maybeSingle(),
    service.from('quotes').select('*').eq('id', params.id).eq('workshop_id', wid).maybeSingle(),
  ]);
  if (!q) notFound();
  const [quote] = await conCitas(service, [q as unknown as Quote]);
  const workshopName = (taller as unknown as { name: string } | null)?.name ?? 'el taller';

  return (
    <div className="animate-fade-in" style={{ paddingTop: 16 }}>
      <Encabezado titulo="Presupuesto" volver="/admin/clientes" />
      <QuoteForm workshopName={workshopName} quote={quote} />
    </div>
  );
}
