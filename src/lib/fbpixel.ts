// Facebook Pixel + Conversions API (CAPI) — helper de cliente.
// El Pixel ID es público (va en el navegador). El token de la CAPI es secreto y
// vive solo en el servidor (variable de entorno FB_CAPI_ACCESS_TOKEN).

export const FB_PIXEL_ID = '1688453135751029';

// Eventos "estándar" de Meta (usan fbq('track', ...)); el resto son personalizados
// (fbq('trackCustom', ...)).
const STANDARD_EVENTS = new Set([
  'PageView',
  'CompleteRegistration',
  'Lead',
  'Contact',
  'ViewContent',
  'InitiateCheckout',
  'Purchase',
]);

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fbq?: (...args: any[]) => void;
  }
}

/**
 * Registra un evento en el Pixel (navegador) y lo reenvía a la Conversions API
 * (servidor) con el MISMO event_id para que Meta los deduplique. Si el pixel o
 * la CAPI fallan, no rompe nada.
 */
export function trackFbEvent(name: string, custom: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;

  const eventId =
    window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  const fn = STANDARD_EVENTS.has(name) ? 'track' : 'trackCustom';

  try {
    window.fbq?.(fn, name, custom, { eventID: eventId });
  } catch {
    /* pixel no disponible */
  }

  // Conversions API (server-side): más fiable y no la bloquean los ad-blockers.
  try {
    fetch('/api/fb-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, eventId, url: window.location.href, custom }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

// Eventos ya disparados en ESTA carga de página (en memoria). Se reinicia al
// recargar la página (F5), a diferencia de localStorage que persiste para
// siempre.
const firedThisLoad = new Set<string>();

/**
 * Igual que trackFbEvent, pero dispara el evento **una sola vez por carga de
 * página**: si en la misma vista se hace clic varias veces (o doble-clic), se
 * cuenta una sola vez y no infla el conteo. Al **recargar** la página el
 * candado se reinicia, así que se puede volver a disparar (útil para verificar
 * en el Meta Pixel Helper). Meta, además, reporta los **usuarios únicos**.
 */
export function trackFbEventOnce(name: string, custom: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;
  if (firedThisLoad.has(name)) return; // ya disparado en esta carga de página
  firedThisLoad.add(name);
  trackFbEvent(name, custom);
}

// Evento "paraguas": se dispara con CUALQUIERA de los 3 botones de conversión
// (ClickIniciarSesion, ClickCrearTaller o ClickRegistrarTaller) — basta con
// uno solo, no hace falta completar los 3. Llamar a
// trackInteraccionFormulaTaller() junto a cada uno de los 3 eventos; el
// candado de trackFbEventOnce evita que se dispare más de una vez por carga
// de página aunque se llame varias veces (una por cada botón que se toque).
export function trackInteraccionFormulaTaller(): void {
  if (typeof window === 'undefined') return;
  if (firedThisLoad.has('interaccionFormulaTaller')) return;
  // Pequeño desfase: si sale en el mismo instante que el evento específico
  // del mismo clic, el Pixel Helper solo alcanza a mostrar uno de los dos en
  // su panel (aunque ambos llegan a Meta).
  setTimeout(() => trackFbEventOnce('interaccionFormulaTaller'), 250);
}
