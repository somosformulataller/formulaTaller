import { redirect } from 'next/navigation';
import { getPlatformAdmin } from '@/lib/api-auth';
import ReferenciasClient from './ReferenciasClient';

export const dynamic = 'force-dynamic';

// «Referencias»: buscar un pago en el estado de cuenta del banco y ver si ya
// acreditó saldo en Formula Taller o lo usó La Mejor Llave (misma cuenta).
export default async function ReferenciasPage() {
  const admin = await getPlatformAdmin();
  if (!admin) redirect('/superadmin/login');
  return <ReferenciasClient />;
}
