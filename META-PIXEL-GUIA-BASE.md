# 🧭 Guía base: Meta Pixel + eventos de conversión + Pixel Helper

Esta guía resume **todo lo aprendido implementando el Pixel de Meta en este proyecto**
(incluyendo los errores y falsas alarmas que costó tiempo diagnosticar), para poder
**replicar la misma lógica en un proyecto nuevo sin repetir la investigación desde cero**.

No es la documentación de *este* proyecto (para eso está `PIXEL-META.md`) — es la
**plantilla/checklist reutilizable**.

---

## 1. Arquitectura general

Dos vías en paralelo, deduplicadas por `event_id`:

1. **Pixel del navegador** (`fbq(...)`) — rápido, pero lo pueden bloquear ad-blockers y
   depende de que el JS del cliente corra bien.
2. **Conversions API / CAPI** (servidor) — pega directo a la API de Meta desde tu backend,
   no la bloquean los ad-blockers, más confiable para medir de verdad.

Ambas mandan el **mismo `event_id`** para el mismo evento → Meta las deduplica y no cuenta
doble.

```
Clic del usuario
   │
   ├─→ fbq('track' | 'trackCustom', nombre, params, { eventID })   (navegador)
   │
   └─→ fetch('/api/tu-endpoint', { name, eventId, url, custom })    (tu backend)
             │
             └─→ Conversions API de Meta (con token secreto server-side)
```

---

## 2. Instalación base del Pixel

Snippet estándar de Meta, en el `<body>` del layout raíz (para que cargue en TODAS las
páginas), **inline** (no como script externo async) para garantizar que se ejecute:

```html
<script>
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
  n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
  document,'script','https://connect.facebook.net/en_US/fbevents.js');

  fbq('set', 'autoConfig', false, 'TU_PIXEL_ID');
  fbq('init', 'TU_PIXEL_ID');
</script>
```

### ⚠️ `autoConfig:false` es obligatorio si vas a usar eventos personalizados

Sin esto, Meta activa su **autocaptura** (detecta automáticamente clics en botones/forms y
dispara eventos como `SubscribedButtonClick` por su cuenta). El problema no es que rompa el
tracking — ambos eventos (el automático y el tuyo) SÍ llegan a Meta — sino que **compiten por
el mismo espacio visual en el panel "Events on this page" del Pixel Helper**, y terminas
viendo el evento automático de Meta en vez del tuyo. Apagar `autoConfig` evita esa confusión.

---

## 3. Helper de cliente (patrón reutilizable)

```ts
// lib/fbpixel.ts
export const FB_PIXEL_ID = 'TU_PIXEL_ID';

// Eventos "estándar" de Meta usan fbq('track', ...); todo lo demás es personalizado
// y usa fbq('trackCustom', ...).
const STANDARD_EVENTS = new Set([
  'PageView', 'CompleteRegistration', 'Lead', 'Contact',
  'ViewContent', 'InitiateCheckout', 'Purchase',
]);

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}

export function trackFbEvent(name: string, custom: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;

  const eventId = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  const fn = STANDARD_EVENTS.has(name) ? 'track' : 'trackCustom';

  try {
    window.fbq?.(fn, name, custom, { eventID: eventId });
  } catch { /* pixel no disponible (ad-blocker) */ }

  try {
    fetch('/api/fb-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, eventId, url: window.location.href, custom }),
      keepalive: true, // importante: sobrevive si la página navega justo después
    }).catch(() => {});
  } catch { /* ignore */ }
}

// Set en memoria: se reinicia al recargar la página (F5), a propósito — así se
// puede volver a probar sin abrir una pestaña nueva.
const firedThisLoad = new Set<string>();

export function trackFbEventOnce(name: string, custom: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;
  if (firedThisLoad.has(name)) return; // ya disparado en esta carga de página
  firedThisLoad.add(name);
  trackFbEvent(name, custom);
}
```

**Por qué "once por carga de página" y no localStorage/siempre:** evita que un doble-clic o
un re-render infle el conteo, pero permite volver a probar recargando (F5), que es justo lo
que necesitas mientras estás verificando en el Pixel Helper. Meta ya reporta "usuarios
únicos" por su cuenta, así que no hace falta perseguir eso a mano.

### Relay a la Conversions API (servidor)

```ts
// app/api/fb-event/route.ts (ejemplo Next.js)
export async function POST(req: Request) {
  const { name, eventId, url, custom } = await req.json();

  await fetch(`https://graph.facebook.com/v20.0/${FB_PIXEL_ID}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: [{
        event_name: name,
        event_id: eventId,           // MISMO id que el del navegador → deduplica
        event_time: Math.floor(Date.now() / 1000),
        event_source_url: url,
        action_source: 'website',
        user_data: {
          client_ip_address: req.headers.get('x-forwarded-for'),
          client_user_agent: req.headers.get('user-agent'),
          // + cookies _fbp / _fbc si las tienes disponibles
        },
        custom_data: custom,
      }],
      access_token: process.env.FB_CAPI_ACCESS_TOKEN, // secreto, SOLO servidor
    }),
  });

  return Response.json({ ok: true });
}
```

El token de la CAPI **nunca** va en el código ni en el cliente — vive en una variable de
entorno del servidor (Vercel: marcarla como *Sensitive*, y recordar que **hay que
redeployar** tras cambiarla, no se aplica sola).

---

## 4. Evento "paraguas" (combinación de varios eventos)

Patrón para cuando necesitas un evento extra que se dispare **solo cuando el usuario ya
completó varias acciones distintas**, sin importar el orden:

```ts
const EVENTOS_REQUERIDOS = ['EventoA', 'EventoB', 'EventoC'];

export function trackEventoComboSiCompleto(): void {
  if (typeof window === 'undefined') return;
  if (firedThisLoad.has('EventoCombo')) return;

  const yaCompleto = EVENTOS_REQUERIDOS.every((name) => firedThisLoad.has(name));
  if (!yaCompleto) return;

  // Desfase ver sección 6 — evita el choque visual en Pixel Helper.
  setTimeout(() => trackFbEventOnce('EventoCombo'), 250);
}
```

Se llama **junto a cada uno** de los eventos individuales (no en un lugar centralizado
distinto), justo después de disparar el evento correspondiente:

```ts
trackFbEventOnce('EventoA');
trackEventoComboSiCompleto(); // no-op hasta que también se disparen B y C
```

Como `firedThisLoad` es un Set a nivel de módulo, **persiste durante toda la sesión de la
pestaña** (sobrevive a navegación tipo SPA/client-side, como `router.push` en Next.js), pero
se reinicia con un F5. Por eso este patrón funciona aunque los 3 eventos ocurran en páginas
distintas dentro del mismo flujo (ej. login → registro).

---

## 5. Evitar que el navegador cancele la petición al navegar

Si un botón dispara un evento **y luego navega** (`router.push`, `location.href`, etc.), el
navegador puede **cancelar** la petición a `facebook.com/tr` a medio camino si la navegación
ocurre demasiado rápido. Solución: dar un pequeño respiro antes de navegar.

```ts
function onClick(e: React.MouseEvent) {
  e.preventDefault();
  trackFbEventOnce('MiEvento');
  setTimeout(() => router.push('/siguiente-pagina'), 400);
}
```

`fetch(..., { keepalive: true })` ya ayuda a que la llamada a tu propio backend sobreviva,
pero la petición del **pixel del navegador** (`fbq`) a `facebook.com/tr` no tiene ese
mecanismo, así que el retraso sigue siendo necesario para navegaciones inmediatas.

---

## 6. El Pixel Helper solo muestra UN evento por interacción simultánea

Descubrimiento clave de este proyecto: si **dos eventos personalizados** (`trackCustom`) se
disparan en el **mismo tick de JavaScript** (la misma línea, un clic), la extensión **Meta
Pixel Helper solo pinta uno de los dos** en su panel "Events on this page" — aunque **ambos
sí llegan a Meta** (se puede confirmar con Network o en Events Manager). Es una limitación de
la extensión, no un bug del código.

**Solución:** cuando dispares dos eventos por el mismo clic (ej. el evento específico + el
evento "paraguas" de la sección 4), sepáralos con un `setTimeout` de ~150–250ms para que la
extensión los procese como interacciones distintas.

```ts
trackFbEventOnce('EventoEspecifico');
setTimeout(() => trackFbEventOnce('EventoCombo'), 250);
```

---

## 7. Falsa alarma clásica: validación nativa del formulario

Si un evento está atado a un `onSubmit` de un `<form>` con campos `required`, y esos campos
están vacíos, **el navegador bloquea el submit ANTES de que corra tu JS** (tooltip nativo
"Please fill out this field"). El evento nunca se dispara — no es un bug de Meta ni del
código, es que el formulario nunca llegó a ejecutar el handler.

**Al probar:** siempre llena todos los campos `required` con datos de prueba (aunque sean
inválidos a propósito para no completar el flujo real), o usa un elemento sin validación
(como un `<Link>`/botón fuera de un `<form>`) para descartar esta causa primero.

---

## 8. Cómo verificar que todo funciona (en orden de confiabilidad)

1. **Network tab del navegador** (filtro `tr`) — la prueba más directa y rápida. Si ves la
   fila con `ev=NombreDelEvento` y **status 200**, la petición salió y Meta la recibió. Esta
   es la fuente de verdad para saber si el CÓDIGO dispara el evento.
2. **Meta Events Manager → tu Pixel → "Probar eventos" ("Test Events")** — la fuente de
   verdad **oficial** de Meta. Muestra Navegador y Servidor por separado, y si deduplican
   bien por `event_id`. No depende de ninguna extensión de terceros.
3. **Meta Pixel Helper** (extensión) — el más rápido de revisar visualmente, pero el **menos
   confiable**: no se refresca solo si el evento se dispara después de abrir el popup, tiene
   problemas mostrando dos eventos simultáneos (sección 6), y a veces hay que cerrarlo y
   volver a abrirlo tras cada clic para que muestre lo último. **Nunca lo uses como única
   prueba de que algo "no funciona"** — si Network y Events Manager confirman el evento, el
   Pixel Helper que no lo muestre es un problema de la extensión, no tuyo.

---

## 9. Checklist para un proyecto nuevo

- [ ] Pixel ID de Meta a mano (público, puede ir en el código cliente).
- [ ] Token de la Conversions API generado en Events Manager → guardarlo como variable de
      entorno **secreta** en el hosting (Vercel/etc.), nunca en el código.
- [ ] Snippet base del Pixel en el layout raíz, con `autoConfig:false` desde el inicio.
- [ ] `trackFbEvent` / `trackFbEventOnce` (sección 3) como helper único, reutilizado en todos
      los componentes — no reinventar la llamada a `fbq` en cada botón.
- [ ] Endpoint relay a la CAPI (sección 3), mismo `event_id` que el del navegador.
- [ ] Definir la lista de eventos de conversión reales del negocio (clics que de verdad
      importan, no cada micro-interacción).
- [ ] Si hace falta un evento "combo"/paraguas, usar el patrón de la sección 4.
- [ ] Delay antes de navegar tras disparar un evento (sección 5).
- [ ] Delay entre dos eventos que salen en el mismo clic (sección 6).
- [ ] Al probar: llenar siempre los campos `required` (sección 7) y verificar por Network +
      Events Manager antes de confiar en el Pixel Helper (sección 8).
- [ ] Mencionar el Pixel en la Política de Privacidad del sitio (es rastreo de terceros).

---

## 10. Mapa completo de archivos (ejemplo real aplicado en este proyecto)

Estos son **todos los archivos que participan** en el flujo del Pixel en este proyecto,
en el orden en que intervienen, con explicación de cada parte del código. Sirve como
plantilla de "qué archivos necesito crear/tocar" al armar esto en un proyecto nuevo.

### `src/app/layout.tsx` — layout raíz (server component)

Punto de entrada: aquí vive el `<script>` inline que inicializa el Pixel (sección 2) y se
monta el componente que dispara `PageView`.

- El `<script dangerouslySetInnerHTML>` con el snippet base de Meta + `fbq('set','autoConfig',false,...)`
  + `fbq('init', PIXEL_ID)` — corre en TODAS las páginas porque está en el layout raíz, y es
  **inline** (no `<script src="...">` externo) para que se ejecute apenas carga el HTML, sin
  depender de que un bundle JS externo termine de cargar primero.
- `<FacebookPixel />` — el componente cliente (ver siguiente) que dispara `PageView`.
- Comentario deliberado: **no** se agregó un `<noscript><img .../></noscript>` de respaldo,
  porque con JS activado el navegador lo precargaba sin usarlo nunca (warning en consola). El
  Pixel + la CAPI ya cubren a todos los visitantes con JavaScript habilitado.
- Bloque separado para el **Service Worker** (PWA): en producción lo registra, en desarrollo
  lo desregistra y limpia cachés — esto es indirectamente relevante porque un Service Worker
  mal configurado podría interceptar y romper las peticiones a `facebook.com/tr` o al propio
  `/api/fb-event`; en este proyecto se verificó (`public/sw.js`) que el `fetch` handler
  **excluye explícitamente** peticiones cross-origin y no-GET, así que nunca toca el tráfico
  del Pixel.

### `src/components/FacebookPixel.tsx` — dispara `PageView`

Componente cliente (`'use client'`) montado una sola vez en el layout raíz.

- `usePathname()` + `useRef` (`lastTracked`) — guarda la última ruta ya contada, para no
  duplicar el `PageView` si el componente se re-renderiza por otra razón sin que la ruta
  realmente haya cambiado.
- `useEffect(() => {...}, [pathname])` — se re-ejecuta cada vez que cambia la ruta (incluida
  navegación interna tipo SPA con `next/link` o `router.push`, sin recargar la página), y ahí
  compara contra `lastTracked.current` antes de llamar `fbq('track', 'PageView')`.
- Es un evento **estándar** de Meta (`track`, no `trackCustom`), por eso se llama
  directamente a `fbq` en vez de pasar por `trackFbEventOnce` — este componente no necesita
  el candado "una vez por carga" del helper porque ya tiene su propia lógica de dedup por
  ruta (y de hecho SÍ debe volver a dispararse en cada navegación, a diferencia de los
  eventos de clic).

### `src/lib/fbpixel.ts` — el helper central (toda la lógica de tracking vive aquí)

El único lugar del proyecto que llama a `fbq(...)` para eventos personalizados y arma las
llamadas a la CAPI. Nada más en el código llama a `window.fbq` directamente (salvo
`FacebookPixel.tsx` para `PageView`, ver arriba) ni hace `fetch` a Meta a mano — todo pasa
por aquí para mantener un solo punto de verdad.

- `FB_PIXEL_ID` — el ID público del Pixel (constante).
- `STANDARD_EVENTS` (`Set`) — lista blanca de nombres de eventos "estándar" de Meta. Decide
  si `trackFbEvent` usa `fbq('track', ...)` o `fbq('trackCustom', ...)`.
- `trackFbEvent(name, custom)` — la función base:
  - genera un `eventId` único (`crypto.randomUUID()` con fallback manual) — **el mismo id
    se manda al navegador y a la CAPI**, es lo que permite a Meta deduplicar.
  - llama a `window.fbq?.(fn, name, custom, { eventID: eventId })` dentro de un `try/catch`
    silencioso — si un ad-blocker eliminó `window.fbq`, no rompe la app.
  - hace `fetch('/api/fb-event', { ..., keepalive: true })` — el relay a la CAPI (ver
    siguiente archivo). `keepalive: true` es clave: permite que la petición siga en vuelo
    aunque la página navegue justo después.
- `firedThisLoad` (`Set<string>` a nivel de módulo, fuera de cualquier función/componente) —
  el "candado" en memoria. Vive mientras dure la sesión de la pestaña/módulo JS (sobrevive a
  navegación SPA), se reinicia con F5.
- `trackFbEventOnce(name, custom)` — como `trackFbEvent`, pero primero chequea/agrega en
  `firedThisLoad` para no disparar el mismo evento dos veces en la misma carga de página.
  **Esta es la función que se usa en los componentes de botones/formularios**, no
  `trackFbEvent` directamente.
- `EVENTOS_REQUERIDOS_INTERACCION` + `trackInteraccionFormulaTaller()` — el evento
  "paraguas" (patrón de la sección 4). Revisa si `ClickIniciarSesion`, `ClickCrearTaller` y
  `ClickRegistrarTaller` **ya están los 3** en `firedThisLoad` antes de disparar
  `interaccionFormulaTaller`, con el `setTimeout` de 250ms (sección 6) para que el Pixel
  Helper no colapse el evento con el que lo completó.

### `src/app/api/fb-event/route.ts` — relay a la Conversions API (servidor)

Route handler de Next.js (`POST /api/fb-event`), la mitad "servidor" del flujo.

- Lee `FB_CAPI_ACCESS_TOKEN` de las variables de entorno; si no está configurado, responde
  `{ ok: false, skipped: 'no token' }` **sin romper nada** — el Pixel del navegador sigue
  funcionando igual aunque la CAPI esté apagada.
- Parsea el body (`name`, `eventId`, `url`, `custom`) enviado por `trackFbEvent`.
- Extrae las **cookies `_fbp`/`_fbc`** (que pone el propio pixel del navegador) y la
  **IP/User-Agent** de los headers de la petición — esto mejora la "calidad de coincidencia"
  (*match quality*) que reporta Meta, ya que le da más señales para identificar al usuario
  del lado servidor.
- Arma el payload en el formato que espera la Graph API de Meta (`data: [{ event_name,
  event_time, event_id, action_source: 'website', event_source_url, user_data, custom_data }]`)
  y hace `POST` a `https://graph.facebook.com/v21.0/{PIXEL_ID}/events?access_token=...`.
- Todo el bloque de red está en `try/catch`: si Meta no responde o fallan, el endpoint igual
  devuelve 200 — un fallo de la CAPI **nunca** debe tumbar el flujo de login/registro del
  usuario real.

### `src/middleware.ts` — deja pública la ruta de la CAPI

El middleware de Next.js protege casi todas las rutas exigiendo sesión. Sin la excepción
explícita, `/api/fb-event` quedaría bloqueada para usuarios sin sesión (el caso normal: un
visitante anónimo en `/login` o `/registro` que todavía no inició sesión).

```ts
// Facebook Conversions API relay: público (se dispara desde login/registro sin sesión).
if (pathname.startsWith('/api/fb-event')) {
  return NextResponse.next();
}
```

**Este paso se olvida fácil** al copiar el patrón a un proyecto nuevo con su propio
middleware de auth — si el endpoint de la CAPI empieza a devolver 401/redirect en vez de
200, revisar esto primero.

### `src/app/login/LoginForm.tsx` — eventos del login

Componente cliente con el formulario de "Iniciar sesión".

- `handleLogin` (submit del `<form>`):
  - `trackFbEventOnce('ClickIniciarSesion')` — primera línea del handler, antes de cualquier
    `await`, para capturar la intención del clic aunque el login después falle.
  - `trackInteraccionFormulaTaller()` — evalúa si con este clic ya se completó la combinación
    de los 3 eventos (sección 4).
  - Después del `await supabase.auth.signInWithPassword(...)`, si hay error, hace `return`
    temprano (el usuario se queda en la página — los eventos ya disparados no se pierden).
  - Si el login fue exitoso, `await new Promise((r) => setTimeout(r, 400))` **antes** de
    cualquier `router.replace(...)` — el delay de la sección 5, para no cancelar las
    peticiones del Pixel a mitad de camino.
- El enlace **"Crear taller"** (no es un submit de formulario, es un `<Link>` interceptado
  con `onClick`):
  - `e.preventDefault()` — evita la navegación instantánea de Next.js.
  - `trackFbEventOnce('ClickCrearTaller')` + `trackInteraccionFormulaTaller()`.
  - `setTimeout(() => router.push('/registro'), 400)` — navega manualmente tras el delay.

### `src/app/registro/RegisterForm.tsx` — evento del registro

Componente cliente con el formulario de alta de taller.

- `handleSubmit`:
  - `trackFbEventOnce('ClickRegistrarTaller')` + `trackInteraccionFormulaTaller()` — mismo
    patrón que en el login: se disparan **antes** de cualquier validación, para capturar la
    intención de clic del usuario aunque el formulario tenga errores de validación después
    (contraseñas que no coinciden, términos no aceptados, etc.) y no llegue a mandarse al
    backend.
  - Las validaciones (`accepted`, contraseñas coincidan, longitud mínima) pueden hacer
    `return` temprano — no cancelan los eventos ya disparados arriba.
  - Si todo pasa, sigue el `fetch('/api/register', ...)` (creación real del taller, no
    relacionado al Pixel) y luego el auto sign-in.

### `PIXEL-META.md` — documentación de estado (no es código)

No participa en el runtime, pero es la referencia de **qué eventos existen actualmente y
por qué** en este proyecto específico — la tabla de eventos, el Pixel ID real, dónde ver los
datos, y los pendientes (regenerar token expuesto, crear conversiones personalizadas en
Events Manager, mencionar el Pixel en la Política de Privacidad).

---

> Este archivo (`META-PIXEL-GUIA-BASE.md`) es la plantilla reutilizable; `PIXEL-META.md` es
> el estado específico de *este* proyecto. Al iniciar un proyecto nuevo, seguir el checklist
> de la sección 9 y usar la sección 10 como mapa de "qué archivo hace qué".
