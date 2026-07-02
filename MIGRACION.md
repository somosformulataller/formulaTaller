# 🔁 Migrar Formula Taller a otras cuentas (Supabase y Vercel)

Guía para mover el proyecto **completo** a una cuenta distinta de **Supabase** (base de datos,
tablas, usuarios, archivos) y a otra cuenta de **Vercel** (hosting + dominio).

> Datos actuales de referencia:
> - Supabase (origen) — project ref: `tsvaagakjkemavhdcroy`
> - Tablas: `workshops`, `profiles`, `orders`, `order_stages`, `stage_attachments`
> - Bucket de Storage: `stage-files` (público)
> - Repo GitHub: `somosformulataller/formulaTaller`
> - Proyecto Vercel: `formula-taller` · Dominio: `formulataller.com`
> - Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
>   `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`

> ⚠️ **Regla de oro:** haz la migración de **Supabase primero** y la de **Vercel después**
> (Vercel solo necesita apuntar sus variables a la nueva base de datos).

---

# PARTE 1 — Migrar Supabase a otra cuenta

Hay dos caminos. Elige según si necesitas conservar el historial de órdenes y los enlaces
de seguimiento que ya compartiste.

| | **Opción A — Completa (pg_dump)** | **Opción B — Limpia (empezar de cero)** |
|---|---|---|
| Conserva órdenes/datos existentes | ✅ Sí (mismos IDs y tokens) | ❌ No (arrancas vacío) |
| Conserva usuarios y contraseñas | ✅ Sí | ❌ No (se recrean con contraseñas nuevas) |
| Enlaces de tracking ya enviados siguen sirviendo | ✅ Sí | ❌ No |
| Dificultad | Media (usa terminal) | Baja (solo SQL + recrear usuarios) |
| Ideal si… | Ya estás en producción con datos reales | Aún estás probando / pocos datos |

---

## Opción A — Migración completa con `pg_dump` (recomendada si ya hay datos)

Conserva **todo**: esquema, datos, usuarios (con sus contraseñas), IDs y tokens.

### 0. Requisitos
- Tener creada la **cuenta y el proyecto NUEVO** en Supabase (vacío).
- Tener instalado **PostgreSQL client** (`pg_dump` y `psql`). En Windows: instala
  [PostgreSQL](https://www.postgresql.org/download/windows/) (te deja `pg_dump`/`psql`).
- Las **cadenas de conexión** de ambos proyectos:
  Supabase → **Settings → Database → Connection string → URI** (marca "Use connection pooling"
  desactivado para migración; usa la conexión directa en el puerto `5432`).
  Se ve así:
  `postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres`

### 1. Exportar desde el proyecto VIEJO
Abre una terminal en una carpeta de trabajo y corre (reemplaza `[PASSWORD]` y el ref viejo):

```bash
# Rol/permisos (opcional pero recomendado)
pg_dump "postgresql://postgres:[PASSWORD_VIEJO]@db.tsvaagakjkemavhdcroy.supabase.co:5432/postgres" \
  --schema=public --schema=auth --schema=storage \
  --no-owner --no-privileges \
  -f formula_dump.sql
```

Esto incluye:
- `public` → tus tablas y datos (`profiles`, `orders`, `order_stages`, `stage_attachments`).
- `auth` → los usuarios (admin y mecánicos) **con sus contraseñas encriptadas**.
- `storage` → los metadatos de los archivos (los archivos físicos se migran en el paso 4).

### 2. Importar en el proyecto NUEVO
```bash
psql "postgresql://postgres:[PASSWORD_NUEVO]@db.[REF_NUEVO].supabase.co:5432/postgres" \
  -f formula_dump.sql
```

> Si aparecen errores de "role already exists" o similares en objetos que Supabase ya crea
> por defecto, son **ignorables**: lo importante es que tus tablas, datos y usuarios entren.
> Si algo de `auth`/`storage` da conflicto, puedes reintentar solo con `--schema=public` y
> luego migrar usuarios con la Opción B (paso "Recrear usuarios").

### 3. Crear el bucket de Storage en el proyecto nuevo
En el **SQL Editor** del proyecto nuevo, corre:

```sql
insert into storage.buckets (id, name, public)
values ('stage-files', 'stage-files', true)
on conflict (id) do nothing;
```

### 4. Migrar los archivos físicos (fotos/documentos de las etapas)
Los archivos del bucket no viajan con `pg_dump`. Opciones:

- **Pocos archivos:** descárgalos del bucket viejo (Supabase → Storage → `stage-files`) y súbelos
  al bucket nuevo con la misma **ruta** (`order_id/stage_id/archivo`). Si cambian las rutas,
  actualiza la columna `stage_attachments.url` con las URLs nuevas.
- **Muchos archivos:** usa **rclone** con el endpoint S3 de Supabase
  (Settings → Storage → S3 connection) para copiar `stage-files` de un proyecto a otro.

> Si migras los archivos con la **misma ruta**, las URLs solo cambian en el dominio del proyecto
> (`https://[REF_NUEVO].supabase.co/...`). Actualiza `stage_attachments.url` con un UPDATE:
> `update stage_attachments set url = replace(url, 'tsvaagakjkemavhdcroy', '[REF_NUEVO]');`

### 5. Salta al paso "Después de migrar Supabase" (más abajo).

---

## Opción B — Migración limpia (recrear esquema y usuarios)

Más simple. Recreas la estructura con los SQL del repo y vuelves a crear los usuarios.
**No** conserva órdenes viejas ni enlaces de tracking ya enviados.

### 1. Recrear el esquema completo en el proyecto NUEVO
En el **SQL Editor** del proyecto nuevo, corre en este orden los archivos del repo:

1. `SETUP.sql` (crea tablas base, enums, triggers y políticas RLS).
2. `supabase/migrations/0003_stage_description.sql` (columna `description`).
3. `supabase/migrations/0004_stage_attachments.sql` (tabla de adjuntos + bucket `stage-files`).
4. `supabase/migrations/0005_multi_tenant.sql` (tabla `workshops` + `workshop_id`, trigger y RLS por taller).

Copia y pega el contenido de cada uno y pulsa **RUN**. Son idempotentes.

### 2. Recrear los usuarios
- **Admin:** con el `.env.local` ya apuntando al proyecto nuevo (ver siguiente sección),
  corre desde la raíz del proyecto:
  ```bash
  npm run seed:admin
  ```
- **Mecánicos:** vuelve a crearlos desde el panel de administrador (Mecánicos → Agregar),
  poniéndoles contraseña y reenviándoles el acceso por WhatsApp.

### 3. (Opcional) Migrar datos por CSV
Si quieres traer algunas órdenes: en el proyecto viejo, Table Editor → cada tabla → **Export CSV**;
en el nuevo, **Import CSV**. Respeta el orden: `profiles` → `orders` → `order_stages` →
`stage_attachments`. (Ojo: si los IDs de usuarios cambiaron, las órdenes no quedarán ligadas
a los mecánicos correctos; por eso, si necesitas conservar datos reales, mejor la Opción A.)

---

## Después de migrar Supabase (aplica a A y B)

### 1. Obtén las llaves del proyecto NUEVO
Supabase (nuevo) → **Settings → API** y **Settings → API Keys**:
- `Project URL` → `https://[REF_NUEVO].supabase.co`
- `publishable key` (`sb_publishable_...`) → será tu `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `secret key` (`sb_secret_...`) → será tu `SUPABASE_SERVICE_ROLE_KEY`

### 2. Actualiza las variables de entorno
- **Local** (`.env.local`): reemplaza URL, anon key y service key por las nuevas.
- **Vercel** (o el nuevo proyecto de Vercel, ver Parte 2): actualiza esas 3 variables y
  haz **Redeploy**.

### 3. Configura Auth del proyecto nuevo
Supabase (nuevo) → **Authentication → URL Configuration**:
- **Site URL:** `https://formulataller.com`
- **Redirect URLs:** `https://formulataller.com/**`

### 4. Verifica
- Entra a la app y comprueba login (admin y un mecánico), crear orden, tracking y adjuntos.

---

# PARTE 2 — Migrar Vercel a otra cuenta

Como la app es un proyecto Next.js conectado a GitHub, migrar es sencillo: la cuenta nueva
importa el mismo repo. Hay dos caminos.

## Opción A — Transferir el proyecto (si tienes acceso a ambas cuentas / un Team)
Vercel → proyecto `formula-taller` → **Settings → Advanced → Transfer Project** y elige la
cuenta/Team destino. (Requiere que seas miembro de ambas.)

## Opción B — Reimportar el repo en la cuenta nueva (recomendada y limpia)

### 1. Da acceso al repo desde la cuenta nueva
Inicia sesión en Vercel con la **cuenta nueva** (con su GitHub) y asegúrate de que tenga
permiso al repo `somosformulataller/formulaTaller` (Vercel → instalar/ajustar la GitHub App).

### 2. Importa el proyecto
[vercel.com/new](https://vercel.com/new) → **Import** → `somosformulataller/formulaTaller` →
Framework Next.js (autodetectado) → agrega las **4 variables de entorno** (con las llaves del
Supabase nuevo, ver Parte 1) → **Deploy**.

### 3. Mueve el dominio `formulataller.com`
Un dominio solo puede estar activo en **una** cuenta/proyecto de Vercel a la vez:
1. En el proyecto **viejo**: Settings → **Domains** → quita `formulataller.com` (y `www`).
2. En el proyecto **nuevo**: Settings → **Domains** → agrega `formulataller.com` y `www`.
3. Como usas registros **A/CNAME** en Namecheap apuntando a Vercel
   (`A @ 216.198.79.1`, `CNAME www cname.vercel-dns.com`), normalmente **no cambian**:
   Vercel revalida el dominio en la cuenta nueva. Si pide un registro **TXT** de verificación,
   agrégalo temporalmente en Namecheap y luego puedes quitarlo.
4. Vuelve a poner `www` redirigiendo a la raíz (como está hoy).

### 4. Ajusta variables y redeploy
- Confirma que `NEXT_PUBLIC_SITE_URL = https://formulataller.com` en el proyecto nuevo.
- **Redeploy** para que tome variables.

### 5. Apaga el proyecto viejo
Cuando confirmes que el nuevo funciona con el dominio: en el proyecto viejo, quítale el dominio
(ya hecho en el paso 3) y opcionalmente **elimínalo** (Settings → Advanced → Delete Project).

---

## ✅ Checklist final de la migración

- [ ] Proyecto Supabase nuevo con esquema + datos (Opción A o B).
- [ ] Bucket `stage-files` creado y archivos migrados (si aplica).
- [ ] Usuarios funcionando (admin + mecánicos).
- [ ] Auth URL Configuration del Supabase nuevo apuntando a `formulataller.com`.
- [ ] Proyecto Vercel nuevo con las 4 variables (llaves del Supabase nuevo).
- [ ] Dominio `formulataller.com` (+ `www`) movido al proyecto/cuenta nueva y con SSL activo.
- [ ] `NEXT_PUBLIC_SITE_URL = https://formulataller.com` + Redeploy.
- [ ] Prueba completa: login, crear orden, tracking, WhatsApp, adjuntos.
- [ ] Rota las **llaves viejas** de Supabase y borra tokens/keys que hayas compartido.
- [ ] (Opcional) Elimina el proyecto viejo en Supabase y en Vercel.

---

## Notas importantes
- **`.env.local` nunca se sube al repo** (está en `.gitignore`): al migrar, edítalo a mano con
  las llaves nuevas.
- Los **IDs de usuario** (`profiles.id`) son los mismos de `auth.users`. Por eso, para conservar
  órdenes ligadas a sus mecánicos, hay que migrar también el esquema `auth` (Opción A). Si recreas
  usuarios (Opción B), tendrán IDs nuevos y las órdenes viejas no quedarán ligadas.
- Si cambias de dominio (no solo de cuenta), actualiza `NEXT_PUBLIC_SITE_URL` y las URLs de Auth
  en Supabase, o los enlaces de tracking por WhatsApp apuntarán al dominio anterior.
