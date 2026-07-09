# 📈 Pixel de Meta (Facebook) — Estado final

Instalación del Pixel + Conversions API y eventos de conversión. Última actualización: **2026-07-09**.

---

## Estado: ✅ ACTIVO

| Componente | Estado |
|---|---|
| **Pixel del navegador** (client-side) | ✅ Activo — dispara `PageView` en cada página. |
| **Conversions API / CAPI** (server-side) | ✅ Activo — verificado (`/api/fb-event` responde `{"ok":true}`). |
| **Deduplicación** navegador ↔ servidor | ✅ Por `event_id` (mismo id en Pixel y CAPI). |
| **Conteo por clic** | ✅ Cada evento se dispara **1 sola vez por carga de página** (no infla con clics repetidos/doble-clic). Al **recargar** (F5) se reinicia y puede volver a dispararse. Meta reporta aparte los **usuarios únicos**. |

- **Pixel ID:** `1688453135751029` (público; está en el código).
- **Token de la CAPI:** secreto, vive en la variable de entorno **`FB_CAPI_ACCESS_TOKEN`** en **Vercel**
  (Production). **No** está en el código.

---

## Eventos que se registran

| Evento | Cuándo se dispara | Tipo | Conteo |
|---|---|---|---|
| `PageView` | Al abrir/navegar cualquier página | Estándar | Cada vista |
| `ClickIniciarSesion` | Clic en **Entrar** (login) | Personalizado | 1 vez por carga de página |
| `ClickCrearTaller` | Clic en el enlace **Crear taller** del login (inicia registro) | Personalizado | 1 vez por carga de página |
| `ClickRegistrarTaller` | Clic en el botón final **Registrar mi taller** | Personalizado | 1 vez por carga de página |
| `interaccionFormulaTaller` | Se dispara **junto con** cada uno de los 3 eventos anteriores (mismo clic, mismo instante) | Personalizado | 1 vez por carga de página |

> El botón final del formulario de registro se renombró de **"Crear taller"** a **"Registrar mi taller"**
> para no confundirlo con el enlace "Crear taller" del login.
>
> `interaccionFormulaTaller` es un evento "paraguas": no tiene su propio botón, sino que se
> dispara en los 3 mismos puntos que `ClickIniciarSesion` / `ClickCrearTaller` /
> `ClickRegistrarTaller`, sin importar el orden en que el usuario haga clic en cada botón. Sirve
> para tener una sola conversión que agrupe **cualquier** interacción relevante del usuario, útil
> como objetivo amplio de campaña en Ads Manager.
>
> Se dispara con un **pequeño desfase (150–250ms)** respecto al evento principal del mismo clic
> (`setTimeout`), no en el mismo instante. Motivo: cuando dos eventos personalizados salen en el
> mismo tick de JavaScript, el **Pixel Helper solo alcanza a mostrar uno de los dos** en su panel
> "Events on this page" (aunque ambos llegan a Meta correctamente — mismo problema de "un solo
> espacio visual por interacción" que `SubscribedButtonClick`, ver más abajo). Separarlos en el
> tiempo evita ese choque visual en la extensión.

---

## Cómo funciona
1. En el navegador, el **Pixel** dispara el evento (`fbq`) con un `event_id`.
2. En paralelo, el navegador llama a **`/api/fb-event`**, que reenvía el mismo evento (mismo `event_id`)
   a la **Conversions API** de Meta con el token secreto + IP/User-Agent + cookies `_fbp`/`_fbc`.
3. Meta **deduplica** por `event_id` (no cuenta doble el navegador y el servidor).
4. Cada evento de clic se dispara **una sola vez por carga de página** (candado en memoria):
   clics repetidos/doble-clic no lo cuentan otra vez. Al **recargar** (F5) el candado se reinicia,
   así se puede volver a disparar y verificar en el Pixel Helper. Meta reporta **usuarios únicos**.

---

## Dónde ver los datos
- **Meta Pixel Helper** (extensión de Chrome): confirma que el Pixel del **navegador** dispara los
  eventos en tiempo real. **No** muestra la CAPI (servidor) ni los conteos totales.
- **Meta Events Manager** (business.facebook.com → Administrador de eventos → tu pixel):
  - **"Eventos de prueba"**: ver eventos en vivo (Navegador **y** Servidor/CAPI) y su deduplicación.
  - **"Descripción general"**: conteos por evento en el tiempo.
- **Ads Manager**: conversiones atribuidas a los anuncios. Para usar los eventos como objetivo de
  campaña, crear **Conversiones personalizadas** basadas en `ClickIniciarSesion` / `ClickCrearTaller` /
  `ClickRegistrarTaller` / `interaccionFormulaTaller`.

---

## Archivos del proyecto
| Archivo | Qué hace |
|---|---|
| `src/lib/fbpixel.ts` | Pixel ID, `trackFbEvent` y `trackFbEventOnce` (1 vez por usuario). |
| `src/components/FacebookPixel.tsx` | Carga el Pixel y dispara `PageView` en cada navegación. |
| `src/app/api/fb-event/route.ts` | Relay a la Conversions API (usa `FB_CAPI_ACCESS_TOKEN`). |
| `src/app/layout.tsx` | Incluye `<FacebookPixel />`. |
| `src/middleware.ts` | Deja pública la ruta `/api/fb-event`. |
| `src/app/login/LoginForm.tsx` | Eventos `ClickIniciarSesion`, `ClickCrearTaller` e `interaccionFormulaTaller`. |
| `src/app/registro/RegisterForm.tsx` | Eventos `ClickRegistrarTaller` e `interaccionFormulaTaller` + botón renombrado. |

---

## Configuración en Vercel
- Variable **`FB_CAPI_ACCESS_TOKEN`** (Sensitive, entorno **Production**) = token largo `EAAT…`.
- ⚠️ Las variables de Vercel **solo se aplican tras un REDEPLOY** (no afectan al despliegue ya corriendo).
  Si se cambia el token, hay que **redeployar**.

---

## Pendientes / recomendaciones
- 🔐 **Regenerar el token** de la CAPI en Meta (quedó visible durante la configuración) y actualizarlo en
  Vercel + redeploy.
- 🧩 Crear las **Conversiones personalizadas** en Events Manager para usarlas como objetivo en anuncios.
- 🍪 **Privacidad:** el Pixel es rastreo de terceros (Meta). Conviene mencionarlo en la **Política de
  Privacidad** y, si aplica por región, considerar un aviso de cookies.
- 🤖 **`SubscribedButtonClick`** es un evento **automático de Meta** (autocaptura de clics). Evidencia real
  (captura del Pixel Helper) mostró que, con la autocaptura activa, Meta mostraba `SubscribedButtonClick`
  en vez de nuestros eventos propios (`ClickIniciarSesion`, etc.) en el panel "Events on this page" —
  competían por el mismo espacio. Por eso el código vuelve a incluir
  `fbq('set','autoConfig',false,'1688453135751029')` justo después de cargar el script, para que solo se
  muestren/cuenten nuestros eventos explícitos.

> Contexto general en `CONTEXTO.md`.
