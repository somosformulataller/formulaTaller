import { createClient } from '@/lib/supabase/client';
import { compressImage } from '@/lib/image';
import { STAGE_FILES_BUCKET } from '@/lib/storage-bucket';

const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Sube la nota de voz o la imagen de un recordatorio directo al bucket
 * privado (con URL firmada, igual que los adjuntos de las etapas) y devuelve
 * su ruta. Las imágenes se comprimen antes en el navegador.
 */
export async function subirArchivoRecordatorio(input: File, kind: 'audio' | 'image'): Promise<string> {
  const file = kind === 'image' ? await compressImage(input) : input;
  if (file.size > MAX_BYTES) throw new Error('El archivo es demasiado pesado (máximo 25 MB).');

  const res = await fetch('/api/reminders/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: file.name, kind }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'No se pudo preparar la subida');
  }
  const { path, token } = (await res.json()) as { path: string; token: string };

  const supabase = createClient();
  const { error } = await supabase.storage
    .from(STAGE_FILES_BUCKET)
    .uploadToSignedUrl(path, token, file, { contentType: file.type || 'application/octet-stream' });
  if (error) throw new Error(error.message);
  return path;
}

/**
 * Pasa a texto una nota de voz quedándose solo con lo que importa: lo del
 * recordatorio, el estado del vehículo al recibirlo ('condiciones') o lo que
 * presenta, la falla por la que lo traen ('falla').
 * Recibe la ruta de una nota ya subida o el audio mismo (que no se guarda).
 * Lanza con un mensaje legible.
 */
export async function transcribir(
  nota: string | File,
  modo: 'recordatorio' | 'condiciones' | 'falla' = 'recordatorio'
): Promise<string> {
  let body: BodyInit;
  const headers: HeadersInit = {};
  if (typeof nota === 'string') {
    body = JSON.stringify({ path: nota, modo });
    headers['Content-Type'] = 'application/json';
  } else {
    const form = new FormData();
    form.append('audio', nota, nota.name);
    form.append('modo', modo);
    body = form;
  }
  const res = await fetch('/api/transcribe', { method: 'POST', headers, body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'No se pudo transcribir la nota.');
  return String(data.text ?? '');
}
