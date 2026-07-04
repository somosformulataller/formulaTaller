# 🧊 Caché en Formula Taller (Next.js + PWA)

Guía para entender por qué a veces una página muestra datos viejos y cómo evitarlo.
Última actualización: **2026-07-04**.

---

## El problema que tuvimos (caso real)

Los **adjuntos** subidos a una orden (recepción y etapas de servicio) **no aparecían en el
tracking del cliente** hasta mucho después, o no aparecían del todo. En el panel del admin/mecánico
sí se veían al instante. Parecía un problema de "admin vs mecánico", pero **no lo era**: el guardado
funcionaba igual para ambos (verificado en la base de datos). Era **caché**.

---

## Las 3 capas de caché que nos afectan

### 1. Full Route Cache (Next.js) — la PÁGINA
Next.js, por defecto, intenta **cachear la página entera** (HTML) si la considera "estática".
Una página se vuelve **dinámica** (no cacheada) si:
- Lee **cookies** o cabeceras (ej. sesión de usuario), **o**
- declara `export const dynamic = 'force-dynamic'`.

➡️ Las vistas de **admin y mecánico** leen la sesión (cookies) → **nunca** se cachean → siempre frescas.
➡️ El **tracking** es **público (sin cookies)** → Next lo cacheaba → mostraba HTML viejo.

### 2. Data Cache (Next.js) — las CONSULTAS
Aparte de la página, Next.js cachea el **resultado de cada `fetch`** (incluidas las consultas a
Supabase, que por dentro usan `fetch`). Esta caché:
- **Persiste** entre peticiones e incluso entre despliegues (hasta que se revalida).
- **`force-dynamic` NO la desactiva por sí solo** si la librería (supabase-js) trae su propia opción
  de fetch. Por eso, aunque la página se renderizaba fresca, **los datos venían de una consulta
  cacheada vieja** (tenía los adjuntos de recepción pero no los de las etapas subidos segundos después).

➡️ Se desactiva con `export const fetchCache = 'force-no-store'` en la página.

### 3. Service Worker (PWA) — el navegador del usuario
El SW (`public/sw.js`) también cachea en el dispositivo. Ya está configurado bien:
- **Navegación de páginas y datos RSC** (navegar dentro de la app) → **network-first** (siempre red).
- **API y Supabase** → network-first.
- **`/_next/`** (chunks del build) → nunca los toca (los maneja el navegador).
- Estáticos varios (iconos, etc.) → cache-first.
- **No** recarga la app por su cuenta (se quitó esa recarga forzada).
- La versión actual de la caché es **`formula-taller-v4`**. Si se cambia la estrategia del SW,
  **subir el número de versión** (`v5`, ...) para que se limpie la caché vieja al activarse.

---

## La regla práctica

> **Página pública que debe mostrar datos siempre frescos** (tracking, y cualquier página sin login):
> agregar **las dos** líneas al principio del archivo `page.tsx`:
>
> ```ts
> export const dynamic = 'force-dynamic';     // no cachear la PÁGINA
> export const fetchCache = 'force-no-store';  // no cachear las CONSULTAS
> ```

- Las páginas **con login** (admin/mecánico) ya son dinámicas por leer cookies; normalmente basta
  con `force-dynamic` (que ya tienen) y no necesitan `fetchCache`.
- Los **endpoints de API** (`/api/...`) no se cachean como las páginas, pero si alguno hace `fetch`
  y devuelve datos que deben ser frescos, vale la misma idea (`cache: 'no-store'` en el fetch).

---

## Cómo diagnosticar "veo datos viejos"

1. **¿Es la página o los datos?** Descarga el HTML de la URL y revisa las cabeceras de respuesta:
   - `x-vercel-cache: HIT` y `age > 0` → **la página** está cacheada (CDN). Falta `force-dynamic`.
   - `x-vercel-cache: MISS`, `cache-control: no-store`, pero **el contenido sigue viejo** → es la
     **Data Cache** de las consultas. Falta `fetchCache = 'force-no-store'`.
2. **¿Los datos están bien guardados?** Consulta la base de datos directamente (Supabase SQL Editor o
   un script con el service role) para confirmar que el dato existe. Si existe en la BD pero no en la
   página → es caché, no un problema de guardado.
3. **¿Es el navegador/PWA?** Prueba en una ventana de incógnito o "hard reload"; si ahí sí aparece,
   es caché del dispositivo/SW.

---

## Qué se aplicó (2026-07-04)
- `src/app/tracking/[token]/page.tsx`: `dynamic = 'force-dynamic'` **+** `fetchCache = 'force-no-store'`.
  Con esto el tracking del cliente muestra **siempre** el estado actual (etapas y adjuntos), sin importar
  quién los subió (admin o mecánico).

> Nota: no hay **actualización en vivo** (si el cliente deja la página abierta, ve los cambios al
> **recargar**). Actualización automática sería una mejora aparte con **Supabase Realtime**.
