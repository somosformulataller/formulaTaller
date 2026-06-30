# 🚀 Despliegue a producción — Formula Taller

Guía paso a paso para subir el proyecto a producción usando **Supabase** (base de datos)
y **Vercel** (hosting de la PWA en Next.js).

> Datos del proyecto:
> - Supabase project ref: `tsvaagakjkemavhdcroy`
> - Repo GitHub: `https://github.com/somosformulataller/formulaTaller`

---

## 0. Requisitos previos

- Tener cuenta en [GitHub](https://github.com), [Supabase](https://supabase.com) y [Vercel](https://vercel.com).
- Tener `git` instalado.
- El esquema de la base de datos ya aplicado (ver paso 2).

---

## 1. Subir el código a GitHub

La carpeta local todavía no es un repositorio git. Desde la raíz del proyecto:

```bash
git init
git add .
git commit -m "Formula Taller - initial production release"
git branch -M main
git remote add origin https://github.com/somosformulataller/formulaTaller.git
git push -u origin main
```

> ⚠️ Verifica que `.env.local` **NO** se suba: ya está listado en `.gitignore`.
> Nunca subas tus claves secretas al repositorio.

Si `git push` te pide credenciales, usa tu usuario de GitHub y un
[Personal Access Token](https://github.com/settings/tokens) como contraseña.

---

## 2. Base de datos (Supabase)

> Si ya corriste `SETUP.sql`, **omite este paso** (ya está hecho).

1. Entra a [Supabase → SQL Editor](https://supabase.com/dashboard/project/tsvaagakjkemavhdcroy/sql/new).
2. Abre el archivo `SETUP.sql` de la raíz del proyecto y copia **todo** su contenido.
3. Pégalo en el editor y pulsa **RUN**.

Esto crea las tablas (`profiles`, `orders`, `order_stages`), enums, triggers y políticas RLS.
Es idempotente: puedes correrlo varias veces sin romper nada.

### Crear el usuario administrador

Con el `.env.local` configurado, desde la raíz:

```bash
npm run seed:admin
```

Crea el admin por defecto:
- **Email:** `admin@formulataller.com`
- **Password:** `Admin1234!`  ← *cámbiala tras el primer login*

(Para personalizarlo: define `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` en `.env.local`.)

---

## 3. Desplegar en Vercel

### Opción A — Conectar el repo (recomendada, redeploys automáticos)

1. Entra a [vercel.com/new](https://vercel.com/new).
2. **Import Git Repository** → selecciona `somosformulataller/formulaTaller`.
3. Framework: **Next.js** (se detecta solo). No cambies build/output.
4. En **Environment Variables**, agrega las 4 variables (ver tabla abajo).
5. Pulsa **Deploy**.

Cada `git push` a `main` desplegará automáticamente.

### Opción B — Vercel CLI

```bash
npm i -g vercel        # o usa: npx vercel
vercel login
vercel --prod
```

Sigue las preguntas (link/crear proyecto) y agrega las variables de entorno
cuando lo pida, o configúralas luego en el dashboard.

---

## 4. Variables de entorno en Vercel

En **Project → Settings → Environment Variables**, agrega estas 4
(marca *Production*, *Preview* y *Development*):

| Variable | Valor | ¿Dónde sacarla? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://tsvaagakjkemavhdcroy.supabase.co` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | tu *publishable key* (`sb_publishable_...`) | Supabase → Settings → API Keys |
| `SUPABASE_SERVICE_ROLE_KEY` | tu *secret key* (`sb_secret_...`) | Supabase → Settings → API Keys (¡secreta!) |
| `NEXT_PUBLIC_SITE_URL` | `https://TU-APP.vercel.app` | la URL que te da Vercel tras el deploy |

> 🔴 **Importante:** `NEXT_PUBLIC_SITE_URL` debe ser tu dominio real de producción.
> De ahí se construyen los enlaces de tracking que se envían por WhatsApp.
> Si lo dejas en `localhost`, los clientes no podrán abrir el seguimiento.

Tras configurar/cambiar variables, haz un **Redeploy** para que tomen efecto.

---

## 5. Configurar Supabase para producción

1. **URLs de autenticación** → [Supabase → Authentication → URL Configuration](https://supabase.com/dashboard/project/tsvaagakjkemavhdcroy/auth/url-configuration):
   - **Site URL:** `https://TU-APP.vercel.app`
   - **Redirect URLs:** agrega `https://TU-APP.vercel.app/**`
2. Verifica que **Email confirmations** esté como prefieras (los usuarios se crean
   ya confirmados desde el panel admin, así que no es crítico).

---

## 6. Verificación post-despliegue

Abre `https://TU-APP.vercel.app` y comprueba:

- [ ] Carga la pantalla de **login**.
- [ ] Entras como **admin** (`admin@formulataller.com`).
- [ ] Puedes **crear un mecánico**.
- [ ] Puedes **crear una orden** y se genera el **enlace de tracking**.
- [ ] El botón de **WhatsApp** abre el chat con el mensaje y el link correcto.
- [ ] El enlace de **tracking** abre el seguimiento (en ventana de incógnito, sin login).
- [ ] El **mecánico** entra con su cuenta y ve solo sus órdenes.
- [ ] La app se puede **instalar como PWA** (icono "Agregar a pantalla de inicio").

---

## 7. Mantenimiento

### Cambios de esquema (migraciones futuras)
Crea un nuevo archivo en `supabase/migrations/000X_descripcion.sql` y aplícalo en el
**SQL Editor** de Supabase (o con `supabase db push` si configuras la CLI).
Nunca edites una migración ya aplicada: crea una nueva.

### Actualizar el código en producción
```bash
git add .
git commit -m "describe el cambio"
git push        # Vercel redespliega solo (Opción A)
```

---

## 🔐 Checklist de seguridad

- [ ] `.env.local` **no** está en el repo (confirmado en `.gitignore`).
- [ ] La **service_role / secret key** solo vive en variables de entorno del servidor
      (nunca en código cliente ni en variables `NEXT_PUBLIC_*`).
- [ ] Contraseña del admin **cambiada** tras el primer login.
- [ ] Si compartiste algún token (Vercel/Supabase) en chats o mensajes, **rótalo**.
- [ ] RLS está **activado** en todas las tablas (lo hace `SETUP.sql`).
