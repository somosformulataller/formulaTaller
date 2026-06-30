# 🧰 Tecnologías del proyecto — Formula Taller

Documento de referencia: **qué tecnología se usa, en qué momento y para qué**.

> ℹ️ **Sobre Python:** Python **NO** forma parte de este proyecto. No hay dependencias,
> scripts ni configuración de Python. Lo que viste fue un comando de terminal puntual
> (`python -c ...`) que se usó **una sola vez para intentar leer un JSON de respuesta**
> durante el setup — y de hecho **falló** y se descartó de inmediato. El proyecto es
> 100% **JavaScript/TypeScript** sobre Node.js. (Ver sección "Aclaraciones" al final.)

---

## 🗺️ Visión general de la arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│  NAVEGADOR (PWA instalable)                                   │
│  React + Next.js (App Router) · Tailwind · lucide-react      │
│  Service Worker (offline/caché)                              │
└───────────────┬─────────────────────────────────────────────┘
                │  HTTP (fetch)
┌───────────────▼─────────────────────────────────────────────┐
│  SERVIDOR NEXT.JS (Vercel)                                   │
│  · Route Handlers (/api/*)  ← backend                        │
│  · Middleware  ← auth + guardas de rol                       │
│  · Server Components  ← render con datos                     │
│  @supabase/ssr (sesión por cookies)                          │
└───────────────┬─────────────────────────────────────────────┘
                │  HTTPS (supabase-js / REST)
┌───────────────▼─────────────────────────────────────────────┐
│  SUPABASE                                                    │
│  · PostgreSQL (tablas, enums, triggers)                      │
│  · Auth (usuarios, JWT)                                      │
│  · Row Level Security (RLS)                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Lenguaje y runtime

### TypeScript `5.6.3`
- **Qué es:** JavaScript con tipos estáticos.
- **Cuándo se usa:** en *todo* el código fuente (`.ts` / `.tsx`).
- **Para qué:** detectar errores en tiempo de compilación; los tipos del dominio
  (`Profile`, `Order`, `OrderStage`, etc.) viven en `src/lib/types.ts` y mantienen
  sincronizados el backend, el frontend y el esquema de la base de datos.
- **Config:** `tsconfig.json` (modo `strict`, alias `@/*` → `src/*`).

### Node.js (`>=18.17`)
- **Qué es:** runtime de JavaScript en el servidor.
- **Cuándo se usa:** ejecuta el servidor de Next.js (local y en Vercel) y los scripts
  de mantenimiento (`scripts/create-admin.mjs`).
- **Para qué:** todo lo que corre fuera del navegador.

---

## 2. Framework principal

### Next.js `14.2.15` (App Router)
- **Qué es:** framework full-stack de React (frontend **y** backend en un solo proyecto).
- **Cuándo se usa:** es el esqueleto de toda la app. Concretamente:
  | Funcionalidad de Next.js | Dónde | Para qué |
  |---|---|---|
  | **App Router** (`src/app/`) | todas las pantallas | enrutado por carpetas |
  | **Server Components** | `page.tsx` de admin/mecánico/tracking | renderizar con datos ya cargados desde el servidor |
  | **Client Components** (`'use client'`) | formularios, timeline, login | interactividad en el navegador |
  | **Route Handlers** (`src/app/api/*/route.ts`) | el **backend** (API REST) | crear/editar/borrar órdenes, mecánicos y etapas |
  | **Middleware** (`src/middleware.ts`) | toda petición | refrescar sesión y proteger rutas por rol |
  | **Metadata / Viewport** (`layout.tsx`) | global | título, manifest PWA, theme-color |
- **Config:** `next.config.js` (headers para el Service Worker y el manifest, `reactStrictMode`).

### React `18.3.1`
- **Qué es:** librería de interfaces por componentes.
- **Cuándo se usa:** en cada componente visual.
- **Para qué:** construir la UI; `useState` maneja el estado local de formularios,
  el timeline de etapas y el estado del login.

---

## 3. Estilos e iconos

### Tailwind CSS `3.4.13`
- **Qué es:** framework de CSS por clases utilitarias.
- **Cuándo se usa:** disponible en toda la app; los estilos globales y variables de
  color (`--color-brand-*`, etc.) están en `src/app/globals.css`.
- **Para qué:** estilizado rápido y consistente. *(El proyecto combina utilidades de
  Tailwind con estilos en línea para los componentes más visuales.)*
- **Config:** `tailwind.config.ts`.

### PostCSS `8.4` + Autoprefixer `10.4`
- **Qué es:** procesador de CSS; Autoprefixer añade prefijos de navegador.
- **Cuándo se usa:** automáticamente en cada build (Tailwind corre como plugin de PostCSS).
- **Para qué:** compilar Tailwind y asegurar compatibilidad entre navegadores.
- **Config:** `postcss.config.js`.

### lucide-react `1.21`
- **Qué es:** set de iconos SVG como componentes React.
- **Cuándo se usa:** en toda la UI (`Wrench`, `Car`, `CheckCircle2`, `MessageCircle`…).
- **Para qué:** iconografía ligera y consistente.

---

## 4. Backend de datos: Supabase

Supabase agrupa varias piezas; aquí cada una por separado:

### PostgreSQL (base de datos)
- **Cuándo se usa:** persistencia de todo (perfiles, órdenes, etapas de tracking).
- **Para qué:** almacenar y consultar los datos.
- **Dónde se define el esquema:** `supabase/migrations/0001_init.sql`
  - **Tablas:** `profiles`, `orders`, `order_stages`.
  - **Enums:** `user_role`, `order_status`, `stage_status`.
  - **Triggers:** `set_updated_at` (timestamps), `seed_default_stages`
    (crea las etapas por defecto al crear una orden), `handle_new_user`
    (crea el perfil al registrar un usuario en Auth).

### Supabase Auth
- **Cuándo se usa:** en el login (`signInWithPassword`) y al crear mecánicos/admin
  (`auth.admin.createUser`).
- **Para qué:** autenticación con email/contraseña y manejo de sesiones (JWT).
- **Dos roles:** `admin` y `mechanic`, guardados en la tabla `profiles`.

### Row Level Security (RLS)
- **Cuándo se usa:** en cada consulta a la base de datos.
- **Para qué:** seguridad a nivel de fila — define quién puede leer/escribir qué.
- **Dónde:** `supabase/migrations/0002_rls.sql` (políticas + funciones `is_admin()` / `is_staff()`).
  - Ej.: un mecánico solo ve/edita sus órdenes asignadas; el cliente puede leer una
    orden por su `public_token` sin login.

### Librerías cliente de Supabase
| Librería | Cuándo | Para qué |
|---|---|---|
| `@supabase/ssr` `0.5.2` | servidor y navegador | crear clientes de Supabase que manejan la **sesión por cookies** (clave en Next.js) |
| `@supabase/supabase-js` `2.45.4` | por debajo de `@supabase/ssr` | SDK base para consultas, auth y storage |

- **Dónde se instancian los clientes:**
  - `src/lib/supabase/client.ts` → cliente del **navegador** (anon key).
  - `src/lib/supabase/server.ts` → cliente del **servidor** (sesión por cookies) y
    el cliente **service-role** (`createServiceClient`, salta RLS — solo en el backend).
  - `src/lib/supabase/middleware.ts` → cliente para el middleware (refresca sesión).

---

## 5. PWA (Progressive Web App)

### Web App Manifest
- **Archivo:** `public/manifest.webmanifest`.
- **Cuándo se usa:** cuando el usuario instala la app ("Agregar a pantalla de inicio").
- **Para qué:** nombre, iconos, color de tema, `display: standalone`, orientación.

### Service Worker
- **Archivo:** `public/sw.js` (registrado en `src/app/layout.tsx`).
- **Cuándo se usa:** corre en segundo plano en el navegador tras la primera visita.
- **Para qué:** caché de assets estáticos (cache-first) y datos siempre frescos para
  las APIs (network-first). Da soporte offline básico.

### Menú inferior (Bottom Nav)
- **Archivo:** `src/components/layout/BottomNav.tsx`.
- **Para qué:** navegación tipo app móvil (Inicio / Órdenes / Mecánicos).

---

## 6. Utilidades de dominio

### WhatsApp (sin librería — API web nativa)
- **Dónde:** `src/lib/utils.ts` (`buildWhatsAppLink`, `buildTrackingMessage`).
- **Cuándo se usa:** al generar una orden, para compartir el enlace de seguimiento.
- **Para qué:** construye un link `https://wa.me/<numero>?text=<mensaje>` con el
  enlace único de tracking. No requiere SDK; usa la API pública de WhatsApp.

### Enlace único de tracking
- **Cómo:** cada orden tiene un `public_token` (UUID aleatorio) generado por Postgres.
- **Para qué:** el cliente accede a `/tracking/<token>` sin login para ver el progreso.

---

## 7. Herramientas de desarrollo

| Herramienta | Cuándo se usa | Para qué |
|---|---|---|
| **ESLint** `8.57` + `eslint-config-next` | en `npm run lint` y en el build | calidad y consistencia del código |
| **dotenv** `16.4` | dev dependency | cargar variables de entorno en scripts (apoyo) |
| **@types/** (node, react, react-dom) | en desarrollo | definiciones de tipos para TypeScript |

### Scripts disponibles (`package.json`)
| Comando | Qué hace |
|---|---|
| `npm run dev` | levanta el servidor de desarrollo (localhost:3000) |
| `npm run build` | compila la app para producción |
| `npm run start` | corre la app ya compilada |
| `npm run lint` | analiza el código con ESLint |
| `npm run seed:admin` | crea el usuario administrador (vía Auth Admin API) |
| `npm run db:push` | aplica migraciones con la Supabase CLI (opcional) |
| `npm run db:reset` | reinicia la base de datos local (opcional) |

---

## 8. Infraestructura / despliegue

| Servicio | Cuándo se usa | Para qué |
|---|---|---|
| **Vercel** | en producción | hospeda la app Next.js (frontend + APIs + middleware) y redespliega en cada push |
| **Supabase (cloud)** | en producción | base de datos PostgreSQL, Auth y RLS gestionados |
| **GitHub** | control de versiones | repositorio del código y disparador de despliegues en Vercel |

> Pasos detallados de despliegue en **`DEPLOY.md`**.

---

## 9. Resumen rápido (stack)

- **Frontend:** Next.js (App Router) · React · TypeScript · Tailwind CSS · lucide-react · PWA (manifest + service worker)
- **Backend:** Next.js Route Handlers · Middleware · `@supabase/ssr`
- **Base de datos / Auth:** Supabase (PostgreSQL + Auth + RLS)
- **Infra:** Vercel + GitHub
- **Lenguaje:** TypeScript sobre Node.js
- **Integraciones:** WhatsApp (link `wa.me`, sin SDK)

---

## ❓ Aclaraciones

- **Python:** no es parte del proyecto (ni runtime, ni dependencia, ni scripts). Fue un
  comando suelto de terminal usado una vez durante el setup para formatear una respuesta
  JSON; falló y no se volvió a usar. Si lo deseas, ignóralo por completo.
- **`curl`:** tampoco es parte de la app. Se usó solo desde la terminal para **verificar**
  manualmente que Supabase y las rutas respondían correctamente durante la configuración.
