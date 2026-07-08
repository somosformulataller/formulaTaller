import { NextResponse } from 'next/server';

const PIXEL_ID = '1688453135751029';
const GRAPH = `https://graph.facebook.com/v21.0/${PIXEL_ID}/events`;

// POST /api/fb-event — reenvía un evento del Pixel a la Conversions API de Meta
// (server-side), con el mismo event_id para deduplicar con el Pixel del navegador.
// Requiere FB_CAPI_ACCESS_TOKEN (secreto, en variables de entorno). Si no está,
// no hace nada (el Pixel del navegador sigue funcionando igual).
export async function POST(req: Request) {
  const token = process.env.FB_CAPI_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ ok: false, skipped: 'no token' });

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name : null;
  if (!name) return NextResponse.json({ error: 'name requerido' }, { status: 400 });

  // Cookies del pixel (_fbp/_fbc) e IP/UA para mejorar la calidad de coincidencia.
  const cookieHeader = req.headers.get('cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=');
      return [k, decodeURIComponent(v.join('='))];
    })
  );
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  const ua = req.headers.get('user-agent') || '';

  const payload = {
    data: [
      {
        event_name: name,
        event_time: Math.floor(Date.now() / 1000),
        event_id: typeof body?.eventId === 'string' ? body.eventId : undefined,
        action_source: 'website',
        event_source_url: typeof body?.url === 'string' ? body.url : undefined,
        user_data: {
          client_ip_address: ip || undefined,
          client_user_agent: ua || undefined,
          fbp: cookies['_fbp'] || undefined,
          fbc: cookies['_fbc'] || undefined,
        },
        custom_data: body?.custom && typeof body.custom === 'object' ? body.custom : {},
      },
    ],
  };

  try {
    const r = await fetch(`${GRAPH}?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return NextResponse.json({ ok: false, error: err }, { status: 200 });
    }
  } catch {
    // No romper la app si Meta no responde.
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  return NextResponse.json({ ok: true });
}
