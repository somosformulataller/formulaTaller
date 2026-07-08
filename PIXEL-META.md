# 📈 Pixel de Meta (Facebook) — Estado final

Instalación del Pixel + Conversions API y eventos de conversión. Última actualización: **2026-07-08**.

---

## Estado: ✅ ACTIVO

| Componente | Estado |
|---|---|
| **Pixel del navegador** (client-side) | ✅ Activo — dispara `PageView` en cada página. |
| **Conversions API / CAPI** (server-side) | ✅ Activo — verificado (`/api/fb-event` responde `{"ok":true}`). |
| **Deduplicación** navegador ↔ servidor | ✅ Por `event_id` (mismo id en Pixel y CAPI). |
| **Conteo por usuario** | ✅ Cada evento cuenta **1 sola vez por usuario/navegador** (no infla con clics repetidos). |

- **Pixel ID:** `1688453135751029` (público; está en el código).
- **Token de la CAPI:** secreto, vive en la variable de entorno **`FB_CAPI_ACCESS_TOKEN`** en **Vercel**
  (Production). **No** está en el código.

---

## Eventos que se registran

| Evento | Cuándo se dispara | Tipo | Conteo |
|---|---|---|---|
| `PageView` | Al abrir/navegar cualquier página | Estándar | Cada vista |
| `ClickIniciarSesion` | Clic en **Entrar** (login) | Personalizado | 1 vez por usuario |
| `ClickCrearTaller` | Clic en el enlace **Crear taller** del login (inicia registro) | Personalizado | 1 vez por usuario |
| `ClickRegistrarTaller` | Clic en el botón final **Registrar mi taller** | Personalizado | 1 vez por usuario |
| `CompleteRegistration` | Cuando el registro **se completa con éxito** (conversión real) | Estándar | 1 vez por usuario |

> El botón final del formulario de registro se renombró de **"Crear taller"** a **"Registrar mi taller"**
> para no confundirlo con el enlace "Crear taller" del login.

---

## Cómo funciona
1. En el navegador, el **Pixel** dispara el evento (`fbq`) con un `event_id`.
2. En paralelo, el navegador llama a **`/api/fb-event`**, que reenvía el mismo evento (mismo `event_id`)
   a la **Conversions API** de Meta con el token secreto + IP/User-Agent + cookies `_fbp`/`_fbc`.
3. Meta **deduplica** por `event_id` (no cuenta doble el navegador y el servidor).
4. Un evento se cuenta **una sola vez por usuario** (marca en `localStorage`), aunque haga muchos clics.

---

## Dónde ver los datos
- **Meta Pixel Helper** (extensión de Chrome): confirma que el Pixel del **navegador** dispara los
  eventos en tiempo real. **No** muestra la CAPI (servidor) ni los conteos totales.
- **Meta Events Manager** (business.facebook.com → Administrador de eventos → tu pixel):
  - **"Eventos de prueba"**: ver eventos en vivo (Navegador **y** Servidor/CAPI) y su deduplicación.
  - **"Descripción general"**: conteos por evento en el tiempo.
- **Ads Manager**: conversiones atribuidas a los anuncios. Para usar los eventos como objetivo de
  campaña, crear **Conversiones personalizadas** (basadas en `ClickIniciarSesion` / `ClickCrearTaller` /
  `ClickRegistrarTaller`) y usar `CompleteRegistration` como conversión estándar.

---

## Archivos del proyecto
| Archivo | Qué hace |
|---|---|
| `src/lib/fbpixel.ts` | Pixel ID, `trackFbEvent` y `trackFbEventOnce` (1 vez por usuario). |
| `src/components/FacebookPixel.tsx` | Carga el Pixel y dispara `PageView` en cada navegación. |
| `src/app/api/fb-event/route.ts` | Relay a la Conversions API (usa `FB_CAPI_ACCESS_TOKEN`). |
| `src/app/layout.tsx` | Incluye `<FacebookPixel />`. |
| `src/middleware.ts` | Deja pública la ruta `/api/fb-event`. |
| `src/app/login/LoginForm.tsx` | Eventos `ClickIniciarSesion` y `ClickCrearTaller`. |
| `src/app/registro/RegisterForm.tsx` | Eventos `ClickRegistrarTaller` y `CompleteRegistration` + botón renombrado. |

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
- 💡 Si se quiere afinar: `CompleteRegistration` hoy cuenta 1 vez por usuario; si prefieres contar **cada
  registro real** (no por usuario), es un cambio de una línea.

> Contexto general en `CONTEXTO.md`.
