import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { carpetaRecordatorios } from '@/lib/admin-taller';
import { getCaller } from '@/lib/api-auth';
import { STAGE_FILES_BUCKET } from '@/lib/storage';

// La nota de voz se pasa a texto con Gemini 3.8 Flash (≈ $0,002 por minuto;
// el doble desde 2027), la misma clave del asistente. En las pruebas entendió
// mejor el audio que Flash-Lite y que el modelo «transcribe» de Gemini.
// Cambiar de proveedor es cambiar solo esta función.
const MODELO = 'gemini-3.8-flash';
// El audio va dentro de la petición, que Gemini limita a 20 MB; en base64
// ocupa un tercio más. 14 MB son más de 15 minutos de nota de voz.
const MAX_BYTES = 14 * 1024 * 1024;
// La nota no se copia palabra por palabra: se queda solo con lo que importa
// para donde se grabó. Si la persona habla de otra cosa (la comida, el
// tráfico, una llamada), eso no pasa al texto.
const COMUN =
  'Responde solo con el texto final, sin comentarios, sin títulos y sin comillas. ' +
  'No inventes nada que no se haya dicho. Si no se dijo nada relacionado o no se entiende, responde vacío.';
const PROMPTS = {
  recordatorio:
    'Esta nota de voz la grabó el administrador de un taller mecánico para crear un recordatorio a un cliente ' +
    '(un mantenimiento, un cambio de aceite, una revisión, un repuesto pendiente, una fecha, etc.). ' +
    'Escucha la nota en español y escribe SOLO lo relacionado con ese recordatorio, redactado de forma clara y breve, ' +
    'con puntuación correcta. Descarta todo lo que no tenga que ver con el recordatorio (conversaciones con otras ' +
    'personas, comida, saludos, muletillas, temas personales). ' +
    COMUN,
  condiciones:
    'Esta nota de voz la grabó el administrador de un taller mecánico al recibir un vehículo, para dejar constancia de ' +
    'sus condiciones previas: golpes, abolladuras, rayones, vidrios, luces, neumáticos, tapicería, tablero, testigos ' +
    'encendidos, accesorios, objetos dentro del carro, kilometraje, nivel de combustible y cualquier daño o detalle ' +
    'del estado del vehículo antes de trabajar en él. Escucha la nota en español y redacta SOLO esas condiciones ' +
    'previas, en frases cortas y claras (una por línea si son varias), con puntuación correcta. Descarta todo lo que ' +
    'no sea el estado del vehículo (comida, conversaciones con otras personas, el trabajo que se le va a hacer, ' +
    'precios, saludos, muletillas, temas personales). ' +
    COMUN,
  falla:
    'Esta nota de voz la grabó el administrador de un taller mecánico al recibir un vehículo, para anotar qué presenta: ' +
    'la falla o el problema por el que lo traen, los síntomas (ruidos, vibraciones, olores, fugas, humo, testigos ' +
    'encendidos, cómo arranca o frena), desde cuándo pasa, en qué condiciones aparece y lo que pide revisar el cliente. ' +
    'Escucha la nota en español y redacta SOLO eso, en frases cortas y claras (una por línea si son varias), con ' +
    'puntuación correcta. Descarta todo lo que no sea lo que presenta el vehículo (comida, conversaciones con otras ' +
    'personas, precios, saludos, muletillas, temas personales). ' +
    COMUN,
} as const;
type Modo = keyof typeof PROMPTS;
// En el recordatorio, además del texto, la IA sugiere el título.
const PROMPT_TITULO =
  'Responde en JSON con dos campos: "texto" (lo anterior) y "titulo": un título corto para el recordatorio, ' +
  'de 3 a 8 palabras, sin punto final, que diga qué hay que hacer (ej.: «Cambio de pastillas de freno», ' +
  '«Mantenimiento de los 10.000 km»). Si no se dijo nada relacionado, ambos vacíos.';
// Las notas de las condiciones van directo en la petición, sin guardarse en
// el bucket. Vercel corta los cuerpos de más de 4,5 MB.
const MAX_DIRECTO = 4 * 1024 * 1024;

export const maxDuration = 60;

// POST /api/transcribe
//   JSON { path, modo? }   — nota de un recordatorio ya subida al bucket.
//   FormData audio + modo  — nota que no se guarda (condiciones del vehículo).
export async function POST(req: Request) {
  // Los recordatorios son del administrador; las condiciones del vehículo
  // también las corrige el mecánico desde la orden.
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workshopId = caller.workshopId;
  if (!workshopId || (caller.role !== 'admin' && caller.role !== 'mechanic')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: 'La transcripción todavía no está configurada. Puedes escribir el texto a mano.' },
      { status: 503 }
    );
  }

  let modo: Modo = 'recordatorio';
  let blob: Blob;
  let nombre: string;

  if ((req.headers.get('content-type') ?? '').includes('multipart/form-data')) {
    const form = await req.formData().catch(() => null);
    const audio = form?.get('audio');
    if (!(audio instanceof Blob) || audio.size === 0) {
      return NextResponse.json({ error: 'No llegó la nota de voz' }, { status: 400 });
    }
    if (audio.size > MAX_DIRECTO) {
      return NextResponse.json({ error: 'La nota de voz es demasiado larga. Graba una más corta.' }, { status: 400 });
    }
    const m = form?.get('modo');
    if (m === 'condiciones' || m === 'falla' || m === 'recordatorio') modo = m;
    blob = audio;
    nombre = audio instanceof File ? audio.name : 'nota.webm';
  } else {
    const body = await req.json().catch(() => null);
    const path = typeof body?.path === 'string' ? body.path : '';
    if (body?.modo === 'condiciones') modo = 'condiciones';
    if (caller.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    // Solo notas del propio taller.
    if (!path.startsWith(carpetaRecordatorios(workshopId)) || path.includes('..')) {
      return NextResponse.json({ error: 'Archivo inválido' }, { status: 400 });
    }
    const service = createServiceClient();
    const { data, error } = await service.storage.from(STAGE_FILES_BUCKET).download(path);
    if (error || !data) return NextResponse.json({ error: 'No se encontró la nota de voz' }, { status: 404 });
    blob = data;
    nombre = path;
  }
  if (blob.size > MAX_BYTES) {
    return NextResponse.json({ error: 'La nota de voz es demasiado larga para transcribirla.' }, { status: 400 });
  }

  // El tipo real lo da la extensión que puso la grabadora (webm, ogg o m4a).
  const ext = nombre.split('.').pop()?.toLowerCase();
  const mimeType = ext === 'ogg' ? 'audio/ogg' : ext === 'm4a' ? 'audio/mp4' : 'audio/webm';
  const data = Buffer.from(await blob.arrayBuffer()).toString('base64');

  const inicio = Date.now();
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`,
      {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: modo === 'recordatorio' ? `${PROMPTS[modo]} ${PROMPT_TITULO}` : PROMPTS[modo] },
                { inlineData: { mimeType, data } },
              ],
            },
          ],
          // Filtrar lo que importa es poco razonamiento: el nivel bajo basta y es más rápido y barato.
          generationConfig: {
            thinkingConfig: { thinkingLevel: 'low' },
            temperature: 0,
            ...(modo === 'recordatorio' && {
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'OBJECT',
                properties: { texto: { type: 'STRING' }, titulo: { type: 'STRING' } },
                required: ['texto', 'titulo'],
              },
            }),
          },
        }),
      }
    );
    if (!res.ok) {
      const detalle = await res.text().catch(() => '');
      console.error('[transcribe] Gemini', res.status, detalle.slice(0, 300));
      return NextResponse.json(
        { error: 'No se pudo transcribir la nota. Puedes escribir el texto a mano.' },
        { status: 502 }
      );
    }
    // Para saber qué parte de la espera es de Gemini y cuál de la subida.
    console.log(`[transcribe] ${modo} ${Math.round(blob.size / 1024)} KB, Gemini ${Date.now() - inicio} ms`);
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
    };
    const text = (json.candidates?.[0]?.content?.parts ?? [])
      .filter((p) => p.text && !p.thought)
      .map((p) => p.text)
      .join('')
      .trim();
    if (modo === 'recordatorio') {
      try {
        const r = JSON.parse(text) as { texto?: unknown; titulo?: unknown };
        return NextResponse.json({
          text: typeof r.texto === 'string' ? r.texto.trim() : '',
          titulo: typeof r.titulo === 'string' ? r.titulo.trim().replace(/\.$/, '').slice(0, 120) : '',
        });
      } catch {
        // Si no vino en JSON, al menos queda el texto.
      }
    }
    return NextResponse.json({ text });
  } catch {
    return NextResponse.json(
      { error: 'No se pudo conectar con el servicio de transcripción.' },
      { status: 502 }
    );
  }
}
