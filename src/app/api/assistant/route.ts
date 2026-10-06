import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { soloAdmin } from '@/lib/admin-taller';
import { cobrar, devolver, leerPrecios } from '@/lib/saldo';
import {
  HERRAMIENTAS,
  MODELO,
  costoUsd,
  ejecutarHerramienta,
  instrucciones,
  type UsoGemini,
} from '@/lib/asistente';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Freno contra abuso, invisible para el uso normal: una persona no manda más
// de 10 preguntas por minuto; un programa o una sesión robada sí.
const MAX_POR_MINUTO = 10;
// Cuántos turnos del historial se reenvían: bastan para seguir la
// conversación y evitan que una charla larga encarezca cada pregunta.
const MAX_TURNOS = 16;
const MAX_CHARS = 2000;
// Rondas de herramientas por pregunta, para que un bucle no dispare el gasto.
const MAX_RONDAS = 6;

type Turno = { role: 'user' | 'assistant'; content: string };

// Mensajes de la API generateContent de Gemini.
type Parte = {
  text?: string;
  thought?: boolean;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
  [k: string]: unknown;
};
type Contenido = { role: 'user' | 'model'; parts: Parte[] };

interface Respuesta {
  candidates?: Array<{ content?: Contenido; finishReason?: string }>;
  usageMetadata?: UsoGemini;
}

// POST /api/assistant — { messages: [{ role, content }] } → { reply }
export async function POST(req: Request) {
  const { caller, error: e } = await soloAdmin();
  if (e) return e;

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: 'El asistente todavía no está configurado (falta la clave de Gemini).' },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => null);
  const historial: Turno[] = (Array.isArray(body?.messages) ? body.messages : [])
    .filter(
      (m: unknown): m is Turno =>
        !!m &&
        typeof m === 'object' &&
        ((m as Turno).role === 'user' || (m as Turno).role === 'assistant') &&
        typeof (m as Turno).content === 'string' &&
        (m as Turno).content.trim() !== ''
    )
    .map((m: Turno) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }))
    .slice(-MAX_TURNOS);
  // La conversación debe empezar con el usuario y terminar con una pregunta.
  while (historial.length && historial[0].role !== 'user') historial.shift();
  if (!historial.length || historial[historial.length - 1].role !== 'user') {
    return NextResponse.json({ error: 'Escribe una pregunta.' }, { status: 400 });
  }

  const service = createServiceClient();

  const haceUnMinuto = new Date(Date.now() - 60_000).toISOString();
  const { count } = await service
    .from('ai_requests')
    .select('id', { count: 'exact', head: true })
    .eq('workshop_id', caller.workshopId)
    .gte('created_at', haceUnMinuto);
  if ((count ?? 0) >= MAX_POR_MINUTO) {
    return NextResponse.json({ error: 'Espera un momento antes de enviar otra pregunta.' }, { status: 429 });
  }

  // Saldo prepagado (0025): cada pregunta se cobra antes de responder y se
  // devuelve si el asistente no pudo contestar.
  const { preguntaIa: precio } = await leerPrecios(service);
  const pregunta = historial[historial.length - 1].content;
  const cobro = await cobrar(service, caller.workshopId, precio, 'pregunta_ia', {
    userId: caller.userId,
    note: `Asistente: ${pregunta}`.slice(0, 200),
  });
  if (!cobro.ok) {
    return NextResponse.json(
      { error: cobro.error, saldoInsuficiente: cobro.insuficiente },
      { status: cobro.insuficiente ? 402 : 500 }
    );
  }

  const { data: ws } = await service.from('workshops').select('name').eq('id', caller.workshopId).maybeSingle();
  const taller = (ws as unknown as { name: string } | null)?.name ?? 'tu taller';

  const contents: Contenido[] = historial.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const uso = { input_tokens: 0, output_tokens: 0, cost: 0 };
  let respuesta = '';

  // Cada pregunta queda anotada (tokens y costo) para el freno por minuto y
  // para ver cuánto gasta cada taller.
  const registrar = () =>
    service.from('ai_requests').insert({
      workshop_id: caller.workshopId,
      user_id: caller.userId,
      input_tokens: uso.input_tokens,
      output_tokens: uso.output_tokens,
      cost_usd: Math.round(uso.cost * 100000) / 100000,
    });

  try {
    for (let ronda = 0; ronda < MAX_RONDAS; ronda++) {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`,
        {
          method: 'POST',
          headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            // Las instrucciones y herramientas no cambian entre preguntas:
            // Gemini cachea ese comienzo solo y lo cobra al 10 %.
            systemInstruction: { parts: [{ text: instrucciones(taller) }] },
            tools: HERRAMIENTAS,
            contents,
            generationConfig: {
              // Consultar órdenes no exige razonar mucho: más rápido y más barato.
              thinkingConfig: { thinkingLevel: 'low' },
              maxOutputTokens: 4000,
            },
          }),
        }
      );
      if (!r.ok) {
        const detalle = await r.text().catch(() => '');
        console.error('[assistant] Gemini', r.status, detalle.slice(0, 300));
        throw Object.assign(new Error('Gemini'), { status: r.status });
      }
      const res = (await r.json()) as Respuesta;

      const u = res.usageMetadata ?? {};
      uso.input_tokens += u.promptTokenCount ?? 0;
      uso.output_tokens += (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0);
      uso.cost += costoUsd(u);

      const contenido = res.candidates?.[0]?.content;
      const partes = contenido?.parts ?? [];
      const llamadas = partes.filter((p) => p.functionCall);
      if (!llamadas.length) {
        respuesta = partes
          .filter((p) => p.text && !p.thought)
          .map((p) => p.text)
          .join('')
          .trim();
        break;
      }

      // El turno del modelo vuelve tal cual: trae firmas de su razonamiento
      // que Gemini exige recibir de nuevo junto con las respuestas.
      contents.push({ role: 'model', parts: partes });
      const respuestas: Parte[] = [];
      for (const p of llamadas) {
        const { name, args } = p.functionCall!;
        const salida = await ejecutarHerramienta(service, caller.workshopId, name, args ?? {});
        respuestas.push({ functionResponse: { name, response: { resultado: JSON.parse(salida) } } });
      }
      contents.push({ role: 'user', parts: respuestas });
    }
  } catch (err) {
    await registrar();
    const saldo = await devolver(service, caller.workshopId, precio, 'El asistente no pudo responder', caller.userId);
    const status = (err as { status?: number }).status;
    return NextResponse.json(
      {
        error:
          status === 429
            ? 'El asistente está muy ocupado. Intenta de nuevo en unos segundos.'
            : 'No pude responder en este momento. Intenta de nuevo.',
        saldo,
      },
      { status: 502 }
    );
  }

  await registrar();

  return NextResponse.json({
    reply: respuesta || 'No encontré una respuesta. ¿Puedes preguntarlo de otra forma?',
    saldo: cobro.saldo,
  });
}
