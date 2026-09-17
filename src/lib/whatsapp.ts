// Envío del video de bienvenida por WhatsApp.
//
// Igual que el botón "recomendar" de La Mejor Llave: en el teléfono, si el
// navegador soporta compartir archivos (Web Share API), se manda el ARCHIVO del
// video y WhatsApp lo recibe como un video con el mensaje de leyenda. En ese
// caso el usuario elige el contacto en el selector de WhatsApp (no se puede
// pre-fijar el número). En escritorio / navegadores sin soporte, se descarga el
// video y se abre el chat del número para adjuntarlo a mano.

/** Video servido desde /public (mismo origen: evita problemas de CORS al leerlo). */
export const TUTORIAL_VIDEO_PATH = '/video/tutorial-formula-taller.mp4';

/** Normaliza un teléfono a solo dígitos con código de país (heurística VE). */
export function waNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, '');
  if (!d) return null;
  // 04241234567 (11 díg, empieza en 0) -> 584241234567
  if (d.length === 11 && d.startsWith('0')) d = '58' + d.slice(1);
  // 4241234567 (10 díg, celular VE sin 0) -> 584241234567
  else if (d.length === 10 && d.startsWith('4')) d = '58' + d;
  // En cualquier otro caso se asume que ya trae código de país.
  return d;
}

/** Enlace wa.me con el mensaje ya escrito, o null si no hay número válido. */
export function waLink(raw: string | null | undefined, text: string): string | null {
  const num = waNumber(raw);
  if (!num) return null;
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}

/** Enlace directo al chat en WhatsApp Web (escritorio) con el mensaje escrito. */
export function waWebLink(raw: string | null | undefined, text: string): string | null {
  const num = waNumber(raw);
  if (!num) return null;
  return `https://web.whatsapp.com/send?phone=${num}&text=${encodeURIComponent(text)}`;
}

/**
 * ¿Es un teléfono/tablet? En Windows/Mac, Chrome y Edge también soportan
 * navigator.share con archivos, pero ahí el selector nativo abre la APP de
 * escritorio de WhatsApp, no WhatsApp Web. Como en PC preferimos WhatsApp Web
 * (descarga + arrastrar), el compartir con archivo se limita a móvil.
 */
function esMovil(): boolean {
  if (typeof navigator === 'undefined') return false;
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  if (uaData && typeof uaData.mobile === 'boolean') return uaData.mobile;
  return /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(navigator.userAgent || '');
}

/** Descarga el video a disco (fallback para PC / sin compartir de archivos). */
function descargarVideo() {
  const a = document.createElement('a');
  a.href = TUTORIAL_VIDEO_PATH;
  a.download = 'formula-taller.mp4';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export type ResultadoEnvio = 'compartido' | 'descargado';

/**
 * Comparte el video + mensaje. Devuelve 'compartido' si se usó el compartir
 * nativo del teléfono (video adjunto), o 'descargado' si cayó al fallback de
 * escritorio (video descargado + chat abierto). Nunca lanza.
 */
export async function shareTutorialVideo(
  rawNumber: string | null | undefined,
  message: string
): Promise<ResultadoEnvio> {
  const text = (message ?? '').trim();

  const nav =
    typeof navigator !== 'undefined'
      ? (navigator as Navigator & {
          canShare?: (data?: { files?: File[] }) => boolean;
          share?: (data?: { files?: File[]; text?: string }) => Promise<void>;
        })
      : null;

  // 1) Solo móvil: compartir el archivo → WhatsApp lo recibe como video adjunto.
  //    (En PC se prefiere WhatsApp Web: se cae al fallback de abajo.)
  if (esMovil() && nav && typeof nav.canShare === 'function' && typeof nav.share === 'function') {
    let file: File | null = null;
    try {
      const res = await fetch(TUTORIAL_VIDEO_PATH);
      const blob = await res.blob();
      file = new File([blob], 'formula-taller.mp4', { type: 'video/mp4' });
    } catch {
      file = null; // no se pudo leer el video: cae al fallback
    }
    if (file && nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file], text });
      } catch {
        /* el usuario canceló: no es un error */
      }
      return 'compartido';
    }
  }

  // 2) Fallback (escritorio / WhatsApp Web): descargar el video y abrir el chat
  //    directo en WhatsApp Web para que arrastres el video descargado y envíes.
  descargarVideo();
  const link = waWebLink(rawNumber, text);
  if (link) window.open(link, '_blank', 'noopener');
  return 'descargado';
}
