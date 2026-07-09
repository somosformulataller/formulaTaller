# 🎯 Evento `interaccionFormulaTaller` — lógica completa y ubicación en el código

Documento enfocado **solo en este evento**: qué es, cuándo se dispara, y exactamente en qué
archivo y qué líneas vive cada parte de su lógica. Para la guía general del Pixel ver
`META-PIXEL-GUIA-BASE.md`; para el estado y la lista completa de eventos del proyecto ver
`PIXEL-META.md`.

---

## 1. Qué es y cuándo se dispara

`interaccionFormulaTaller` es un evento personalizado **"paraguas"**: no tiene su propio
botón. Se dispara junto con **cualquiera** de los 3 eventos de conversión existentes —
**basta con un solo clic** en cualquiera de estos tres para que se cuente:

- `ClickIniciarSesion` (botón **Entrar** en `/login`)
- `ClickCrearTaller` (enlace **Crear taller** en `/login`, hacia `/registro`)
- `ClickRegistrarTaller` (botón **Registrar mi taller** en `/registro`)

No hace falta que el usuario complete los 3 — con tocar uno solo de esos botones ya se
dispara. Si en la misma carga de página toca más de uno, el evento **no se duplica** (se
cuenta una sola vez), gracias al candado de `trackFbEventOnce`. Sirve como una sola
conversión "agregada" que agrupa cualquier interacción real del usuario con los puntos de
conversión del sitio, útil como objetivo amplio de campaña en Ads Manager.

### Requisito para probarlo

Con un solo clic en **cualquiera** de los 3 botones ya debería aparecer, junto al evento
específico de ese botón, la petición de `interaccionFormulaTaller` en la pestaña Network
(filtro `tr`) — no hace falta hacer un flujo completo ni tocar los otros dos botones.

---

## 2. Dónde vive cada parte de la lógica

### `src/lib/fbpixel.ts` — el disparo del evento paraguas

```ts
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
```

Explicación línea por línea:

- **`if (typeof window === 'undefined') return;`** — protección estándar para SSR (esta
  función solo tiene sentido en el navegador).
- **`if (firedThisLoad.has('interaccionFormulaTaller')) return;`** — si el evento paraguas ya
  se disparó en esta carga de página (porque el usuario ya tocó otro de los 3 botones antes),
  no hace nada más. `firedThisLoad` es el mismo `Set` en memoria que usa `trackFbEventOnce`
  para no duplicar eventos, definido más arriba en el mismo archivo.
- **`setTimeout(() => trackFbEventOnce('interaccionFormulaTaller'), 250);`** — el disparo
  real, con 250ms de desfase respecto al clic. El desfase existe porque el evento específico
  (ej. `ClickIniciarSesion`) y este evento paraguas se disparan en el mismo clic/tick de
  JavaScript; si salieran exactamente al mismo tiempo, la extensión Meta Pixel Helper solo
  alcanza a pintar uno de los dos en su panel "Events on this page" (aunque ambos sí llegan a
  Meta — comportamiento documentado en `META-PIXEL-GUIA-BASE.md`, sección 6). Usa
  `trackFbEventOnce` (no `trackFbEvent` directo) para que quede registrado en `firedThisLoad`
  y no se pueda volver a disparar en la misma carga de página.

Esta función depende de dos cosas ya existentes en el mismo archivo, más arriba:

- `firedThisLoad` — el `Set<string>` en memoria (candado "una vez por carga de página").
- `trackFbEventOnce(name, custom)` — dispara el evento real: llama a `fbq('trackCustom', ...)`
  en el navegador y hace `fetch('/api/fb-event', ...)` hacia la Conversions API.

### `src/app/login/LoginForm.tsx` — 2 de los 3 puntos de disparo

**Import** (línea 11):
```ts
import { trackFbEventOnce, trackInteraccionFormulaTaller } from '@/lib/fbpixel';
```

**Punto 1 — botón "Entrar" (dentro de `handleLogin`, líneas 28-34):**
```ts
async function handleLogin(e: React.FormEvent) {
  e.preventDefault();
  trackFbEventOnce('ClickIniciarSesion');
  trackInteraccionFormulaTaller();
  setError(null);
  setLoading(true);
  ...
```
Ambas llamadas van **antes** de cualquier `await` (antes de intentar el login contra
Supabase), para capturar la intención del clic aunque el login después falle por credenciales
incorrectas — el `return` temprano en el bloque de error no afecta a estos dos disparos, que
ya ocurrieron.

**Punto 2 — enlace "Crear taller" (líneas 230-243):**
```tsx
<Link
  href="/registro"
  onClick={(e) => {
    // Disparar el evento y esperar ~400ms antes de navegar, para que
    // la petición del Pixel (facebook.com/tr) no se cancele.
    e.preventDefault();
    trackFbEventOnce('ClickCrearTaller');
    trackInteraccionFormulaTaller();
    setTimeout(() => router.push('/registro'), 400);
  }}
  ...
>
  Crear taller
</Link>
```
Aquí `e.preventDefault()` bloquea la navegación instantánea de Next.js para poder disparar
los eventos primero; la navegación real ocurre 400ms después vía `router.push`, dándole
tiempo a la petición del Pixel para salir antes de cambiar de página.

### `src/app/registro/RegisterForm.tsx` — el 3er punto de disparo

**Import** (línea 11):
```ts
import { trackFbEventOnce, trackInteraccionFormulaTaller } from '@/lib/fbpixel';
```

**Dentro de `handleSubmit` (líneas 35-40):**
```ts
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  // Click en "Registrar mi taller" (intención de terminar el registro).
  trackFbEventOnce('ClickRegistrarTaller');
  trackInteraccionFormulaTaller();
  setError(null);
  ...
```
Igual que en el login: ambas llamadas van antes de las validaciones del formulario
(`accepted`, contraseñas coincidan, longitud mínima), así que se disparan aunque el usuario
tenga un error de validación después y el registro no llegue a completarse en el backend.

Cada uno de los 3 puntos es **independiente**: cualquiera de los 3 dispara
`interaccionFormulaTaller` por sí solo, sin depender de los otros dos.

---

## 3. Diagrama del flujo

```
Usuario en /login
  │
  ├─ clic "Entrar" ──────────────► trackFbEventOnce('ClickIniciarSesion')
  │                                 trackInteraccionFormulaTaller()
  │                                 (250ms después) → dispara 'interaccionFormulaTaller' ✔
  │
  ├─ clic "Crear taller" ────────► trackFbEventOnce('ClickCrearTaller')
  │                                 trackInteraccionFormulaTaller() → ya se disparó antes,
  │                                 no hace nada (candado de firedThisLoad)
  │                                 (400ms después) → navega a /registro
  │
Usuario en /registro
  │
  └─ clic "Registrar mi taller" ─► trackFbEventOnce('ClickRegistrarTaller')
                                    trackInteraccionFormulaTaller() → ya se disparó antes,
                                    no hace nada
```

Con **cualquiera** de los 3 clics, en cualquier orden, alcanza para que se dispare una vez.
Los clics posteriores a los otros botones no vuelven a dispararlo (por diseño, para no
inflar el conteo).

---

## 4. Cómo verificar que está funcionando (sin depender de Pixel Helper)

1. **Network del navegador** (filtro `tr`): al hacer clic en cualquiera de los 3 botones,
   debe aparecer una fila `ev=interaccionFormulaTaller` con status 200 (además de la fila del
   evento específico de ese botón).
2. **Meta Events Manager → Probar eventos**: con esa pantalla abierta durante la prueba, debe
   aparecer `interaccionFormulaTaller` con columnas Navegador y Servidor en verde.
3. **Meta Pixel Helper** (extensión): es el más rápido de revisar a simple vista pero el
   **menos confiable** — no se refresca solo, y a veces hay que cerrar y volver a abrir el
   popup después del clic para que lo muestre. Si Network y Events Manager confirman el
   evento pero Pixel Helper no lo pinta, es un problema de la extensión, no del código (ver
   sección 3 de `META-PIXEL-GUIA-BASE.md` para más detalle de esta limitación conocida).

---

> Ver también: `PIXEL-META.md` (estado y lista completa de eventos de este proyecto) y
> `META-PIXEL-GUIA-BASE.md` (guía genérica reutilizable de todo el patrón Pixel + CAPI).
