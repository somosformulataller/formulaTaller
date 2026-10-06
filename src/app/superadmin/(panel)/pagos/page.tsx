import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { getPlatformAdmin } from '@/lib/api-auth';
import PagosClient, { type AjustesCobro } from './PagosClient';

export const dynamic = 'force-dynamic';

// «Pagos»: las compras de saldo de los talleres, para aprobarlas o
// rechazarlas a mano (0025), y la configuración de precios y Pago Móvil.
export default async function PagosPage() {
  const admin = await getPlatformAdmin();
  if (!admin) redirect('/superadmin/login');

  const service = createServiceClient();
  const { data } = await service
    .from('platform_settings')
    .select(
      'price_order_usd, price_ai_question_usd, welcome_balance_usd, pago_movil_bank, pago_movil_phone, pago_movil_document, pago_movil_holder'
    )
    .eq('id', 1)
    .maybeSingle();
  const d = (data ?? {}) as Record<string, unknown>;

  const ajustes: AjustesCobro = {
    price_order_usd: Number(d.price_order_usd ?? 0.2),
    price_ai_question_usd: Number(d.price_ai_question_usd ?? 0.035),
    welcome_balance_usd: Number(d.welcome_balance_usd ?? 3),
    pago_movil_bank: (d.pago_movil_bank as string | null) ?? '',
    pago_movil_phone: (d.pago_movil_phone as string | null) ?? '',
    pago_movil_document: (d.pago_movil_document as string | null) ?? '',
    pago_movil_holder: (d.pago_movil_holder as string | null) ?? '',
  };

  return <PagosClient ajustesIniciales={ajustes} />;
}
