import { NextResponse } from 'next/server';
import { getPlatformAdmin } from '@/lib/api-auth';

// GET /api/superadmin/me — 200 solo si el usuario actual es superadmin de
// plataforma. Lo usa la pantalla de login para confirmar el acceso.
export async function GET() {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json({ ok: true, email: admin.email });
}
