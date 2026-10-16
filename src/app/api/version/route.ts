import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET /api/version — la versión desplegada ahora (commit de Vercel). El
// navegador la compara con la suya para avisar que hay una actualización.
export async function GET() {
  return NextResponse.json(
    { version: process.env.VERCEL_GIT_COMMIT_SHA || 'dev' },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
