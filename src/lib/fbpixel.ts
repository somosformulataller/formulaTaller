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

// Candado de 24 h por usuario (este navegador): cada evento se cuenta una sola
// vez y no vuelve a contarse hasta que pasen 24 horas, aunque haga clic otra
// vez, recargue la página o vuelva otro día antes de tiempo. La hora del
// último disparo de cada evento se guarda en localStorage. Si el navegador no
// deja guardar (modo privado), al menos no se repite en esta carga de página.
const VENTANA_MS = 24 * 60 * 60 * 1000;
const CLAVE = 'ft-fb-eventos';
const enMemoria = new Map<string, number>();

function leerCandados(): Record<string, number> {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

function yaContado(name: string): boolean {
  const ultimo = leerCandados()[name] ?? enMemoria.get(name);
  return typeof ultimo === 'number' && Date.now() - ultimo < VENTANA_MS;
}

function marcarContado(name: string): void {
  const ahora = Date.now();
  enMemoria.set(name, ahora);
  try {
    const candados = leerCandados();
    candados[name] = ahora;
    // Se limpian los vencidos para que no crezca.
    for (const k of Object.keys(candados)) {
      if (ahora - candados[k] >= VENTANA_MS) delete candados[k];
    }
    localStorage.setItem(CLAVE, JSON.stringify(candados));
  } catch {
    /* sin almacenamiento: queda el candado en memoria */
  }
}

/**
 * Igual que trackFbEvent, pero cada evento se cuenta **una sola vez cada 24
 * horas por usuario** (navegador). Si hace clic de nuevo antes de que pasen
 * 24 h, no se envía nada; pasadas las 24 h, el siguiente clic vuelve a contar.
 */
export function trackFbEventOnce(name: string, custom: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;
  if (yaContado(name)) return;
  marcarContado(name);
  trackFbEvent(name, custom);
}

// Evento "paraguas": se dispara con CUALQUIERA de los 3 botones de conversión
// (ClickIniciarSesion, ClickCrearTaller o ClickRegistrarTaller) — basta con
// uno solo. Tiene su propio candado de 24 h, así que aunque toque los 3
// botones cuenta una sola vez al día.
export function trackInteraccionFormulaTaller(): void {
  if (typeof window === 'undefined') return;
  if (yaContado('interaccionFormulaTaller')) return;
  // Se marca ya (no al salir el evento) para que dos clics seguidos no lo
  // programen dos veces.
  marcarContado('interaccionFormulaTaller');
  // Pequeño desfase: si sale en el mismo instante que el evento específico
  // del mismo clic, el Pixel Helper solo alcanza a mostrar uno de los dos en
  // su panel (aunque ambos llegan a Meta).
  setTimeout(() => trackFbEvent('interaccionFormulaTaller'), 250);
}
