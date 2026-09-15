import { createServiceClient } from '@/lib/supabase/server';

// El bucket de fotos/adjuntos de las etapas es PRIVADO (auditoría 15/09/2026,
// hallazgo 10): las fotos de los vehículos de los clientes ya no son públicas.
// Se sirven con URLs firmadas de vida corta, generadas en el servidor al
// renderizar. Los LOGOS de los talleres viven en otro bucket público aparte
// (WORKSHOP_LOGOS_BUCKET): son marca, se muestran en login/tracking sin sesión.
export const STAGE_FILES_BUCKET = 'stage-files';
export const WORKSHOP_LOGOS_BUCKET = 'workshop-logos';

// Vida de la URL firmada. 1 hora: sobra para ver/descargar mientras la página
// está abierta; al recargar se vuelven a firmar. Si alguien deja la pestaña
// abierta más de una hora, un refresco basta.
const SIGNED_URL_TTL_SECONDS = 60 * 60;

type SignableAttachment = { path?: string | null; url?: string | null };
type StageWithAttachments = { attachments?: SignableAttachment[] | null };

/**
 * Reemplaza in situ el `url` de cada adjunto de las etapas por una URL firmada
 * del bucket privado, calculada a partir de su `path`. Firma todas en UNA sola
 * llamada (createSignedUrls) para no hacer una petición por foto. Si una no se
 * puede firmar, se deja su url anterior (peor caso: imagen rota, no un crash).
 *
 * Requiere el service client: storage.objects tiene RLS sin políticas, así que
 * solo el service_role puede firmar.
 */
export async function signStageAttachments(
  service: ReturnType<typeof createServiceClient>,
  stages: StageWithAttachments[] | null | undefined
): Promise<void> {
  const all = (stages ?? []).flatMap((s) => s.attachments ?? []);
  const paths = all.map((a) => a.path).filter((p): p is string => !!p);
  if (paths.length === 0) return;

  const { data } = await service.storage
    .from(STAGE_FILES_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  if (!data) return;

  // createSignedUrls devuelve los resultados en el mismo orden que los paths.
  const signedByPath = new Map<string, string>();
  data.forEach((res, i) => {
    if (res.signedUrl) signedByPath.set(paths[i], res.signedUrl);
  });

  for (const att of all) {
    if (!att.path) continue;
    const signed = signedByPath.get(att.path);
    if (signed) att.url = signed;
  }
}
