# 🗂️ Arquitectura del proyecto — Formula Taller

Qué hace cada archivo y cómo se conectan según la lógica de la app. Next.js 14 (App Router) + Supabase.

---

## Flujo general (cómo viaja una petición)
```
Navegador
  → middleware.ts            (revisa sesión y rol, redirige)
  → app/**/page.tsx          (Server Component: lee datos de Supabase y los pasa como props)
  → **Client.tsx / componentes (UI interactiva en el navegador)
  → fetch → app/api/**/route.ts  (endpoints: validan permisos y escriben en Supabase)
  → Supabase (Postgres + Auth + Storage)
```
- **Server** (page.tsx, route.ts, lib/supabase/server.ts): corre en el servidor, puede usar la clave secreta.
- **Client** (`'use client'`): corre en el navegador, solo llama a los endpoints `/api`.

---

## Núcleo / configuración
| Archivo | Rol |
|---|---|
| `src/middleware.ts` | Portero: en cada ruta revisa sesión y rol; redirige admin→`/admin`, mecánico→`/mecanico`, y deja públicas `/login` y `/tracking`. |
| `src/lib/supabase/server.ts` | Crea el cliente Supabase del servidor: `createClient()` (con sesión del usuario, respeta RLS) y `createServiceClient()` (clave secreta, salta RLS). |
| `src/lib/supabase/client.ts` | Cliente Supabase para el navegador (login). |
| `src/lib/supabase/middleware.ts` | Refresca la sesión desde cookies (usado por el middleware). |
| `src/lib/types.ts` | Tipos TypeScript de todo (Profile, Order, OrderStage, StageAttachment, payloads). Fuente de verdad de los datos. |
| `src/lib/utils.ts` | Utilidades: fechas, links de WhatsApp (`buildWhatsAppLink`, mensajes de tracking y credenciales), etiquetas/colores de estado. |
| `src/lib/api-auth.ts` | Autorización de los endpoints: `getCaller()` (usuario+rol) y `canManageOrder()` (admin, o mecánico asignado). |
| `src/lib/mechanics.ts` | `listMechanicsWithEmail()`: junta `profiles` con el email de `auth.users`. |
| `src/app/layout.tsx` | Layout raíz (PWA, fuentes, estilos globales). |

---

## Autenticación
| Archivo | Rol |
|---|---|
| `src/app/login/page.tsx` + `LoginForm.tsx` | Pantalla de login; tras entrar, lee el rol y redirige a `/admin` o `/mecanico`. |
| `src/app/api/auth/callback/route.ts` | Callback de autenticación de Supabase. |
| `scripts/create-admin.mjs` | Script (`npm run seed:admin`) para crear el usuario admin inicial. |

---

## Panel ADMIN (`src/app/admin/`)
| Archivo | Rol |
|---|---|
| `layout.tsx` | Estructura del panel admin (navegación). |
| `page.tsx` + `DashboardClient.tsx` | Inicio/resumen del admin. |
| `ordenes/page.tsx` → `ordenes/OrdenesClient.tsx` | Lista TODAS las órdenes (carga datos + mecánicos) con buscador/filtro y crear. |
| `ordenes/[id]/page.tsx` → `[id]/OrderDetailClient.tsx` | Detalle de una orden: editar, estado, tracking y sus etapas. |
| `mecanicos/page.tsx` → `mecanicos/MecanicosClient.tsx` | Gestión de mecánicos (crear/editar/reenviar acceso). |

## Panel MECÁNICO (`src/app/mecanico/`)
| Archivo | Rol |
|---|---|
| `layout.tsx` | Estructura del panel del mecánico. |
| `page.tsx` → `OrdenesClient.tsx` | Lista TODAS las órdenes con filtro **Mis órdenes / Todas**; crear y autoasignarse. |
| `ordenes/[id]/page.tsx` → `[id]/OrderDetailClient.tsx` | Detalle: asignarse, editar, marcar lista y gestionar etapas. |

## Tracking del CLIENTE (público)
| Archivo | Rol |
|---|---|
| `src/app/tracking/[token]/page.tsx` → `TrackingClient.tsx` | Página pública (sin login): con el `public_token` muestra estado, etapas, descripciones y adjuntos. Usa `createServiceClient`. |

---

## Componentes reutilizables (`src/components/`)
| Archivo | Rol |
|---|---|
| `ui/Button.tsx`, `ui/Input.tsx`, `ui/Modal.tsx`, `ui/Badge.tsx` | Piezas de interfaz genéricas. |
| `layout/TopBar.tsx`, `layout/BottomNav.tsx` | Barras de navegación. |
| `orders/OrderCard.tsx` | Tarjeta de orden en las listas (WhatsApp, copiar, asignarme, estado). |
| `orders/OrderForm.tsx` | Formulario crear/editar orden (usado por admin y mecánico). |
| `orders/CopyLinkButton.tsx` | Botón "Copiar" (enlace de tracking o texto). |
| `orders/StageTimeline.tsx` | Etapas del servicio: estado, editar título/descripción, adjuntar/eliminar archivos. |
| `mechanics/MechanicCard.tsx` | Tarjeta de mecánico (email, editar, reenviar acceso, activar/eliminar). |
| `mechanics/MechanicForm.tsx` | Formulario crear/editar mecánico + panel de credenciales (copiar/WhatsApp). |

---

## Endpoints API (`src/app/api/`) — la lógica de escritura
Todos validan permisos con `lib/api-auth.ts` y escriben con el service client.
| Endpoint | Qué hace |
|---|---|
| `mechanics/route.ts` (GET/POST) | Listar (con email) y crear mecánico (crea usuario en Auth + perfil). |
| `mechanics/[id]/route.ts` (PATCH/DELETE) | Editar mecánico (nombre/teléfono/email/**contraseña**) y desactivar. |
| `orders/route.ts` (GET/POST) | Listar y crear órdenes (cualquier staff). |
| `orders/[id]/route.ts` (GET/PATCH/DELETE) | Ver, editar/asignar (staff) y eliminar (solo admin). |
| `orders/[id]/stages/route.ts` (GET/POST) | Listar y crear etapas. |
| `orders/[id]/stages/[sid]/route.ts` (PATCH/DELETE) | Cambiar estado/título/descripción y borrar etapa. |
| `orders/[id]/stages/[sid]/attachments/route.ts` (POST/DELETE) | Subir/borrar adjuntos en Storage (`stage-files`) + tabla. |
| `tracking/[token]/route.ts` | Datos públicos de tracking por token. |

---

## Relaciones de datos (lógica)
```
auth.users ─(id)─ profiles (admin | mechanic)
                     │ assigned_mechanic_id
orders ──────────────┘   (public_token → enlace de tracking del cliente)
  └── order_stages (1 orden : N etapas)
         └── stage_attachments (1 etapa : N archivos → bucket stage-files)
```
- Una **orden** se asigna a un **mecánico** y tiene varias **etapas**; cada etapa puede tener **adjuntos**.
- El **cliente** entra por el `public_token` (sin login) y ve etapas + adjuntos en tiempo real.

---

## Otros archivos
- `public/manifest.webmanifest`, `public/sw.js`, `public/icons/` → configuración PWA (instalable).
- `supabase/migrations/*.sql`, `SETUP.sql` → esquema y cambios de la base de datos.
- `next.config.js`, `tailwind.config.ts`, `tsconfig.json`, `postcss.config.js` → configuración del build.
- Documentación: `CONTEXTO.md`, `PRODUCCION.md`, `ACTUALIZAR-PRODUCCION.md`, `DNS-DOMINIO.md`, `MIGRACION.md`.
