import { createServiceClient } from '@/lib/supabase/server';
import { getCaller } from '@/lib/api-auth';
import QuoteForm, { type DatosIniciales } from '@/components/presupuestos/QuoteForm';
import Encabezado from '@/components/presupuestos/Encabezado';

export const dynamic = 'force-dynamic';

// «Enviar presupuesto» (0028). Con ?cliente=<id> llega con sus datos puestos.
export default async function EnviarPresupuestoPage({ searchParams }: { searchParams: { cliente?: string } }) {
  const caller = await getCaller();
  const wid = caller?.workshopId ?? '';
  const service = createServiceClient();

  const [{ data: taller }, cliente] = await Promise.all([
    service.from('workshops').select('name').eq('id', wid).maybeSingle(),
    searchParams.cliente ? datosDelCliente(service, wid, searchParams.cliente) : Promise.resolve(undefined),
  ]);
  const workshopName = (taller as unknown as { name: string } | null)?.name ?? 'el taller';

  return (
    <div className="animate-fade-in" style={{ paddingTop: 16 }}>
      <Encabezado titulo="Enviar presupuesto" />
      <QuoteForm workshopName={workshopName} inicial={cliente} />
    </div>
  );
}

async function datosDelCliente(
  service: ReturnType<typeof createServiceClient>,
  wid: string,
  id: string
): Promise<DatosIniciales | undefined> {
  const [{ data: c }, { data: o }] = await Promise.all([
    service.from('clients').select('first_name, last_name, whatsapp').eq('id', id).eq('workshop_id', wid).maybeSingle(),
    service
      .from('orders')
      .select('car_model, client_whatsapp')
      .eq('client_id', id)
      .eq('workshop_id', wid)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!c) return undefined;
  const cli = c as unknown as { first_name: string; last_name: string; whatsapp: string };
  const ultima = o as unknown as { car_model: string; client_whatsapp: string } | null;
  return {
    client_first_name: cli.first_name,
    client_last_name: cli.last_name,
    // El de la orden trae el «+»; el del cliente son solo dígitos.
    client_whatsapp: ultima?.client_whatsapp || `+${cli.whatsapp}`,
    car_model: ultima?.car_model ?? '',
  };
}
