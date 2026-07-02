import { createClient } from '@/lib/supabase/client';
import { compressImage } from '@/lib/image';
import type { StageAttachment } from '@/lib/types';

const BUCKET = 'stage-files';

// Supabase free plan caps a single upload at 50 MB. Guard client-side so a
// long video fails with a clear message instead of a cryptic storage error.
const MAX_BYTES = 50 * 1024 * 1024;

/**
 * Uploads one file to a stage:
 *  1. Compresses images in the browser (photos/gallery).
 *  2. Gets a signed upload URL from the server.
 *  3. Uploads the bytes straight to Supabase Storage (skips the serverless
 *     body limit — needed for videos/voice notes).
 *  4. Records the attachment metadata row and returns it.
 */
export async function uploadStageAttachment(
  orderId: string,
  stageId: string,
  input: File
): Promise<StageAttachment> {
  const file = input.type.startsWith('image/') ? await compressImage(input) : input;

  if (file.size > MAX_BYTES) {
    const mb = Math.round(file.size / (1024 * 1024));
    throw new Error(`El archivo pesa ${mb} MB. El máximo permitido es 50 MB.`);
  }

  // 1. Ask the server for a signed upload URL.
  const signRes = await fetch(
    `/api/orders/${orderId}/stages/${stageId}/attachments/sign`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: file.name, mime: file.type }),
    }
  );
  if (!signRes.ok) {
    const e = await signRes.json().catch(() => ({}));
    throw new Error(e.error || 'No se pudo preparar la subida');
  }
  const { path, token } = (await signRes.json()) as { path: string; token: string };

  // 2. Upload the bytes directly to Storage.
  const supabase = createClient();
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .uploadToSignedUrl(path, token, file, {
      contentType: file.type || 'application/octet-stream',
    });
  if (upErr) throw new Error(upErr.message);

  // 3. Record the metadata row.
  const metaRes = await fetch(
    `/api/orders/${orderId}/stages/${stageId}/attachments`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, name: file.name, mime: file.type || null }),
    }
  );
  if (!metaRes.ok) {
    const e = await metaRes.json().catch(() => ({}));
    throw new Error(e.error || 'No se pudo guardar el adjunto');
  }
  return metaRes.json();
}
