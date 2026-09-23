import PresupuestosClient from '@/components/orders/PresupuestosClient';

// Mismo contenido que el del admin: en Formula Taller el mecánico gestiona
// las órdenes de su taller igual que el dueño (ver canManageOrder).
export const dynamic = 'force-dynamic';

export default function PresupuestosMecanicoPage() {
  return <PresupuestosClient basePath="/mecanico" />;
}
