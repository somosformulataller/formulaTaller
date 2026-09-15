import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getPlatformAdmin } from '@/lib/api-auth';
import { randomInt } from 'node:crypto';

type Params = { params: { id: string } };

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

// Contraseña temporal fuerte y legible. Antes usaba Math.random() —no
// criptográfico y con estado predecible— para una credencial; ahora usa
// randomInt (CSPRNG). Alfabeto sin caracteres ambiguos (0/O, 1/l/I) para
// poder dictarla por teléfono/WhatsApp. ~12 caracteres, con al menos una
// minúscula, una mayúscula y un dígito garantizados.
function tempPassword(): string {
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const all = lower + upper + digits;
  const pick = (set: string) => set[randomInt(set.length)];
  const chars = [pick(lower), pick(upper), pick(digits)];
  while (chars.length < 12) chars.push(pick(all));
  // Baraja (Fisher–Yates con CSPRNG) para no dejar las 3 fijas al inicio.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return `FT-${chars.join('')}`;
}

// POST /api/superadmin/workshops/:id/reset-password
// body { mode: 'email' | 'temp' }
//  - 'email': envía al dueño un correo con enlace para poner nueva contraseña.
//  - 'temp' : genera una contraseña temporal y la devuelve para compartirla.
export async function POST(req: Request, { params }: Params) {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const mode = body?.mode;
  if (mode !== 'email' && mode !== 'temp') {
    return NextResponse.json({ error: 'mode debe ser "email" o "temp"' }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: ws } = await service
    .from('workshops')
    .select('owner_id')
    .eq('id', params.id)
    .single();
  const ownerId = (ws as unknown as { owner_id: string | null } | null)?.owner_id;
  if (!ownerId) {
    return NextResponse.json({ error: 'El taller no tiene un dueño registrado.' }, { status: 400 });
  }

  const { data: userRes } = await service.auth.admin.getUserById(ownerId);
  const email = userRes?.user?.email;
  if (!email) {
    return NextResponse.json({ error: 'El dueño no tiene un correo asociado.' }, { status: 400 });
  }

  if (mode === 'email') {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const redirectTo = `${SITE_URL}/reset-password`;
    const r = await fetch(
      `${url}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`,
      {
        method: 'POST',
        headers: { apikey: anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      }
    );
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      return NextResponse.json(
        { error: e.msg || e.error_description || 'No se pudo enviar el correo.' },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, mode: 'email', email });
  }

  // mode === 'temp'
  const password = tempPassword();
  const { error } = await service.auth.admin.updateUserById(ownerId, { password });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, mode: 'temp', email, password });
}
