# Formula Taller — PWA de Gestión de Taller Mecánico

Una Progressive Web App (PWA) fullstack construida con **Next.js 14 + Supabase** para la gestión de órdenes de servicio de un taller mecánico.

## 🚀 Stack Tecnológico

- **Frontend**: Next.js 14 (App Router) + TypeScript
- **Backend**: Next.js Route Handlers (API Routes)
- **Base de datos**: Supabase (PostgreSQL)
- **Autenticación**: Supabase Auth (email + password)
- **Estilos**: Vanilla CSS (design system propio)
- **PWA**: Web Manifest + Service Worker manual
- **Deploy**: Vercel + Supabase Cloud

---

## 📁 Estructura del Proyecto

```
src/
  app/
    login/              # Página de login (admin + mecánico)
    admin/              # Panel de administrador
      page.tsx          # Dashboard con estadísticas
      ordenes/          # Lista y detalle de órdenes
      mecanicos/        # Gestión de mecánicos
    mecanico/           # Panel de mecánico
      page.tsx          # Mis órdenes asignadas
      ordenes/[id]/     # Gestión de etapas
    tracking/[token]/   # Vista pública del cliente (sin auth)
    api/                # API Routes (backend)
  components/
    ui/                 # Button, Input, Modal, Badge
    layout/             # TopBar, BottomNav
    orders/             # OrderCard, OrderForm, StageTimeline
    mechanics/          # MechanicCard, MechanicForm
  lib/
    supabase/           # Clientes browser/server/service
    types.ts            # TypeScript types del schema
    utils.ts            # Helpers y formatters
  middleware.ts         # Protección de rutas por rol
supabase/
  migrations/
    0001_init.sql       # Schema: tablas, enums, triggers
    0002_rls.sql        # Row Level Security policies
scripts/
  create-admin.mjs     # Script para crear el admin inicial
```

---

## ⚙️ Configuración Inicial

### 1. Variables de entorno

Copia `.env.example` a `.env.local` y completa los valores:

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
NEXT_PUBLIC_SITE_URL=https://tu-app.vercel.app
```

### 2. Base de datos

Aplica las migraciones en tu proyecto Supabase:

```bash
# Opción A: Supabase CLI (recomendado)
supabase link --project-ref TU-PROJECT-REF
supabase db push

# Opción B: Copiar y ejecutar en el SQL Editor de Supabase Dashboard
# Ejecutar en orden: 0001_init.sql → 0002_rls.sql
```

### 3. Crear el administrador inicial

```bash
# Configura en .env.local (opcional, tiene defaults):
# ADMIN_EMAIL=admin@formulataller.com
# ADMIN_PASSWORD=Admin1234!
# ADMIN_NAME=Administrador

npm run seed:admin
```

### 4. Instalar y ejecutar

```bash
npm install
npm run dev        # Desarrollo en http://localhost:3000
npm run build      # Build de producción
```

---

## 🔐 Autenticación y Roles

| Rol | Acceso |
|-----|--------|
| `admin` | Panel `/admin` — CRUD completo de órdenes, gestión de mecánicos |
| `mechanic` | Panel `/mecanico` — Solo sus órdenes asignadas, gestión de etapas |
| Público | `/tracking/[token]` — Solo lectura, sin auth |

---

## 🔑 Flujo de Uso

1. **Admin** crea mecánicos en `/admin/mecanicos`
2. **Admin** o **mecánico** crea una orden con datos del cliente
3. Al guardar, se genera un **link único** de tracking (`/tracking/[token]`)
4. El link se envía por **WhatsApp** directamente desde la app
5. El **mecánico** gestiona las etapas del servicio (completar, agregar custom)
6. El **cliente** puede ver el progreso en tiempo real desde su móvil

---

## 📱 PWA

La app funciona como PWA instalable en iOS y Android:

- Manifest en `/public/manifest.webmanifest`
- Service Worker en `/public/sw.js` (cache-first estático, network-first API)
- Menú inferior (bottom navigation) para navegación móvil

---

## 🚀 Deploy en Vercel

1. Push el repo a GitHub
2. Conecta con Vercel
3. Agrega las variables de entorno en Vercel Dashboard
4. Deploy automático en cada push a `main`

### Variables requeridas en Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL` (tu URL de Vercel, ej: `https://formula-taller.vercel.app`)
