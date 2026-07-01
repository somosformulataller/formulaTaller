import { listMechanicsWithEmail } from '@/lib/mechanics';
import MecanicosClient from './MecanicosClient';

export const dynamic = 'force-dynamic';

export default async function MecanicosPage() {
  const mechanics = await listMechanicsWithEmail();
  return <MecanicosClient initialMechanics={mechanics} />;
}
