import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { soloAdmin } from '@/lib/admin-taller';
import { MODELO, costoUsd, type UsoGemini } from '@/lib/asistente';
import { formatDia, hoyVE, mensajeRecordatorio } from '@/lib/recordatorios';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type Params = { params: { id: string } };

// POST /api/reminders/:id/mensaje → { mensaje }
// Redacta con IA el WhatsApp del recordatorio para el cliente: cercano, como
// si lo escribiera el mecánico o el dueño del taller, a partir del título, el
// texto (o lo dictado por voz) y la última visita. Si la IA falla, devuelve
// el mensaje de respaldo. No descuenta saldo.
export async function POST(_req: Request, { params }: Params) {
  const { caller, error: e } = await soloAdmin();
  if (e) return e;
  const service = createServiceClient();

  const { data } = await service
    .from('reminders')
    .select('id, order_id, title, body, transcript, due_date, created_at, client:clients(first_name), workshop:workshops(name)')
    .eq('id', params.id)
    .eq('workshop_id', caller.workshopId)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: 'Recordatorio no encontrado' }, { status: 404 });

  const r = data as unknown as {
    order_id: string | null;
    title: string;
    body: string | null;
    transcript: string | null;
    due_date: string;
    created_at: string;
    client: { first_name: string } | null;
    workshop: { name: string } | null;
  };

  // La visita de la que sale el recordatorio: la orden enlazada, si hay.
  let carro: string | null = null;
  let visita = r.created_at;
  if (r.order_id) {
    const { data: o } = await service
      .from('orders')
      .select('car_model, created_at')
      .eq('id', r.order_id)
      .eq('workshop_id', caller.workshopId)
      .maybeSingle();
    const orden = o as unknown as { car_model: string; created_at: string } | null;
    if (orden) {
      carro = orden.car_model;
      visita = orden.created_at;
    }
  }

  const nombre = r.client?.first_name?.trim() ?? '';
  const taller = r.workshop?.name ?? 'el taller';
  const texto = (r.body || r.transcript || '').trim();
  const respaldo = mensajeRecordatorio({ nombreCliente: nombre, taller, titulo: r.title, texto, fecha: r.due_date });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ mensaje: respaldo, ia: false });

  const hoy = hoyVE();
  const dias = Math.max(0, Math.round((Date.parse(hoy) - Date.parse(visita.slice(0, 10))) / 86_400_000));
  const datos = [
    `Nombre del cliente: ${nombre || '(no se sabe)'}`,
    `Taller: ${taller}`,
    carro ? `Vehículo: ${carro}` : null,
    `Recordatorio: ${r.title}`,
    texto ? `Detalles que anotó el taller: ${texto}` : null,
    `Fecha del recordatorio: ${formatDia(r.due_date)} (hoy es ${formatDia(hoy)})`,
    `Última visita del cliente al taller: hace ${dias} día${dias === 1 ? '' : 's'}`,
  ]
    .filter(Boolean)
    .join('\n');

  const prompt = `Redacta el mensaje de WhatsApp que el dueño o el mecánico de un taller venezolano le manda a su cliente para recordarle algo de su carro.

Tono: cercano, cálido y humano, como si lo escribiera la persona del taller que lo atendió, no una empresa ni un robot. Tutea al cliente. Español de Venezuela, natural y sencillo. Sin mayúsculas exageradas, sin listas, sin asteriscos y sin emojis de más (uno como máximo, opcional).

Estructura:
1. Saluda por su nombre y deséale que esté bien.
2. Recuérdale lo que tiene pendiente, explicando con naturalidad el porqué a partir de los detalles (por ejemplo, lo que se vio en su última visita) y por qué conviene no dejarlo pasar.
3. Cierra en un párrafo aparte poniéndote a la orden y pidiéndole que confirme qué día puede traer el carro.

Usa SOLO los datos de abajo: no inventes fallas, precios, fechas ni nombres. Si un dato no está, no lo menciones. Máximo 90 palabras. Responde solo con el mensaje, sin comillas ni explicaciones.

Ejemplo del tono buscado:
Hola María, espero que estés muy bien. Recuerda que debes cambiar las pastillas de freno del carro: hace 15 días, cuando viniste, nos dimos cuenta de que les quedaba aproximadamente un mes, y ya está cerca la fecha. Es mejor cambiarlas a tiempo para evitar daños mayores.

Estamos por acá a tu orden para que nos confirmes el día que traerás el carro.

Datos:
${datos}`;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { thinkingConfig: { thinkingLevel: 'low' }, temperature: 0.7, maxOutputTokens: 1000 },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      console.error('[mensaje] Gemini', res.status, (await res.text().catch(() => '')).slice(0, 300));
      return NextResponse.json({ mensaje: respaldo, ia: false });
    }
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
      usageMetadata?: UsoGemini;
    };
    const mensaje = (json.candidates?.[0]?.content?.parts ?? [])
      .filter((p) => p.text && !p.thought)
      .map((p) => p.text)
      .join('')
      .trim()
      .replace(/^["«]|["»]$/g, '');

    // Queda anotado como el resto del gasto de IA del taller.
    const u = json.usageMetadata ?? {};
    await service.from('ai_requests').insert({
      workshop_id: caller.workshopId,
      user_id: caller.userId,
      input_tokens: u.promptTokenCount ?? 0,
      output_tokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
      cost_usd: costoUsd(u),
    });

    return NextResponse.json({ mensaje: mensaje || respaldo, ia: Boolean(mensaje) });
  } catch {
    return NextResponse.json({ mensaje: respaldo, ia: false });
  }
}
