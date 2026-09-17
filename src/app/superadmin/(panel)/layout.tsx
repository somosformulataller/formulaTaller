import { redirect } from 'next/navigation';
import { getPlatformAdmin } from '@/lib/api-auth';
import SuperadminShell from './SuperadminShell';

// Layout de las pestañas autenticadas del panel de plataforma (Talleres, Ventas).
// El login vive fuera de este grupo de rutas, así que no hereda el menú ni la
// guardia (evita un bucle de redirección).
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await getPlatformAdmin();
  if (!admin) redirect('/superadmin/login');

  return <SuperadminShell adminEmail={admin.email}>{children}</SuperadminShell>;
}
