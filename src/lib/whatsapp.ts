// Helpers para armar enlaces "click para chatear" de WhatsApp (wa.me).
//
// wa.me necesita el número en formato internacional, solo dígitos, SIN el "+",
// espacios ni el cero inicial. Como el mercado principal es Venezuela, cuando el
// número viene en formato local (04XX... o 4XX...) se le antepone el código de
// país 58. Si ya trae código de país, se respeta.

/** Normaliza un teléfono a solo dígitos con código de país (heurística VE). */
export function waNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, '');
  if (!d) return null;

  // 04241234567 (11 díg, empieza en 0) -> 584241234567
  if (d.length === 11 && d.startsWith('0')) {
    d = '58' + d.slice(1);
  }
  // 4241234567 (10 díg, celular VE sin 0) -> 584241234567
  else if (d.length === 10 && d.startsWith('4')) {
    d = '58' + d;
  }
  // En cualquier otro caso se asume que ya incluye el código de país.

  return d;
}

/** Construye el enlace wa.me con el mensaje ya escrito, o null si no hay número. */
export function waLink(raw: string | null | undefined, text: string): string | null {
  const num = waNumber(raw);
  if (!num) return null;
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}

/** Texto final del mensaje de onboarding: mensaje + enlace del video. */
export function buildTutorialText(message: string, videoUrl: string | null): string {
  const msg = (message ?? '').trim();
  if (!videoUrl) return msg;
  return `${msg}\n\n${videoUrl}`;
}
