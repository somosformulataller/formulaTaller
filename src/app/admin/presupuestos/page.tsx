import PresupuestosClient from '@/components/orders/PresupuestosClient';

// Los totales cambian cada vez que alguien toca un ítem: nada de página
// cacheada. Los datos los trae el cliente desde /api/budgets.
export const dynamic = 'force-dynamic';

export default function PresupuestosAdminPage() {
  return <PresupuestosClient basePath="/admin" />;
}
