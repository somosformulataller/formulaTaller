# 🛠️ Comandos útiles — Formula Taller

Referencia rápida de los comandos usados. Última actualización: **2026-07-03**.

> **Cómo ejecutarlos aquí:** escribe el comando con un **`!` al inicio** en el chat
> (ej. `! npm run build`) y se ejecuta en esta sesión, mostrando el resultado.
> Todos se corren **en la carpeta del proyecto** y los scripts leen las claves de `.env.local`.

---

## 🔑 Superadmin de plataforma

**Crear un superadmin** (acceso al panel `/superadmin`):
```bash
npm run seed:superadmin -- <email> <password> ["Nombre"]
# ej.
npm run seed:superadmin -- somosformulataller@gmail.com "MiClave123" "Formula Taller"
```
- Si el correo ya existía, **solo lo marca como superadmin** (no cambia la contraseña).
- La contraseña debe tener **mínimo 6 caracteres**.

**Cambiar la contraseña de un superadmin (o de cualquier cuenta por su correo):**
```bash
npm run set:superadmin-password -- <email> <nueva_password>
# ej.
npm run set:superadmin-password -- somosformulataller@gmail.com "NuevaClave123"
```

> Entrar al panel: `https://formulataller.com/superadmin/login` (o el login normal, que
> redirige al panel si la cuenta es superadmin).

---

## 🚀 Subir cambios a producción

```bash
git add .
git commit -m "describe el cambio"
git push          # Vercel redespliega solo en ~1 min
```
> Si el cambio incluye una **migración de base de datos**, córrela **primero** en el
> SQL Editor de Supabase y **después** haz el `push`.

Ver en qué quedó el repositorio:
```bash
git log origin/main -1 --oneline   # último commit publicado
git status -sb                     # estado local
```

---

## 🧪 Desarrollo y verificación

```bash
npm run dev          # levantar la app en local (http://localhost:3000)
npx tsc --noEmit     # revisar tipos (TypeScript) sin compilar
npm run build        # compilar como en producción (detecta errores antes de subir)
npm run lint         # linter de Next.js
```

---

## 🗄️ Base de datos (Supabase)

**Migraciones:** se corren pegando el archivo `supabase/migrations/000X_*.sql` en
**Supabase → SQL Editor → New query → Run**. Son idempotentes (se pueden repetir).

Scripts de base de datos (requieren el CLI de Supabase enlazado):
```bash
npm run db:push      # aplica las migraciones al proyecto enlazado
npm run db:reset     # reinicia la base local (¡destructivo!)
```

**Consultas útiles** (pegar en el SQL Editor):
```sql
-- Ver a qué está atada una cuenta por su correo
select u.email, p.role, w.name as taller
from auth.users u
left join public.profiles p on p.id = u.id
left join public.workshops w on w.id = p.workshop_id
where u.email = 'somosformulataller@gmail.com';

-- Quitar el perfil de taller de una cuenta (dejarla solo superadmin)
delete from public.profiles p using auth.users u
where p.id = u.id and u.email = 'somosformulataller@gmail.com';
```

---

## 👤 Otros scripts

```bash
npm run seed:admin   # crea un admin de taller por defecto (usa variables de .env.local)
```

---

## 📄 Notas

- `.env.local` debe tener `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` y `NEXT_PUBLIC_SITE_URL`. Está en `.gitignore` (no se sube al repo).
- Los scripts `seed:superadmin` y `set:superadmin-password` **no contienen claves**: las leen de `.env.local`.
- Más contexto del proyecto en `CONTEXTO.md`; cómo subir cambios en `ACTUALIZAR-PRODUCCION.md`.
